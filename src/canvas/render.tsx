/**
 * Renders a page the way the generated project would, using the same
 * primitives and the same class computation (`neucli/core`) as the CLI.
 *
 * Interactions use core's action and condition helpers too. In edit mode,
 * state shows its initial values (or values previewed from the panel) and
 * nothing reacts to clicks; in Preview (`live`) the handlers run.
 *
 * Differences from generated code are editor-only:
 * - every page node gets `data-nid` (its path) so clicks map back to the document;
 * - component `logic:` doesn't run, so names it declares stay as literal
 *   `{name}` text and `{expr}` event handlers are dropped.
 */

import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { Frame, Text, Image, Link, Input, Dialog, cx, onPress } from 'neucli/core/primitives';
import {
  childFlows, collectSlots, componentRestVariants, isInstance, layoutOf, nodeClassVariants, pageParentFlows,
  rootOverrides, slotParentFlows, sourceOf, COLUMN_FLOWS, pickVariant, parseAction, parseCondition, evalCondition,
  applyAction, attrCondition, INTERACTIVE_TAGS,
} from 'neucli/core';
import type { ClassVariants, Config, Flows, InstanceNode, Node, Page, PrimitiveNode, StateValue } from 'neucli/core';
import type { ElementType } from 'react';

export const NID_ATTR = 'data-nid';
/** Drop target for an empty named slot of an instance: `<instance nid>|<slot name>`. */
export const NSLOT_ATTR = 'data-nslot';

type Scope = Record<string, unknown> | null;

/** State declared by one frame, linked to the frames around it. */
export interface StateFrame {
  values: Record<string, StateValue>;
  /** Live only: change a value (updater form, like React's). */
  set: ((name: string, next: (current: StateValue) => StateValue) => void) | null;
  parent: StateFrame | null;
}

/** Edit-mode state values previewed from the panel, by node id. */
export type StatePreview = Record<string, Record<string, StateValue>>;

function lookupFrame(frame: StateFrame | null, name: string): StateFrame | null {
  for (let f = frame; f; f = f.parent) if (name in f.values) return f;
  return null;
}

function stateGet(frame: StateFrame | null) {
  return (name: string) => lookupFrame(frame, name)?.values[name];
}

function stateNames(frame: StateFrame | null): Record<string, StateValue> {
  const out: Record<string, StateValue> = {};
  const chain: StateFrame[] = [];
  for (let f = frame; f; f = f.parent) chain.unshift(f);
  for (const f of chain) Object.assign(out, f.values);
  return out;
}

interface Ctx {
  config: Config;
  /** Component props in scope for `{name}` interpolation; null outside components. */
  scope: Scope;
  /** State from enclosing frames (and the current one, for its own on/when/attrs). */
  state?: StateFrame | null;
  /** Preview: interactions run. Otherwise state shows initial / previewed values. */
  live?: boolean;
  /** Values previewed from the panel (edit mode), by node id. */
  preview?: StatePreview;
  /** Rendered slot content while inside a component. */
  slots: Record<string, ReactNode>;
  /** Editing a main component: its own slots show as placeholders. */
  editingSlots?: boolean;
  /** A drag is in progress: empty named slots of page instances show drop targets. */
  dropSlots?: boolean;
}

const PLACEHOLDER_STYLE = {
  minHeight: 40, minWidth: 80, padding: 8, borderRadius: 4, boxSizing: 'border-box',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: '1px dashed rgba(139, 92, 246, 0.7)', background: 'rgba(139, 92, 246, 0.07)',
  color: 'rgb(124, 58, 237)', font: '500 11px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace',
} as const;

/** Props a component root receives from the instance that placed it. */
interface RootOverride {
  /** The root's classes for the current state (state styles on the root can change them). */
  classes: (get: (name: string) => StateValue | undefined) => string;
  rest: Record<string, unknown>;
}

const INTERPOLATION = /\{\s*([A-Za-z_$][\w$]*)((?:\.[A-Za-z_$][\w$]*)*)\s*\}/g;

function lookup(scope: Record<string, unknown>, name: string, fields: string): unknown {
  let value: unknown = scope[name];
  for (const f of fields.split('.').filter(Boolean)) value = (value as Record<string, unknown> | null)?.[f];
  return value;
}

/** Interpolate in-scope `{name}`. A string that is exactly one `{name}` yields the raw value. */
function interpolate(str: string, scope: Scope): unknown {
  if (!scope) return str;
  const matches = [...str.matchAll(INTERPOLATION)].filter((m) => m[1] in scope);
  if (matches.length === 0) return str;
  if (matches.length === 1 && matches[0][0] === str) return lookup(scope, matches[0][1], matches[0][2]);
  return str.replace(INTERPOLATION, (whole, name: string, fields: string) =>
    name in scope ? String(lookup(scope, name, fields)) : whole,
  );
}

function textOf(value: unknown): ReactNode {
  if (value === undefined || value === null || typeof value === 'boolean') return null;
  return String(value);
}

/**
 * `attrs:` as React props. A whole-value `{condition}` over state is live
 * (`aria-selected`); any other whole-value `{expr}` inside components is code,
 * which the canvas can't run.
 */
function extraAttrs(attrs: Record<string, unknown> | undefined, scope: Scope, state: StateFrame | null = null): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (/^on[A-Z]/.test(key)) continue;
    const c = attrCondition(value, (name) => !!lookupFrame(state, name));
    if (c) {
      out[key] = evalCondition(c, stateGet(state));
      continue;
    }
    if (typeof value === 'string' && scope && /^\{[^{}]+\}$/.test(value)) continue;
    out[key === 'class' ? 'className' : key] = typeof value === 'string' ? interpolate(value, scope) : value;
  }
  return out;
}

/** Interpolation scope: props plus state values. */
function scopeWith(ctx: Ctx): Scope {
  if (!ctx.state) return ctx.scope;
  return { ...(ctx.scope ?? {}), ...stateNames(ctx.state) };
}

/** Holds one frame's state: live React state in Preview, initial + previewed values otherwise. */
function StateScope({ initial, preview, live, parent, render }: {
  initial: Record<string, StateValue>;
  preview?: Record<string, StateValue>;
  live: boolean;
  parent: StateFrame | null;
  render: (frame: StateFrame) => ReactNode;
}) {
  const [values, setValues] = useState(initial);
  // Editing the initial values (or switching modes) starts over from them.
  const key = JSON.stringify(initial);
  useEffect(() => setValues(initial), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const frame: StateFrame = live
    ? { values, parent, set: (name, next) => setValues((prev) => ({ ...prev, [name]: next(prev[name]) })) }
    : { values: { ...initial, ...preview }, parent, set: null };
  return <>{render(frame)}</>;
}

/** Run an action against the state chain (Preview only). */
function runAction(src: string, state: StateFrame | null) {
  const action = parseAction(src);
  if (!action) return;
  const owner = lookupFrame(state, action.name);
  owner?.set?.(action.name, (current) => applyAction(action, current));
}

/** `on:` as live handlers, the same semantics as generated code. */
function eventProps(node: PrimitiveNode, ctx: Ctx): Record<string, unknown> {
  const on = (node as { on?: Record<string, string> }).on;
  if (!on || !ctx.live) return {};
  const state = ctx.state ?? null;
  const out: Record<string, unknown> = {};
  for (const [event, src] of Object.entries(on)) {
    const run = () => runAction(src, state);
    if (event === 'click') {
      const tag = (node as { tag?: string }).tag ?? (node.type === 'text' ? 'p' : node.type === 'link' ? 'a' : 'div');
      if (node.type === 'link' || INTERACTIVE_TAGS.has(tag)) {
        out.onClick = (e: { preventDefault: () => void }) => {
          if (node.type === 'link' && (node as { href: string }).href.startsWith('#')) e.preventDefault();
          run();
        };
        if (tag === 'button' && !(node as { attrs?: Record<string, unknown> }).attrs?.type) out.type = 'button';
      } else {
        Object.assign(out, onPress(run));
      }
    } else if (event === 'submit') {
      out.onSubmit = (e: { preventDefault: () => void }) => {
        e.preventDefault();
        run();
      };
    } else if (event === 'mouseenter') out.onMouseEnter = run;
    else if (event === 'mouseleave') out.onMouseLeave = run;
  }
  return out;
}

function childNid(nid: string | null, ...segments: (string | number)[]): string | null {
  return nid === null ? null : [nid, ...segments].join('.');
}

export function renderNode(any: Node, parent: Flows, ctx: Ctx, nid: string | null, root?: RootOverride): ReactNode {
  const node = any as PrimitiveNode | InstanceNode;
  // visibleWhen reads the enclosing frames' state. A dialog handles it itself (open / closed).
  const visibleWhen = (node as { visibleWhen?: string }).visibleWhen;
  const dialog = node.type === 'frame' && (node as { tag?: string }).tag === 'dialog';
  if (visibleWhen && !dialog) {
    const c = parseCondition(visibleWhen);
    if (c && lookupFrame(ctx.state ?? null, c.name) && !evalCondition(c, stateGet(ctx.state ?? null))) return null;
  }
  if (isInstance(node)) return renderInstance(node, parent, ctx, nid, null);
  if (node.type === 'slot') {
    if (ctx.editingSlots) {
      return <div {...(nid !== null ? { [NID_ATTR]: nid } : {})} style={PLACEHOLDER_STYLE}>{node.name ? `slot: ${node.name}` : 'slot'}</div>;
    }
    return ctx.slots[node.name ?? 'children'] ?? null;
  }
  const state = (node as { state?: Record<string, StateValue> }).state;
  if (state && Object.keys(state).length) {
    return (
      <StateScope
        initial={state}
        preview={nid !== null ? ctx.preview?.[nid] : undefined}
        live={!!ctx.live}
        parent={ctx.state ?? null}
        render={(frame) => renderPrimitive(node, parent, { ...ctx, state: frame }, nid, root)}
      />
    );
  }
  return renderPrimitive(node, parent, ctx, nid, root);
}

function variantsClass(v: ClassVariants, ctx: Ctx): string {
  return v.variants.length ? pickVariant(v, stateGet(ctx.state ?? null)) : v.base;
}

function renderPrimitive(node: Exclude<PrimitiveNode, { type: 'slot' }>, parent: Flows, ctx: Ctx, nid: string | null, root?: RootOverride): ReactNode {
  const scope = scopeWith(ctx);
  const state = ctx.state ?? null;
  const common: Record<string, unknown> = {
    ...(node.id ? { id: node.id } : {}),
    className: (root ? root.classes(stateGet(state)) : variantsClass(nodeClassVariants(node, parent), ctx)) || undefined,
    ...extraAttrs(node.attrs, ctx.scope ? scope : null, state),
    ...eventProps(node, ctx),
    ...(root?.rest ?? {}),
    ...(nid !== null ? { [NID_ATTR]: nid } : {}),
  };
  const kids = (children: Node[] | undefined, flows: Flows) =>
    (children ?? []).map((c, i) => <Fragment key={i}>{renderNode(c, flows, ctx, childNid(nid, i))}</Fragment>);

  switch (node.type) {
    case 'frame': {
      const children = kids(node.children, childFlows(sourceOf(node, 'frame')));
      if (node.tag === 'dialog') {
        const c = parseCondition(node.visibleWhen ?? '');
        const owner = c ? lookupFrame(state, c.name) : null;
        const open = !!c && !!owner && evalCondition(c, stateGet(state));
        return (
          <Dialog
            open={open}
            modal={!!ctx.live}
            onClose={() => owner?.set?.(c!.name, () => !!c!.negate)}
            {...common}
          >
            {children}
          </Dialog>
        );
      }
      return <Frame tag={(node.tag ?? 'div') as ElementType} {...common}>{children}</Frame>;
    }
    case 'text':
      return <Text tag={(node.tag ?? 'p') as ElementType} {...common}>{textOf(interpolate(node.content, scope))}</Text>;
    case 'image':
      return (
        <Image
          src={String(interpolate(node.src, scope) ?? '')}
          {...(node.alt !== undefined ? { alt: String(interpolate(node.alt, scope) ?? '') } : {})}
          {...common}
        />
      );
    case 'link':
      return (
        <Link href={String(interpolate(node.href, scope) ?? '')} newTab={node.newTab} {...common}>
          {node.content !== undefined
            ? textOf(interpolate(node.content, scope))
            : kids(node.children, childFlows(sourceOf(node, 'link')))}
        </Link>
      );
    case 'input':
      return (
        <Input
          multiline={node.multiline}
          {...(!node.multiline && node.inputType ? { type: node.inputType } : {})}
          {...(node.field ? { name: node.field } : {})}
          {...(node.placeholder !== undefined ? { placeholder: String(interpolate(node.placeholder, scope) ?? '') } : {})}
          required={node.required}
          readOnly={!ctx.live}
          {...common}
        />
      );
  }
}

interface Forward {
  overrides: string;
  className: string | undefined;
  rest: Record<string, unknown>;
}

/**
 * An instance renders its component's root with the instance's props in scope
 * and its children/slots rendered in the caller's context, so slot content
 * keeps its own `data-nid` while the component's internals don't get one.
 */
function renderInstance(node: InstanceNode, parent: Flows, ctx: Ctx, nid: string | null, forward: Forward | null): ReactNode {
  const def = ctx.config.components?.[node.type];
  if (!def?.root) return null;

  const scope: Record<string, unknown> = {};
  // Every declared prop is in scope, set or not: an unset `{title}` renders nothing, as in generated code.
  for (const [prop, d] of Object.entries((def.props ?? {}) as Record<string, { default?: unknown }>)) {
    scope[prop] = d.default;
  }
  const outer = scopeWith(ctx);
  for (const [prop, value] of Object.entries(node.props ?? {})) {
    scope[prop] = typeof value === 'string' ? interpolate(value, outer) : value;
  }

  const slots: Record<string, ReactNode> = {};
  const defaultFlows = slotParentFlows(ctx.config, node.type, undefined);
  slots.children = (node.children ?? []).map((c, i) => (
    <Fragment key={i}>{renderNode(c, defaultFlows, ctx, childNid(nid, i))}</Fragment>
  ));
  for (const [name, list] of Object.entries(node.slots ?? {})) {
    const flows = slotParentFlows(ctx.config, node.type, name);
    slots[name] = list.map((c, i) => <Fragment key={i}>{renderNode(c, flows, ctx, childNid(nid, name, i))}</Fragment>);
  }
  // While dragging, an empty named slot needs something to drop onto.
  if (ctx.dropSlots && nid !== null) {
    for (const name of collectSlots(def).named) {
      if (node.slots?.[name]?.length) continue;
      slots[name] = <div {...{ [NSLOT_ATTR]: `${nid}|${name}` }} style={PLACEHOLDER_STYLE}>{name}</div>;
    }
  }

  // The component's own tree starts a fresh state chain (state is lexical to a file).
  const inner: Ctx = { config: ctx.config, scope, slots, live: ctx.live, state: null };
  const overrides = forward ? forward.overrides : rootOverrides(ctx.config, def, node, parent);
  const className = forward ? forward.className : node.className;
  const rest = forward
    ? forward.rest
    : {
        ...(node.id ? { id: node.id } : {}),
        ...extraAttrs(node.attrs, ctx.scope ? outer : null, ctx.state ?? null),
        ...(nid !== null ? { [NID_ATTR]: nid } : {}),
      };

  const root = def.root;
  if (isInstance(root)) return renderInstance(root, COLUMN_FLOWS, inner, null, { overrides, className, rest });
  const restVariants = componentRestVariants(def);
  return renderNode(root, COLUMN_FLOWS, inner, null, {
    classes: (get) => cx(restVariants.variants.length ? pickVariant(restVariants, get) : restVariants.base, overrides, className),
    rest,
  });
}

/**
 * A main component on its own, as an instance with no props or overrides
 * would render it: declared props show their defaults, and the component's
 * slots show as placeholders so they can be selected and moved.
 */
export function ComponentView({ config, name, dropSlots, live, preview }: { config: Config; name: string; dropSlots?: boolean; live?: boolean; preview?: StatePreview }): ReactNode {
  const def = config.components?.[name];
  if (!def?.root) return null;
  const scope: Record<string, unknown> = {};
  for (const [prop, raw] of Object.entries((def.props ?? {}) as Record<string, { type: string; default?: unknown } | string>)) {
    const d = typeof raw === 'string' ? { type: raw } : raw;
    // A text prop without a default would render nothing, leaving nothing to click: show its name instead.
    scope[prop] = d.default ?? (d.type === 'text' ? `{${prop}}` : undefined);
  }
  const ctx: Ctx = { config, scope, slots: {}, editingSlots: true, dropSlots, live, preview };
  const root = def.root;
  if (isInstance(root)) return renderNode(root, COLUMN_FLOWS, ctx, '0');
  const restVariants = componentRestVariants(def);
  const overrides = rootOverrides(config, def, null, COLUMN_FLOWS);
  return renderNode(root, COLUMN_FLOWS, ctx, '0', {
    classes: (get) => cx(restVariants.variants.length ? pickVariant(restVariants, get) : restVariants.base, overrides),
    rest: {},
  });
}

/** A page inside its layout, as `App.tsx` + the page component would render it. */
export function PageView({ config, page, dropSlots, live, preview }: { config: Config; page: Page; dropSlots?: boolean; live?: boolean; preview?: StatePreview }): ReactNode {
  const ctx: Ctx = { config, scope: null, slots: {}, dropSlots, live, preview };
  const parent = pageParentFlows(config, page);
  const sections = page.sections.map((s, i) => <Fragment key={i}>{renderNode(s, parent, ctx, String(i))}</Fragment>);
  const layout = layoutOf(config, page);
  if (!layout || !config.components?.[layout]?.root) return <>{sections}</>;
  return <LayoutWithContent config={config} layout={layout} live={live}>{sections}</LayoutWithContent>;
}

/** Render a layout component with already-rendered page content in its default slot. */
function LayoutWithContent({ config, layout, live, children }: { config: Config; layout: string; live?: boolean; children: ReactNode }): ReactNode {
  const def = config.components![layout];
  // A layout gets no props from a page, so declared props render their defaults, as in generated code.
  const scope: Record<string, unknown> = {};
  for (const [prop, d] of Object.entries((def.props ?? {}) as Record<string, { default?: unknown } | string>)) {
    scope[prop] = typeof d === 'object' ? d.default : undefined;
  }
  const inner: Ctx = { config, scope, slots: { children }, live };
  const overrides = rootOverrides(config, def, null, COLUMN_FLOWS);
  const root = def.root!;
  if (isInstance(root)) return renderInstance(root, COLUMN_FLOWS, inner, null, { overrides, className: undefined, rest: {} });
  const restVariants = componentRestVariants(def);
  return renderNode(root, COLUMN_FLOWS, inner, null, {
    classes: (get) => cx(restVariants.variants.length ? pickVariant(restVariants, get) : restVariants.base, overrides),
    rest: {},
  });
}
