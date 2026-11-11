/**
 * Reading and writing a node's structured styles at a breakpoint.
 *
 * Desktop values live on the node itself (`fill: white`); tablet and phone
 * values live under `responsive.tablet` / `responsive.phone` and merge over
 * the base key by key, the same way core compiles them. The panel always
 * writes to the active breakpoint, so editing on phone never touches desktop.
 */

import { isInstance, mergeStyle, pickOverridable, resolveStyle, styleOf } from 'neucli/core';
import type { Breakpoint, Config, InstanceNode, Node, Style } from 'neucli/core';

export type StyleKey = keyof Style;

type Obj = Record<string, unknown>;

function isPlainObject(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Where a person would write each key. New keys are inserted before the first
 * existing key that comes later in this order; existing keys never move, so a
 * hand-written file keeps its shape.
 */
export const NODE_KEY_ORDER = [
  'type', 'name', 'id', 'tag', 'content', 'href', 'newTab', 'src', 'alt', 'field', 'inputType', 'multiline', 'placeholder', 'required',
  'props', 'layout', 'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight', 'fill', 'color', 'font', 'radius',
  'border', 'shadow', 'opacity', 'clip', 'hidden', 'fit', 'className', 'attrs', 'state', 'on', 'visibleWhen', 'when', 'responsive', 'children', 'slots',
];
const SUB_KEY_ORDER: Record<string, string[]> = {
  layout: ['direction', 'columns', 'wrap', 'gap', 'padding', 'align', 'justify'],
  font: ['family', 'size', 'weight', 'leading', 'tracking', 'align', 'transform', 'italic'],
  border: ['width', 'color', 'sides', 'style'],
};

/** Set `key` on a copy of `obj`: in place when it exists, else at its position in `order`. */
export function withKey(obj: Obj, key: string, value: unknown, order: string[]): Obj {
  if (value === undefined) {
    const out = { ...obj };
    delete out[key];
    return out;
  }
  if (key in obj) return { ...obj, [key]: value };
  const rank = order.indexOf(key);
  const keys = Object.keys(obj);
  const before = rank < 0 ? -1 : keys.findIndex((k) => order.indexOf(k) > rank);
  if (before < 0) return { ...obj, [key]: value };
  const out: Obj = {};
  keys.forEach((k, i) => {
    if (i === before) out[key] = value;
    out[k] = obj[k];
  });
  return out;
}

/** Keys whose object value merges key by key across breakpoints (so a sub-key can be overridden alone). */
const MERGED_OBJECTS = new Set<StyleKey>(['layout', 'font', 'border']);

function responsiveOf(node: Node): Partial<Record<'tablet' | 'phone', Style>> | undefined {
  return (node as { responsive?: Partial<Record<'tablet' | 'phone', Style>> }).responsive;
}

/** The effective style at a breakpoint (desktop <- tablet <- phone). */
export function styleAt(node: Node, bp: Breakpoint): Style {
  return resolveStyle(styleOf(node), responsiveOf(node) as never, bp);
}

/** What this breakpoint itself sets: the node's own keys on desktop, the override layer otherwise. */
export function layerAt(node: Node, bp: Breakpoint): Style {
  if (bp === 'desktop') return styleOf(node);
  return responsiveOf(node)?.[bp] ?? {};
}

/** True when the active (non-desktop) breakpoint overrides this key or sub-key. */
export function isOverridden(node: Node, bp: Breakpoint, key: StyleKey, sub?: string): boolean {
  if (bp === 'desktop') return false;
  const layer = layerAt(node, bp) as Obj;
  if (!(key in layer)) return false;
  if (sub === undefined) return true;
  const v = layer[key];
  return isPlainObject(v) && sub in v;
}

/** Rewrite the tablet or phone override layer, dropping it (and `responsive`) when empty. */
function withLayer(node: Node, bp: 'tablet' | 'phone', fn: (layer: Obj) => Obj): Node {
  const responsive: Obj = { ...((responsiveOf(node) as Obj | undefined) ?? {}) };
  const layer = fn({ ...((responsive[bp] as Obj | undefined) ?? {}) });
  if (Object.keys(layer).length) responsive[bp] = layer;
  else delete responsive[bp];
  const out: Obj = { ...(node as unknown as Obj) };
  if (Object.keys(responsive).length) out.responsive = responsive;
  else delete out.responsive;
  return out as unknown as Node;
}

/**
 * Set a style key at a breakpoint; undefined removes it from that breakpoint.
 * On desktop the key keeps its position in the node when it already exists.
 */
export function setStyle(node: Node, bp: Breakpoint, key: StyleKey, value: unknown): Node {
  if (bp === 'desktop') return withKey(node as unknown as Obj, key, value, NODE_KEY_ORDER) as unknown as Node;
  return withLayer(node, bp, (layer) => withKey(layer, key, value, NODE_KEY_ORDER));
}

/**
 * Set one sub-key of an object style (`layout.gap`, `font.size`, `border.color`).
 * At tablet/phone only the sub-key is written, since these objects merge key by key.
 * An object left empty is removed.
 */
export function setStyleSub(node: Node, bp: Breakpoint, key: StyleKey, sub: string, value: unknown): Node {
  const own = (layerAt(node, bp) as Obj)[key];
  const obj = withKey(isPlainObject(own) ? own : {}, sub, value, SUB_KEY_ORDER[key] ?? []);
  return setStyle(node, bp, key, Object.keys(obj).length ? obj : undefined);
}

/** Drop a breakpoint override (key, or one sub-key of an object style). */
export function resetOverride(node: Node, bp: Breakpoint, key: StyleKey, sub?: string): Node {
  if (bp === 'desktop') return node;
  return sub === undefined ? setStyle(node, bp, key, undefined) : setStyleSub(node, bp, key, sub, undefined);
}

export function mergesBySubKey(key: StyleKey): boolean {
  return MERGED_OBJECTS.has(key);
}

// --- instances ---------------------------------------------------------------

/** The component root's style at a breakpoint (what an instance inherits). */
export function componentStyleAt(config: Config, node: InstanceNode, bp: Breakpoint): Style {
  const root = config.components?.[node.type]?.root;
  if (!root) return {};
  if (isInstance(root)) return mergeStyle(componentStyleAt(config, root, bp), pickOverridable(styleAt(root, bp)));
  return styleAt(root, bp);
}

/** What an instance shows at a breakpoint: the component's overridable values with the copy's on top. */
export function instanceStyleAt(config: Config, node: InstanceNode, bp: Breakpoint): Style {
  return mergeStyle(pickOverridable(componentStyleAt(config, node, bp)), pickOverridable(styleAt(node, bp)));
}

/** True when the copy sets this key itself at any breakpoint up to `bp`. */
export function instanceOverrides(node: InstanceNode, bp: Breakpoint, key: StyleKey): boolean {
  if (key in styleOf(node)) return true;
  const r = responsiveOf(node);
  if ((bp === 'tablet' || bp === 'phone') && r?.tablet && key in r.tablet) return true;
  return bp === 'phone' && !!r?.phone && key in r.phone;
}

/** Remove a key from the copy everywhere (base and both breakpoints): back to the component's value. */
export function resetInstanceKey(node: InstanceNode, key: StyleKey): Node {
  let out = setStyle(node, 'desktop', key, undefined);
  out = setStyle(out, 'tablet', key, undefined);
  return setStyle(out, 'phone', key, undefined);
}
