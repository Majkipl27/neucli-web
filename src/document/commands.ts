/**
 * Atomic document mutations. Each returns a new config (or null for a no-op)
 * and never mutates its input, so undo history stays coherent.
 */

import type { Config, Node, Page, Path, Selection } from './types';
import { cloneNode, getAt, getList, insertAt, moveNode, removeAt, swapSibling, updateAt } from './tree';
import { acceptsChildren } from './palette';
import { rootsOf, withRoots } from './scope';

function withPages(config: Config, fn: (pages: Page[]) => Page[]): Config {
  return { ...config, pages: fn(config.pages) };
}

function withSections(config: Config, pageIndex: number, fn: (sections: Node[]) => Node[]): Config {
  return withRoots(config, pageIndex, fn);
}

// Pages ----------------------------------------------------------------------

export function addPage(config: Config): { config: Config; newIndex: number } {
  const taken = new Set(config.pages.map((p) => p.name.toLowerCase()));
  let n = config.pages.length + 1;
  while (taken.has(`page ${n}`)) n++;
  const name = `Page ${n}`;
  const page: Page = { path: `/page-${n}`, name, title: name, sections: [] };
  return { config: withPages(config, (pages) => [...pages, page]), newIndex: config.pages.length };
}

export function deletePage(config: Config, index: number): Config {
  if (config.pages.length <= 1) return config;
  return withPages(config, (pages) => pages.filter((_, i) => i !== index));
}

export function duplicatePage(config: Config, index: number): { config: Config; newIndex: number } {
  const source = config.pages[index];
  if (!source) return { config, newIndex: index };
  const copy = cloneNode(source);
  copy.name = `${source.name} copy`;
  copy.path = `${source.path === '/' ? '' : source.path}/copy`;
  copy.title = `${source.title ?? source.name} (copy)`;
  return {
    config: withPages(config, (pages) => {
      const out = [...pages];
      out.splice(index + 1, 0, copy);
      return out;
    }),
    newIndex: index + 1,
  };
}

export function updatePage(config: Config, index: number, updates: Partial<Page>): Config {
  return withPages(config, (pages) =>
    pages.map((p, i) => {
      if (i !== index) return p;
      const next: Page = { ...p, ...updates };
      for (const [k, v] of Object.entries(updates)) if (v === undefined || v === '') delete (next as unknown as Record<string, unknown>)[k];
      return next;
    }),
  );
}

// Nodes ----------------------------------------------------------------------

/**
 * Where a new node goes: inside the selection when it can hold children,
 * after it otherwise, or at the end of the page with nothing selected.
 */
export function insertionPoint(config: Config, pageIndex: number, selection: Selection | null): Path {
  const sections = rootsOf(config, pageIndex);
  // A component has one root: with nothing selected, new layers go inside it.
  if (pageIndex < 0 && (!selection || selection.pageIndex !== pageIndex)) {
    const root = sections[0];
    return root && acceptsChildren(config, root) ? [0, getList(sections, [0])?.length ?? 0] : [1];
  }
  if (!selection || selection.pageIndex !== pageIndex) return [sections.length];
  const node = getAt(sections, selection.path);
  if (!node) return [sections.length];
  if (acceptsChildren(config, node)) {
    const count = getList(sections, selection.path)?.length ?? 0;
    return [...selection.path, count];
  }
  const idx = selection.path[selection.path.length - 1] as number;
  return [...selection.path.slice(0, -1), idx + 1];
}

export function insertNode(config: Config, pageIndex: number, path: Path, node: Node): Config {
  return withSections(config, pageIndex, (s) => insertAt(s, path, node));
}

export function deleteNode(config: Config, target: Selection): Config {
  return withSections(config, target.pageIndex, (s) => removeAt(s, target.path));
}

export function duplicateNode(config: Config, target: Selection): { config: Config; newPath: Path } | null {
  const source = getAt(rootsOf(config, target.pageIndex), target.path);
  if (!source) return null;
  const idx = target.path[target.path.length - 1] as number;
  const newPath = [...target.path.slice(0, -1), idx + 1];
  return { config: withSections(config, target.pageIndex, (s) => insertAt(s, newPath, cloneNode(source))), newPath };
}

export function moveSibling(config: Config, target: Selection, direction: 'up' | 'down'): { config: Config; newPath: Path } | null {
  const result = swapSibling(rootsOf(config, target.pageIndex), target.path, direction);
  if (!result) return null;
  return { config: withSections(config, target.pageIndex, () => result.nodes), newPath: result.newPath };
}

export function moveTo(config: Config, pageIndex: number, from: Path, to: Path): { config: Config; newPath: Path } | null {
  const result = moveNode(rootsOf(config, pageIndex), from, to);
  if (!result) return null;
  return { config: withSections(config, pageIndex, () => result.nodes), newPath: result.newPath };
}

export function replaceNode(config: Config, target: Selection, replacement: Node): Config {
  return withSections(config, target.pageIndex, (s) => updateAt(s, target.path, () => replacement));
}

/** Set top-level keys on a node; undefined removes the key. */
export function patchNode(config: Config, target: Selection, patch: Record<string, unknown>): Config {
  return withSections(config, target.pageIndex, (s) =>
    updateAt(s, target.path, (n) => {
      const next: Record<string, unknown> = { ...n };
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) delete next[k];
        else next[k] = v;
      }
      return next as unknown as Node;
    }),
  );
}

/** Set one prop on an instance; undefined / '' removes it. */
export function setInstanceProp(config: Config, target: Selection, key: string, value: unknown): Config {
  return withSections(config, target.pageIndex, (s) =>
    updateAt(s, target.path, (n) => {
      const props: Record<string, unknown> = { ...((n as { props?: Record<string, unknown> }).props ?? {}) };
      if (value === undefined || value === '') delete props[key];
      else props[key] = value;
      const next: Record<string, unknown> = { ...n, props };
      if (Object.keys(props).length === 0) delete next.props;
      return next as unknown as Node;
    }),
  );
}

// Site level -----------------------------------------------------------------

export function setMeta(config: Config, updates: Partial<Config['meta']>): Config {
  return { ...config, meta: { ...config.meta, ...updates } };
}

type TokenKind = 'colors' | 'fonts';

function withTokens(config: Config, kind: TokenKind, fn: (tokens: Record<string, string>) => Record<string, string>): Config {
  const tokens = fn({ ...(config.theme?.[kind] ?? {}) });
  const theme = { ...(config.theme ?? {}), [kind]: tokens };
  if (Object.keys(tokens).length === 0) delete theme[kind];
  return { ...config, theme };
}

export function setToken(config: Config, kind: TokenKind, key: string, value: string): Config {
  return withTokens(config, kind, (t) => ({ ...t, [key]: value }));
}

export function deleteToken(config: Config, kind: TokenKind, key: string): Config {
  return withTokens(config, kind, (t) => {
    delete t[key];
    return t;
  });
}

/** Rename a token, keeping its position. */
export function renameToken(config: Config, kind: TokenKind, oldKey: string, newKey: string): Config {
  return withTokens(config, kind, (t) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k === oldKey ? newKey : k, v])));
}
