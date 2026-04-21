import React, { useCallback, useRef, useState } from 'react';
import { useDocumentStore } from '../store/useDocument';
import { useSelectionStore } from '../store/useSelection';
import { useUIStore, ZOOM_MAX, ZOOM_MIN } from '../store/useUI';
import {
  insertAtTop as cmdInsertAtTop,
  insertChild as cmdInsertChild,
  moveTo as cmdMoveTo,
  addPage as cmdAddPage,
} from '../document/commands';
import { createDefault } from '../blocks';
import type { NeucliTheme, Path } from '../document/types';
import PreviewTree from './PreviewTree';
import ErrorBoundary from './ErrorBoundary';

const CANVAS_WIDTH = 1280;
const PAN_ACTIVATION_PX = 4;

/**
 * Design-tool viewport behavior:
 * - Scroll-lock: wheel anywhere inside scrolls this container only.
 * - Grab-to-pan: mousedown on empty canvas background, drag to pan.
 * - Clicking empty space (no drag motion) deselects.
 * - The rendered document card swallows click/drag so it never fights the pan.
 */
export default function Canvas() {
  const config = useDocumentStore((s) => s.config);
  const dispatch = useDocumentStore((s) => s.dispatch);

  const pageIndex = useSelectionStore((s) => s.pageIndex);
  const selection = useSelectionStore((s) => s.selection);
  const setPage = useSelectionStore((s) => s.setPage);
  const select = useSelectionStore((s) => s.select);
  const clearSelection = useSelectionStore((s) => s.clear);

  const dragFrom = useUIStore((s) => s.dragFrom);
  const dropTarget = useUIStore((s) => s.dropTarget);
  const startDrag = useUIStore((s) => s.startDrag);
  const endDrag = useUIStore((s) => s.endDrag);
  const setDropTarget = useUIStore((s) => s.setDropTarget);

  const zoom = useUIStore((s) => s.zoom);
  const setZoom = useUIStore((s) => s.setZoom);
  const zoomIn = useUIStore((s) => s.zoomIn);
  const zoomOut = useUIStore((s) => s.zoomOut);
  const resetZoom = useUIStore((s) => s.resetZoom);

  const scrollerRef = useRef<HTMLElement | null>(null);
  const panState = useRef<PanState | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  const currentPage = config.pages[pageIndex];

  const handleSelect = useCallback(
    (path: Path) => {
      select({ pageIndex, path });
    },
    [pageIndex, select],
  );

  const handleInsertAtIndex = useCallback(
    (index: number, type: string) => {
      dispatch((c) => cmdInsertAtTop(c, pageIndex, index, createDefault(type)));
    },
    [dispatch, pageIndex],
  );

  const handleInsertChildAtPath = useCallback(
    (parentPath: Path, index: number, type: string) => {
      dispatch((c) =>
        cmdInsertChild(c, { pageIndex, path: parentPath }, index, createDefault(type)),
      );
    },
    [dispatch, pageIndex],
  );

  const handleDrop = useCallback(
    (from: Path, toParentPath: Path, toIndex: number) => {
      let newPath: Path | null = null;
      dispatch((c) => {
        const res = cmdMoveTo(c, pageIndex, from, [...toParentPath, toIndex]);
        if (!res) return null;
        newPath = res.newPath;
        return res.config;
      });
      if (newPath) select({ pageIndex, path: newPath });
    },
    [dispatch, pageIndex, select],
  );

  const handleAddPage = useCallback(() => {
    const result = cmdAddPage(config);
    dispatch(() => result.config);
    setPage(result.newIndex);
  }, [config, dispatch, setPage]);

  const handleBackgroundMouseDown = useCallback((event: React.MouseEvent) => {
    if (event.button !== 0 && event.button !== 1) return;
    if (!scrollerRef.current) return;
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
    clearSelection();
  }, [clearSelection]);

  const handleBackgroundMouseLeave = useCallback(() => {
    if (panState.current?.moved) {
      setIsPanning(false);
    }
    panState.current = null;
  }, []);

  const handleWheel = useCallback(
    (event: React.WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      // Ctrl/Cmd + wheel => zoom centred on the cursor.
      event.preventDefault();
      const scroller = scrollerRef.current;
      if (!scroller) return;

      const rect = scroller.getBoundingClientRect();
      const pointerX = event.clientX - rect.left + scroller.scrollLeft;
      const pointerY = event.clientY - rect.top + scroller.scrollTop;

      const current = useUIStore.getState().zoom;
      const factor = Math.exp(-event.deltaY * 0.0015);
      const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, current * factor));
      if (next === current) return;

      const ratio = next / current;
      setZoom(next);

      // Keep the pointer over the same canvas coordinate after scaling.
      requestAnimationFrame(() => {
        if (!scrollerRef.current) return;
        scrollerRef.current.scrollLeft = pointerX * ratio - (event.clientX - rect.left);
        scrollerRef.current.scrollTop = pointerY * ratio - (event.clientY - rect.top);
      });
    },
    [setZoom],
  );

  const cursorClass = isPanning ? 'cursor-grabbing' : 'cursor-grab';

  return (
    <div className="relative flex min-w-0 flex-1">
      <main
        ref={scrollerRef}
        className={`flex-1 canvas-bg select-none overflow-auto ${cursorClass}`}
        onMouseDown={handleBackgroundMouseDown}
        onMouseMove={handleBackgroundMouseMove}
        onMouseUp={handleBackgroundMouseUp}
        onMouseLeave={handleBackgroundMouseLeave}
        onWheel={handleWheel}
        onDragEnd={endDrag}
      >
      <div
        className="sticky top-0 z-10 flex cursor-default items-center gap-0.5 border-b border-white/10 bg-[#1e1e1e]/90 px-8 pt-4 pb-0 backdrop-blur-sm"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {config.pages.map((page, idx) => (
          <button
            key={idx}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPage(idx);
            }}
            className={[
              'rounded-t px-3 py-1.5 text-[11px] font-medium transition',
              idx === pageIndex
                ? 'bg-white text-slate-900 shadow-sm'
                : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60',
            ].join(' ')}
          >
            {page.name}
          </button>
        ))}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleAddPage();
          }}
          className="rounded-t px-2 py-1.5 text-[11px] text-white/30 transition hover:bg-white/5 hover:text-white/50"
        >
          +
        </button>
      </div>

      <div className="p-8 pb-[50vh]" style={{ minWidth: 'max-content' }}>
        <div
          className="mx-auto cursor-default overflow-hidden rounded-lg bg-white shadow-2xl shadow-black/40"
          style={{
            width: CANVAS_WIDTH,
            minHeight: 600,
            // Non-standard `zoom` is used instead of `transform: scale` because
            // it also affects layout, so scrollbar extents stay correct without
            // manual size compensation.
            zoom,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div
            className="min-h-full bg-white text-slate-900"
            style={buildThemeVars(config.theme)}
          >
            <ErrorBoundary resetKey={pageIndex} label="Preview failed to render">
              <PreviewTree
                nodes={currentPage?.sections ?? []}
                selectedPath={selection?.path ?? null}
                onSelect={handleSelect}
                onInsertAtIndex={handleInsertAtIndex}
                onInsertChildAtPath={handleInsertChildAtPath}
                onDrop={handleDrop}
                dragFrom={dragFrom}
                setDragFrom={(path) => (path ? startDrag(path) : endDrag())}
                dropTarget={dropTarget}
                setDropTarget={setDropTarget}
              />
            </ErrorBoundary>
          </div>
        </div>
      </div>
      </main>

      <ZoomWidget
        zoom={zoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onReset={resetZoom}
      />
    </div>
  );
}

interface ZoomWidgetProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

function ZoomWidget({ zoom, onZoomIn, onZoomOut, onReset }: ZoomWidgetProps) {
  return (
    <div className="pointer-events-none absolute bottom-4 right-4 z-20 flex items-center gap-1 rounded-full border border-white/10 bg-[#2c2c2c]/90 p-0.5 shadow-lg shadow-black/30 backdrop-blur-sm">
      <button
        type="button"
        title="Zoom out (Ctrl -)"
        onClick={onZoomOut}
        disabled={zoom <= ZOOM_MIN}
        className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full text-[13px] text-white/60 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
      >
        &#x2212;
      </button>
      <button
        type="button"
        title="Reset zoom (Ctrl 0)"
        onClick={onReset}
        className="pointer-events-auto min-w-[48px] rounded-full px-2 py-0.5 text-center font-mono text-[11px] text-white/70 tabular-nums transition hover:bg-white/10 hover:text-white"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        type="button"
        title="Zoom in (Ctrl +)"
        onClick={onZoomIn}
        disabled={zoom >= ZOOM_MAX}
        className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full text-[13px] text-white/60 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
      >
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

/**
 * Convert `theme.colors` and `theme.fonts` into CSS custom properties injected
 * on the preview root. Color keys become `--nc-<key>`, font keys become
 * `--nc-font-<key>`. Blocks can reference these in className with Tailwind's
 * arbitrary value syntax, e.g. `bg-[--nc-primary]` or `text-[--nc-primary]`.
 */
function buildThemeVars(theme: NeucliTheme | undefined): React.CSSProperties {
  if (!theme) return {};
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(theme.colors ?? {})) {
    if (typeof v === 'string') vars[`--nc-${k}`] = v;
  }
  for (const [k, v] of Object.entries(theme.fonts ?? {})) {
    if (typeof v === 'string') vars[`--nc-font-${k}`] = v;
  }
  return vars as React.CSSProperties;
}
