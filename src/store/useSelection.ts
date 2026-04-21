/**
 * Selection store.
 *
 * Kept separate from the document store so changing selection never creates
 * an undo entry.
 */

import { create } from 'zustand';
import type { Path, Selection } from '../document/types';

interface SelectionState {
  pageIndex: number;
  selection: Selection | null;

  setPage: (index: number) => void;
  select: (selection: Selection | null) => void;
  selectPath: (path: Path) => void;
  clear: () => void;
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  pageIndex: 0,
  selection: null,

  setPage: (index) => {
    set({ pageIndex: index, selection: null });
  },
  select: (selection) => {
    set({ selection });
  },
  selectPath: (path) => {
    set({ selection: { pageIndex: get().pageIndex, path } });
  },
  clear: () => {
    set({ selection: null });
  },
}));
