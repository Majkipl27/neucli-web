/**
 * Direct manipulation on the canvas: Figma-style click / Shift+click /
 * Cmd+click selection, double-click to go deeper or edit text, drag to move
 * (reorder inside auto layout or drop into another frame), and resize
 * handles. Every gesture is one undo step.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import { isInstance, validate } from 'neucli/core';
import { useDocumentStore } from '../store/useDocument';
import { selectedPaths, useSelectionStore } from '../store/useSelection';
import { useUIStore } from '../store/useUI';
import { getAt, isAncestorOrSelf, pathEquals, pathKey, updateAt } from '../document/tree';
import { setStyle } from '../document/style';
import { moveMany, normalizePaths } from '../document/multi';
import { patchNode, setInstanceProp } from '../document/commands';
import type { Config, Node, Path } from '../document/types';
import type { CanvasPointer } from './CanvasFrame';
import type { Handle } from './Overlay';
import {
  childToward, clickTarget, deepestAt, elementFor, hasEditableContent, propTextAt, rectOf, resolveDrop,
} from './interaction';
import type { Drop, Rect, TextTarget } from './interaction';
import { notifyLayout } from './layoutBus';
import { rootsOf, scopeComponent, withRoots } from '../document/scope';
import { boundProp, setPropDefault } from '../document/components';

const DRAG_START_PX = 4; // on screen
const SPRING_MS = 500;

type Gesture =
  | { kind: 'press'; x: number; y: number; target: Path; collapseTo: Path | null }
  | { kind: 'move'; paths: Path[]; sibling: Path | null; siblingSince: number; last: { x: number; y: number }; timer?: ReturnType<typeof setTimeout> }
  | { kind: 'resize'; handle: Handle; path: Path; el: HTMLElement; start: Rect; x: number; y: number; prevStyle: string };

interface EditState {
  target: TextTarget;
  shown: string;
  cleanup: () => void;
}

/** The live gesture of the mounted canvas, so global shortcuts can stay out of its way (Esc cancels a drag). */
let liveGesture: { current: unknown } | null = null;

export function canvasGestureActive(): boolean {
  return !!liveGesture?.current;
}

export interface Interactions {
  onPointer: (p: CanvasPointer) => void;
  onHandleDown: (handle: Handle, event: React.MouseEvent) => void;
  drop: Drop | null;
  dropInvalid: boolean;
  editing: boolean;
  renderKey: number;
  /** Live size while resizing, page px. */
  resizing: { w: number; h: number } | null;
  /** A move drag is in progress (the canvas shows drop targets for empty named slots). */
  moving: boolean;
}

export function useCanvasInteractions(doc: Document | null, sizerRef: React.RefObject<HTMLDivElement | null>): Interactions {
  const gesture = useRef<Gesture | null>(null);
  liveGesture = gesture;
  const edit = useRef<EditState | null>(null);
  const dropCache = useRef<{ key: string; result: { config: Config; newPaths: Path[] } | null; invalid: boolean } | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);
  const [dropInvalid, setDropInvalid] = useState(false);
  const [editing, setEditing] = useState(false);
  const [renderKey, setRenderKey] = useState(0);
  const [resizing, setResizing] = useState<{ w: number; h: number } | null>(null);
  const [moving, setMoving] = useState(false);

  const zoom = () => useUIStore.getState().zoom;
  const pageIndex = () => useSelectionStore.getState().pageIndex;
  const rawConfig = () => useDocumentStore.getState().config;

  /** Editor client px -> page px. */
  const toPage = useCallback((clientX: number, clientY: number) => {
    const s = sizerRef.current?.getBoundingClientRect();
    if (!s) return { x: clientX, y: clientY };
    return { x: (clientX - s.left) / zoom(), y: (clientY - s.top) / zoom() };
  }, [sizerRef]);

  // --- text editing --------------------------------------------------------------

  const finishEdit = useCallback((commit: boolean) => {
    const state = edit.current;
    if (!state) return;
    edit.current = null;
    const { target, shown } = state;
    const text = target.el.innerText.replace(/\n$/, '');
    state.cleanup();
    setEditing(false);
    if (commit && text !== shown) {
      const sel = { pageIndex: pageIndex(), path: target.path };
      useDocumentStore.getState().dispatch((c) => {
        if (target.kind === 'prop') return setInstanceProp(c, sel, target.prop, text);
        // In a main component, text bound to a prop (`{title}`) edits that prop's default.
        const component = scopeComponent(c, sel.pageIndex);
        const bound = component ? boundProp(getAt(rootsOf(c, sel.pageIndex), sel.path)) : null;
        if (component && bound) return setPropDefault(c, component, bound, text);
        return patchNode(c, sel, { content: text });
      });
    }
    // The browser edited React's DOM; rebuild the page from the document.
    setRenderKey((k) => k + 1);
  }, []);

  const startEdit = useCallback((target: TextTarget) => {
    if (edit.current) finishEdit(true);
    const el = target.el;
    const shown = el.innerText;
    el.setAttribute('contenteditable', 'plaintext-only');
    el.setAttribute('spellcheck', 'false');
    const prevOutline = el.style.outline;
    el.style.outline = 'none';
    el.style.cursor = 'text';
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        finishEdit(false);
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        finishEdit(true);
      }
    };
    const onBlur = () => finishEdit(true);
    el.addEventListener('keydown', onKey);
    el.addEventListener('blur', onBlur);
    edit.current = {
      target,
      shown,
      cleanup: () => {
        el.removeEventListener('keydown', onKey);
        el.removeEventListener('blur', onBlur);
        el.removeAttribute('contenteditable');
        el.removeAttribute('spellcheck');
        el.style.outline = prevOutline;
        el.style.cursor = '';
      },
    };
    setEditing(true);
    el.focus();
    const sel = el.ownerDocument.getSelection();
    sel?.selectAllChildren(el);
  }, [finishEdit]);

  /** Enter on a selected text node starts editing it. */
  const editRequest = useUIStore((s) => s.editRequest);
  useEffect(() => {
    if (editRequest === 0 || !doc) return;
    const sel = useSelectionStore.getState().selection;
    if (!sel) return;
    const node = getAt(rootsOf(rawConfig(), sel.pageIndex), sel.path);
    const el = elementFor(doc, sel.path) as HTMLElement | null;
    if (node && el && hasEditableContent(node)) startEdit({ kind: 'content', path: sel.path, el });
  }, [editRequest, doc, startEdit]);

  // Leaving the page or changing the document under an edit commits it.
  useEffect(() => () => finishEdit(true), [doc, finishEdit]);

  // --- dropping --------------------------------------------------------------------

  const computeDrop = useCallback((g: Extract<Gesture, { kind: 'move' }>, x: number, y: number) => {
    if (!doc) return;
    const config = rawConfig();
    const idx = pageIndex();
    const now = Date.now();
    const res = resolveDrop(doc, config, idx, g.paths, x, y, (sib) => pathEquals(sib, g.sibling) && now - g.siblingSince >= SPRING_MS);
    if (!res) return;
    if (!pathEquals(res.sibling, g.sibling)) {
      g.sibling = res.sibling;
      g.siblingSince = now;
      clearTimeout(g.timer);
      if (res.sibling) {
        // Re-check once the spring delay passes, even if the pointer rests.
        g.timer = setTimeout(() => {
          if (gesture.current === g) computeDrop(g, g.last.x, g.last.y);
        }, SPRING_MS + 20);
      }
    }
    const key = `${pathKey(res.drop.list)}|${res.drop.index}`;
    if (dropCache.current?.key !== key) {
      const result = moveMany(config, idx, g.paths, res.drop.list, res.drop.index);
      const invalid = !!result && validate(result.config).errors.length > 0;
      dropCache.current = { key, result, invalid };
    }
    setDrop(res.drop);
    setDropInvalid(dropCache.current.invalid);
  }, [doc]);

  const endMove = useCallback((commit: boolean) => {
    const g = gesture.current;
    if (g?.kind === 'move') clearTimeout(g.timer);
    const cached = dropCache.current;
    dropCache.current = null;
    setMoving(false);
    setDrop(null);
    setDropInvalid(false);
    if (!commit || !cached?.result) return;
    if (cached.invalid) {
      useUIStore.getState().flash("Can't drop there: the result wouldn't be a valid config.");
      return;
    }
    const { config, newPaths } = cached.result;
    useDocumentStore.getState().dispatch(() => config);
    useSelectionStore.getState().selectMany(newPaths);
  }, []);

  // --- resizing --------------------------------------------------------------------

  const resizeTo = useCallback((g: Extract<Gesture, { kind: 'resize' }>, x: number, y: number, snap8: boolean) => {
    const dx = x - g.x;
    const dy = y - g.y;
    const round = (v: number) => Math.max(1, snap8 ? Math.round(v / 8) * 8 : Math.round(v));
    let w = g.start.w;
    let h = g.start.h;
    if (g.handle.includes('e')) w = round(g.start.w + dx);
    if (g.handle.includes('w')) w = round(g.start.w - dx);
    if (g.handle.includes('s')) h = round(g.start.h + dy);
    if (g.handle.includes('n')) h = round(g.start.h - dy);
    const horizontal = /[ew]/.test(g.handle);
    const vertical = /[ns]/.test(g.handle);
    // Preview on the element itself; the document changes once, on release.
    g.el.style.cssText = g.prevStyle;
    if (horizontal) Object.assign(g.el.style, { width: `${w}px`, minWidth: '0', maxWidth: 'none', flexGrow: '0', flexShrink: '0', flexBasis: 'auto' });
    if (vertical) Object.assign(g.el.style, { height: `${h}px`, minHeight: '0', maxHeight: 'none', ...(horizontal ? {} : { flexGrow: '0', flexShrink: '0', flexBasis: 'auto' }) });
    setResizing({ w: horizontal ? w : Math.round(g.start.w), h: vertical ? h : Math.round(g.start.h) });
    notifyLayout();
    return { w, h, horizontal, vertical };
  }, []);

  const endResize = useCallback((g: Extract<Gesture, { kind: 'resize' }>, x: number, y: number, snap8: boolean) => {
    const { w, h, horizontal, vertical } = resizeTo(g, x, y, snap8);
    g.el.style.cssText = g.prevStyle;
    setResizing(null);
    // Write to the active breakpoint, like every panel edit (responsive.tablet / .phone off desktop).
    const bp = useUIStore.getState().breakpoint;
    const resize = (n: Node) => {
      let out = n;
      if (horizontal) out = setStyle(out, bp, 'width', w);
      if (vertical) out = setStyle(out, bp, 'height', h);
      return out;
    };
    useDocumentStore.getState().dispatch((c) => withRoots(c, pageIndex(), (s) => updateAt(s, g.path, resize)));
    notifyLayout();
  }, [resizeTo]);

  const onHandleDown = useCallback((handle: Handle, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const sel = useSelectionStore.getState().selection;
    if (!doc || !sel) return;
    const el = elementFor(doc, sel.path) as HTMLElement | null;
    const start = rectOf(el);
    if (!el || !start) return;
    const p = toPage(event.clientX, event.clientY);
    gesture.current = { kind: 'resize', handle, path: sel.path, el, start, x: p.x, y: p.y, prevStyle: el.style.cssText };
  }, [doc, toPage]);

  // --- pointer -----------------------------------------------------------------------

  const handleMove = useCallback((x: number, y: number, shift: boolean, mod: boolean) => {
    const g = gesture.current;
    if (!doc) return;
    if (!g) {
      if (edit.current) return;
      const deepest = deepestAt(doc, x, y);
      const key = deepest ? pathKey(clickTarget(deepest, selectedPaths(), mod)) : null;
      if (useUIStore.getState().hoverKey !== key) useUIStore.getState().setHoverKey(key);
      return;
    }
    if (g.kind === 'press') {
      if (Math.hypot(x - g.x, y - g.y) * zoom() < DRAG_START_PX) return;
      const paths = normalizePaths(selectedPaths());
      if (!paths.length || !paths.some((p) => isAncestorOrSelf(p, g.target) || isAncestorOrSelf(g.target, p))) {
        gesture.current = null;
        return;
      }
      const move: Gesture = { kind: 'move', paths, sibling: null, siblingSince: 0, last: { x, y } };
      gesture.current = move;
      setMoving(true);
      useUIStore.getState().setHoverKey(null);
      computeDrop(move, x, y);
      return;
    }
    if (g.kind === 'move') {
      g.last = { x, y };
      computeDrop(g, x, y);
      return;
    }
    resizeTo(g, x, y, shift);
  }, [doc, computeDrop, resizeTo]);

  const handleUp = useCallback((x: number, y: number, shift: boolean) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    if (g.kind === 'press') {
      // Mouse down on one node of a multi-selection and released without dragging: keep just that one.
      if (g.collapseTo) useSelectionStore.getState().selectPath(g.collapseTo);
      return;
    }
    if (g.kind === 'move') {
      endMove(true);
      return;
    }
    endResize(g, x, y, shift);
  }, [endMove, endResize]);

  const onPointer = useCallback((p: CanvasPointer) => {
    if (!doc) return;
    if (p.type === 'move') return handleMove(p.x, p.y, p.shift, p.mod);
    if (p.type === 'up') return handleUp(p.x, p.y, p.shift);
    if (p.type === 'leave') {
      if (!gesture.current) useUIStore.getState().setHoverKey(null);
      return;
    }

    const sel = useSelectionStore.getState();
    const config = rawConfig();
    const sections = rootsOf(config, sel.pageIndex);

    if (p.type === 'down') {
      if (p.button !== 0) return;
      if (edit.current) finishEdit(true);
      const deepest = deepestAt(doc, p.x, p.y);
      if (!deepest) {
        if (!p.shift) sel.clear();
        return;
      }
      const target = clickTarget(deepest, selectedPaths(), p.mod);
      const isSelected = selectedPaths().some((q) => pathEquals(q, target));
      if (p.shift) {
        sel.toggle(target);
        gesture.current = isSelected ? null : { kind: 'press', x: p.x, y: p.y, target, collapseTo: null };
        return;
      }
      if (!isSelected) sel.select({ pageIndex: sel.pageIndex, path: target });
      const multi = isSelected && selectedPaths().length > 1;
      gesture.current = { kind: 'press', x: p.x, y: p.y, target, collapseTo: multi ? target : null };
      return;
    }

    if (p.type === 'dblclick') {
      const primary = sel.selection?.path;
      const deepest = deepestAt(doc, p.x, p.y);
      if (!primary || !deepest || !isAncestorOrSelf(primary, deepest)) return;
      const child = childToward(deepest, primary);
      if (child) {
        sel.select({ pageIndex: sel.pageIndex, path: child });
        return;
      }
      const node: Node | null = getAt(sections, primary);
      const el = elementFor(doc, primary) as HTMLElement | null;
      if (!node || !el) return;
      if (hasEditableContent(node)) {
        startEdit({ kind: 'content', path: primary, el });
      } else if (isInstance(node)) {
        const target = propTextAt(doc, config, primary, node, p.x, p.y);
        if (target) startEdit(target);
      }
    }
  }, [doc, handleMove, handleUp, finishEdit, startEdit]);

  // Drags and resizes keep going when the pointer leaves the page for the editor around it.
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!gesture.current) return;
      const p = toPage(e.clientX, e.clientY);
      handleMove(p.x, p.y, e.shiftKey, e.metaKey || e.ctrlKey);
    };
    const up = (e: MouseEvent) => {
      if (!gesture.current) return;
      const p = toPage(e.clientX, e.clientY);
      handleUp(p.x, p.y, e.shiftKey);
    };
    const key = (e: KeyboardEvent) => {
      const g = gesture.current;
      if (e.key !== 'Escape' || !g) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      gesture.current = null;
      if (g.kind === 'move') endMove(false);
      if (g.kind === 'resize') {
        g.el.style.cssText = g.prevStyle;
        setResizing(null);
        notifyLayout();
      }
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('keydown', key, true);
    };
  }, [toPage, handleMove, handleUp, endMove]);

  return { onPointer, onHandleDown, drop, dropInvalid, editing, renderKey, resizing, moving };
}
