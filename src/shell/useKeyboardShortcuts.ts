import { useEffect } from 'react';
import { useDocumentStore } from '../store/useDocument';
import { useSelectionStore } from '../store/useSelection';
import { useUIStore } from '../store/useUI';
import {
  appendToPage as cmdAppendToPage,
  deleteNode as cmdDeleteNode,
  duplicateNode as cmdDuplicateNode,
  insertSibling as cmdInsertSibling,
} from '../document/commands';
import { getAt } from '../document/tree';
import { getClipboardNode, setClipboardNode } from '../document/clipboard';
import { exportConfig, filenameFor } from '../document/io';
import type { NeucliNode } from '../document/types';

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
function copySelection(selection: {
  pageIndex: number;
  path: number[];
}): NeucliNode | null {
  const config = useDocumentStore.getState().config;
  const sections = config.pages[selection.pageIndex]?.sections ?? [];
  const node = getAt(sections, selection.path);
  if (!node) return null;
  setClipboardNode(node);
  return node;
}

/**
 * Paste a node into the current document. If something is selected the copy
 * is inserted as the next sibling (so repeated pastes stack cleanly); with no
 * selection it appends to the current page's top-level sections.
 */
function pasteNode(node: NeucliNode): void {
  const selection = useSelectionStore.getState().selection;
  const pageIndex =
    selection?.pageIndex ?? useSelectionStore.getState().pageIndex;

  useDocumentStore.getState().dispatch((c) => {
    if (selection && selection.path.length > 0) {
      return cmdInsertSibling(c, selection, node);
    }
    return cmdAppendToPage(c, pageIndex, node);
  });

  // Move selection onto the freshly pasted node so further actions target it.
  queueMicrotask(() => {
    const state = useDocumentStore.getState();
    const sections = state.config.pages[pageIndex]?.sections ?? [];
    if (selection && selection.path.length > 0) {
      const parentPath = selection.path.slice(0, -1);
      const newIndex = selection.path[selection.path.length - 1] + 1;
      useSelectionStore.getState().select({
        pageIndex,
        path: [...parentPath, newIndex],
      });
    } else {
      useSelectionStore.getState().select({
        pageIndex,
        path: [sections.length - 1],
      });
    }
  });
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
 * - Delete / Backspace: delete selected node (only when not typing)
 * - Escape: close YAML drawer if open, otherwise clear selection
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

      if (e.key === 'Escape') {
        const ui = useUIStore.getState();
        if (ui.yamlOpen) {
          ui.setYamlOpen(false);
        } else {
          useSelectionStore.getState().clear();
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

      if (mod && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        useDocumentStore.getState().dispatch((c) => {
          const result = cmdDuplicateNode(c, selection);
          if (!result) return null;
          // Move selection onto the duplicate so successive Cmd+D stacks copies.
          queueMicrotask(() =>
            useSelectionStore.getState().select({
              pageIndex: selection.pageIndex,
              path: result.newPath,
            }),
          );
          return result.config;
        });
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        useDocumentStore.getState().dispatch((c) => cmdDeleteNode(c, selection));
        useSelectionStore.getState().clear();
        return;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
