import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useDocumentStore } from '../store/useDocument';
import { useSelectionStore } from '../store/useSelection';
import { useUIStore, VIEWPORTS, ZOOM_MAX, ZOOM_MIN } from '../store/useUI';
import { styleAt } from '../document/style';
import type { Breakpoint } from 'neucli/core';
import { useValidated } from '../store/useValidated';
import { addPage as cmdAddPage } from '../document/commands';
import { getAt, pathKey } from '../document/tree';
import { labelFor } from '../document/palette';
import BoardFrame from '../canvas/BoardFrame';
import type { FrameDeps, FrameHandlers } from '../canvas/BoardFrame';
import type { CanvasPointer } from '../canvas/CanvasFrame';
import Overlay, { measure } from '../canvas/Overlay';
import { notifyLayout } from '../canvas/layoutBus';
import { canvasGestureActive, useCanvasInteractions } from '../canvas/useCanvasInteractions';
import type { FrameAnchor } from '../canvas/useCanvasInteractions';
import { setCanvasDocument } from '../canvas/registry';
import type { Node } from '../document/types';
import { rootsOf, scopeComponent } from '../document/scope';

/** Screen px around the board. */
const PAD = 64;
/** Board px between breakpoint columns and between page rows (rows leave room for the labels). */
const GAP_X = 120;
const GAP_Y = 240;
const PAN_ACTIVATION_PX = 4;
const BREAKPOINTS: Breakpoint[] = ['desktop', 'tablet', 'phone'];

function clampZoom(z: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

interface FrameSpec {
  key: string;
  pageIndex: number;
  bp: Breakpoint;
  component: string | null;
  label: string;
  /** Board px. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The board, Figma-style: every page is a row, every breakpoint a column, all
 * rendered live from the same document. One frame is active at a time (the
 * selected page at the active breakpoint): it gets selection handles, drags,
 * resizes and inline editing, and panel edits go to its breakpoint. Pressing
 * the mouse on any other frame activates it in the same gesture.
 *
 * - wheel scrolls, Ctrl/Cmd+wheel or pinch zooms around the pointer;
 * - drag empty board or hold Space and drag anywhere to pan;
 * - Shift+1 fits the whole board, Shift+2 the selection.
 *
 * A main component (opened from the Components list) is shown on its own,
 * at the active breakpoint.
 */
export default function Canvas() {
  const config = useDocumentStore((s) => s.config);
  const dispatch = useDocumentStore((s) => s.dispatch);
  const { config: rendered, errors } = useValidated();

  const pageIndex = useSelectionStore((s) => s.pageIndex);
  const selection = useSelectionStore((s) => s.selection);
  const selectedPathList = useSelectionStore((s) => s.paths);
  const setPage = useSelectionStore((s) => s.setPage);
  const clearSelection = useSelectionStore((s) => s.clear);
  const lastPage = useSelectionStore((s) => s.lastPage);

  const zoom = useUIStore((s) => s.zoom);
  const setZoom = useUIStore((s) => s.setZoom);
  const hoverKey = useUIStore((s) => s.hoverKey);
  const flashMessage = useUIStore((s) => s.error);
  const fitRequest = useUIStore((s) => s.fitRequest);
  const focusRequest = useUIStore((s) => s.focusRequest);
  const requestFit = useUIStore((s) => s.requestFit);
  const requestFocus = useUIStore((s) => s.requestFocus);
  const breakpoint = useUIStore((s) => s.breakpoint);
  const setBreakpoint = useUIStore((s) => s.setBreakpoint);
  const allBreakpoints = useUIStore((s) => s.boardAllBreakpoints);
  const setAllBreakpoints = useUIStore((s) => s.setBoardAllBreakpoints);
  const preview = useUIStore((s) => s.preview);
  const setPreview = useUIStore((s) => s.setPreview);
  const statePreviewAll = useUIStore((s) => s.statePreview);

  const scrollerRef = useRef<HTMLElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const panState = useRef<PanState | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [scroller, setScroller] = useState<HTMLElement | null>(null);

  // A main component open on the canvas (negative scope), or the pages.
  const componentName = scopeComponent(config, pageIndex);
  const renderedComponent = componentName && rendered.components?.[componentName]?.root ? componentName : null;
  // The component was deleted or renamed away under us: go back to the page.
  useEffect(() => {
    if (pageIndex < 0 && !componentName) setPage(Math.min(lastPage, config.pages.length - 1));
  }, [pageIndex, componentName, lastPage, config.pages.length, setPage]);

  // --- layout -----------------------------------------------------------------

  const [heights, setHeights] = useState<Record<string, number>>({});
  const columns: Breakpoint[] = componentName || !allBreakpoints ? [breakpoint] : BREAKPOINTS;

  const { frames, boardW, boardH } = useMemo(() => {
    const rows = componentName
      ? [{ pageIndex, component: renderedComponent, name: componentName }]
      : rendered.pages.map((p, i) => ({ pageIndex: i, component: null, name: p.name }));
    const out: FrameSpec[] = [];
    let y = 0;
    let w = 0;
    for (const row of rows) {
      let x = 0;
      let rowH = 0;
      for (const bp of columns) {
        const key = row.component !== null || componentName ? `c:${bp}` : `${row.pageIndex}:${bp}`;
        const fw = VIEWPORTS[bp].width;
        const fh = heights[key] ?? VIEWPORTS[bp].height;
        out.push({ key, pageIndex: row.pageIndex, bp, component: componentName ? renderedComponent : null, label: row.name, x, y, w: fw, h: fh });
        x += fw + GAP_X;
        rowH = Math.max(rowH, fh);
      }
      w = Math.max(w, x - GAP_X);
      y += rowH + GAP_Y;
    }
    return { frames: out, boardW: Math.max(w, 1), boardH: Math.max(y - GAP_Y, 1) };
    // `columns` is derived from the deps below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rendered.pages, componentName, renderedComponent, pageIndex, heights, allBreakpoints, breakpoint]);

  const framesByKey = useMemo(() => new Map(frames.map((f) => [f.key, f])), [frames]);
  const framesRef = useRef(framesByKey);
  framesRef.current = framesByKey;

  const activeKey = componentName ? `c:${breakpoint}` : `${pageIndex}:${breakpoint}`;
  const active = framesByKey.get(activeKey) ?? null;
  const activeKeyRef = useRef(activeKey);
  activeKeyRef.current = activeKey;

  // --- frame documents and the active frame -------------------------------------------

  const docsRef = useRef<Record<string, Document | null>>({});
  const [, setDocsVersion] = useState(0);
  const activeDoc = docsRef.current[activeKey] ?? null;

  /** Screen rect (editor client px) of a frame's top-left. */
  const frameScreen = useCallback((key: string) => {
    const f = framesRef.current.get(key);
    const w = worldRef.current?.getBoundingClientRect();
    const z = useUIStore.getState().zoom;
    if (!f || !w) return { left: 0, top: 0 };
    return { left: w.left + f.x * z, top: w.top + f.y * z };
  }, []);

  const anchor: FrameAnchor = useMemo(() => ({
    current: { getBoundingClientRect: () => frameScreen(activeKeyRef.current) },
  }), [frameScreen]);

  const interactions = useCanvasInteractions(activeDoc, anchor);
  useEffect(() => setCanvasDocument(activeDoc), [activeDoc]);

  // Set when a click in a frame made it active: don't scroll the board under the pointer.
  const activatedByClick = useRef(false);

  const activate = useCallback((key: string) => {
    const f = framesRef.current.get(key);
    if (!f) return;
    activatedByClick.current = true;
    activeKeyRef.current = key;
    interactions.switchDocument(docsRef.current[key] ?? null);
    if (!f.component && f.pageIndex !== useSelectionStore.getState().pageIndex) setPage(f.pageIndex);
    if (f.bp !== useUIStore.getState().breakpoint) setBreakpoint(f.bp);
  }, [interactions, setPage, setBreakpoint]);

  // --- selection, measured on the active frame -----------------------------------------

  const selectedKey = selection && selection.pageIndex === pageIndex ? pathKey(selection.path) : null;
  const selectedNode = selection ? getAt(rootsOf(config, pageIndex), selection.path) : null;
  const selectedKeys = selection && selection.pageIndex === pageIndex
    ? (selectedPathList.length ? selectedPathList : [selection.path]).map(pathKey)
    : [];
  const box = measure(activeDoc, selectedKey);
  const sizeLabel = selectedNode && box
    ? interactions.resizing
      ? `${interactions.resizing.w} × ${interactions.resizing.h}`
      : `${sizeText(selectedNode, breakpoint, 'width', box.w)} × ${sizeText(selectedNode, breakpoint, 'height', box.h)}`
    : null;

  // --- scrolling and zoom ------------------------------------------------------------------

  // Scroll positions depend on the rendered board size, so they're applied after React commits.
  const afterRender = useRef<(() => void) | null>(null);
  const [renderTick, setRenderTick] = useState(0);
  const schedule = useCallback((fn: () => void) => {
    afterRender.current = fn;
    setRenderTick((t) => t + 1);
  }, []);
  useLayoutEffect(() => {
    const fn = afterRender.current;
    if (!fn) return;
    afterRender.current = null;
    fn();
  });

  /** Scroll so board point (bx, by) lands at screen point (sx, sy). */
  const scrollBoardPointTo = useCallback((bx: number, by: number, sx: number, sy: number) => {
    const s = scrollerRef.current;
    const w = worldRef.current?.getBoundingClientRect();
    if (!s || !w) return;
    const z = useUIStore.getState().zoom;
    s.scrollLeft += w.left + bx * z - sx;
    s.scrollTop += w.top + by * z - sy;
  }, []);

  const zoomAround = useCallback((next: number, clientX: number, clientY: number) => {
    const w = worldRef.current?.getBoundingClientRect();
    const current = useUIStore.getState().zoom;
    next = clampZoom(next);
    if (!w || next === current) return;
    const bx = (clientX - w.left) / current;
    const by = (clientY - w.top) / current;
    setZoom(next);
    schedule(() => scrollBoardPointTo(bx, by, clientX, clientY));
  }, [setZoom, schedule, scrollBoardPointTo]);

  /** Zoom (optional) and scroll so a board rect sits at the top-left, or centred when it fits. */
  const showRect = useCallback((r: { x: number; y: number; w: number; h: number }, z: number | null, center: boolean) => {
    if (z !== null) setZoom(clampZoom(z));
    schedule(() => {
      const s = scrollerRef.current;
      if (!s) return;
      const v = s.getBoundingClientRect();
      const zz = useUIStore.getState().zoom;
      const headerH = (s.firstElementChild as HTMLElement | null)?.offsetHeight ?? 0;
      const top = v.top + headerH;
      const height = v.height - headerH;
      if (center) {
        scrollBoardPointTo(r.x + r.w / 2, r.y + r.h / 2, v.left + v.width / 2, top + height / 2);
      } else {
        const fitsW = r.w * zz <= v.width - PAD * 2;
        scrollBoardPointTo(r.x + (fitsW ? r.w / 2 : 0), r.y, fitsW ? v.left + v.width / 2 : v.left + PAD, top + PAD);
      }
    });
  }, [setZoom, schedule, scrollBoardPointTo]);

  const viewportSize = () => {
    const s = scrollerRef.current;
    const headerH = (s?.firstElementChild as HTMLElement | null)?.offsetHeight ?? 0;
    return { w: (s?.clientWidth ?? 800) - PAD * 2, h: (s?.clientHeight ?? 600) - headerH - PAD * 2 };
  };

  const fitFrameWidth = useCallback((f: FrameSpec) => {
    showRect(f, Math.min(1, viewportSize().w / f.w), false);
  }, [showRect]);

  const fitAll = useCallback(() => {
    const v = viewportSize();
    showRect({ x: 0, y: 0, w: boardW, h: boardH }, Math.min(1, v.w / boardW, v.h / boardH), true);
  }, [showRect, boardW, boardH]);

  // On load and when switching between pages and a main component: fit the active frame's width.
  const scopeKind = componentName ? `c:${componentName}` : 'pages';
  const fittedScope = useRef<string | null>(null);
  useEffect(() => {
    if (!active || !scroller || fittedScope.current === scopeKind) return;
    fittedScope.current = scopeKind;
    activatedByClick.current = false;
    fitFrameWidth(active);
  }, [active, scroller, scopeKind, fitFrameWidth]);

  // Another page or breakpoint became active from outside the board (page list, tabs,
  // switcher, a link in Preview): bring its frame into view at the current zoom.
  const lastActive = useRef(activeKey);
  useEffect(() => {
    if (lastActive.current === activeKey) return;
    lastActive.current = activeKey;
    if (activatedByClick.current) {
      activatedByClick.current = false;
      return;
    }
    const f = framesRef.current.get(activeKey);
    if (f && fittedScope.current === scopeKind) showRect(f, null, false);
  }, [activeKey, scopeKind, showRect]);

  // Showing all sizes or one reflows the columns: keep the active frame in view.
  const lastAll = useRef(allBreakpoints);
  useEffect(() => {
    if (lastAll.current === allBreakpoints) return;
    lastAll.current = allBreakpoints;
    const f = framesRef.current.get(activeKeyRef.current);
    if (f) showRect(f, null, false);
  }, [allBreakpoints, showRect]);

  // Shift+1 / the zoom menu: the whole board.
  const lastFit = useRef(fitRequest);
  useEffect(() => {
    if (lastFit.current === fitRequest) return;
    lastFit.current = fitRequest;
    fitAll();
  }, [fitRequest, fitAll]);

  // Shift+2: the selection.
  useEffect(() => {
    if (focusRequest === 0 || !active) return;
    const b = measure(activeDoc, selectedKey);
    if (!b) return;
    const v = viewportSize();
    const r = { x: active.x + b.x, y: active.y + b.y, w: b.w, h: b.h };
    showRect(r, Math.min(v.w / r.w, v.h / r.h, 2), true);
    // Only on request, not when the selection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

  useEffect(() => notifyLayout(), [zoom, selectedKey, renderTick, boardW, boardH]);

  // The visible part of the board, board px, for mounting only the frames on or near screen.
  const [viewBox, setViewBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  useEffect(() => {
    const s = scrollerRef.current;
    if (!s) return;
    const update = () => {
      const w = worldRef.current?.getBoundingClientRect();
      const v = s.getBoundingClientRect();
      if (!w) return;
      const z = useUIStore.getState().zoom;
      const next = { x: (v.left - w.left) / z, y: (v.top - w.top) / z, w: v.width / z, h: v.height / z };
      setViewBox((prev) => (prev && Math.abs(prev.x - next.x) < 32 && Math.abs(prev.y - next.y) < 32 && Math.abs(prev.w - next.w) < 32 && Math.abs(prev.h - next.h) < 32 ? prev : next));
    };
    update();
    s.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(s);
    return () => {
      s.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [scroller, zoom, boardW, boardH, renderTick]);
  /** On screen or within three quarters of a screen of it. */
  const isNear = (f: FrameSpec) => {
    if (!viewBox) return false;
    const mx = viewBox.w * 0.75;
    const my = viewBox.h * 0.75;
    return f.x < viewBox.x + viewBox.w + mx && f.x + f.w > viewBox.x - mx && f.y < viewBox.y + viewBox.h + my && f.y + f.h > viewBox.y - my;
  };

  // Preview: the part of the active frame on screen, so a modal dialog opens where you're looking.
  const [view, setView] = useState<{ top: number; height: number } | undefined>(undefined);
  const activeH = active?.h ?? 0;
  useEffect(() => {
    const s = scrollerRef.current;
    if (!preview || !s) return;
    const update = () => {
      const z = useUIStore.getState().zoom;
      const f = frameScreen(activeKeyRef.current);
      const v = s.getBoundingClientRect();
      const top = Math.max(0, (v.top - f.top) / z);
      setView({ top, height: Math.max(0, Math.min(v.height / z, activeH - top)) });
    };
    update();
    s.addEventListener('scroll', update, { passive: true });
    return () => s.removeEventListener('scroll', update);
  }, [preview, zoom, activeH, activeKey, frameScreen]);

  // --- frame events --------------------------------------------------------------------

  const handlers: FrameHandlers = useMemo(() => ({
    onHeight: (key, h) => setHeights((prev) => (prev[key] === h ? prev : { ...prev, [key]: h })),
    onDocument: (key, d) => {
      if (docsRef.current[key] === d) return;
      docsRef.current[key] = d;
      setDocsVersion((n) => n + 1);
    },
    onLayout: notifyLayout,
    onNavigate: (href) => {
      const path = href.split('#')[0] || '/';
      const index = useDocumentStore.getState().config.pages.findIndex((p) => p.path === path);
      if (index >= 0 && index !== useSelectionStore.getState().pageIndex) setPage(index);
    },
    onWheel: (key, e) => {
      const s = scrollerRef.current;
      if (!s) return;
      const z = useUIStore.getState().zoom;
      const f = frameScreen(key);
      if (e.ctrlKey || e.metaKey) zoomAround(z * Math.exp(-e.deltaY * 0.0015), f.left + e.clientX * z, f.top + e.clientY * z);
      else s.scrollBy(e.deltaX, e.deltaY);
    },
    onPointer: (key, p) => routeRef.current(key, p),
  }), [frameScreen, zoomAround, setPage]);

  const interactionsRef = useRef(interactions);
  interactionsRef.current = interactions;
  const routeRef = useRef(routePointer);
  routeRef.current = routePointer;

  /** The frame at a board point, if any. */
  function frameAt(bx: number, by: number): FrameSpec | null {
    for (const f of framesRef.current.values()) {
      if (bx >= f.x && bx <= f.x + f.w && by >= f.y && by <= f.y + f.h) return f;
    }
    return null;
  }

  function refuseCrossFrameDrop() {
    // The gesture's own Esc handling cancels the move and clears the drop indicator.
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    useUIStore.getState().flash("Drop inside the frame you started in: moving between frames isn't supported.");
  }

  /** Mouse input from a frame. The active frame edits; any other frame becomes active first. */
  function routePointer(key: string, p: CanvasPointer) {
    if (useUIStore.getState().preview) return;
    const ix = interactionsRef.current;
    if (key === activeKeyRef.current) {
      // The browser keeps sending a drag to the frame it started in, even with the pointer over
      // another frame. Frames don't share coordinates, so a drop there is refused, not misplaced.
      if (ix.moving && (p.type === 'move' || p.type === 'up')) {
        const f = framesRef.current.get(key);
        const over = f ? frameAt(f.x + p.x, f.y + p.y) : null;
        if (over && over.key !== key) {
          if (p.type === 'up') refuseCrossFrameDrop();
          return;
        }
      }
      ix.onPointer(p);
      return;
    }
    if (canvasGestureActive()) {
      // A drag started in another frame and was released over this one.
      if (p.type === 'up' && ix.moving) refuseCrossFrameDrop();
      return;
    }
    if (p.type === 'down' && p.button === 0) {
      activate(key);
      ix.onPointer(p);
      return;
    }
    if (p.type === 'move' && useUIStore.getState().hoverKey !== null) useUIStore.getState().setHoverKey(null);
  }

  // Ctrl+wheel must be non-passive to stop the browser zooming the whole editor.
  useEffect(() => {
    const s = scrollerRef.current;
    if (!s) return;
    const block = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    s.addEventListener('wheel', block, { passive: false });
    return () => s.removeEventListener('wheel', block);
  }, []);

  const handleWheel = useCallback((event: React.WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    zoomAround(useUIStore.getState().zoom * Math.exp(-event.deltaY * 0.0015), event.clientX, event.clientY);
  }, [zoomAround]);

  // --- panning: drag empty board, or hold Space and drag anywhere ---------------------------

  const [spaceDown, setSpaceDown] = useState(false);
  useEffect(() => {
    const typing = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      if (typing(e.target) || typing(document.activeElement) || useUIStore.getState().preview) return;
      e.preventDefault();
      if (!e.repeat) setSpaceDown(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') setSpaceDown(false);
    };
    const blur = () => setSpaceDown(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  const startPan = useCallback((event: React.MouseEvent, fromSpace: boolean) => {
    if ((event.button !== 0 && event.button !== 1) || !scrollerRef.current) return;
    panState.current = {
      startX: event.clientX,
      startY: event.clientY,
      startScrollLeft: scrollerRef.current.scrollLeft,
      startScrollTop: scrollerRef.current.scrollTop,
      moved: false,
      fromSpace,
    };
    if (fromSpace) setIsPanning(true);
  }, []);

  useEffect(() => {
    const move = (event: MouseEvent) => {
      const state = panState.current;
      const s = scrollerRef.current;
      if (!state || !s) return;
      const dx = event.clientX - state.startX;
      const dy = event.clientY - state.startY;
      if (!state.moved && Math.hypot(dx, dy) < PAN_ACTIVATION_PX) return;
      if (!state.moved) {
        state.moved = true;
        setIsPanning(true);
      }
      s.scrollLeft = state.startScrollLeft - dx;
      s.scrollTop = state.startScrollTop - dy;
    };
    const up = () => {
      const state = panState.current;
      panState.current = null;
      if (!state) return;
      setIsPanning(false);
      // A click on empty board (no drag) deselects.
      if (!state.moved && !state.fromSpace) clearSelection();
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [clearSelection]);

  const handleAddPage = useCallback(() => {
    const result = cmdAddPage(useDocumentStore.getState().config);
    dispatch(() => result.config);
    setPage(result.newIndex);
  }, [dispatch, setPage]);

  const zoomTo = useCallback((z: number) => {
    const s = scrollerRef.current?.getBoundingClientRect();
    if (s) zoomAround(z, s.left + s.width / 2, s.top + s.height / 2);
  }, [zoomAround]);

  // --- render -----------------------------------------------------------------------------

  const statePreviewFor = (scope: number) => (statePreviewAll.scope === scope ? statePreviewAll.values : undefined);
  const rawShared = { components: config.components, theme: config.theme, layout: config.layout, meta: config.meta };
  const depsFor = (f: FrameSpec): FrameDeps => ({
    page: f.component ? config.components?.[f.component] : config.pages[f.pageIndex],
    ...rawShared,
  });

  return (
    <div className="relative flex min-w-0 flex-1">
      <main
        ref={(el) => {
          scrollerRef.current = el;
          setScroller(el);
        }}
        className={`flex-1 canvas-bg select-none overflow-auto ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={(e) => startPan(e, false)}
        onWheel={handleWheel}
      >
        <div
          className="sticky left-0 top-0 z-20 flex cursor-default items-center gap-0.5 border-b border-white/10 bg-[#1e1e1e]/90 px-8 pb-0 pt-4 backdrop-blur-sm"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {config.pages.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setPage(idx)}
              className={[
                'rounded-t px-3 py-1.5 text-[11px] font-medium transition',
                idx === pageIndex
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60',
              ].join(' ')}
            >
              {p.name}
            </button>
          ))}
          <button
            type="button"
            onClick={handleAddPage}
            className="rounded-t px-2 py-1.5 text-[11px] text-white/30 transition hover:bg-white/5 hover:text-white/50"
          >
            +
          </button>
          {componentName && (
            <div className="ml-2 flex items-center rounded-t bg-violet-500/25 text-violet-100 shadow-sm">
              <span className="px-3 py-1.5 text-[11px] font-medium" title="Editing the main component: every instance follows">
                <span className="mr-1.5 text-violet-300">&#x25C6;</span>{componentName}
              </span>
              <button
                type="button"
                title="Back to the page"
                onClick={() => setPage(Math.min(lastPage, config.pages.length - 1))}
                className="rounded-tr px-2 py-1.5 text-[11px] text-violet-200/60 hover:bg-violet-500/30 hover:text-white"
              >
                &#x2715;
              </button>
            </div>
          )}
          <div className="ml-auto flex items-center gap-2 pb-1">
            {!componentName && (
              <button
                type="button"
                title={allBreakpoints ? 'Show only the active breakpoint' : 'Show every page at desktop, tablet and phone'}
                onClick={() => setAllBreakpoints(!allBreakpoints)}
                className={`h-6 rounded px-2.5 text-[11px] transition ${
                  allBreakpoints ? 'bg-white/15 text-white' : 'bg-white/[0.06] text-white/50 hover:bg-white/10 hover:text-white'
                }`}
              >
                All sizes
              </button>
            )}
            <BreakpointSwitch value={breakpoint} onChange={setBreakpoint} />
          </div>
          <button
            type="button"
            title={preview ? 'Back to editing (Esc)' : 'Try the pages: clicks run interactions'}
            onClick={() => setPreview(!preview)}
            className={`mb-1 ml-2 h-6 rounded px-2.5 text-[11px] font-medium transition ${
              preview ? 'bg-emerald-500/25 text-emerald-100 hover:bg-emerald-500/35' : 'bg-white/[0.06] text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            {preview ? 'Stop preview' : 'Preview'}
          </button>
        </div>

        <div className="flex w-max min-w-full justify-center" style={{ padding: PAD, paddingBottom: '40vh' }}>
          <div ref={worldRef} className="relative shrink-0" style={{ width: boardW * zoom, height: boardH * zoom }}>
            {/* Labels and the active outline stay a constant size on screen. */}
            {frames.map((f) => {
              const isActive = f.key === activeKey;
              const samePage = f.pageIndex === pageIndex;
              return (
                <button
                  key={`label:${f.key}`}
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => {
                    activate(f.key);
                    clearSelection();
                  }}
                  className={`absolute flex max-w-full items-baseline gap-1.5 truncate whitespace-nowrap text-left text-[11px] ${
                    isActive ? 'text-indigo-300' : samePage ? 'text-white/70 hover:text-white' : 'text-white/35 hover:text-white/70'
                  }`}
                  style={{ left: f.x * zoom, top: f.y * zoom - 20, maxWidth: Math.max(80, f.w * zoom) }}
                  title={`${f.label}, ${VIEWPORTS[f.bp].label} ${VIEWPORTS[f.bp].width}px`}
                >
                  <span className="font-medium">{componentName ? <>&#x25C6; {f.label}</> : f.label}</span>
                  <span className="font-mono text-[10px] opacity-60">{VIEWPORTS[f.bp].label} {VIEWPORTS[f.bp].width}</span>
                </button>
              );
            })}
            {active && (
              <div
                className="pointer-events-none absolute rounded-[2px] ring-2 ring-indigo-500/60"
                style={{ left: active.x * zoom, top: active.y * zoom, width: active.w * zoom, height: active.h * zoom }}
              />
            )}

            <div
              className="absolute left-0 top-0 cursor-default"
              style={{ width: boardW, height: boardH, transform: `scale(${zoom})`, transformOrigin: '0 0' }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {frames.map((f) => {
                const isActive = f.key === activeKey;
                const page = f.component ? null : rendered.pages[f.pageIndex] ?? null;
                return (
                  <BoardFrame
                    key={f.key}
                    frameKey={f.key}
                    x={f.x}
                    y={f.y}
                    width={f.w}
                    height={f.h}
                    viewportHeight={VIEWPORTS[f.bp].height}
                    config={rendered}
                    page={page}
                    component={f.component}
                    deps={depsFor(f)}
                    active={isActive}
                    live={preview}
                    statePreview={preview ? undefined : statePreviewFor(f.component ? pageIndex : f.pageIndex)}
                    dropSlots={isActive && interactions.moving && !preview}
                    renderKey={isActive ? interactions.renderKey : 0}
                    view={isActive && preview ? view : undefined}
                    near={isNear(f)}
                    handlers={handlers}
                  />
                );
              })}

              {!preview && frames.map((f) => {
                if (f.pageIndex !== pageIndex) return null;
                const isActive = f.key === activeKey;
                const doc = docsRef.current[f.key] ?? null;
                if (!isActive && (!doc || selectedKeys.length === 0)) return null;
                return (
                  <div key={`overlay:${f.key}`} className="pointer-events-none absolute" style={{ left: f.x, top: f.y, width: f.w, height: f.h }}>
                    {isActive ? (
                      <Overlay
                        doc={doc}
                        zoom={zoom}
                        selectedKeys={selectedKeys}
                        primaryKey={selectedKey}
                        label={selectedNode ? labelFor(selectedNode) : ''}
                        sizeLabel={selectedKeys.length === 1 ? sizeLabel : null}
                        hoverKey={hoverKey}
                        handles={selectedKeys.length === 1}
                        drop={interactions.drop}
                        dropInvalid={interactions.dropInvalid}
                        editing={interactions.editing}
                        onHandleDown={interactions.onHandleDown}
                      />
                    ) : (
                      // The same selection on this page's other breakpoints, outline only.
                      <div className="opacity-50">
                        <Overlay
                          doc={doc}
                          zoom={zoom}
                          selectedKeys={selectedKeys}
                          primaryKey={null}
                          label=""
                          sizeLabel={null}
                          hoverKey={null}
                          handles={false}
                          drop={null}
                          dropInvalid={false}
                          editing={false}
                          onHandleDown={noop}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      </main>

      {spaceDown && (
        // Space held: panning wins everywhere, including over the frames' iframes.
        <div
          className={`absolute inset-0 top-[37px] z-10 ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
          onMouseDown={(e) => startPan(e, true)}
          onWheel={(e) => scrollerRef.current?.scrollBy(e.deltaX, e.deltaY)}
        />
      )}

      {errors.length > 0 && (
        <div className="absolute left-4 right-4 top-14 z-20 rounded border border-red-500/30 bg-[#2a1d1d]/95 px-3 py-2 text-[11px] text-red-300 shadow-lg">
          <div className="mb-1 font-semibold">The document doesn't validate, so the canvas shows the last valid version:</div>
          {errors.slice(0, 4).map((e) => (
            <div key={e} className="font-mono text-[10px] text-red-300/80">{e}</div>
          ))}
        </div>
      )}

      {flashMessage && (
        <div className="pointer-events-none absolute bottom-16 left-1/2 z-30 -translate-x-1/2 rounded-md border border-white/10 bg-[#2c2c2c] px-3 py-1.5 text-[11px] text-white/80 shadow-lg shadow-black/40">
          {flashMessage}
        </div>
      )}

      <ZoomWidget
        zoom={zoom}
        onZoomTo={zoomTo}
        onFitAll={requestFit}
        onFitSelection={requestFocus}
        canFitSelection={!!box}
      />
    </div>
  );
}

/** Desktop / tablet / phone: which frame of the page is active; edits go to its breakpoint. */
function BreakpointSwitch({ value, onChange }: { value: Breakpoint; onChange: (bp: Breakpoint) => void }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-6 items-center gap-px rounded bg-white/[0.06] p-px">
        {(Object.keys(VIEWPORTS) as Breakpoint[]).map((bp) => (
          <button
            key={bp}
            type="button"
            title={`${VIEWPORTS[bp].label}: ${VIEWPORTS[bp].width}px${bp === 'desktop' ? '' : `, edits go to responsive.${bp}`}`}
            onClick={() => onChange(bp)}
            className={`h-full rounded-[3px] px-2 text-[11px] transition ${
              bp === value ? (bp === 'desktop' ? 'bg-white/15 text-white' : 'bg-sky-500/25 text-sky-100') : 'text-white/45 hover:text-white/80'
            }`}
          >
            {VIEWPORTS[bp].label}
          </button>
        ))}
      </div>
      <span className="font-mono text-[10px] text-white/25">
        {VIEWPORTS[value].width} × {VIEWPORTS[value].height}
      </span>
    </div>
  );
}

/** Figma-style size readout: a fixed number, Fill, Hug, or the measured size when unset. */
function sizeText(node: Node, bp: Breakpoint, axis: 'width' | 'height', measured: number): string {
  const v = (styleAt(node, bp) as Record<string, unknown>)[axis];
  if (v === 'fill') return 'Fill';
  if (v === 'hug') return 'Hug';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return v;
  return String(Math.round(measured));
}

const ZOOM_PRESETS = [0.25, 0.5, 1, 2];

function ZoomWidget({ zoom, onZoomTo, onFitAll, onFitSelection, canFitSelection }: {
  zoom: number;
  onZoomTo: (z: number) => void;
  onFitAll: () => void;
  onFitSelection: () => void;
  canFitSelection: boolean;
}) {
  const [open, setOpen] = useState(false);
  const btn =
    'pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full text-[13px] text-white/60 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent';
  const item = 'flex w-full items-center justify-between gap-6 px-3 py-1.5 text-left text-[11px] text-white/80 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent';
  const pick = (fn: () => void) => () => {
    fn();
    setOpen(false);
  };
  return (
    <div className="pointer-events-none absolute bottom-4 right-4 z-20 flex flex-col items-end gap-1">
      {open && (
        <>
          <div className="pointer-events-auto fixed inset-0" onMouseDown={() => setOpen(false)} />
          <div className="pointer-events-auto relative min-w-[180px] overflow-hidden rounded-md border border-white/10 bg-[#2c2c2c] py-1 shadow-lg shadow-black/40">
            <button type="button" className={item} onClick={pick(onFitAll)}>
              Zoom to fit all <span className="font-mono text-white/35">⇧1</span>
            </button>
            <button type="button" className={item} disabled={!canFitSelection} onClick={pick(onFitSelection)}>
              Zoom to selection <span className="font-mono text-white/35">⇧2</span>
            </button>
            <div className="my-1 border-t border-white/10" />
            {ZOOM_PRESETS.map((z) => (
              <button key={z} type="button" className={item} onClick={pick(() => onZoomTo(z))}>
                Zoom to {z * 100}%
              </button>
            ))}
          </div>
        </>
      )}
      <div className="flex items-center gap-1 rounded-full border border-white/10 bg-[#2c2c2c]/90 p-0.5 shadow-lg shadow-black/30 backdrop-blur-sm">
        <button type="button" title="Zoom out (Ctrl -)" onClick={() => onZoomTo(prevStep(zoom))} disabled={zoom <= ZOOM_MIN} className={btn}>
          &#x2212;
        </button>
        <button
          type="button"
          title="Zoom options"
          onClick={() => setOpen((o) => !o)}
          className="pointer-events-auto min-w-[48px] rounded-full px-2 py-0.5 text-center font-mono text-[11px] tabular-nums text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button type="button" title="Zoom in (Ctrl +)" onClick={() => onZoomTo(nextStep(zoom))} disabled={zoom >= ZOOM_MAX} className={btn}>
          +
        </button>
      </div>
    </div>
  );
}

const STEPS = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4];
function nextStep(z: number): number {
  return STEPS.find((s) => s > z + 0.001) ?? ZOOM_MAX;
}
function prevStep(z: number): number {
  return [...STEPS].reverse().find((s) => s < z - 0.001) ?? ZOOM_MIN;
}

function noop() {}

interface PanState {
  startX: number;
  startY: number;
  startScrollLeft: number;
  startScrollTop: number;
  moved: boolean;
  fromSpace: boolean;
}
