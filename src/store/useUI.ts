/**
 * Ephemeral editor UI state: drag state, drawer visibility, transient
 * errors. Never persisted, never in undo history.
 */

import { create } from 'zustand';
import type { Path } from '../document/types';

export interface DropTarget {
  parentPath: Path;
  index: number;
}

/**
 * Preset zoom stops the +/- buttons and keyboard shortcut step through.
 * Wheel zoom uses continuous values, clamped to the same outer bounds.
 */
export const ZOOM_STEPS = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4] as const;
export const ZOOM_MIN = ZOOM_STEPS[0];
export const ZOOM_MAX = ZOOM_STEPS[ZOOM_STEPS.length - 1];

interface UIState {
  dragFrom: Path | null;
  dropTarget: DropTarget | null;

  yamlOpen: boolean;

  error: string | null;

  /** Which page's inline-edit form is open in the left sidebar. */
  editingPageIndex: number | null;

  /** Path key of the page node under the pointer on the canvas. */
  hoverKey: string | null;

  /** Bumped to ask the canvas to zoom to fit / zoom to the selection. */
  fitRequest: number;
  focusRequest: number;
  /** Bumped to start editing the selected text in place (Enter). */
  editRequest: number;

  /** Canvas zoom factor; 1 = 100%. */
  zoom: number;

  startDrag: (path: Path) => void;
  setDropTarget: (target: DropTarget | null) => void;
  endDrag: () => void;

  toggleYaml: () => void;
  setYamlOpen: (open: boolean) => void;

  setError: (error: string | null) => void;
  setEditingPageIndex: (index: number | null) => void;
  setHoverKey: (key: string | null) => void;
  requestFit: () => void;
  requestFocus: () => void;
  requestEdit: () => void;
  /** Show a short message on the canvas (e.g. why a drop was refused). */
  flash: (message: string) => void;

  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}

function clampZoom(z: number): number {
  if (Number.isNaN(z)) return 1;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

function nextStep(current: number, direction: 1 | -1): number {
  if (direction === 1) {
    for (const s of ZOOM_STEPS) if (s > current + 0.001) return s;
    return ZOOM_MAX;
  }
  for (let i = ZOOM_STEPS.length - 1; i >= 0; i--) {
    if (ZOOM_STEPS[i] < current - 0.001) return ZOOM_STEPS[i];
  }
  return ZOOM_MIN;
}

let flashTimer: ReturnType<typeof setTimeout> | undefined;

export const useUIStore = create<UIState>((set, get) => ({
  dragFrom: null,
  dropTarget: null,
  yamlOpen: false,
  error: null,
  editingPageIndex: null,
  hoverKey: null,
  fitRequest: 0,
  focusRequest: 0,
  editRequest: 0,
  zoom: 1,

  startDrag: (path) => set({ dragFrom: path, dropTarget: null }),
  setDropTarget: (target) => set({ dropTarget: target }),
  endDrag: () => set({ dragFrom: null, dropTarget: null }),

  toggleYaml: () => set((s) => ({ yamlOpen: !s.yamlOpen })),
  setYamlOpen: (yamlOpen) => set({ yamlOpen }),

  setError: (error) => set({ error }),
  setEditingPageIndex: (editingPageIndex) => set({ editingPageIndex }),
  setHoverKey: (hoverKey) => set({ hoverKey }),
  requestFit: () => set((s) => ({ fitRequest: s.fitRequest + 1 })),
  requestFocus: () => set((s) => ({ focusRequest: s.focusRequest + 1 })),
  requestEdit: () => set((s) => ({ editRequest: s.editRequest + 1 })),
  flash: (message) => {
    set({ error: message });
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      if (get().error === message) set({ error: null });
    }, 2600);
  },

  setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),
  zoomIn: () => set({ zoom: nextStep(get().zoom, 1) }),
  zoomOut: () => set({ zoom: nextStep(get().zoom, -1) }),
  resetZoom: () => set({ zoom: 1 }),
}));
