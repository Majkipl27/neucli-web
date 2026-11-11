/**
 * Pure, immutable operations on a page's node tree.
 *
 * See `Path` in ./types for addressing. Every function returns new arrays and
 * leaves its input untouched.
 */

import type { Node, Path } from './types';

type Children = { children?: Node[]; slots?: Record<string, Node[]> };

export function cloneNode<T>(node: T): T {
  return JSON.parse(JSON.stringify(node));
}

/** The node list at a list path, or null when the path doesn't lead anywhere. */
export function getList(nodes: Node[], listPath: Path): Node[] | null {
  let list: Node[] = nodes;
  let current: Node | null = null;
  for (const seg of listPath) {
    if (typeof seg === 'string') {
      if (!current) return null;
      list = (current as Children).slots?.[seg] ?? [];
      current = null;
      continue;
    }
    current = list[seg] ?? null;
    if (!current) return null;
    list = (current as Children).children ?? [];
  }
  return list;
}

export function getAt(nodes: Node[], path: Path): Node | null {
  if (path.length === 0) return null;
  const idx = path[path.length - 1];
  if (typeof idx !== 'number') return null;
  return getList(nodes, path.slice(0, -1))?.[idx] ?? null;
}

/** Replace the list at `listPath` with `fn(list)`. Unknown paths return `nodes` unchanged. */
export function updateList(nodes: Node[], listPath: Path, fn: (list: Node[]) => Node[]): Node[] {
  if (listPath.length === 0) return fn(nodes);
  const [head, ...rest] = listPath;
  if (typeof head !== 'number' || !nodes[head]) return nodes;
  const node = nodes[head] as Node & Children;
  let next: Node;
  if (rest.length > 0 && typeof rest[0] === 'string') {
    const slot = rest[0];
    const slots = { ...(node.slots ?? {}) };
    slots[slot] = updateList(slots[slot] ?? [], rest.slice(1), fn);
    if (slots[slot].length === 0) delete slots[slot];
    next = { ...node, slots } as Node;
    if (Object.keys(slots).length === 0) delete (next as Children).slots;
  } else {
    const children = updateList(node.children ?? [], rest, fn);
    next = { ...node, children } as Node;
    if (children.length === 0) delete (next as Children).children;
  }
  return nodes.map((n, i) => (i === head ? next : n));
}

export function updateAt(nodes: Node[], path: Path, fn: (node: Node) => Node): Node[] {
  const idx = path[path.length - 1];
  if (typeof idx !== 'number') return nodes;
  return updateList(nodes, path.slice(0, -1), (list) =>
    idx >= 0 && idx < list.length ? list.map((n, i) => (i === idx ? fn(n) : n)) : list,
  );
}

export function insertAt(nodes: Node[], path: Path, node: Node): Node[] {
  const idx = path[path.length - 1];
  if (typeof idx !== 'number') return nodes;
  return updateList(nodes, path.slice(0, -1), (list) => {
    const out = [...list];
    out.splice(clamp(idx, 0, out.length), 0, node);
    return out;
  });
}

export function removeAt(nodes: Node[], path: Path): Node[] {
  const idx = path[path.length - 1];
  if (typeof idx !== 'number') return nodes;
  return updateList(nodes, path.slice(0, -1), (list) => list.filter((_, i) => i !== idx));
}

/**
 * Move a node from `from` to `to` (a path whose last segment is the index in
 * the destination list, counted before removal). Returns null for invalid
 * moves, including moving a node into itself.
 */
export function moveNode(nodes: Node[], from: Path, to: Path): { nodes: Node[]; newPath: Path } | null {
  const node = getAt(nodes, from);
  if (!node || to.length === 0) return null;
  const toList = to.slice(0, -1);
  if (isAncestorOrSelf(from, toList)) return null;
  const fromList = from.slice(0, -1);
  const fromIdx = from[from.length - 1] as number;
  let toIdx = to[to.length - 1] as number;
  if (pathEquals(fromList, toList) && fromIdx < toIdx) toIdx -= 1;

  // Removing `from` shifts later siblings of any ancestor on the destination path.
  const adjustedList = toList.map((seg, i) =>
    i === fromList.length && pathEquals(fromList, toList.slice(0, i)) && typeof seg === 'number' && seg > fromIdx
      ? seg - 1
      : seg,
  );
  const removed = removeAt(nodes, from);
  const newPath = [...adjustedList, toIdx];
  return { nodes: insertAt(removed, newPath, node), newPath };
}

export function swapSibling(nodes: Node[], path: Path, direction: 'up' | 'down'): { nodes: Node[]; newPath: Path } | null {
  const idx = path[path.length - 1];
  if (typeof idx !== 'number') return null;
  const listPath = path.slice(0, -1);
  const list = getList(nodes, listPath);
  const next = direction === 'up' ? idx - 1 : idx + 1;
  if (!list || next < 0 || next >= list.length) return null;
  const out = updateList(nodes, listPath, (l) => {
    const copy = [...l];
    [copy[idx], copy[next]] = [copy[next], copy[idx]];
    return copy;
  });
  return { nodes: out, newPath: [...listPath, next] };
}

export function pathEquals(a: Path | null | undefined, b: Path | null | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

/** True when `ancestor` is `path` itself or one of its ancestors. */
export function isAncestorOrSelf(ancestor: Path, path: Path): boolean {
  if (ancestor.length > path.length) return false;
  return ancestor.every((v, i) => v === path[i]);
}

/** Stable string key for a path, used to tag rendered elements. */
export function pathKey(path: Path): string {
  return path.join('.');
}

export function parsePathKey(key: string): Path {
  if (key === '') return [];
  return key.split('.').map((s) => (/^\d+$/.test(s) ? Number(s) : s));
}

/** Path of the closest node containing `path` (drops the index, and a slot name if present). */
export function parentPath(path: Path): Path {
  const list = path.slice(0, -1);
  if (typeof list[list.length - 1] === 'string') list.pop();
  return list;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
