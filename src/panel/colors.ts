/**
 * Swatch colors for the panel. Palette values come straight from Tailwind
 * v4's theme.css (the same file the canvas compiles), so a swatch shows the
 * exact oklch color the class will produce.
 */

import themeCss from 'tailwindcss-v4/theme.css?raw';
import { PALETTE_FAMILIES, PALETTE_SHADES } from 'neucli/core';
import type { Theme } from 'neucli/core';

export { PALETTE_FAMILIES, PALETTE_SHADES };

const PALETTE: Record<string, string> = {};
for (const m of themeCss.matchAll(/--color-([a-z]+-\d{2,3}):\s*([^;]+);/g)) PALETTE[m[1]] = m[2].trim();

const KEYWORDS: Record<string, string> = { white: '#fff', black: '#000', transparent: 'transparent', current: 'currentColor', inherit: 'inherit' };

export interface ParsedColor {
  base: string;
  /** 0-100, undefined = opaque. */
  alpha?: number;
}

export function splitColor(value: string): ParsedColor {
  const m = /^(.+?)(?:\/(\d{1,3}))?$/.exec(value.trim());
  if (!m) return { base: value };
  return { base: m[1], ...(m[2] !== undefined ? { alpha: Number(m[2]) } : {}) };
}

export function joinColor({ base, alpha }: ParsedColor): string {
  return alpha === undefined || alpha >= 100 ? base : `${base}/${Math.max(0, Math.round(alpha))}`;
}

/** CSS color for a neucli color value, or null when it isn't one we know. */
export function cssColor(value: string | undefined, theme: Theme | undefined): string | null {
  if (!value) return null;
  const { base, alpha } = splitColor(value);
  const solid = base.startsWith('#') ? base : PALETTE[base] ?? KEYWORDS[base] ?? theme?.colors?.[base] ?? null;
  if (!solid) return null;
  return alpha === undefined ? solid : `color-mix(in oklab, ${solid} ${alpha}%, transparent)`;
}

export function paletteColor(name: string): string | undefined {
  return PALETTE[name];
}
