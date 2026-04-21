/**
 * Pure, immutable operations on a node tree.
 *
 * All functions take a node list (either a page's `sections` or a node's
 * `children`) and return a new list. Nothing in this module is React-aware
 * or touches NeucliConfig.
 */

import type { NeucliNode, Path } from './types';

export function cloneNode(node: NeucliNode): NeucliNode {
  return JSON.parse(JSON.stringify(node));
}

/** Returns the node at `path`, or null if the path is invalid. */
export function getAt(nodes: NeucliNode[], path: Path): NeucliNode | null {
  if (path.length === 0) return null;
  let list = nodes;
  let current: NeucliNode | undefined;
  for (let i = 0; i < path.length; i++) {
    current = list[path[i]];
    if (!current) return null;
    list = current.children ?? [];
  }
  return current ?? null;
}

/**
 * Returns a new node list with the node at `path` replaced by `updater(node)`.
 * If the path is invalid the input is returned unchanged.
 */
export function updateAt(
  nodes: NeucliNode[],
  path: Path,
  updater: (node: NeucliNode) => NeucliNode,
): NeucliNode[] {
  if (path.length === 0) return nodes;
  const [idx, ...rest] = path;
  if (idx < 0 || idx >= nodes.length) return nodes;

  if (rest.length === 0) {
    return nodes.map((n, i) => (i === idx ? updater(n) : n));
  }

  return nodes.map((n, i) => {
    if (i !== idx) return n;
    const children = n.children ?? [];
    return { ...n, children: updateAt(children, rest, updater) };
  });
}

/**
 * Returns a new list with `node` inserted at `path`. The last element of the
 * path is the insertion index in its parent's child list; preceding elements
 * are the parent path. Out-of-range indices are clamped.
 */
export function insertAt(nodes: NeucliNode[], path: Path, node: NeucliNode): NeucliNode[] {
  if (path.length === 0) return nodes;
  const parentPath = path.slice(0, -1);
  const index = path[path.length - 1];
  const toInsert = normaliseForInsert(node);

  if (parentPath.length === 0) {
    const out = [...nodes];
    out.splice(clamp(index, 0, out.length), 0, toInsert);
    return out;
  }

  return updateAt(nodes, parentPath, (parent) => {
    const children = parent.children ? [...parent.children] : [];
    children.splice(clamp(index, 0, children.length), 0, toInsert);
    return { ...parent, children };
  });
}

export function removeAt(nodes: NeucliNode[], path: Path): NeucliNode[] {
  if (path.length === 0) return nodes;
  const parentPath = path.slice(0, -1);
  const index = path[path.length - 1];

  if (parentPath.length === 0) {
    if (index < 0 || index >= nodes.length) return nodes;
    return nodes.filter((_, i) => i !== index);
  }

  return updateAt(nodes, parentPath, (parent) => {
    const children = (parent.children ?? []).filter((_, i) => i !== index);
    return { ...parent, children };
  });
}

/**
 * Move a node from `from` to `to`. Adjusts for same-parent index shifting
 * automatically. Returns the new list and the resulting path of the moved
 * node, or null if the source path is invalid.
 */
export function moveNode(
  nodes: NeucliNode[],
  from: Path,
  to: Path,
): { nodes: NeucliNode[]; newPath: Path } | null {
  if (from.length === 0 || to.length === 0) return null;
  const node = getAt(nodes, from);
  if (!node) return null;

  const fromParent = from.slice(0, -1);
  const toParent = to.slice(0, -1);
  const fromIdx = from[from.length - 1];
  const toIdx = to[to.length - 1];

  const sameParent =
    fromParent.length === toParent.length &&
    fromParent.every((v, i) => v === toParent[i]);

  const adjustedIdx = sameParent && fromIdx < toIdx ? toIdx - 1 : toIdx;
  const removed = removeAt(nodes, from);
  const inserted = insertAt(removed, [...toParent, adjustedIdx], cloneNode(node));
  return { nodes: inserted, newPath: [...toParent, adjustedIdx] };
}

/** Swap the node at `path` with its neighbour in `direction`, if any. */
export function swapSibling(
  nodes: NeucliNode[],
  path: Path,
  direction: 'up' | 'down',
): { nodes: NeucliNode[]; newPath: Path } | null {
  if (path.length === 0) return null;
  const parentPath = path.slice(0, -1);
  const idx = path[path.length - 1];
  const newIdx = direction === 'up' ? idx - 1 : idx + 1;

  const siblings =
    parentPath.length === 0 ? nodes : getAt(nodes, parentPath)?.children ?? null;
  if (!siblings || newIdx < 0 || newIdx >= siblings.length) return null;

  if (parentPath.length === 0) {
    const out = [...nodes];
    [out[idx], out[newIdx]] = [out[newIdx], out[idx]];
    return { nodes: out, newPath: [...parentPath, newIdx] };
  }

  const out = updateAt(nodes, parentPath, (parent) => {
    const children = [...(parent.children ?? [])];
    [children[idx], children[newIdx]] = [children[newIdx], children[idx]];
    return { ...parent, children };
  });
  return { nodes: out, newPath: [...parentPath, newIdx] };
}

export function pathEquals(a: Path | null | undefined, b: Path | null | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** True if `ancestor` is a strict prefix of `descendant`. */
export function isAncestorOf(ancestor: Path, descendant: Path): boolean {
  if (ancestor.length >= descendant.length) return false;
  for (let i = 0; i < ancestor.length; i++) {
    if (ancestor[i] !== descendant[i]) return false;
  }
  return true;
}

function clamp(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

/** Drop empty `children: []` so YAML output stays clean. */
function normaliseForInsert(node: NeucliNode): NeucliNode {
  if (node.children && node.children.length === 0) {
    const { children: _drop, ...rest } = node;
    return rest;
  }
  return node;
}
