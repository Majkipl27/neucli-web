/**
 * Renders a page the way the generated project would, using the same
 * primitives and the same class computation (`neucli/core`) as the CLI.
 *
 * Differences from generated code are editor-only:
 * - every page node gets `data-nid` (its path) so clicks map back to the document;
 * - component `logic:` doesn't run, so names it declares stay as literal
 *   `{name}` text and `{expr}` event handlers are dropped.
 */

import { Fragment, type ReactNode } from 'react';
import { Frame, Text, Image, Link, Input, cx } from 'neucli/core/primitives';
import {
  childFlows, collectSlots, componentRestClasses, isInstance, layoutOf, nodeClasses, pageParentFlows,
  rootOverrides, slotParentFlows, sourceOf, COLUMN_FLOWS,
} from 'neucli/core';
import type { Config, Flows, InstanceNode, Node, Page, PrimitiveNode } from 'neucli/core';
import type { ElementType } from 'react';

export const NID_ATTR = 'data-nid';
/** Drop target for an empty named slot of an instance: `<instance nid>|<slot name>`. */
export const NSLOT_ATTR = 'data-nslot';

type Scope = Record<string, unknown> | null;

interface Ctx {
  config: Config;
  /** Component props in scope for `{name}` interpolation; null outside components. */
  scope: Scope;
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
  className: string;
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

/** `attrs:` as React props. Whole-value `{expr}` inside components is code, which the canvas can't run. */
function extraAttrs(attrs: Record<string, unknown> | undefined, scope: Scope): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (/^on[A-Z]/.test(key)) continue;
    if (typeof value === 'string' && scope && /^\{[^{}]+\}$/.test(value)) continue;
    out[key === 'class' ? 'className' : key] = typeof value === 'string' ? interpolate(value, scope) : value;
  }
  return out;
}

function childNid(nid: string | null, ...segments: (string | number)[]): string | null {
  return nid === null ? null : [nid, ...segments].join('.');
}

export function renderNode(any: Node, parent: Flows, ctx: Ctx, nid: string | null, root?: RootOverride): ReactNode {
  if (isInstance(any)) return renderInstance(any, parent, ctx, nid, null);
  const node = any as PrimitiveNode;
  if (node.type === 'slot') {
    if (ctx.editingSlots) {
      return <div {...(nid !== null ? { [NID_ATTR]: nid } : {})} style={PLACEHOLDER_STYLE}>{node.name ? `slot: ${node.name}` : 'slot'}</div>;
    }
    return ctx.slots[node.name ?? 'children'] ?? null;
  }

  const common: Record<string, unknown> = {
    ...(node.id ? { id: node.id } : {}),
    className: root ? root.className : nodeClasses(node, parent) || undefined,
    ...extraAttrs(node.attrs, ctx.scope),
    ...(root?.rest ?? {}),
    ...(nid !== null ? { [NID_ATTR]: nid } : {}),
  };
  const kids = (children: Node[] | undefined, flows: Flows) =>
    (children ?? []).map((c, i) => <Fragment key={i}>{renderNode(c, flows, ctx, childNid(nid, i))}</Fragment>);

  switch (node.type) {
    case 'frame':
      return (
        <Frame tag={(node.tag ?? 'div') as ElementType} {...common}>
          {kids(node.children, childFlows(sourceOf(node, 'frame')))}
        </Frame>
      );
    case 'text':
      return <Text tag={(node.tag ?? 'p') as ElementType} {...common}>{textOf(interpolate(node.content, ctx.scope))}</Text>;
    case 'image':
      return (
        <Image
          src={String(interpolate(node.src, ctx.scope) ?? '')}
          {...(node.alt !== undefined ? { alt: String(interpolate(node.alt, ctx.scope) ?? '') } : {})}
          {...common}
        />
      );
    case 'link':
      return (
        <Link href={String(interpolate(node.href, ctx.scope) ?? '')} newTab={node.newTab} {...common}>
          {node.content !== undefined
            ? textOf(interpolate(node.content, ctx.scope))
            : kids(node.children, childFlows(sourceOf(node, 'link')))}
        </Link>
      );
    case 'input':
      return (
        <Input
          multiline={node.multiline}
          {...(!node.multiline && node.inputType ? { type: node.inputType } : {})}
          {...(node.field ? { name: node.field } : {})}
          {...(node.placeholder !== undefined ? { placeholder: String(interpolate(node.placeholder, ctx.scope) ?? '') } : {})}
          required={node.required}
          readOnly
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
  for (const [prop, value] of Object.entries(node.props ?? {})) {
    scope[prop] = typeof value === 'string' ? interpolate(value, ctx.scope) : value;
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

  const inner: Ctx = { config: ctx.config, scope, slots };
  const overrides = forward ? forward.overrides : rootOverrides(ctx.config, def, node, parent);
  const className = forward ? forward.className : node.className;
  const rest = forward
    ? forward.rest
    : {
        ...(node.id ? { id: node.id } : {}),
        ...extraAttrs(node.attrs, ctx.scope),
        ...(nid !== null ? { [NID_ATTR]: nid } : {}),
      };

  const root = def.root;
  if (isInstance(root)) return renderInstance(root, COLUMN_FLOWS, inner, null, { overrides, className, rest });
  return renderNode(root, COLUMN_FLOWS, inner, null, { className: cx(componentRestClasses(def), overrides, className), rest });
}

/**
 * A main component on its own, as an instance with no props or overrides
 * would render it: declared props show their defaults, and the component's
 * slots show as placeholders so they can be selected and moved.
 */
export function ComponentView({ config, name, dropSlots }: { config: Config; name: string; dropSlots?: boolean }): ReactNode {
  const def = config.components?.[name];
  if (!def?.root) return null;
  const scope: Record<string, unknown> = {};
  for (const [prop, raw] of Object.entries((def.props ?? {}) as Record<string, { type: string; default?: unknown } | string>)) {
    const d = typeof raw === 'string' ? { type: raw } : raw;
    // A text prop without a default would render nothing, leaving nothing to click: show its name instead.
    scope[prop] = d.default ?? (d.type === 'text' ? `{${prop}}` : undefined);
  }
  const ctx: Ctx = { config, scope, slots: {}, editingSlots: true, dropSlots };
  const root = def.root;
  if (isInstance(root)) return renderNode(root, COLUMN_FLOWS, ctx, '0');
  const className = cx(componentRestClasses(def), rootOverrides(config, def, null, COLUMN_FLOWS));
  return renderNode(root, COLUMN_FLOWS, ctx, '0', { className, rest: {} });
}

/** A page inside its layout, as `App.tsx` + the page component would render it. */
export function PageView({ config, page, dropSlots }: { config: Config; page: Page; dropSlots?: boolean }): ReactNode {
  const ctx: Ctx = { config, scope: null, slots: {}, dropSlots };
  const parent = pageParentFlows(config, page);
  const sections = page.sections.map((s, i) => <Fragment key={i}>{renderNode(s, parent, ctx, String(i))}</Fragment>);
  const layout = layoutOf(config, page);
  if (!layout || !config.components?.[layout]?.root) return <>{sections}</>;
  return <LayoutWithContent config={config} layout={layout}>{sections}</LayoutWithContent>;
}

/** Render a layout component with already-rendered page content in its default slot. */
function LayoutWithContent({ config, layout, children }: { config: Config; layout: string; children: ReactNode }): ReactNode {
  const def = config.components![layout];
  // A layout gets no props from a page, so declared props render their defaults, as in generated code.
  const scope: Record<string, unknown> = {};
  for (const [prop, d] of Object.entries((def.props ?? {}) as Record<string, { default?: unknown } | string>)) {
    scope[prop] = typeof d === 'object' ? d.default : undefined;
  }
  const inner: Ctx = { config, scope, slots: { children } };
  const overrides = rootOverrides(config, def, null, COLUMN_FLOWS);
  const root = def.root!;
  if (isInstance(root)) return renderInstance(root, COLUMN_FLOWS, inner, null, { overrides, className: undefined, rest: {} });
  return renderNode(root, COLUMN_FLOWS, inner, null, { className: cx(componentRestClasses(def), overrides), rest: {} });
}
