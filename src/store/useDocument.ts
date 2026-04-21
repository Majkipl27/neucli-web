/**
 * Document store: current config plus an undo/redo history stack.
 *
 * Mutations are commands that take the current config and return the next
 * one. Every dispatch either starts a new history entry or coalesces into
 * the current one; coalescing lets text-input typing produce a single undo
 * step per burst rather than one per keystroke.
 */

import { create } from 'zustand';
import type { NeucliConfig } from '../document/types';
import { DEFAULT_CONFIG } from '../document/defaults';
import { loadPersistedConfig } from './persist';

// Hydrate from localStorage synchronously so a reload doesn't flash the
// default config. Falls back to DEFAULT_CONFIG when nothing is saved or
// the saved blob fails schema validation.
const INITIAL_CONFIG: NeucliConfig = loadPersistedConfig() ?? DEFAULT_CONFIG;

const MAX_HISTORY = 100;
const COALESCE_WINDOW_MS = 600;

/**
 * - 'commit' (default): always pushes a new history entry.
 * - 'coalesce': replaces the current entry if the previous dispatch used the
 *   same `group` within the coalesce window; otherwise pushes.
 */
export interface DispatchOptions {
  mode?: 'commit' | 'coalesce';
  /** Consecutive 'coalesce' dispatches with the same group merge into one entry. */
  group?: string;
}

interface HistoryMeta {
  at: number;
  group?: string;
  mode: 'commit' | 'coalesce';
}

interface DocumentState {
  config: NeucliConfig;
  history: NeucliConfig[];
  meta: HistoryMeta[];
  index: number;

  canUndo: () => boolean;
  canRedo: () => boolean;

  /** Replace the whole config (YAML import, "New"). Clears history. */
  reset: (config: NeucliConfig) => void;

  dispatch: (
    command: (current: NeucliConfig) => NeucliConfig | null,
    options?: DispatchOptions,
  ) => void;

  undo: () => void;
  redo: () => void;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  config: INITIAL_CONFIG,
  history: [INITIAL_CONFIG],
  meta: [{ at: Date.now(), mode: 'commit' }],
  index: 0,

  canUndo: () => get().index > 0,
  canRedo: () => get().index < get().history.length - 1,

  reset: (config) => {
    set({
      config,
      history: [config],
      meta: [{ at: Date.now(), mode: 'commit' }],
      index: 0,
    });
  },

  dispatch: (command, options) => {
    const state = get();
    const next = command(state.config);
    if (!next || next === state.config) return;

    const mode = options?.mode ?? 'commit';
    const now = Date.now();
    const lastMeta = state.meta[state.index];
    const canCoalesce =
      mode === 'coalesce' &&
      lastMeta.mode === 'coalesce' &&
      lastMeta.group !== undefined &&
      lastMeta.group === options?.group &&
      now - lastMeta.at <= COALESCE_WINDOW_MS;

    const truncatedHistory = state.history.slice(0, state.index + 1);
    const truncatedMeta = state.meta.slice(0, state.index + 1);

    if (canCoalesce) {
      truncatedHistory[truncatedHistory.length - 1] = next;
      truncatedMeta[truncatedMeta.length - 1] = { ...lastMeta, at: now };
      set({
        config: next,
        history: truncatedHistory,
        meta: truncatedMeta,
        index: truncatedHistory.length - 1,
      });
      return;
    }

    truncatedHistory.push(next);
    truncatedMeta.push({ at: now, mode, group: options?.group });

    let newIndex = truncatedHistory.length - 1;
    if (truncatedHistory.length > MAX_HISTORY) {
      const overflow = truncatedHistory.length - MAX_HISTORY;
      truncatedHistory.splice(0, overflow);
      truncatedMeta.splice(0, overflow);
      newIndex = truncatedHistory.length - 1;
    }

    set({
      config: next,
      history: truncatedHistory,
      meta: truncatedMeta,
      index: newIndex,
    });
  },

  undo: () => {
    const state = get();
    if (state.index <= 0) return;
    const newIndex = state.index - 1;
    set({ config: state.history[newIndex], index: newIndex });
  },

  redo: () => {
    const state = get();
    if (state.index >= state.history.length - 1) return;
    const newIndex = state.index + 1;
    set({ config: state.history[newIndex], index: newIndex });
  },
}));

export const useConfig = (): NeucliConfig => useDocumentStore((s) => s.config);
