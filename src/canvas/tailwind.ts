/**
 * Tailwind v4, compiled in the browser for the canvas.
 *
 * Uses Tailwind's own `compile()` with the config's theme, the same CSS the
 * generated project's index.css feeds Tailwind, so `bg-primary`, arbitrary
 * values and responsive variants resolve exactly as they will in the build.
 */

import { themeCss } from 'neucli/core';
import type { Theme } from 'neucli/core';

export type BuildCss = (candidates: string[]) => string;

const compilers = new Map<string, Promise<BuildCss>>();

/** Tailwind's compiler and stylesheet are big; load them in their own chunk. */
async function loadTailwind() {
  const [{ compile }, { default: css }] = await Promise.all([
    import('tailwindcss-v4'),
    import('tailwindcss-v4/index.css?raw'),
  ]);
  return { compile, css };
}

/** One compiler per theme; `build` accumulates candidates and returns the full stylesheet. */
export function compilerFor(theme: Theme | undefined): Promise<BuildCss> {
  const input = `@import "tailwindcss";\n${themeCss(theme)}`;
  let compiler = compilers.get(input);
  if (!compiler) {
    compiler = loadTailwind().then(({ compile, css }) =>
      compile(input, {
        base: '/',
        async loadStylesheet(id, base) {
          if (id === 'tailwindcss') return { path: 'tailwindcss/index.css', base, content: css };
          throw new Error(`The canvas can't load stylesheet "${id}"`);
        },
      }),
    ).then((c) => (candidates: string[]) => c.build(candidates));
    compilers.set(input, compiler);
  }
  return compiler;
}

/**
 * The canvas iframe grows to the page's full height, so `100vh` would mean
 * "the whole page". Pin viewport-height units to the simulated viewport, as
 * a browser window of that size would.
 */
export function pinViewportUnits(css: string, viewportHeight: number): string {
  return css.replace(/(-?\d*\.?\d+)(?:d|s|l)?vh\b/g, (_, n: string) => `${(Number(n) * viewportHeight) / 100}px`);
}

/** Every class token used in a document. */
export function classesIn(doc: Document): string[] {
  const out = new Set<string>();
  doc.querySelectorAll('[class]').forEach((el) => {
    const value = el.getAttribute('class');
    if (value) for (const token of value.split(/\s+/)) if (token) out.add(token);
  });
  return [...out];
}
