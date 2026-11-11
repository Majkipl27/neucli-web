/**
 * What the canvas is editing: a page, or a component's definition (Figma's
 * "main component").
 *
 * The selection store keeps a single number, `pageIndex`. Zero and up is a
 * page. Negative numbers are components, by position in `config.components`:
 * -1 is the first, -2 the second. A component's tree is edited as a one-item
 * list `[root]`, so every path-based operation (select, move, resize, style)
 * works unchanged, with the root at path `[0]`.
 */

import type { Config, Node } from './types';

export function isComponentScope(scope: number): boolean {
  return scope < 0;
}

export function componentNames(config: Config): string[] {
  return Object.keys(config.components ?? {});
}

/** The component a scope points at, or null for pages and stale scopes. */
export function scopeComponent(config: Config, scope: number): string | null {
  if (scope >= 0) return null;
  return componentNames(config)[-scope - 1] ?? null;
}

export function componentScope(config: Config, name: string): number | null {
  const i = componentNames(config).indexOf(name);
  return i < 0 ? null : -(i + 1);
}

/** Top-level nodes of a scope: a page's sections, or `[root]` for a component. */
export function rootsOf(config: Config, scope: number): Node[] {
  if (scope >= 0) return config.pages[scope]?.sections ?? [];
  const name = scopeComponent(config, scope);
  const root = name ? config.components?.[name]?.root : undefined;
  return root ? [root] : [];
}

/**
 * Replace a scope's top-level nodes with `fn(nodes)`. A component keeps
 * exactly one root: a change that would remove it, add a sibling next to it
 * or turn it into a slot is ignored (the config comes back unchanged).
 */
export function withRoots(config: Config, scope: number, fn: (nodes: Node[]) => Node[]): Config {
  if (scope >= 0) {
    if (!config.pages[scope]) return config;
    return { ...config, pages: config.pages.map((p, i) => (i === scope ? { ...p, sections: fn(p.sections) } : p)) };
  }
  const name = scopeComponent(config, scope);
  const def = name ? config.components?.[name] : undefined;
  if (!name || !def?.root) return config;
  const next = fn([def.root]);
  if (next.length !== 1 || next[0].type === 'slot') return config;
  if (next[0] === def.root) return config;
  return { ...config, components: { ...config.components, [name]: { ...def, root: next[0] } } };
}
