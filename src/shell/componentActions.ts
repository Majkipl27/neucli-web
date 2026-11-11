/**
 * Component actions shared by the toolbar, panels and shortcuts: open a main
 * component, create one from the selection, insert presets and slots.
 */

import { getPreset } from 'neucli/core';
import { useDocumentStore } from '../store/useDocument';
import { selectedPaths, useSelectionStore } from '../store/useSelection';
import { useUIStore } from '../store/useUI';
import { componentScope, rootsOf, scopeComponent } from '../document/scope';
import { insertNode, insertionPoint } from '../document/commands';
import { applyLayout, insertPresetAt, newSlot } from '../document/components';
import type { Path } from '../document/types';

/** Open a component's definition on the canvas (Figma's "Go to main component"). */
export function openComponent(name: string): void {
  const scope = componentScope(useDocumentStore.getState().config, name);
  if (scope === null) return;
  useSelectionStore.getState().setPage(scope);
  useUIStore.getState().requestFit();
}

/** Back to the page the user came from. */
export function closeComponent(): void {
  const { lastPage, setPage } = useSelectionStore.getState();
  setPage(Math.min(lastPage, useDocumentStore.getState().config.pages.length - 1));
  useUIStore.getState().requestFit();
}

export function openCreateComponent(): void {
  if (selectedPaths().length === 0) {
    useUIStore.getState().flash('Select the layers to turn into a component.');
    return;
  }
  useUIStore.getState().setCreateComponentOpen(true);
}

/** Copy a preset's definition into the document and place an instance where new layers go. */
export function insertPreset(id: string): void {
  const { pageIndex, selection, select } = useSelectionStore.getState();
  const preset = getPreset(id);
  if (!preset) return;
  let error: string | null = null;
  let path: Path | null = null;
  let name = preset.name;
  useDocumentStore.getState().dispatch((c) => {
    path = insertionPoint(c, pageIndex, selection);
    const res = insertPresetAt(c, pageIndex, id, path);
    if (!res.ok) {
      error = res.error;
      return null;
    }
    name = res.name;
    return res.config;
  });
  if (error) return useUIStore.getState().flash(error);
  if (path) select({ pageIndex, path });
  if (name !== preset.name) useUIStore.getState().flash(`Added as ${name}: this document already has a different ${preset.name}.`, 'info');
}

/** Add a slot to the open main component. The first is the default slot; later ones get names. */
export function insertSlot(): void {
  const { pageIndex, selection, select } = useSelectionStore.getState();
  const config = useDocumentStore.getState().config;
  const name = scopeComponent(config, pageIndex);
  if (!name) return useUIStore.getState().flash('Slots go inside a component. Open one from the Components list first.');
  const node = newSlot(config.components?.[name] ?? null);
  const path = insertionPoint(config, pageIndex, selection);
  const next = insertNode(config, pageIndex, path, node);
  if (next === config || rootsOf(next, pageIndex).length !== 1) return useUIStore.getState().flash("A slot can't go there.");
  useDocumentStore.getState().dispatch(() => next);
  select({ pageIndex, path });
}

/** Add a layout preset (or a blank one) for a page, or as the site default with `pageIndex` null. */
export function addLayout(presetId: string, pageIndex: number | null): void {
  const res = applyLayout(useDocumentStore.getState().config, presetId, pageIndex);
  if (!res.ok) return useUIStore.getState().flash(res.error);
  useDocumentStore.getState().dispatch(() => res.config);
  useUIStore.getState().flash(`Added the ${res.name} layout. Open it from Components to edit it.`, 'info');
}
