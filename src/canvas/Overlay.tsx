/**
 * Selection, hover, resize handles and drop indicators, drawn above the
 * canvas iframe from element rects. Nothing is added to the rendered page, so
 * selecting never shifts layout or fights the element's own shadow.
 *
 * Coordinates are page px; the parent applies the zoom transform, so sizes
 * that should stay constant on screen are divided by `zoom`.
 */

import { useEffect, useReducer } from 'react';
import type React from 'react';
import { NID_ATTR } from './render';
import { onLayout } from './layoutBus';
import type { Drop } from './interaction';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function measure(doc: Document | null, key: string | null): Box | null {
  if (!doc || key === null) return null;
  const el = doc.querySelector(`[${NID_ATTR}="${key}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

export type Handle = 'n' | 'e' | 's' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const CURSOR: Record<Handle, string> = {
  n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
  ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize',
};

const ACCENT = '#6366f1';

interface OverlayProps {
  doc: Document | null;
  zoom: number;
  /** Every selected node; the primary one gets the label and handles. */
  selectedKeys: string[];
  primaryKey: string | null;
  label: string;
  /** "320 × Hug" under the primary selection. */
  sizeLabel: string | null;
  hoverKey: string | null;
  handles: boolean;
  drop: Drop | null;
  dropInvalid: boolean;
  /** Hide boxes while the user is typing into a text node. */
  editing: boolean;
  onHandleDown: (handle: Handle, event: React.MouseEvent) => void;
}

export default function Overlay(props: OverlayProps) {
  const { doc, zoom, selectedKeys, primaryKey, label, sizeLabel, hoverKey, handles, drop, dropInvalid, editing, onHandleDown } = props;
  const [, remeasure] = useReducer((n: number) => n + 1, 0);
  useEffect(() => onLayout(remeasure), []);

  const line = 1.5 / zoom;
  const hover = hoverKey !== null && !selectedKeys.includes(hoverKey) ? measure(doc, hoverKey) : null;
  const primary = measure(doc, primaryKey);
  const others = selectedKeys.filter((k) => k !== primaryKey).map((k) => measure(doc, k)).filter((b): b is Box => !!b);
  const dropColor = dropInvalid ? '#ef4444' : ACCENT;

  const badge = (text: string, place: 'above' | 'below', color = ACCENT) => (
    <div
      className="absolute left-0 whitespace-nowrap rounded-sm px-1.5 py-px font-mono text-[11px] leading-4 text-white"
      style={{
        background: color,
        ...(place === 'above' ? { bottom: '100%', marginBottom: 4 / zoom } : { top: '100%', marginTop: 4 / zoom }),
        transform: `scale(${1 / zoom})`,
        transformOrigin: place === 'above' ? 'bottom left' : 'top left',
      }}
    >
      {text}
    </div>
  );

  return (
    <div className="pointer-events-none absolute inset-0">
      {hover && !drop && (
        <div className="absolute" style={{ left: hover.x, top: hover.y, width: hover.w, height: hover.h, boxShadow: `0 0 0 ${line}px ${ACCENT}` }} />
      )}

      {others.map((b, i) => (
        <div key={i} className="absolute" style={{ left: b.x, top: b.y, width: b.w, height: b.h, boxShadow: `0 0 0 ${line * 1.4}px ${ACCENT}` }} />
      ))}

      {primary && (
        <div
          className="absolute"
          style={{
            left: primary.x, top: primary.y, width: primary.w, height: primary.h,
            boxShadow: `0 0 0 ${line * 1.4}px ${ACCENT}`,
            opacity: editing ? 0.35 : 1,
          }}
        >
          {!drop && badge(label, 'above')}
          {!drop && sizeLabel && !editing && <div className="absolute left-0 right-0" style={{ top: '100%' }}>{badge(sizeLabel, 'below', '#4f46e5')}</div>}
          {handles && !drop && !editing && <Handles zoom={zoom} onHandleDown={onHandleDown} />}
        </div>
      )}

      {drop?.container && (
        <div
          className="absolute"
          style={{
            left: drop.container.x, top: drop.container.y, width: drop.container.w, height: drop.container.h,
            boxShadow: `0 0 0 ${line}px ${dropColor}`,
            background: dropInvalid ? 'rgba(239,68,68,0.06)' : 'rgba(99,102,241,0.06)',
          }}
        />
      )}
      {drop && (
        <div
          className="absolute rounded-full"
          style={{
            left: drop.line.x,
            top: drop.line.y,
            width: Math.max(drop.line.w, 2 / zoom),
            height: Math.max(drop.line.h, 2 / zoom),
            background: dropColor,
          }}
        />
      )}
    </div>
  );
}

function Handles({ zoom, onHandleDown }: { zoom: number; onHandleDown: OverlayProps['onHandleDown'] }) {
  const s = 8 / zoom; // square size on screen: 8px
  const hit = 6 / zoom; // edge hit zone thickness
  const square = (h: Handle, style: React.CSSProperties) => (
    <div
      key={h}
      data-handle={h}
      onMouseDown={(e) => onHandleDown(h, e)}
      className="pointer-events-auto absolute bg-white"
      style={{ width: s, height: s, border: `${1.5 / zoom}px solid ${ACCENT}`, cursor: CURSOR[h], ...style }}
    />
  );
  const edge = (h: Handle, style: React.CSSProperties) => (
    <div key={h} data-handle={h} onMouseDown={(e) => onHandleDown(h, e)} className="pointer-events-auto absolute" style={{ cursor: CURSOR[h], ...style }} />
  );
  return (
    <>
      {edge('n', { left: s, right: s, top: -hit / 2, height: hit })}
      {edge('s', { left: s, right: s, bottom: -hit / 2, height: hit })}
      {edge('w', { top: s, bottom: s, left: -hit / 2, width: hit })}
      {edge('e', { top: s, bottom: s, right: -hit / 2, width: hit })}
      {square('nw', { left: -s / 2, top: -s / 2 })}
      {square('ne', { right: -s / 2, top: -s / 2 })}
      {square('sw', { left: -s / 2, bottom: -s / 2 })}
      {square('se', { right: -s / 2, bottom: -s / 2 })}
    </>
  );
}
