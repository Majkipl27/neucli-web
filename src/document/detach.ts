/**
 * Detach an instance (Figma's "Detach instance"): replace it with a plain copy
 * of its component's tree. Props are substituted, slot content is put where
 * the slots were, and the copy's overrides are merged into the root. Instances
 * nested inside the component stay instances, as in Figma.
 */

import { isInstance, mergeStyle, pickOverridable, styleOf } from 'neucli/core';
import type { Config, InstanceNode, Node } from 'neucli/core';
import { cloneNode } from './tree';
import { NODE_KEY_ORDER } from './style';

type Obj = Record<string, unknown>;
type Scope = Record<string, unknown>;

const INTERPOLATION = /\{\s*([A-Za-z_$][\w$]*)\s*\}/g;
const STRING_FIELDS = ['content', 'src', 'alt', 'href', 'placeholder'] as const;

/** `{name}` -> value; a string that is exactly one `{name}` keeps the raw value. Unset props become empty. */
function interpolate(str: string, scope: Scope): unknown {
  const whole = /^\{\s*([A-Za-z_$][\w$]*)\s*\}$/.exec(str);
  if (whole && whole[1] in scope) return scope[whole[1]] ?? '';
  return str.replace(INTERPOLATION, (m, name: string) => (name in scope ? String(scope[name] ?? '') : m));
}

function substitute(node: Node, scope: Scope, slots: Record<string, Node[]>): Node[] {
  if (node.type === 'slot') {
    return cloneNode(slots[(node as { name?: string }).name ?? 'children'] ?? []);
  }
  const out = cloneNode(node) as unknown as Obj;
  if (isInstance(node)) {
    const props = out.props as Obj | undefined;
    if (props) for (const [k, v] of Object.entries(props)) if (typeof v === 'string') props[k] = interpolate(v, scope);
    if (Array.isArray(out.children)) out.children = (node.children ?? []).flatMap((c) => substitute(c, scope, slots));
    const named = out.slots as Record<string, Node[]> | undefined;
    if (named) for (const [k, list] of Object.entries(named)) named[k] = list.flatMap((c) => substitute(c, scope, slots));
    return [out as unknown as Node];
  }
  for (const f of STRING_FIELDS) {
    if (typeof out[f] === 'string') out[f] = String(interpolate(out[f] as string, scope) ?? '');
  }
  const attrs = out.attrs as Obj | undefined;
  if (attrs) for (const [k, v] of Object.entries(attrs)) if (typeof v === 'string') attrs[k] = interpolate(v, scope);
  if (Array.isArray(out.children)) {
    out.children = ((node as { children?: Node[] }).children ?? []).flatMap((c) => substitute(c, scope, slots));
  }
  return [out as unknown as Node];
}

type Responsive = Partial<Record<'tablet' | 'phone', Obj>>;

export type DetachResult = { ok: true; node: Node } | { ok: false; error: string };

export function detachInstance(config: Config, instance: InstanceNode): DetachResult {
  const def = config.components?.[instance.type];
  if (!def?.root) return { ok: false, error: `${instance.type} has no tree to detach (it uses file:).` };
  if (def.logic || def.imports?.length) {
    return { ok: false, error: `${instance.type} has its own logic, which plain nodes can't carry. Edit the component instead.` };
  }

  const scope: Scope = {};
  for (const [prop, d] of Object.entries(def.props ?? {})) {
    scope[prop] = typeof d === 'object' ? d.default : undefined;
  }
  Object.assign(scope, instance.props ?? {});
  const slots: Record<string, Node[]> = { children: instance.children ?? [], ...(instance.slots ?? {}) };

  const [root] = substitute(def.root, scope, slots);
  if (!root) return { ok: false, error: `${instance.type}'s root is a slot; nothing to detach.` };
  const out = root as unknown as Obj;

  // The copy's overrides win over the root's own values, key by key.
  const merged = mergeStyle(pickOverridable(styleOf(root)), pickOverridable(styleOf(instance)));
  Object.assign(out, merged);
  const rootR = ((root as { responsive?: Responsive }).responsive ?? {}) as Responsive;
  const instR = (instance.responsive ?? {}) as Responsive;
  const responsive: Responsive = {};
  for (const bp of ['tablet', 'phone'] as const) {
    const layer = mergeStyle(rootR[bp] ?? {}, instR[bp]);
    if (Object.keys(layer).length) responsive[bp] = layer;
  }
  if (Object.keys(responsive).length) out.responsive = responsive;
  else delete out.responsive;

  const className = [out.className, instance.className].filter(Boolean).join(' ');
  if (className) out.className = className;
  if (instance.id) out.id = instance.id;
  if (instance.attrs) out.attrs = { ...((out.attrs as Obj | undefined) ?? {}), ...instance.attrs };
  out.name = instance.name ?? instance.type;

  // A new node, so put its keys in the order a person would write them.
  const rank = (k: string) => (NODE_KEY_ORDER.indexOf(k) + 1 || NODE_KEY_ORDER.length) ;
  const ordered = Object.fromEntries(Object.entries(out).sort(([a], [b]) => rank(a) - rank(b)));
  return { ok: true, node: ordered as unknown as Node };
}
