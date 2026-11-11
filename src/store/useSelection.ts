/**
 * Selection store.
 *
 * Kept separate from the document store so changing selection never creates
 * an undo entry.
 *
 * `selection` is the primary (last clicked) node: the property panel and
 * single-node commands use it. `paths` is every selected node on the page,
 * primary included, in the order they were picked.
 */

import { create } from 'zustand';
import type { Path, Selection } from '../document/types';
import { pathEquals } from '../document/tree';

interface SelectionState {
  /** What the canvas edits: a page index, or a negative component scope (see document/scope.ts). */
  pageIndex: number;
  /** The page to go back to after editing a main component. */
  lastPage: number;
  selection: Selection | null;
  paths: Path[];

  setPage: (index: number) => void;
  select: (selection: Selection | null) => void;
  selectPath: (path: Path) => void;
  /** Replace the selection with several nodes on the current page; the last one becomes primary. */
  selectMany: (paths: Path[]) => void;
  /** Shift+click: add the node, or remove it if it's already selected. */
  toggle: (path: Path) => void;
  clear: () => void;
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  pageIndex: 0,
  lastPage: 0,
  selection: null,
  paths: [],

  setPage: (index) => {
    set({ pageIndex: index, selection: null, paths: [], ...(index >= 0 ? { lastPage: index } : {}) });
  },
  select: (selection) => {
    set({ selection, paths: selection ? [selection.path] : [] });
  },
  selectPath: (path) => {
    set({ selection: { pageIndex: get().pageIndex, path }, paths: [path] });
  },
  selectMany: (paths) => {
    const last = paths[paths.length - 1];
    set({ paths, selection: last ? { pageIndex: get().pageIndex, path: last } : null });
  },
  toggle: (path) => {
    const { paths, pageIndex } = get();
    if (paths.some((p) => pathEquals(p, path))) {
      const rest = paths.filter((p) => !pathEquals(p, path));
      const last = rest[rest.length - 1];
      set({ paths: rest, selection: last ? { pageIndex, path: last } : null });
    } else {
      set({ paths: [...paths, path], selection: { pageIndex, path } });
    }
  },
  clear: () => {
    set({ selection: null, paths: [] });
  },
}));

/** Every selected path, or the primary alone when `paths` is out of sync. */
export function selectedPaths(): Path[] {
  const { paths, selection } = useSelectionStore.getState();
  if (paths.length) return paths;
  return selection ? [selection.path] : [];
}
