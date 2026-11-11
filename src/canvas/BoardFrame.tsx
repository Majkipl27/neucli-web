/**
 * One frame on the board: a page (or main component) at one breakpoint.
 *
 * Many live iframes are expensive, so a frame:
 * - mounts its iframe only once it comes near the viewport (until then it's a
 *   blank sheet of the right size);
 * - keeps rendering what it showed last while it's off screen;
 * - re-renders only when something it depends on changed: its own page, or the
 *   document-wide parts every page uses (components, theme, layout, meta).
 *   An edit on Home leaves the Pricing frames alone;
 * - when it isn't the frame being edited, updates in a deferred render, so the
 *   active frame reflects an edit first.
 */

import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { Config, Page } from 'neucli/core';
import CanvasFrame from './CanvasFrame';
import type { CanvasPointer } from './CanvasFrame';
import type { StatePreview } from './render';
import ErrorBoundary from '../shell/ErrorBoundary';

/** The raw (pre-validation) objects a frame's render depends on, compared by identity. */
export interface FrameDeps {
  page: unknown;
  components: unknown;
  theme: unknown;
  layout: unknown;
  meta: unknown;
}

export interface FrameHandlers {
  onHeight: (key: string, height: number) => void;
  onPointer: (key: string, event: CanvasPointer) => void;
  onWheel: (key: string, event: WheelEvent) => void;
  onDocument: (key: string, doc: Document | null) => void;
  onNavigate: (href: string) => void;
  onLayout: () => void;
}

export interface BoardFrameProps {
  frameKey: string;
  /** Board position and size, board px. */
  x: number;
  y: number;
  width: number;
  /** Last known content height (placeholder size until the iframe measures itself). */
  height: number;
  viewportHeight: number;
  config: Config;
  page: Page | null;
  component: string | null;
  deps: FrameDeps;
  active: boolean;
  live: boolean;
  statePreview?: StatePreview;
  dropSlots: boolean;
  renderKey: number;
  view?: { top: number; height: number };
  /** On or near the screen (the canvas works this out from scroll position and zoom). */
  near: boolean;
  handlers: FrameHandlers;
}

function sameDeps(a: FrameDeps, b: FrameDeps): boolean {
  return a.page === b.page && a.components === b.components && a.theme === b.theme && a.layout === b.layout && a.meta === b.meta;
}

function BoardFrame(props: BoardFrameProps) {
  const { frameKey, x, y, width, height, viewportHeight, active, live, handlers } = props;
  const near = props.near;
  // Once mounted, an iframe stays mounted: remounting costs more than keeping it.
  const [seen, setSeen] = useState(near || active);
  useEffect(() => {
    if ((near || active) && !seen) setSeen(true);
  }, [near, active, seen]);

  // The frame being edited updates right away; the others follow in a low-priority render.
  const input = { config: props.config, page: props.page, deps: props.deps };
  const deferred = useDeferredValue(input);
  const latest = active ? input : deferred;

  // Reuse the last render input while nothing this frame shows has changed, or while it's off screen.
  const cache = useRef<{ deps: FrameDeps; config: Config; page: Page | null } | null>(null);
  const showing = near || active;
  let config = latest.config;
  let page = latest.page;
  if (cache.current && (!showing || sameDeps(cache.current.deps, latest.deps))) {
    config = cache.current.config;
    page = cache.current.page;
  } else {
    cache.current = { deps: latest.deps, config, page };
  }

  const bound = useMemo(() => ({
    onHeight: (h: number) => handlers.onHeight(frameKey, h),
    onPointer: (e: CanvasPointer) => handlers.onPointer(frameKey, e),
    onWheel: (e: WheelEvent) => handlers.onWheel(frameKey, e),
    onDocument: (d: Document | null) => handlers.onDocument(frameKey, d),
  }), [handlers, frameKey]);

  return (
    <div className="absolute" style={{ left: x, top: y, width, minHeight: height }}>
      {seen ? (
        <ErrorBoundary resetKey={frameKey} label="Frame failed to render">
          <CanvasFrame
            config={config}
            page={page}
            component={props.component}
            dropSlots={props.dropSlots}
            width={width}
            viewportHeight={viewportHeight}
            onHeight={bound.onHeight}
            onLayout={handlers.onLayout}
            onPointer={bound.onPointer}
            live={live}
            statePreview={props.statePreview}
            onNavigate={handlers.onNavigate}
            view={props.view}
            renderKey={props.renderKey}
            onWheel={bound.onWheel}
            onDocument={bound.onDocument}
          />
        </ErrorBoundary>
      ) : (
        <div className="bg-white/90" style={{ width, height }} />
      )}
    </div>
  );
}

export default memo(BoardFrame);
