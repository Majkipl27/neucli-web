/**
 * Theme token references: count them, and rename them everywhere.
 *
 * Colors are referenced by structured values (`fill`, `color`, `border.color`,
 * `shadow.color`, gradient stops, in every breakpoint) and by escape-hatch
 * classes (`hover:bg-primary/50`). Fonts by `font.family` and `font-heading`.
 */

import type { Config } from 'neucli/core';

type Kind = 'colors' | 'fonts';
type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** `primary`, `primary/20` -> `brand`, `brand/20`; anything else unchanged. */
function swapColor(value: unknown, from: string, to: string | null, hit: () => void): unknown {
  if (typeof value !== 'string') return value;
  const m = /^([^/]+)(\/\d{1,3})?$/.exec(value);
  if (!m || m[1] !== from) return value;
  hit();
  return to === null ? value : to + (m[2] ?? '');
}

function swapClasses(className: string, kind: Kind, from: string, to: string | null, hit: () => void): string {
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = kind === 'colors'
    ? new RegExp(`^((?:[\\w-]+:)*[a-z-]+-)${escaped}(/\\d{1,3})?$`)
    : new RegExp(`^((?:[\\w-]+:)*font-)${escaped}$`);
  return className
    .split(/(\s+)/)
    .map((tok) => {
      const m = re.exec(tok);
      if (!m) return tok;
      hit();
      return to === null ? tok : m[1] + to + (m[2] ?? '');
    })
    .join('');
}

function walkStyle(style: Obj, kind: Kind, from: string, to: string | null, hit: () => void): Obj {
  const out: Obj = { ...style };
  if (kind === 'colors') {
    if ('fill' in out) {
      out.fill = isObj(out.fill)
        ? { ...out.fill, from: swapColor(out.fill.from, from, to, hit), via: swapColor(out.fill.via, from, to, hit), to: swapColor(out.fill.to, from, to, hit) }
        : swapColor(out.fill, from, to, hit);
      if (isObj(out.fill) && out.fill.via === undefined) delete (out.fill as Obj).via;
    }
    if ('color' in out) out.color = swapColor(out.color, from, to, hit);
    if (isObj(out.border) && 'color' in out.border) out.border = { ...out.border, color: swapColor(out.border.color, from, to, hit) };
    if (isObj(out.shadow) && 'color' in out.shadow) out.shadow = { ...out.shadow, color: swapColor(out.shadow.color, from, to, hit) };
  } else if (isObj(out.font) && out.font.family === from) {
    hit();
    if (to !== null) out.font = { ...out.font, family: to };
  }
  return out;
}

function walk(value: unknown, kind: Kind, from: string, to: string | null, hit: () => void): unknown {
  if (Array.isArray(value)) return value.map((v) => walk(v, kind, from, to, hit));
  if (!isObj(value)) return value;
  let out: Obj = value;
  if (typeof value.type === 'string') {
    out = walkStyle(value, kind, from, to, hit);
    if (isObj(out.responsive)) {
      const r: Obj = {};
      for (const [bp, layer] of Object.entries(out.responsive)) r[bp] = isObj(layer) ? walkStyle(layer, kind, from, to, hit) : layer;
      out.responsive = r;
    }
    if (typeof out.className === 'string') out.className = swapClasses(out.className, kind, from, to, hit);
  }
  const result: Obj = {};
  for (const [k, v] of Object.entries(out)) result[k] = k === 'responsive' ? v : walk(v, kind, from, to, hit);
  return result;
}

function walkConfig(config: Config, kind: Kind, from: string, to: string | null): { config: Config; uses: number } {
  let uses = 0;
  const hit = () => uses++;
  const pages = config.pages.map((p) => ({ ...p, sections: walk(p.sections, kind, from, to, hit) as Config['pages'][number]['sections'] }));
  const components = config.components
    ? (Object.fromEntries(
        Object.entries(config.components).map(([name, def]) => [name, def.root ? { ...def, root: walk(def.root, kind, from, to, hit) } : def]),
      ) as Config['components'])
    : undefined;
  return { config: { ...config, pages, ...(components ? { components } : {}) }, uses };
}

/** How many places reference a theme token. */
export function tokenUses(config: Config, kind: Kind, name: string): number {
  return walkConfig(config, kind, name, null).uses;
}

/** Rename a token and every reference to it, keeping its position in the theme. */
export function renameTokenEverywhere(config: Config, kind: Kind, from: string, to: string): Config {
  const { config: next } = walkConfig(config, kind, from, to);
  const tokens = next.theme?.[kind] ?? {};
  const renamed = Object.fromEntries(Object.entries(tokens).map(([k, v]) => [k === from ? to : k, v]));
  return { ...next, theme: { ...(next.theme ?? {}), [kind]: renamed } };
}
