import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDocumentStore } from '../store/useDocument';
import { useSelectionStore } from '../store/useSelection';
import { useUIStore, VIEWPORTS, ZOOM_MAX, ZOOM_MIN } from '../store/useUI';
import { styleAt } from '../document/style';
import type { Breakpoint } from 'neucli/core';
import { useValidated } from '../store/useValidated';
import { addPage as cmdAddPage } from '../document/commands';
import { getAt, pathKey } from '../document/tree';
import { labelFor } from '../document/palette';
import CanvasFrame from '../canvas/CanvasFrame';
import Overlay, { measure } from '../canvas/Overlay';
import { notifyLayout } from '../canvas/layoutBus';
import { useCanvasInteractions } from '../canvas/useCanvasInteractions';
import { setCanvasDocument } from '../canvas/registry';
import type { Node } from '../document/types';
import ErrorBoundary from './ErrorBoundary';
import { rootsOf, scopeComponent } from '../document/scope';

const PAD = 64;
const PAN_ACTIVATION_PX = 4;

function clampZoom(z: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

/**
 * Design-tool viewport:
 * - wheel scrolls, Ctrl/Cmd+wheel zooms around the pointer (also over the page);
 * - drag empty background to pan, click it to deselect;
 * - click the page to select; selection and hover are drawn as an overlay.
 */
export default function Canvas() {
  const config = useDocumentStore((s) => s.config);
  const dispatch = useDocumentStore((s) => s.dispatch);
  const { config: rendered, errors } = useValidated();

  const pageIndex = useSelectionStore((s) => s.pageIndex);
  const selection = useSelectionStore((s) => s.selection);
  const selectedPathList = useSelectionStore((s) => s.paths);
  const setPage = useSelectionStore((s) => s.setPage);
  const select = useSelectionStore((s) => s.select);
  const clearSelection = useSelectionStore((s) => s.clear);

  const zoom = useUIStore((s) => s.zoom);
  const setZoom = useUIStore((s) => s.setZoom);
  const zoomIn = useUIStore((s) => s.zoomIn);
  const zoomOut = useUIStore((s) => s.zoomOut);
  const hoverKey = useUIStore((s) => s.hoverKey);
  const flashMessage = useUIStore((s) => s.error);
  const fitRequest = useUIStore((s) => s.fitRequest);
  const focusRequest = useUIStore((s) => s.focusRequest);
  const requestFit = useUIStore((s) => s.requestFit);
  const breakpoint = useUIStore((s) => s.breakpoint);
  const setBreakpoint = useUIStore((s) => s.setBreakpoint);
  /** Simulated viewport for the active breakpoint. The page's media queries see this width. */
  const VIEWPORT = VIEWPORTS[breakpoint];

  const scrollerRef = useRef<HTMLElement | null>(null);
  const sizerRef = useRef<HTMLDivElement | null>(null);
  const panState = useRef<PanState | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [doc, setDoc] = useState<Document | null>(null);
  const [pageHeight, setPageHeight] = useState(VIEWPORT.height);

  const lastPage = useSelectionStore((s) => s.lastPage);
  // A main component open on the canvas (negative scope), or a page.
  const componentName = scopeComponent(config, pageIndex);
  const renderedComponent = componentName && rendered.components?.[componentName]?.root ? componentName : null;
  const page = pageIndex < 0 ? null : rendered.pages[pageIndex] ?? rendered.pages[0];
  // The component was deleted or renamed away under us: go back to the page.
  useEffect(() => {
    if (pageIndex < 0 && !componentName) setPage(Math.min(lastPage, config.pages.length - 1));
  }, [pageIndex, componentName, lastPage, config.pages.length, setPage]);
  const selectedKey = selection && selection.pageIndex === pageIndex ? pathKey(selection.path) : null;
  const selectedNode = selection ? getAt(rootsOf(config, pageIndex), selection.path) : null;
  const selectedKeys = selection && selection.pageIndex === pageIndex
    ? (selectedPathList.length ? selectedPathList : [selection.path]).map(pathKey)
    : [];

  const interactions = useCanvasInteractions(doc, sizerRef);
  useEffect(() => setCanvasDocument(doc), [doc]);
  const box = measure(doc, selectedKey);
  const sizeLabel = selectedNode && box
    ? interactions.resizing
      ? `${interactions.resizing.w} × ${interactions.resizing.h}`
      : `${sizeText(selectedNode, breakpoint, 'width', box.w)} × ${sizeText(selectedNode, breakpoint, 'height', box.h)}`
    : null;

  // --- zoom helpers -----------------------------------------------------------

  /** Zoom to `next`, keeping the page point under (clientX, clientY) in place. */
  const zoomAround = useCallback((next: number, clientX: number, clientY: number) => {
    const scroller = scrollerRef.current;
    const sizer = sizerRef.current;
    if (!scroller || !sizer) return;
    const current = useUIStore.getState().zoom;
    next = clampZoom(next);
    if (next === current) return;
    const s = sizer.getBoundingClientRect();
    const pageX = (clientX - s.left) / current;
    const pageY = (clientY - s.top) / current;
    setZoom(next);
    requestAnimationFrame(() => {
      const after = sizer.getBoundingClientRect();
      scroller.scrollLeft += after.left + pageX * next - clientX;
      scroller.scrollTop += after.top + pageY * next - clientY;
    });
  }, [setZoom]);

  /** Scroll so the page rect (page px) sits centred in the viewport at the current zoom. */
  const centerOn = useCallback((box: { x: number; y: number; w: number; h: number }) => {
    requestAnimationFrame(() => {
      const scroller = scrollerRef.current;
      const sizer = sizerRef.current;
      if (!scroller || !sizer) return;
      const z = useUIStore.getState().zoom;
      const s = sizer.getBoundingClientRect();
      const v = scroller.getBoundingClientRect();
      scroller.scrollLeft += s.left + (box.x + box.w / 2) * z - (v.left + v.width / 2);
      scroller.scrollTop += s.top + (box.y + box.h / 2) * z - (v.top + v.height / 2);
    });
  }, []);

  // Zoom to fit the page width (Shift+1), on load and on page switch.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    setZoom(clampZoom(Math.min(1, (scroller.clientWidth - PAD * 2) / VIEWPORT.width)));
    requestAnimationFrame(() => {
      scroller.scrollTop = 0;
      scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) / 2;
    });
  }, [pageIndex, fitRequest, setZoom, VIEWPORT.width]);

  // Zoom to selection (Shift+2).
  useEffect(() => {
    if (focusRequest === 0) return;
    const scroller = scrollerRef.current;
    const box = measure(doc, selectedKey);
    if (!scroller || !box) return;
    const z = Math.min((scroller.clientWidth - PAD * 2) / box.w, (scroller.clientHeight - PAD * 2) / box.h);
    setZoom(clampZoom(Math.min(z, 2)));
    centerOn(box);
    // Only on request, not when selection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

  useEffect(() => notifyLayout(), [zoom, selectedKey]);

  // --- canvas events ------------------------------------------------------------

  const handlePageWheel = useCallback((e: WheelEvent) => {
    const sizer = sizerRef.current;
    const scroller = scrollerRef.current;
    if (!sizer || !scroller) return;
    // Page px -> editor client px.
    const s = sizer.getBoundingClientRect();
    const z = useUIStore.getState().zoom;
    const clientX = s.left + e.clientX * z;
    const clientY = s.top + e.clientY * z;
    if (e.ctrlKey || e.metaKey) zoomAround(z * Math.exp(-e.deltaY * 0.0015), clientX, clientY);
    else scroller.scrollBy(e.deltaX, e.deltaY);
  }, [zoomAround]);

  const handleWheel = useCallback((event: React.WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    zoomAround(useUIStore.getState().zoom * Math.exp(-event.deltaY * 0.0015), event.clientX, event.clientY);
  }, [zoomAround]);

  // Ctrl+wheel must be non-passive to stop the browser zooming the whole editor.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const block = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    scroller.addEventListener('wheel', block, { passive: false });
    return () => scroller.removeEventListener('wheel', block);
  }, []);

  const handleBackgroundMouseDown = useCallback((event: React.MouseEvent) => {
    if ((event.button !== 0 && event.button !== 1) || !scrollerRef.current) return;
    panState.current = {
      startX: event.clientX,
      startY: event.clientY,
      startScrollLeft: scrollerRef.current.scrollLeft,
      startScrollTop: scrollerRef.current.scrollTop,
      moved: false,
    };
  }, []);

  const handleBackgroundMouseMove = useCallback((event: React.MouseEvent) => {
    const state = panState.current;
    if (!state || !scrollerRef.current) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (!state.moved && Math.hypot(dx, dy) < PAN_ACTIVATION_PX) return;
    if (!state.moved) {
      state.moved = true;
      setIsPanning(true);
    }
    scrollerRef.current.scrollLeft = state.startScrollLeft - dx;
    scrollerRef.current.scrollTop = state.startScrollTop - dy;
  }, []);

  const handleBackgroundMouseUp = useCallback(() => {
    const state = panState.current;
    panState.current = null;
    if (state?.moved) {
      setIsPanning(false);
      return;
    }
    if (state) clearSelection();
  }, [clearSelection]);

  const handleAddPage = useCallback(() => {
    const result = cmdAddPage(useDocumentStore.getState().config);
    dispatch(() => result.config);
    setPage(result.newIndex);
  }, [dispatch, setPage]);

  return (
    <div className="relative flex min-w-0 flex-1">
      <main
        ref={scrollerRef}
        className={`flex-1 canvas-bg select-none overflow-auto ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={handleBackgroundMouseDown}
        onMouseMove={handleBackgroundMouseMove}
        onMouseUp={handleBackgroundMouseUp}
        onMouseLeave={() => {
          if (panState.current?.moved) setIsPanning(false);
          panState.current = null;
        }}
        onWheel={handleWheel}
      >
        <div
          className="sticky left-0 top-0 z-10 flex cursor-default items-center gap-0.5 border-b border-white/10 bg-[#1e1e1e]/90 px-8 pb-0 pt-4 backdrop-blur-sm"
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
          <BreakpointSwitch value={breakpoint} onChange={setBreakpoint} />
        </div>

        <div className="flex w-max min-w-full justify-center" style={{ padding: PAD, paddingBottom: "40vh" }}>
          <div
            ref={sizerRef}
            className="relative shrink-0 cursor-default shadow-2xl shadow-black/40"
            style={{ width: VIEWPORT.width * zoom, height: pageHeight * zoom }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div
              className="absolute left-0 top-0"
              style={{ width: VIEWPORT.width, height: pageHeight, transform: `scale(${zoom})`, transformOrigin: '0 0' }}
            >
              <ErrorBoundary resetKey={pageIndex} label="Canvas failed to render">
                {(page || renderedComponent) && (
                  <CanvasFrame
                    config={rendered}
                    page={page}
                    component={renderedComponent}
                    dropSlots={interactions.moving}
                    width={VIEWPORT.width}
                    viewportHeight={VIEWPORT.height}
                    onHeight={setPageHeight}
                    onLayout={notifyLayout}
                    onPointer={interactions.onPointer}
                    renderKey={interactions.renderKey}
                    onWheel={handlePageWheel}
                    onDocument={setDoc}
                  />
                )}
              </ErrorBoundary>
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
            </div>
          </div>
        </div>
      </main>

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

      <ZoomWidget zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onFit={requestFit} />
    </div>
  );
}

/** Desktop / tablet / phone. Switching resizes the canvas and routes panel edits to that breakpoint. */
function BreakpointSwitch({ value, onChange }: { value: Breakpoint; onChange: (bp: Breakpoint) => void }) {
  return (
    <div className="ml-auto flex items-center gap-2 pb-1">
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

function ZoomWidget({ zoom, onZoomIn, onZoomOut, onFit }: { zoom: number; onZoomIn: () => void; onZoomOut: () => void; onFit: () => void }) {
  const btn =
    'pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full text-[13px] text-white/60 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent';
  return (
    <div className="pointer-events-none absolute bottom-4 right-4 z-20 flex items-center gap-1 rounded-full border border-white/10 bg-[#2c2c2c]/90 p-0.5 shadow-lg shadow-black/30 backdrop-blur-sm">
      <button type="button" title="Zoom out (Ctrl -)" onClick={onZoomOut} disabled={zoom <= ZOOM_MIN} className={btn}>
        &#x2212;
      </button>
      <button
        type="button"
        title="Zoom to fit (Shift 1)"
        onClick={onFit}
        className="pointer-events-auto min-w-[48px] rounded-full px-2 py-0.5 text-center font-mono text-[11px] tabular-nums text-white/70 transition hover:bg-white/10 hover:text-white"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button type="button" title="Zoom in (Ctrl +)" onClick={onZoomIn} disabled={zoom >= ZOOM_MAX} className={btn}>
        +
      </button>
    </div>
  );
}

interface PanState {
  startX: number;
  startY: number;
  startScrollLeft: number;
  startScrollTop: number;
  moved: boolean;
}
