/**
 * Atomic document mutations. Each function returns a new config (or null when
 * it's a no-op); never mutates input. All user actions go through these so
 * undo history stays coherent.
 */

import type { NeucliConfig, NeucliNode, NeucliPage, Path, Selection } from './types';
import { getAt, insertAt, removeAt, swapSibling, moveNode, updateAt } from './tree';

function withPages(
  config: NeucliConfig,
  fn: (pages: NeucliPage[]) => NeucliPage[],
): NeucliConfig {
  return { ...config, pages: fn(config.pages) };
}

function withSections(
  config: NeucliConfig,
  pageIndex: number,
  fn: (sections: NeucliNode[]) => NeucliNode[],
): NeucliConfig {
  return withPages(config, (pages) =>
    pages.map((p, i) => (i === pageIndex ? { ...p, sections: fn(p.sections) } : p)),
  );
}

// Pages

export function addPage(config: NeucliConfig): { config: NeucliConfig; newIndex: number } {
  const idx = config.pages.length;
  const name = `Page ${idx + 1}`;
  const page: NeucliPage = {
    path: `/${name.toLowerCase().replace(/\s+/g, '-')}`,
    name,
    title: name,
    meta: { description: '' },
    sections: [],
  };
  return {
    config: withPages(config, (pages) => [...pages, page]),
    newIndex: idx,
  };
}

export function deletePage(config: NeucliConfig, index: number): NeucliConfig {
  if (config.pages.length <= 1) return config;
  return withPages(config, (pages) => pages.filter((_, i) => i !== index));
}

export function duplicatePage(
  config: NeucliConfig,
  index: number,
): { config: NeucliConfig; newIndex: number } {
  const source = config.pages[index];
  if (!source) return { config, newIndex: index };
  const copy: NeucliPage = JSON.parse(JSON.stringify(source));
  copy.name = `${source.name} (copy)`;
  copy.path = `${source.path}-copy`;
  copy.title = `${source.title ?? source.name} (copy)`;
  const newIndex = index + 1;
  return {
    config: withPages(config, (pages) => {
      const out = [...pages];
      out.splice(newIndex, 0, copy);
      return out;
    }),
    newIndex,
  };
}

export function updatePage(
  config: NeucliConfig,
  index: number,
  updates: Partial<NeucliPage>,
): NeucliConfig {
  return withPages(config, (pages) =>
    pages.map((p, i) => (i === index ? { ...p, ...updates } : p)),
  );
}

// Nodes

export function appendToPage(
  config: NeucliConfig,
  pageIndex: number,
  node: NeucliNode,
): NeucliConfig {
  return withSections(config, pageIndex, (sections) =>
    insertAt(sections, [sections.length], node),
  );
}

export function insertAtTop(
  config: NeucliConfig,
  pageIndex: number,
  index: number,
  node: NeucliNode,
): NeucliConfig {
  return withSections(config, pageIndex, (sections) => insertAt(sections, [index], node));
}

export function insertChild(
  config: NeucliConfig,
  target: Selection,
  index: number,
  node: NeucliNode,
): NeucliConfig {
  return withSections(config, target.pageIndex, (sections) =>
    insertAt(sections, [...target.path, index], node),
  );
}

export function appendChild(
  config: NeucliConfig,
  target: Selection,
  node: NeucliNode,
): NeucliConfig {
  const parent = getAt(config.pages[target.pageIndex]?.sections ?? [], target.path);
  const count = parent?.children?.length ?? 0;
  return insertChild(config, target, count, node);
}

export function insertSibling(
  config: NeucliConfig,
  target: Selection,
  node: NeucliNode,
): NeucliConfig {
  if (target.path.length === 0) return config;
  const parentPath = target.path.slice(0, -1);
  const index = target.path[target.path.length - 1] + 1;
  return withSections(config, target.pageIndex, (sections) =>
    insertAt(sections, [...parentPath, index], node),
  );
}

export function deleteNode(config: NeucliConfig, target: Selection): NeucliConfig {
  return withSections(config, target.pageIndex, (sections) => removeAt(sections, target.path));
}

/**
 * Deep-clone the selected node and drop the copy immediately after it.
 * Returns the new path of the copy so the caller can move selection onto it.
 */
export function duplicateNode(
  config: NeucliConfig,
  target: Selection,
): { config: NeucliConfig; newPath: Path } | null {
  if (target.path.length === 0) return null;
  const sections = config.pages[target.pageIndex]?.sections ?? [];
  const source = getAt(sections, target.path);
  if (!source) return null;
  const copy: NeucliNode = JSON.parse(JSON.stringify(source));
  const parentPath = target.path.slice(0, -1);
  const insertIndex = target.path[target.path.length - 1] + 1;
  const newPath = [...parentPath, insertIndex];
  return {
    config: withSections(config, target.pageIndex, (s) => insertAt(s, newPath, copy)),
    newPath,
  };
}

/** Swap selected node with its neighbour. Returns the new path of the moved node. */
export function moveSibling(
  config: NeucliConfig,
  target: Selection,
  direction: 'up' | 'down',
): { config: NeucliConfig; newPath: Path } | null {
  const sections = config.pages[target.pageIndex]?.sections ?? [];
  const result = swapSibling(sections, target.path, direction);
  if (!result) return null;
  return {
    config: withSections(config, target.pageIndex, () => result.nodes),
    newPath: result.newPath,
  };
}

export function moveTo(
  config: NeucliConfig,
  pageIndex: number,
  from: Path,
  to: Path,
): { config: NeucliConfig; newPath: Path } | null {
  const sections = config.pages[pageIndex]?.sections ?? [];
  const result = moveNode(sections, from, to);
  if (!result) return null;
  return {
    config: withSections(config, pageIndex, () => result.nodes),
    newPath: result.newPath,
  };
}

// Properties

export function setClassName(config: NeucliConfig, target: Selection, className: string): NeucliConfig {
  return withSections(config, target.pageIndex, (sections) =>
    updateAt(sections, target.path, (n) => ({ ...n, className })),
  );
}

export function setText(config: NeucliConfig, target: Selection, text: string): NeucliConfig {
  return withSections(config, target.pageIndex, (sections) =>
    updateAt(sections, target.path, (n) => ({ ...n, text })),
  );
}

export function setProp(
  config: NeucliConfig,
  target: Selection,
  key: string,
  value: unknown,
): NeucliConfig {
  return withSections(config, target.pageIndex, (sections) =>
    updateAt(sections, target.path, (n) => ({
      ...n,
      props: { ...(n.props ?? {}), [key]: value },
    })),
  );
}

export function setProps(
  config: NeucliConfig,
  target: Selection,
  props: Record<string, unknown>,
): NeucliConfig {
  return withSections(config, target.pageIndex, (sections) =>
    updateAt(sections, target.path, (n) => ({ ...n, props: { ...(n.props ?? {}), ...props } })),
  );
}

export function replaceNode(
  config: NeucliConfig,
  target: Selection,
  replacement: NeucliNode,
): NeucliConfig {
  return withSections(config, target.pageIndex, (sections) =>
    updateAt(sections, target.path, () => replacement),
  );
}

// Site level

export function setMeta(
  config: NeucliConfig,
  updates: Partial<NeucliConfig['meta']>,
): NeucliConfig {
  return { ...config, meta: { ...config.meta, ...updates } };
}

export function setThemeColor(config: NeucliConfig, key: string, value: string): NeucliConfig {
  return {
    ...config,
    theme: { ...(config.theme ?? {}), colors: { ...(config.theme?.colors ?? {}), [key]: value } },
  };
}

export function deleteThemeColor(config: NeucliConfig, key: string): NeucliConfig {
  const colors = { ...(config.theme?.colors ?? {}) };
  delete colors[key];
  return { ...config, theme: { ...(config.theme ?? {}), colors } };
}

/** Rename a color token, preserving insertion order as best as possible. */
export function renameThemeColor(
  config: NeucliConfig,
  oldKey: string,
  newKey: string,
): NeucliConfig {
  const colors: Record<string, string> = {};
  for (const [k, v] of Object.entries(config.theme?.colors ?? {})) {
    colors[k === oldKey ? newKey : k] = v;
  }
  return { ...config, theme: { ...(config.theme ?? {}), colors } };
}

export function setThemeFont(config: NeucliConfig, key: string, value: string): NeucliConfig {
  return {
    ...config,
    theme: { ...(config.theme ?? {}), fonts: { ...(config.theme?.fonts ?? {}), [key]: value } },
  };
}

export function deleteThemeFont(config: NeucliConfig, key: string): NeucliConfig {
  const fonts = { ...(config.theme?.fonts ?? {}) };
  delete fonts[key];
  return { ...config, theme: { ...(config.theme ?? {}), fonts } };
}

export function renameThemeFont(
  config: NeucliConfig,
  oldKey: string,
  newKey: string,
): NeucliConfig {
  const fonts: Record<string, string> = {};
  for (const [k, v] of Object.entries(config.theme?.fonts ?? {})) {
    fonts[k === oldKey ? newKey : k] = v;
  }
  return { ...config, theme: { ...(config.theme ?? {}), fonts } };
}
