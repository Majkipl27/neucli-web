/**
 * The document as the CLI would see it: validated and normalised by
 * `neucli/core`. While an edit leaves the document invalid, the canvas keeps
 * showing the last valid version and the errors are listed.
 */

import { validate } from 'neucli/core';
import type { Config } from 'neucli/core';
import { useDocumentStore } from './useDocument';

export interface Validated {
  /** Last valid, normalised config (what gets rendered). */
  config: Config;
  /** Errors in the current document; empty when it's valid. */
  errors: string[];
  warnings: string[];
}

const cache = new WeakMap<object, Validated>();
let lastGood: Config | null = null;

export function validated(raw: Config): Validated {
  const hit = cache.get(raw);
  if (hit) return hit;
  const result = validate(raw);
  if (result.config && result.errors.length === 0) lastGood = result.config;
  const out: Validated = {
    config: (result.errors.length === 0 ? result.config : lastGood) ?? (raw as Config),
    errors: result.errors,
    warnings: result.warnings,
  };
  cache.set(raw, out);
  return out;
}

export function useValidated(): Validated {
  return validated(useDocumentStore((s) => s.config));
}
