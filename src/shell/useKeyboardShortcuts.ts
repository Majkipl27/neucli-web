import { useEffect } from 'react';
import { useDocumentStore } from '../store/useDocument';
import { selectedPaths, useSelectionStore } from '../store/useSelection';
import { useUIStore } from '../store/useUI';
import {
  deleteNode as cmdDeleteNode,
  insertNode as cmdInsertNode,
} from '../document/commands';
import { deleteMany, duplicateMany, groupMany, ungroup, areSiblings, normalizePaths } from '../document/multi';
import { getAt, parentPath } from '../document/tree';
import { canvasDocument } from '../canvas/registry';
import { elementFor } from '../canvas/interaction';
import { canvasGestureActive } from '../canvas/useCanvasInteractions';
import { getClipboardNode, setClipboardNode } from '../document/clipboard';
import { exportConfig, filenameFor } from '../document/io';
import type { Node, Path, Selection } from '../document/types';

/**
 * Returns true when the user is typing in a field; prevents shortcuts from
 * hijacking Delete / Backspace / Escape in inputs.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

/** Serialize the currently-selected node into the in-memory clipboard. */
function copySelection(selection: Selection): Node | null {
  const config = useDocumentStore.getState().config;
  const node = getAt(config.pages[selection.pageIndex]?.sections ?? [], selection.path);
  if (!node) return null;
  setClipboardNode(node);
  return node;
}

/**
 * Paste after the selection (so repeated pastes stack), or at the end of the
 * page with nothing selected, then select the pasted node.
 */
function pasteNode(node: Node): void {
  const { selection, pageIndex, select } = useSelectionStore.getState();
  let path: Path | null = null;
  useDocumentStore.getState().dispatch((c) => {
    const sections = c.pages[pageIndex]?.sections ?? [];
    if (selection && selection.pageIndex === pageIndex) {
      const idx = selection.path[selection.path.length - 1] as number;
      path = [...selection.path.slice(0, -1), idx + 1];
    } else {
      path = [sections.length];
    }
    return cmdInsertNode(c, pageIndex, path, node);
  });
  if (path) select({ pageIndex, path });
}

/** First child of a node: its children, else its first non-empty slot. */
function firstChild(node: Node, path: Path): Path | null {
  const children = (node as { children?: Node[] }).children;
  if (children?.length) return [...path, 0];
  for (const [name, list] of Object.entries((node as { slots?: Record<string, Node[]> }).slots ?? {})) {
    if (list.length) return [...path, name, 0];
  }
  return null;
}

/**
 * The wrapper for Cmd+G: a frame that keeps the parent's flow (row stays a
 * row, with the same gap) so grouping doesn't rearrange anything.
 */
function groupFrame(firstPath: Path): Record<string, unknown> {
  const el = elementFor(canvasDocument(), firstPath)?.parentElement;
  const frame: Record<string, unknown> = { name: 'Group' };
  if (!el) return frame;
  const cs = el.ownerDocument.defaultView!.getComputedStyle(el);
  const row = cs.display.includes('flex') && cs.flexDirection.startsWith('row');
  const gap = Math.round(parseFloat(row ? cs.columnGap : cs.rowGap) || 0);
  const layout: Record<string, unknown> = {};
  if (row) layout.direction = 'row';
  if (gap > 0) layout.gap = gap;
  if (Object.keys(layout).length) frame.layout = layout;
  return frame;
}

function downloadYaml(): void {
  const config = useDocumentStore.getState().config;
  const yaml = exportConfig(config);
  const blob = new Blob([yaml], { type: 'text/yaml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filenameFor(config);
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Global keyboard shortcuts. Mounted once at the app root.
 *
 * - Ctrl/Cmd+Z: undo
 * - Ctrl/Cmd+Shift+Z, Ctrl+Y: redo
 * - Ctrl/Cmd+S: download YAML (intercepts the browser's "Save Page" dialog)
 * - Ctrl/Cmd+D: duplicate selected node
 * - Ctrl/Cmd+C / X / V: copy / cut / paste subtree (skipped while typing)
 * - Ctrl/Cmd + "+" / "-" / "0": zoom the canvas in / out / to 100%
 * - Shift+1 / Shift+2: zoom to fit / zoom to selection
 * - Delete / Backspace: delete the selected nodes (only when not typing)
 * - Enter / Shift+Enter: select first child / parent; Enter on text edits it
 * - Ctrl/Cmd+G: wrap the selected siblings in a frame; Ctrl/Cmd+Shift+G: unwrap a frame
 * - Escape: close YAML drawer if open, otherwise select the parent, or clear at the top
 */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      const typing = isTypingTarget(e.target);

      if (mod && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) useDocumentStore.getState().redo();
        else useDocumentStore.getState().undo();
        return;
      }

      if (mod && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        useDocumentStore.getState().redo();
        return;
      }

      if (mod && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        downloadYaml();
        return;
      }

      // Zoom. `=`/`+` pair handles both bare-key and shifted layouts; `-` is
      // reported as itself on every layout we care about.
      if (mod && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        useUIStore.getState().zoomIn();
        return;
      }
      if (mod && e.key === '-') {
        e.preventDefault();
        useUIStore.getState().zoomOut();
        return;
      }
      if (mod && e.key === '0') {
        e.preventDefault();
        useUIStore.getState().resetZoom();
        return;
      }

      if (!mod && e.shiftKey && !typing && (e.code === 'Digit1' || e.code === 'Digit2')) {
        e.preventDefault();
        if (e.code === 'Digit1') useUIStore.getState().requestFit();
        else useUIStore.getState().requestFocus();
        return;
      }

      if (e.key === 'Escape') {
        // A drag or resize on the canvas handles its own Esc (cancel).
        if (canvasGestureActive() || e.defaultPrevented) return;
        const ui = useUIStore.getState();
        const sel = useSelectionStore.getState();
        if (ui.yamlOpen) {
          ui.setYamlOpen(false);
        } else if (!typing && sel.selection && parentPath(sel.selection.path).length > 0) {
          e.preventDefault();
          sel.selectPath(parentPath(sel.selection.path));
        } else {
          sel.clear();
          // Drop focus so the next keystroke isn't captured by whatever input
          // stole focus earlier; e.g. after closing a form.
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
        }
        return;
      }

      // Selection-scoped shortcuts bail out when the user is in a text field
      // so browser copy/paste and text editing keep working normally.
      if (typing) return;

      const selection = useSelectionStore.getState().selection;

      // Paste works even without a selection: it appends to the current page.
      if (mod && (e.key === 'v' || e.key === 'V')) {
        const node = getClipboardNode();
        if (!node) return;
        e.preventDefault();
        pasteNode(node);
        return;
      }

      if (!selection) return;

      if (mod && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        copySelection(selection);
        return;
      }

      if (mod && (e.key === 'x' || e.key === 'X')) {
        e.preventDefault();
        const copied = copySelection(selection);
        if (copied) {
          useDocumentStore.getState().dispatch((c) => cmdDeleteNode(c, selection));
          useSelectionStore.getState().clear();
        }
        return;
      }

      const paths = selectedPaths();

      if (mod && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        let copies: Path[] = [];
        useDocumentStore.getState().dispatch((c) => {
          const result = duplicateMany(c, selection.pageIndex, paths);
          if (!result) return null;
          copies = result.newPaths;
          return result.config;
        });
        // Select the copies so successive Cmd+D stacks more.
        if (copies.length) useSelectionStore.getState().selectMany(copies);
        return;
      }

      if (mod && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        const sel = useSelectionStore.getState();
        if (e.shiftKey) {
          let children: Path[] = [];
          useDocumentStore.getState().dispatch((c) => {
            const result = ungroup(c, selection.pageIndex, selection.path);
            if (!result) return null;
            children = result.newPaths;
            return result.config;
          });
          if (children.length) sel.selectMany(children);
          else useUIStore.getState().flash('Only a frame can be unwrapped.');
          return;
        }
        const targets = normalizePaths(paths);
        if (!areSiblings(targets)) {
          useUIStore.getState().flash('Group works on layers that share a parent.');
          return;
        }
        let wrapped: Path | null = null;
        useDocumentStore.getState().dispatch((c) => {
          const result = groupMany(c, selection.pageIndex, targets, groupFrame(targets[0]));
          if (!result) return null;
          wrapped = result.newPath;
          return result.config;
        });
        if (wrapped) sel.selectPath(wrapped);
        return;
      }

      if (e.key === 'Enter' && !mod) {
        e.preventDefault();
        const config = useDocumentStore.getState().config;
        const sections = config.pages[selection.pageIndex]?.sections ?? [];
        const node = getAt(sections, selection.path);
        if (!node) return;
        if (e.shiftKey) {
          const up = parentPath(selection.path);
          if (up.length) useSelectionStore.getState().selectPath(up);
          return;
        }
        const down = firstChild(node, selection.path);
        if (down) useSelectionStore.getState().selectPath(down);
        else useUIStore.getState().requestEdit();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        useDocumentStore.getState().dispatch((c) => deleteMany(c, selection.pageIndex, paths));
        useSelectionStore.getState().clear();
        return;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
