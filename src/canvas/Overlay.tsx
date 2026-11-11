/**
 * Selection and hover boxes drawn above the canvas iframe, from element rects.
 * Nothing is added to the rendered page, so selecting never shifts layout or
 * fights the element's own shadow.
 */

import { useEffect, useReducer } from 'react';
import { NID_ATTR } from './render';
import { onLayout } from './layoutBus';

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

interface OverlayProps {
  doc: Document | null;
  zoom: number;
  selectedKey: string | null;
  selectedLabel: string;
  hoverKey: string | null;
}

export default function Overlay({ doc, zoom, selectedKey, selectedLabel, hoverKey }: OverlayProps) {
  const [, remeasure] = useReducer((n: number) => n + 1, 0);
  useEffect(() => onLayout(remeasure), []);

  const selected = measure(doc, selectedKey);
  const hover = hoverKey !== selectedKey ? measure(doc, hoverKey) : null;
  const line = 1.5 / zoom;

  return (
    <div className="pointer-events-none absolute inset-0">
      {hover && (
        <div
          className="absolute"
          style={{ left: hover.x, top: hover.y, width: hover.w, height: hover.h, boxShadow: `0 0 0 ${line}px #6366f1` }}
        />
      )}
      {selected && (
        <div
          className="absolute"
          style={{ left: selected.x, top: selected.y, width: selected.w, height: selected.h, boxShadow: `0 0 0 ${line * 1.4}px #6366f1` }}
        >
          <div
            className="absolute left-0 whitespace-nowrap rounded-sm bg-indigo-500 px-1.5 py-px font-mono text-[11px] leading-4 text-white"
            style={{ bottom: '100%', marginBottom: 4 / zoom, transform: `scale(${1 / zoom})`, transformOrigin: 'bottom left' }}
          >
            {selectedLabel}
          </div>
        </div>
      )}
    </div>
  );
}
