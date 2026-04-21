/**
 * localStorage persistence for the document store.
 *
 * The store itself uses `loadPersistedConfig()` (defined here, dependency-free)
 * as its initial state, so a reload does not flash the default config.
 * `startPersisting()` wires up debounced writes; call it once from the app
 * entry.
 */

import type { NeucliConfig } from '../document/types';
import { NeucliConfigSchema } from '../document/schema';
import { useDocumentStore } from './useDocument';

const STORAGE_KEY = 'neucli-web:doc:v1';
const DEBOUNCE_MS = 400;

/**
 * Read the persisted config if the browser has one and it validates against
 * the current schema. Never throws: a malformed blob is silently dropped so
 * the user gets the default config instead of a broken session.
 *
 * Intentionally depends on nothing from this package's store, so
 * `useDocument.ts` can call it at module init without a circular import.
 */
export function loadPersistedConfig(): NeucliConfig | null {
  if (typeof window === 'undefined') return null;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    const result = NeucliConfigSchema.safeParse(parsed);
    if (!result.success) return null;
    return result.data as NeucliConfig;
  } catch {
    return null;
  }
}

export function clearPersistedConfig(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Quota / privacy-mode errors are benign here.
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;
let lastWritten: NeucliConfig | null = null;

function write(config: NeucliConfig): void {
  if (typeof window === 'undefined') return;
  if (config === lastWritten) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    lastWritten = config;
  } catch {
    // Quota exceeded / access denied: skip, retry on next change.
  }
}

/**
 * Subscribe the document store to localStorage. Call once at app startup.
 * Writes are debounced so a burst of edits produces a single write.
 */
export function startPersisting(): () => void {
  const unsubscribe = useDocumentStore.subscribe((state, prev) => {
    if (state.config === prev.config) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      write(state.config);
    }, DEBOUNCE_MS);
  });

  if (typeof window !== 'undefined') {
    // Flush any pending debounce on unload so the last edit survives a reload.
    window.addEventListener('beforeunload', () => {
      if (timer) clearTimeout(timer);
      write(useDocumentStore.getState().config);
    });
  }

  return unsubscribe;
}
