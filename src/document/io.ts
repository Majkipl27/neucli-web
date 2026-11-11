/**
 * YAML import/export.
 *
 * The editor keeps the document as written (prop shorthands, number content,
 * key order) so exporting doesn't rewrite a hand-written file. Validation and
 * normalisation come from `neucli/core`, the same code the CLI runs.
 */

import { parse, Document, isMap, isSeq, isScalar, visit } from 'yaml';
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
 * YAML for any value. Collections nested at least `minDepth` levels deep go
 * on one line when they're small (`layout: { gap: 16, padding: [24, 32] }`).
 */
export function toYaml(value: unknown, minDepth = 1): string {
  const doc = new Document(value);
  visit(doc, {
    Map(_key, node, path) {
      if (path.length > minDepth && isSmall(node)) node.flow = true;
    },
    Seq(_key, node, path) {
      if (path.length > minDepth && isSmall(node)) node.flow = true;
    },
  });
  // The library pads `{ }` and `[ ]` alike; hand-written configs pad maps but
  // not short lists (`padding: [24, 32]`), so tighten plain-token lists only.
  return doc
    .toString({ lineWidth: 0, indentSeq: true })
    .replace(TIGHT_SEQ, (_m, before: string, items: string) => `${before}[${items}]`);
}

const TIGHT_SEQ = /(: |, |\[|- )\[ ((?:[\w.#%/-]+, )*[\w.#%/-]+) \]/g;

const FLOW_MAX = 72;

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
    return false;
  }
  return JSON.stringify((node as { toJSON(): unknown }).toJSON()).length <= FLOW_MAX;
}

export function filenameFor(config: Config): string {
  const slug = config.meta.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return `${slug || 'neucli'}.yml`;
}
