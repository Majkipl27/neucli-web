/**
 * YAML import/export.
 *
 * The editor keeps the document as written (prop shorthands, number content,
 * key order) so exporting doesn't rewrite a hand-written file. Validation and
 * normalisation come from `neucli/core`, the same code the CLI runs.
 */

import { parse, Document, isMap, isPair, isSeq, isScalar, visit } from 'yaml';
import { validate } from 'neucli/core';
import type { Config } from './types';

export type ImportResult =
  | { ok: true; config: Config; warnings: string[] }
  | { ok: false; error: string };

/** Parse and validate YAML. Never throws. */
export function importConfig(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = parse(text);
  } catch (e) {
    return { ok: false, error: `YAML parse error: ${e instanceof Error ? e.message : String(e)}` };
  }
  const result = validate(raw);
  if (result.errors.length > 0) return { ok: false, error: result.errors.slice(0, 5).join('\n') };
  return { ok: true, config: raw as Config, warnings: result.warnings };
}

/** Readable YAML: small mappings and lists of plain values go on one line, like hand-written configs. */
export function exportConfig(config: Config): string {
  return toYaml(config, 3);
}

/**
 * YAML for any value, in the house style:
 * - layers (anything with `type:`) are always blocks, so the tree reads top-down;
 * - small style values nested at least `minDepth` levels deep go on one line
 *   (`layout: { gap: 16, padding: [24, 32] }`, `props: { title: Pro }`);
 * - `theme`, `meta`, `responsive`, `imports` and a component's prop
 *   declarations stay blocks, one entry per line.
 */
export function toYaml(value: unknown, minDepth = 1): string {
  const doc = new Document(value);
  const inline = (node: unknown, path: readonly unknown[]) =>
    path.length > minDepth &&
    !isLayer(node) &&
    !isPropDeclarations(path) &&
    !BLOCK_KEYS.has(ownKey(path) ?? '') &&
    !BLOCK_SECTIONS.has(topKey(path) ?? '') &&
    isSmall(node);
  visit(doc, {
    Map(_key, node, path) {
      if (inline(node, path)) node.flow = true;
    },
    Seq(_key, node, path) {
      if (inline(node, path)) node.flow = true;
    },
  });
  // The library pads `{ }` and `[ ]` alike; hand-written configs pad maps but
  // not short lists (`padding: [24, 32]`), so tighten plain-token lists only.
  return doc
    .toString({ lineWidth: 0, indentSeq: true, singleQuote: true })
    .replace(TIGHT_SEQ, (_m, before: string, items: string) => `${before}[${items}]`);
}

const BLOCK_SECTIONS = new Set(['theme', 'meta']);
/** Keys whose value stays a block (its entries may still be one-liners). */
const BLOCK_KEYS = new Set(['responsive', 'imports']);

/** The key this collection is the value of, if any. */
function ownKey(path: readonly unknown[]): string | undefined {
  const pair = path[path.length - 1];
  return isPair(pair) && isScalar(pair.key) ? String(pair.key.value) : undefined;
}

function isLayer(node: unknown): boolean {
  return isMap(node) && node.items.some((p) => isScalar(p.key) && p.key.value === 'type');
}

/** `components.Card.props`: the map holding the `props` pair also has a `root`. */
function isPropDeclarations(path: readonly unknown[]): boolean {
  const pair = path[path.length - 1];
  const owner = path[path.length - 2];
  return isPair(pair) && isScalar(pair.key) && pair.key.value === 'props' &&
    isMap(owner) && owner.items.some((p) => isScalar(p.key) && p.key.value === 'root');
}

/** The top-level config key a node sits under (`theme`, `pages`, ...). */
function topKey(path: readonly unknown[]): string | undefined {
  const pair = path.find(isPair);
  return pair && isScalar(pair.key) ? String(pair.key.value) : undefined;
}

const TIGHT_SEQ = /(: |, |\[|- )\[ ((?:[\w.#%/-]+, )*[\w.#%/-]+) \]/g;

const FLOW_MAX = 96;

function isSmall(node: unknown): boolean {
  const items = isMap(node) ? node.items.map((p) => p.value) : isSeq(node) ? node.items : null;
  if (!items || items.length === 0) return false;
  for (const item of items) {
    if (isScalar(item)) {
      if (typeof item.value === 'string' && item.value.includes('\n')) return false;
      continue;
    }
    // One level of nesting for number pairs like padding: [16, 32].
    if (isSeq(item) && item.items.every((i) => isScalar(i) && typeof i.value === 'number')) continue;
    // Small style maps inside overrides: phone: { layout: { padding: [16, 16] } }.
    if (isMap(item) && !isLayer(item) && isSmall(item)) continue;
    return false;
  }
  return JSON.stringify((node as { toJSON(): unknown }).toJSON()).length <= FLOW_MAX;
}

export function filenameFor(config: Config): string {
  const slug = config.meta.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return `${slug || 'neucli'}.yml`;
}
