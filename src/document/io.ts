/**
 * YAML import/export. Strips editor-only fields on write and validates on read.
 */

import yaml from 'js-yaml';
import type { NeucliConfig, NeucliNode } from './types';
import { NeucliConfigSchema, formatZodError } from './schema';

export type ImportResult =
  | { ok: true; config: NeucliConfig }
  | { ok: false; error: string };

/** Parse and validate a YAML string into a NeucliConfig. Never throws. */
export function importConfig(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = yaml.load(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `YAML parse error: ${msg}` };
  }

  const result = NeucliConfigSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, error: `Invalid config: ${formatZodError(result.error)}` };
  }

  return { ok: true, config: result.data as NeucliConfig };
}

/** Serialise to a YAML string, stripping editor-only metadata. */
export function exportConfig(config: NeucliConfig): string {
  const clean = stripEditorMetadata(config);
  return yaml.dump(clean, { noRefs: true, indent: 2, lineWidth: -1 });
}

function stripEditorMetadata(config: NeucliConfig): NeucliConfig {
  return {
    ...config,
    pages: config.pages.map((page) => ({
      ...page,
      sections: page.sections.map(stripNode),
    })),
    globals: config.globals
      ? {
          navbar: config.globals.navbar ? stripNode(config.globals.navbar) : undefined,
          footer: config.globals.footer ? stripNode(config.globals.footer) : undefined,
        }
      : undefined,
  };
}

function stripNode(node: NeucliNode): NeucliNode {
  const { id: _drop, children, ...rest } = node;
  const out: NeucliNode = { ...rest };
  if (children && children.length > 0) out.children = children.map(stripNode);
  return out;
}

export function filenameFor(config: NeucliConfig): string {
  const slug = config.meta.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return `${slug || 'neucli-config'}.yml`;
}
