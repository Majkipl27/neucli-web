/**
 * Hit testing and drop placement on the canvas, Figma-style.
 *
 * Coordinates are page pixels: the iframe never scrolls (it grows to the
 * page height), so its client coordinates are page coordinates.
 */

import type { Config, Node, Path } from '../document/types';
import { getAt, getList, isAncestorOrSelf, parentPath, parsePathKey, pathEquals, pathKey } from '../document/tree';
import { acceptsChildren } from '../document/palette';
import { NID_ATTR } from './render';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function elementFor(doc: Document | null, path: Path): Element | null {
  if (!doc) return null;
  return doc.querySelector(`[${NID_ATTR}="${pathKey(path)}"]`);
}

export function rectOf(el: Element | null): Rect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

function insideAny(path: Path, roots: Path[]): boolean {
  return roots.some((r) => isAncestorOrSelf(r, path));
}

/** Deepest page node under the point, skipping anything inside `exclude` (the nodes being dragged). */
export function deepestAt(doc: Document, x: number, y: number, exclude: Path[] = []): Path | null {
  for (const el of doc.elementsFromPoint(x, y)) {
    const tagged = el.closest(`[${NID_ATTR}]`);
    const key = tagged?.getAttribute(NID_ATTR);
    if (key == null) continue;
    let path: Path | null = parsePathKey(key);
    // A dragged node still renders in place; look through it to what's around it.
    while (path && insideAny(path, exclude)) path = path.length > 1 ? parentPath(path) : null;
    if (path && path.length) return path;
  }
  return null;
}

/** Node paths from the top-level section down to `path`, inclusive. */
export function ancestors(path: Path): Path[] {
  const out: Path[] = [];
  let p: Path = path;
  while (p.length) {
    out.unshift(p);
    p = parentPath(p);
  }
  return out;
}

/**
 * What a click selects, as in Figma: the outermost node not yet "entered".
 * Siblings of the selection and of its ancestors are directly clickable;
 * children of the selection need a double-click (or Cmd/Ctrl+click, `deep`).
 */
export function clickTarget(deepest: Path, selected: Path[], deep: boolean): Path {
  if (deep) return deepest;
  const chain = ancestors(deepest);
  const contexts = selected.length ? selected.map(parentPath) : [[]];
  for (let i = chain.length - 1; i >= 0; i--) {
    const parent = parentPath(chain[i]);
    if (contexts.some((c) => isAncestorOrSelf(parent, c))) return chain[i];
  }
  return chain[0];
}

/** The child of `of` on the way down to `deepest`, for double-click deep select. */
export function childToward(deepest: Path, of: Path): Path | null {
  return ancestors(deepest).find((p) => pathEquals(parentPath(p), of)) ?? null;
}

// --- dropping -------------------------------------------------------------------

export type Flow = 'row' | 'column' | 'grid';

export interface Drop {
  /** List the nodes go into: `[]` page, a node path (its children), or `[node, slot]`. */
  list: Path;
  /** Index in that list, counted with the dragged nodes still in place. */
  index: number;
  /** Indicator line in page px. */
  line: { x: number; y: number; w: number; h: number };
  /** Box of the receiving container, when there's one to outline. */
  container: Rect | null;
}

function flowOf(el: Element | null): Flow {
  if (!el) return 'column';
  const cs = el.ownerDocument.defaultView!.getComputedStyle(el);
  if (cs.display.includes('grid')) return 'grid';
  if (cs.display.includes('flex') && cs.flexDirection.startsWith('row')) return 'row';
  return 'column';
}

/** Owner node path of a list path (`[2, 'actions']` -> `[2]`). */
function ownerOf(list: Path): Path {
  return typeof list[list.length - 1] === 'string' ? list.slice(0, -1) : list;
}

/**
 * Where a drop at (x, y) lands.
 *
 * - Over a container (frame, link box, instance with a default slot): into it,
 *   at the position along its flow.
 * - Over anything else: next to it, in its own list.
 * - Over a sibling of the dragged nodes: reorder next to it, unless `armed`
 *   says the pointer has rested on that sibling long enough to enter it
 *   (spring-loading), so reordering a row of cards doesn't nest them.
 */
export function resolveDrop(
  doc: Document,
  config: Config,
  pageIndex: number,
  dragging: Path[],
  x: number,
  y: number,
  armed: (sibling: Path) => boolean,
): { drop: Drop; sibling: Path | null } | null {
  const sections = config.pages[pageIndex]?.sections ?? [];
  const deepest = deepestAt(doc, x, y, dragging);
  const dragList = dragging.length && dragging.every((p) => pathEquals(p.slice(0, -1), dragging[0].slice(0, -1)))
    ? dragging[0].slice(0, -1)
    : null;

  if (!deepest) return { drop: placeIn(doc, sections, [], x, y), sibling: null };

  const chain = ancestors(deepest);
  const sibling = dragList ? chain.find((p) => pathEquals(p.slice(0, -1), dragList) && !insideAny(p, dragging)) ?? null : null;
  if (sibling && !armed(sibling)) {
    return { drop: placeIn(doc, sections, dragList!, x, y), sibling };
  }

  for (let i = chain.length - 1; i >= 0; i--) {
    const p = chain[i];
    const node = getAt(sections, p);
    if (!node) continue;
    if (acceptsChildren(config, node)) return { drop: placeIn(doc, sections, p, x, y), sibling };
    return { drop: placeIn(doc, sections, p.slice(0, -1), x, y), sibling };
  }
  return { drop: placeIn(doc, sections, [], x, y), sibling };
}

/** Index and indicator for a drop at (x, y) into the list at `list`. */
function placeIn(doc: Document, sections: Node[], list: Path, x: number, y: number): Drop {
  const items = getList(sections, list) ?? [];
  const rects = items.map((_, i) => rectOf(elementFor(doc, [...list, i])));
  const firstEl = items.map((_, i) => elementFor(doc, [...list, i])).find(Boolean) ?? null;
  const owner = ownerOf(list);
  const ownerEl = owner.length ? elementFor(doc, owner) : null;
  const flowEl = firstEl?.parentElement ?? ownerEl;
  const flow = flowOf(flowEl);
  const container = rectOf(ownerEl);
  const box = rectOf(flowEl) ?? container ?? { x: 0, y: 0, w: doc.documentElement.clientWidth, h: 0 };

  const shown = rects.map((r, i) => (r ? { r, i } : null)).filter((v): v is { r: Rect; i: number } => !!v);
  const T = 2;

  if (shown.length === 0) {
    const inner = container ?? box;
    return {
      list,
      index: items.length,
      line: flow === 'row'
        ? { x: inner.x + 4, y: inner.y + 4, w: T, h: Math.max(16, inner.h - 8) }
        : { x: inner.x + 4, y: inner.y + 4, w: Math.max(16, inner.w - 8), h: T },
      container,
    };
  }

  if (flow === 'grid') {
    let best = shown[0];
    let bestD = Infinity;
    for (const s of shown) {
      const cx = Math.min(Math.max(x, s.r.x), s.r.x + s.r.w);
      const cy = Math.min(Math.max(y, s.r.y), s.r.y + s.r.h);
      const d = Math.hypot(x - cx, y - cy);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    const r = best.r;
    const sameRow = y >= r.y && y <= r.y + r.h;
    const before = sameRow ? x < r.x + r.w / 2 : y < r.y + r.h / 2;
    return {
      list,
      index: before ? best.i : best.i + 1,
      line: { x: before ? r.x - T : r.x + r.w, y: r.y, w: T, h: r.h },
      container,
    };
  }

  const horizontal = flow === 'row';
  const mid = (r: Rect) => (horizontal ? r.x + r.w / 2 : r.y + r.h / 2);
  const pos = horizontal ? x : y;
  const at = shown.find((s) => pos < mid(s.r));
  const index = at ? at.i : items.length;

  // Line in the middle of the gap before `at` (or after the last item).
  const prev = at ? shown[shown.indexOf(at) - 1] : shown[shown.length - 1];
  const edgeStart = (r: Rect) => (horizontal ? r.x : r.y);
  const edgeEnd = (r: Rect) => (horizontal ? r.x + r.w : r.y + r.h);
  let c: number;
  if (at && prev) c = (edgeEnd(prev.r) + edgeStart(at.r)) / 2;
  else if (at) c = edgeStart(at.r) - 2;
  else c = edgeEnd(prev!.r) + 2;

  const crossStart = horizontal ? Math.min(...shown.map((s) => s.r.y)) : Math.min(...shown.map((s) => s.r.x));
  const crossEnd = horizontal ? Math.max(...shown.map((s) => s.r.y + s.r.h)) : Math.max(...shown.map((s) => s.r.x + s.r.w));
  return {
    list,
    index,
    line: horizontal
      ? { x: c - T / 2, y: crossStart, w: T, h: crossEnd - crossStart }
      : { x: crossStart, y: c - T / 2, w: crossEnd - crossStart, h: T },
    container,
  };
}

// --- text editing ---------------------------------------------------------------

export type TextTarget =
  | { kind: 'content'; path: Path; el: HTMLElement }
  | { kind: 'prop'; path: Path; prop: string; el: HTMLElement };

/** Can this node's text be edited in place (text, or a link with text content)? */
export function hasEditableContent(node: Node | null): boolean {
  if (!node) return false;
  if (node.type === 'text') return true;
  return node.type === 'link' && (node as { content?: unknown }).content !== undefined;
}

/**
 * Text inside a component instance comes from the component, so it isn't a
 * page node. When it's exactly one of the instance's text props (`{title}`),
 * edit that prop instead.
 */
export function propTextAt(
  doc: Document,
  config: Config,
  instancePath: Path,
  node: Node,
  x: number,
  y: number,
): TextTarget | null {
  const def = config.components?.[node.type];
  if (!def) return null;
  const values: [string, string][] = [];
  const set = (node as { props?: Record<string, unknown> }).props ?? {};
  for (const [prop, d] of Object.entries(def.props ?? {})) {
    const type = typeof d === 'string' ? d : (d as { type?: string }).type;
    if (type !== 'text') continue;
    const value = set[prop] ?? (typeof d === 'object' ? (d as { default?: unknown }).default : undefined);
    if (typeof value === 'string' && value.trim()) values.push([prop, value.trim()]);
  }
  const instanceEl = elementFor(doc, instancePath);
  for (const el of doc.elementsFromPoint(x, y)) {
    if (instanceEl && !instanceEl.contains(el)) continue;
    const text = (el as HTMLElement).innerText?.trim();
    const hit = values.find(([, v]) => v === text);
    if (hit && el.children.length === 0) return { kind: 'prop', path: instancePath, prop: hit[0], el: el as HTMLElement };
  }
  return null;
}
