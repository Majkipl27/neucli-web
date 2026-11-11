/**
 * Operations on several nodes at once (multi-select): move, delete,
 * duplicate, group into a frame, ungroup.
 *
 * Paths shift as soon as one node moves, so instead of juggling indices the
 * selected nodes get a temporary mark, a placeholder goes where they should
 * land, and one walk over the tree pulls the marked nodes out and swaps them
 * in for the placeholder. Then the new paths are read back from the tree.
 */

import type { Config, Node, Path } from './types';
import { cloneNode, getAt, insertAt, isAncestorOrSelf, pathEquals, updateAt } from './tree';

const MARK = '__nc_mark';
const SLOT = '__nc_drop';

type Marked = Node & { [MARK]?: number };
type WithLists = { children?: Node[]; slots?: Record<string, Node[]> };

function withSections(config: Config, pageIndex: number, fn: (sections: Node[]) => Node[]): Config {
  return { ...config, pages: config.pages.map((p, i) => (i === pageIndex ? { ...p, sections: fn(p.sections) } : p)) };
}

/** Sort paths in document order (pre-order), dropping any path inside another selected one. */
export function normalizePaths(paths: Path[]): Path[] {
  const unique = paths.filter((p, i) => paths.findIndex((q) => pathEquals(p, q)) === i);
  const outer = unique.filter((p) => !unique.some((q) => q !== p && q.length < p.length && isAncestorOrSelf(q, p)));
  return outer.sort(compareDocOrder);
}

function compareDocOrder(a: Path, b: Path): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) continue;
    if (typeof a[i] === 'number' && typeof b[i] === 'number') return (a[i] as number) - (b[i] as number);
    // children (number) come before named slots (string); slots sort by name
    if (typeof a[i] === 'number') return -1;
    if (typeof b[i] === 'number') return 1;
    return String(a[i]).localeCompare(String(b[i]));
  }
  return a.length - b.length;
}

/** Map every node list in the tree, deepest first. */
function mapLists(nodes: Node[], fn: (list: Node[]) => Node[]): Node[] {
  const mapped = nodes.map((n) => {
    const node = n as Node & WithLists;
    let next: Node & WithLists = node;
    if (node.children) {
      const children = mapLists(node.children, fn);
      next = { ...next, children };
      if (children.length === 0) delete next.children;
    }
    if (node.slots) {
      const slots: Record<string, Node[]> = {};
      for (const [k, list] of Object.entries(node.slots)) {
        const out = mapLists(list, fn);
        if (out.length) slots[k] = out;
      }
      next = { ...next, slots };
      if (Object.keys(slots).length === 0) delete next.slots;
    }
    return next as Node;
  });
  return fn(mapped);
}

/** Path of the first node matching `pred`, in document order. */
function findPath(nodes: Node[], pred: (n: Node) => boolean, prefix: Path = []): Path | null {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i] as Node & WithLists;
    const here = [...prefix, i];
    if (pred(n)) return here;
    if (n.children) {
      const hit = findPath(n.children, pred, here);
      if (hit) return hit;
    }
    for (const [k, list] of Object.entries(n.slots ?? {})) {
      const hit = findPath(list, pred, [...here, k]);
      if (hit) return hit;
    }
  }
  return null;
}

function mark(sections: Node[], paths: Path[]): Node[] {
  return paths.reduce((s, p, i) => updateAt(s, p, (n) => ({ ...n, [MARK]: i }) as unknown as Node), sections);
}

function unmark(node: Marked): Node {
  const { [MARK]: _drop, ...rest } = node;
  return rest as Node;
}

function isPlaceholder(n: Node): boolean {
  return n.type === SLOT;
}

/**
 * Move `paths` (document order kept) into the list at `listPath`, before
 * index `index` (counted in the list as it is now, selection included).
 * Returns null for impossible moves (into one of the moved nodes).
 */
export function moveMany(config: Config, pageIndex: number, paths: Path[], listPath: Path, index: number): { config: Config; newPaths: Path[] } | null {
  const sections = config.pages[pageIndex]?.sections;
  if (!sections) return null;
  const moving = normalizePaths(paths);
  if (moving.length === 0) return null;
  if (moving.some((p) => isAncestorOrSelf(p, listPath))) return null;

  let s = mark(sections, moving);
  s = insertAt(s, [...listPath, index], { type: SLOT } as Node);
  const pulled: Marked[] = [];
  s = mapLists(s, (list) =>
    list.filter((n) => {
      const m = (n as Marked)[MARK];
      if (m === undefined) return true;
      pulled[m] = n as Marked;
      return false;
    }),
  );
  const at = findPath(s, isPlaceholder);
  if (!at) return null;
  const nodes = pulled.filter(Boolean).map(unmark);
  s = mapLists(s, (list) => list.flatMap((n) => (isPlaceholder(n) ? nodes : [n])));
  const base = at[at.length - 1] as number;
  const newPaths = nodes.map((_, i) => [...at.slice(0, -1), base + i]);
  const next = withSections(config, pageIndex, () => s);
  return samePlacement(moving, newPaths) ? null : { config: next, newPaths };
}

function samePlacement(a: Path[], b: Path[]): boolean {
  return a.length === b.length && a.every((p, i) => pathEquals(p, b[i]));
}

export function deleteMany(config: Config, pageIndex: number, paths: Path[]): Config {
  const sections = config.pages[pageIndex]?.sections;
  if (!sections) return config;
  const marked = mark(sections, normalizePaths(paths));
  return withSections(config, pageIndex, () => mapLists(marked, (list) => list.filter((n) => (n as Marked)[MARK] === undefined)));
}

/** A copy of each node right after it. Returns the copies' paths. */
export function duplicateMany(config: Config, pageIndex: number, paths: Path[]): { config: Config; newPaths: Path[] } | null {
  const sections = config.pages[pageIndex]?.sections;
  const targets = normalizePaths(paths);
  if (!sections || targets.length === 0) return null;
  const marked = mark(sections, targets);
  const COPY = '__nc_copy';
  let s = mapLists(marked, (list) =>
    list.flatMap((n) => {
      const m = (n as Marked)[MARK];
      if (m === undefined) return [n];
      return [unmark(n as Marked), { ...unmark(cloneNode(n) as Marked), [COPY]: m } as unknown as Node];
    }),
  );
  const newPaths: Path[] = [];
  for (let i = 0; i < targets.length; i++) {
    const p = findPath(s, (n) => (n as unknown as Record<string, unknown>)[COPY] === i);
    if (p) newPaths.push(p);
  }
  s = mapLists(s, (list) =>
    list.map((n) => {
      if ((n as unknown as Record<string, unknown>)[COPY] === undefined) return n;
      const { [COPY]: _c, ...rest } = n as unknown as Record<string, unknown>;
      return rest as unknown as Node;
    }),
  );
  return { config: withSections(config, pageIndex, () => s), newPaths };
}

/** Do all paths sit in the same list? */
export function areSiblings(paths: Path[]): boolean {
  if (paths.length === 0) return false;
  const list = paths[0].slice(0, -1);
  return paths.every((p) => pathEquals(p.slice(0, -1), list));
}

/**
 * Wrap sibling nodes in a new frame at the first one's position, keeping
 * their order. `frame` supplies the wrapper's own keys (layout etc.).
 */
export function groupMany(config: Config, pageIndex: number, paths: Path[], frame: Record<string, unknown>): { config: Config; newPath: Path } | null {
  const sections = config.pages[pageIndex]?.sections;
  const targets = normalizePaths(paths);
  if (!sections || !areSiblings(targets)) return null;
  const list = targets[0].slice(0, -1);
  const moved = moveMany(config, pageIndex, targets, list, targets[0][targets[0].length - 1] as number);
  // moveMany returns null when nothing moved (already contiguous), which is fine here.
  const base = moved?.config ?? config;
  const startIdx = (moved?.newPaths[0] ?? targets[0])[list.length] as number;
  const children = targets.map((_, i) => getAt(base.pages[pageIndex].sections, [...list, startIdx + i])!).filter(Boolean);
  if (children.length !== targets.length) return null;
  const wrapper = { type: 'frame', ...frame, children } as unknown as Node;
  const next = withSections(base, pageIndex, (s) => {
    let out = s;
    for (let i = children.length - 1; i >= 0; i--) out = removeIndex(out, list, startIdx + i);
    return insertAt(out, [...list, startIdx], wrapper);
  });
  return { config: next, newPath: [...list, startIdx] };
}

function removeIndex(nodes: Node[], list: Path, idx: number): Node[] {
  return mapAtList(nodes, list, (l) => l.filter((_, i) => i !== idx));
}

function mapAtList(nodes: Node[], list: Path, fn: (l: Node[]) => Node[]): Node[] {
  // insertAt/removeAt work on node paths; for lists reuse insertAt's list walk via updateAt on the parent.
  if (list.length === 0) return fn(nodes);
  const last = list[list.length - 1];
  if (typeof last === 'string') {
    const owner = list.slice(0, -1);
    return updateAt(nodes, owner, (n) => {
      const slots = { ...((n as WithLists).slots ?? {}) };
      slots[last] = fn(slots[last] ?? []);
      return { ...n, slots } as Node;
    });
  }
  return updateAt(nodes, list, (n) => ({ ...n, children: fn((n as WithLists).children ?? []) }) as Node);
}

/** Replace a frame with its children. Returns the children's paths. */
export function ungroup(config: Config, pageIndex: number, path: Path): { config: Config; newPaths: Path[] } | null {
  const sections = config.pages[pageIndex]?.sections;
  const node = sections && getAt(sections, path);
  if (!node || node.type !== 'frame') return null;
  const children = (node as WithLists).children ?? [];
  const list = path.slice(0, -1);
  const idx = path[path.length - 1] as number;
  const next = withSections(config, pageIndex, (s) =>
    mapAtList(s, list, (l) => [...l.slice(0, idx), ...children, ...l.slice(idx + 1)]),
  );
  return { config: next, newPaths: children.map((_, i) => [...list, idx + i]) };
}
