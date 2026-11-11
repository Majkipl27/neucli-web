/**
 * Component authoring: create a component from a selection, rename or
 * delete one, edit its props, bind text to props, insert presets.
 *
 * Every function returns a new config (or an error string) and leaves the
 * input untouched. Callers dispatch the result as one undo step.
 */

import {
  COMPONENT_NAME, IDENTIFIER, RESERVED_NAMES, RESERVED_PROPS, collectSlots, insertPreset, isInstance, validate,
} from 'neucli/core';
import type { ComponentDef, Config, Node, Page, Path, PropDef, PropType } from './types';
import { cloneNode, getAt } from './tree';
import { normalizePaths, areSiblings, groupMany } from './multi';
import { rootsOf, withRoots, isComponentScope, scopeComponent } from './scope';
import { insertAt, updateAt } from './tree';

type Obj = Record<string, unknown>;
type WithLists = { children?: Node[]; slots?: Record<string, Node[]> };

export type Result<T> = ({ ok: true; config: Config } & T) | { ok: false; error: string };

// --- walking --------------------------------------------------------------------

/** Map every node in a tree (children and slot content), parents before children. */
function mapTree(node: Node, fn: (n: Node) => Node): Node {
  const out = fn(node) as Node & WithLists;
  const next: Obj = { ...out };
  if (out.children) next.children = out.children.map((c) => mapTree(c, fn));
  if (out.slots) next.slots = Object.fromEntries(Object.entries(out.slots).map(([k, l]) => [k, l.map((c) => mapTree(c, fn))]));
  return next as unknown as Node;
}

/** Apply `fn` to every node in the document: page sections and component roots. */
function mapDocument(config: Config, fn: (n: Node) => Node): Config {
  const components = config.components
    ? Object.fromEntries(Object.entries(config.components).map(([k, d]) => [k, d.root ? { ...d, root: mapTree(d.root, fn) } : d]))
    : undefined;
  return {
    ...config,
    ...(components ? { components } : {}),
    pages: config.pages.map((p) => ({ ...p, sections: p.sections.map((s) => mapTree(s, fn)) })),
  };
}

function walk(node: Node, visit: (n: Node) => void) {
  visit(node);
  const n = node as WithLists;
  n.children?.forEach((c) => walk(c, visit));
  Object.values(n.slots ?? {}).forEach((l) => l.forEach((c) => walk(c, visit)));
}

/** Instances of `name` on pages and inside other components, plus pages that use it as a layout. */
export function usageOf(config: Config, name: string): { instances: number; layoutPages: number; isDefaultLayout: boolean } {
  let instances = 0;
  const count = (n: Node) => {
    if (n.type === name) instances++;
  };
  for (const p of config.pages) p.sections.forEach((s) => walk(s, count));
  for (const [k, d] of Object.entries(config.components ?? {})) if (k !== name && d.root) walk(d.root, count);
  const layoutPages = config.pages.filter((p) => p.layout === name).length;
  return { instances, layoutPages, isDefaultLayout: config.layout === name };
}

// --- names ----------------------------------------------------------------------

/** Why `name` can't be a new component name, or null when it's fine. */
export function componentNameProblem(config: Config, name: string, except?: string): string | null {
  if (!name) return 'Give it a name.';
  if (!COMPONENT_NAME.test(name)) return 'Use PascalCase letters and digits, like PricingCard.';
  if (RESERVED_NAMES.has(name)) return `${name} is used by the generated code.`;
  const clash = Object.keys(config.components ?? {}).find((k) => k !== except && k.toLowerCase() === name.toLowerCase());
  if (clash) return clash === name ? `${name} already exists.` : `${clash} already exists (names can't differ only by case).`;
  return null;
}

/** A free PascalCase name based on `base`. */
export function freeComponentName(config: Config, base: string): string {
  const clean = toPascal(base) || 'Component';
  let name = RESERVED_NAMES.has(clean) ? `${clean}Block` : clean;
  let n = 2;
  const root = name;
  while (componentNameProblem(config, name)) name = `${root}${n++}`;
  return name;
}

export function toPascal(text: string): string {
  const words = text.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const out = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  return /^[A-Z]/.test(out) ? out : '';
}

function toCamel(text: string): string {
  const words = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).slice(0, 3);
  const out = words.map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1))).join('');
  return /^[a-z]/.test(out) ? out : '';
}

export function propNameProblem(def: ComponentDef, name: string, except?: string): string | null {
  if (!IDENTIFIER.test(name)) return 'Use letters, digits and _ (no spaces), starting with a letter.';
  if (RESERVED_PROPS.has(name)) return `${name} is reserved.`;
  if (name !== except && def.props && name in def.props) return `${name} already exists.`;
  return null;
}

// --- create from selection --------------------------------------------------------

export interface TextCandidate {
  /** Path inside the new component's root (root = []). */
  at: Path;
  prop: string;
  value: string;
}

const BOUND = /^\{\s*([A-Za-z_$][\w$]*)\s*\}$/;

/** Text in a tree that could become a prop: text nodes and text links without `{}` already in them. */
export function textCandidates(root: Node): TextCandidate[] {
  const out: TextCandidate[] = [];
  const used = new Set<string>();
  const visit = (node: Node, at: Path) => {
    if (isInstance(node)) return; // an instance's own text belongs to its component
    const n = node as unknown as Obj;
    const content = n.content;
    if ((node.type === 'text' || node.type === 'link') && typeof content === 'string' && !content.includes('{') && content.trim()) {
      const base = toCamel(String(n.name ?? '')) || (out.length === 0 ? 'title' : toCamel(content)) || 'text';
      let prop = RESERVED_PROPS.has(base) ? `${base}Text` : base;
      let i = 2;
      while (used.has(prop)) prop = `${base}${i++}`;
      used.add(prop);
      out.push({ at, prop, value: content });
    }
    ((node as WithLists).children ?? []).forEach((c, i) => visit(c, [...at, i]));
  };
  visit(root, []);
  return out;
}

/**
 * Turn the selection into a component (Figma's Create component): the
 * node (several siblings get wrapped in a frame first) moves into
 * `components[name]` and an instance takes its place. With `props`, the
 * listed texts become `text` props whose defaults are the current text, so
 * the instance looks exactly as before.
 */
export function createComponent(
  config: Config,
  scope: number,
  paths: Path[],
  name: string,
  props: TextCandidate[] = [],
): Result<{ path: Path }> {
  const problem = componentNameProblem(config, name);
  if (problem) return { ok: false, error: problem };
  let targets = normalizePaths(paths);
  if (targets.length === 0) return { ok: false, error: 'Select something first.' };
  if (isComponentScope(scope) && targets.some((p) => p.length === 1)) {
    return { ok: false, error: "A component's root can't become a component of its own. Select something inside it." };
  }

  let base = config;
  if (targets.length > 1) {
    if (!areSiblings(targets)) return { ok: false, error: 'Select layers that sit next to each other (same parent).' };
    const grouped = groupMany(config, scope, targets, { layout: { gap: 16 } });
    if (!grouped) return { ok: false, error: "Couldn't group the selection." };
    base = grouped.config;
    targets = [grouped.newPath];
  }

  const path = targets[0];
  const node = getAt(rootsOf(base, scope), path);
  if (!node) return { ok: false, error: 'Nothing to turn into a component.' };
  if (node.type === 'slot') return { ok: false, error: "A slot can't become a component." };

  let root = cloneNode(node) as Node;
  const declared: Record<string, PropDef> = {};
  for (const c of props) {
    root = c.at.length === 0
      ? ({ ...(root as unknown as Obj), content: `{${c.prop}}` } as unknown as Node)
      : updateAt([root], [0, ...c.at], (n) => ({ ...(n as unknown as Obj), content: `{${c.prop}}` } as unknown as Node))[0];
    declared[c.prop] = { type: 'text', default: c.value };
  }
  // `name` (layer name) and `id` stay on the instance: they describe this placement, not the component.
  const r = root as unknown as Obj;
  const instance: Obj = { type: name };
  for (const k of ['id', 'name'] as const) {
    if (r[k] !== undefined) {
      instance[k] = r[k];
      delete r[k];
    }
  }
  const def: ComponentDef = { ...(Object.keys(declared).length ? { props: declared } : {}), root };
  const withDef: Config = { ...base, components: { ...(base.components ?? {}), [name]: def } };
  const next = withRoots(withDef, scope, (s) => updateAt(s, path, () => instance as unknown as Node));
  if (next === withDef) return { ok: false, error: "Couldn't replace the selection." };
  const errors = validate(next).errors;
  if (errors.length) return { ok: false, error: errors[0] };
  return { ok: true, config: next, path };
}

// --- rename / delete ----------------------------------------------------------------

export function renameComponent(config: Config, from: string, to: string): Result<object> {
  if (from === to) return { ok: true, config };
  const problem = componentNameProblem(config, to, from);
  if (problem) return { ok: false, error: problem };
  const entries = Object.entries(config.components ?? {}).map(([k, d]) => [k === from ? to : k, d] as const);
  let next: Config = { ...config, components: Object.fromEntries(entries) };
  next = mapDocument(next, (n) => (n.type === from ? ({ ...(n as unknown as Obj), type: to } as unknown as Node) : n));
  next = {
    ...next,
    ...(next.layout === from ? { layout: to } : {}),
    pages: next.pages.map((p) => (p.layout === from ? { ...p, layout: to } : p)),
  };
  return { ok: true, config: next };
}

export function deleteComponent(config: Config, name: string): Result<object> {
  const use = usageOf(config, name);
  const where: string[] = [];
  if (use.instances) where.push(`${use.instances} instance${use.instances === 1 ? '' : 's'}`);
  if (use.layoutPages || use.isDefaultLayout) where.push('a page layout');
  if (where.length) return { ok: false, error: `${name} is still used (${where.join(', ')}). Detach or remove those first.` };
  const components = { ...(config.components ?? {}) };
  delete components[name];
  const next: Config = { ...config, components };
  if (Object.keys(components).length === 0) delete (next as unknown as Obj).components;
  return { ok: true, config: next };
}

// --- props ----------------------------------------------------------------------------

function defOf(config: Config, name: string): ComponentDef | null {
  return config.components?.[name] ?? null;
}

function withDef(config: Config, name: string, fn: (d: ComponentDef) => ComponentDef): Config {
  const d = defOf(config, name);
  if (!d) return config;
  return { ...config, components: { ...config.components, [name]: fn(d) } };
}

export function normalizeProp(raw: PropDef | PropType | string): PropDef {
  return typeof raw === 'string' ? { type: raw as PropType } : raw;
}

export function addProp(config: Config, name: string, type: PropType = 'text'): Result<{ prop: string }> {
  const d = defOf(config, name);
  if (!d) return { ok: false, error: `${name} doesn't exist.` };
  let prop = type === 'text' ? 'label' : type === 'url' ? 'href' : type === 'image' ? 'image' : type === 'number' ? 'count' : 'enabled';
  let i = 2;
  const root = prop;
  while (propNameProblem(d, prop)) prop = `${root}${i++}`;
  const value: PropDef = type === 'text' ? { type, default: 'Text' } : { type };
  return { ok: true, prop, config: withDef(config, name, (def) => ({ ...def, props: { ...(def.props ?? {}), [prop]: value } })) };
}

export function setPropDef(config: Config, name: string, prop: string, value: PropDef): Config {
  return withDef(config, name, (def) => {
    const clean: PropDef = { type: value.type };
    if (value.default !== undefined && value.default !== '') clean.default = value.default;
    return { ...def, props: { ...(def.props ?? {}), [prop]: clean } };
  });
}

/** Replace `{from}` with `{to}` in every string of a component tree. */
function renameRefs(node: Node, from: string, to: string): Node {
  const re = new RegExp(`\\{\\s*${from}\\s*\\}`, 'g');
  const fix = (v: unknown): unknown => (typeof v === 'string' ? v.replace(re, `{${to}}`) : v);
  return mapTree(node, (n) => {
    const out: Obj = { ...(n as unknown as Obj) };
    for (const k of ['content', 'src', 'alt', 'href', 'placeholder']) if (typeof out[k] === 'string') out[k] = fix(out[k]);
    for (const k of ['attrs', 'props']) {
      if (out[k] && typeof out[k] === 'object') out[k] = Object.fromEntries(Object.entries(out[k] as Obj).map(([a, v]) => [a, fix(v)]));
    }
    return out as unknown as Node;
  });
}

/** Rename a prop: the declaration (order kept), `{prop}` in the component, and every instance's value. */
export function renameProp(config: Config, name: string, from: string, to: string): Result<object> {
  const d = defOf(config, name);
  if (!d?.props || !(from in d.props)) return { ok: false, error: `${from} isn't a prop of ${name}.` };
  if (from === to) return { ok: true, config };
  const problem = propNameProblem(d, to, from);
  if (problem) return { ok: false, error: problem };
  const props = Object.fromEntries(Object.entries(d.props).map(([k, v]) => [k === from ? to : k, v]));
  let next = withDef(config, name, (def) => ({ ...def, props, ...(def.root ? { root: renameRefs(def.root, from, to) } : {}) }));
  next = mapDocument(next, (n) => {
    if (n.type !== name) return n;
    const p = (n as { props?: Obj }).props;
    if (!p || !(from in p)) return n;
    return { ...(n as unknown as Obj), props: Object.fromEntries(Object.entries(p).map(([k, v]) => [k === from ? to : k, v])) } as unknown as Node;
  });
  return { ok: true, config: next };
}

/** Remove a prop. Text bound to it gets the prop's default (or empty), and instances drop their value. */
export function removeProp(config: Config, name: string, prop: string): Config {
  const d = defOf(config, name);
  if (!d?.props || !(prop in d.props)) return config;
  const fallback = String(normalizeProp(d.props[prop]).default ?? '');
  const props = { ...d.props };
  delete props[prop];
  const re = new RegExp(`\\{\\s*${prop}\\s*\\}`, 'g');
  let next = withDef(config, name, (def) => {
    const out: ComponentDef = { ...def, props };
    if (Object.keys(props).length === 0) delete out.props;
    if (def.root) {
      out.root = mapTree(def.root, (n) => {
        const o: Obj = { ...(n as unknown as Obj) };
        for (const k of ['content', 'src', 'alt', 'href', 'placeholder']) if (typeof o[k] === 'string') o[k] = (o[k] as string).replace(re, fallback);
        return o as unknown as Node;
      });
    }
    return out;
  });
  next = mapDocument(next, (n) => {
    if (n.type !== name) return n;
    const p = (n as { props?: Obj }).props;
    if (!p || !(prop in p)) return n;
    const rest = { ...p };
    delete rest[prop];
    const out: Obj = { ...(n as unknown as Obj), props: rest };
    if (Object.keys(rest).length === 0) delete out.props;
    return out as unknown as Node;
  });
  return next;
}

/** The prop a text is bound to (`content: "{title}"`), if any. */
export function boundProp(node: Node | null): string | null {
  const content = (node as { content?: unknown } | null)?.content;
  if (typeof content !== 'string') return null;
  return BOUND.exec(content)?.[1] ?? null;
}

/** Set a prop's default value (editing bound text in the main component). */
export function setPropDefault(config: Config, name: string, prop: string, value: string): Config {
  const d = defOf(config, name);
  if (!d?.props || !(prop in d.props)) return config;
  return setPropDef(config, name, prop, { ...normalizeProp(d.props[prop]), default: value });
}

/**
 * Bind a text node in a component to a prop (`content: "{prop}"`), or unbind
 * it (prop null) back to the prop's default as plain text. Binding to a new
 * prop name declares it with the current text as default.
 */
export function bindText(config: Config, scope: number, path: Path, prop: string | null): Result<object> {
  const name = scopeComponent(config, scope);
  if (!name) return { ok: false, error: 'Text binds to props only inside a component.' };
  const d = defOf(config, name)!;
  const node = getAt(rootsOf(config, scope), path);
  if (!node || (node.type !== 'text' && node.type !== 'link')) return { ok: false, error: 'Select a text or a text link.' };
  const current = boundProp(node);
  const content = String((node as unknown as Obj).content ?? '');
  if (prop === null) {
    if (!current) return { ok: true, config };
    const value = String(normalizeProp(d.props?.[current] ?? 'text').default ?? '');
    return { ok: true, config: withRoots(config, scope, (s) => updateAt(s, path, (n) => ({ ...(n as unknown as Obj), content: value } as unknown as Node))) };
  }
  let next = config;
  if (!d.props || !(prop in d.props)) {
    const problem = propNameProblem(d, prop);
    if (problem) return { ok: false, error: problem };
    next = setPropDef(next, name, prop, { type: 'text', default: current ? String(normalizeProp(d.props?.[current] ?? 'text').default ?? '') : content });
  }
  next = withRoots(next, scope, (s) => updateAt(s, path, (n) => ({ ...(n as unknown as Obj), content: `{${prop}}` } as unknown as Node)));
  return { ok: true, config: next };
}

// --- slots ----------------------------------------------------------------------------

/** A slot node for a component that may already have a default slot. */
export function newSlot(def: ComponentDef | null): Node {
  const info = def ? collectSlots(def) : { hasDefault: false, named: new Set<string>() };
  if (!info.hasDefault) return { type: 'slot' } as Node;
  let i = info.named.size + 1;
  let name = i === 1 ? 'actions' : `slot${i}`;
  while (info.named.has(name)) name = `slot${++i}`;
  return { type: 'slot', name } as Node;
}

// --- presets ----------------------------------------------------------------------------

/** Copy a preset's definitions in and place an instance at `path` in the scope. */
export function insertPresetAt(config: Config, scope: number, presetId: string, path: Path): Result<{ name: string }> {
  const inserted = insertPreset(config, presetId);
  if (!inserted) return { ok: false, error: `Unknown preset ${presetId}.` };
  if (isComponentScope(scope) && scopeComponent(inserted.config, scope) === inserted.name) {
    return { ok: false, error: "A component can't contain itself." };
  }
  const next = withRoots(inserted.config, scope, (s) => insertAt(s, path, { type: inserted.name } as Node));
  if (next === inserted.config) return { ok: false, error: "There's no room there (a component keeps a single root)." };
  const errors = validate(next).errors;
  if (errors.length) return { ok: false, error: errors[0] };
  return { ok: true, config: next, name: inserted.name };
}

/** Add a layout preset (or a blank layout) and use it for a page, or as the site default when `pageIndex` is null. */
export function applyLayout(config: Config, presetId: string | 'blank', pageIndex: number | null): Result<{ name: string }> {
  let next: Config;
  let name: string;
  if (presetId === 'blank') {
    name = freeComponentName(config, 'Layout');
    const def: ComponentDef = {
      root: { type: 'frame', minHeight: 'screen', children: [{ type: 'frame', tag: 'main', height: 'fill', children: [{ type: 'slot' }] }] } as Node,
    };
    next = { ...config, components: { ...(config.components ?? {}), [name]: def } };
  } else {
    const inserted = insertPreset(config, presetId);
    if (!inserted) return { ok: false, error: `Unknown preset ${presetId}.` };
    next = inserted.config;
    name = inserted.name;
  }
  next = pageIndex === null
    ? { ...next, layout: name }
    : { ...next, pages: next.pages.map((p: Page, i: number) => (i === pageIndex ? { ...p, layout: name } : p)) };
  const errors = validate(next).errors;
  if (errors.length) return { ok: false, error: errors[0] };
  return { ok: true, config: next, name };
}

/** Components with a default slot, usable as layouts. */
export function layoutCandidates(config: Config): string[] {
  return Object.entries(config.components ?? {}).filter(([, d]) => d.root && collectSlots(d).hasDefault).map(([k]) => k);
}
