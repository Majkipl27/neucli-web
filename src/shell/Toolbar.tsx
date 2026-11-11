import React, { useRef, useState } from 'react';
import { useDocumentStore } from '../store/useDocument';
import { useSelectionStore } from '../store/useSelection';
import { useUIStore } from '../store/useUI';
import { exportConfig, filenameFor, importConfig } from '../document/io';
import { EXAMPLES, BLANK_CONFIG, loadExample } from '../document/examples';
import { PRIMITIVES, createNode } from '../document/palette';
import { insertNode, insertionPoint } from '../document/commands';
import { clearPersistedConfig } from '../store/persist';
import type { Config } from '../document/types';
import { PRESETS } from 'neucli/core';
import { scopeComponent } from '../document/scope';
import { insertPreset, insertSlot, openCreateComponent } from './componentActions';

export default function Toolbar() {
  const config = useDocumentStore((s) => s.config);
  const resetDoc = useDocumentStore((s) => s.reset);
  const canUndo = useDocumentStore((s) => s.canUndo());
  const canRedo = useDocumentStore((s) => s.canRedo());
  const undo = useDocumentStore((s) => s.undo);
  const redo = useDocumentStore((s) => s.redo);

  const setPage = useSelectionStore((s) => s.setPage);

  const yamlOpen = useUIStore((s) => s.yamlOpen);
  const toggleYaml = useUIStore((s) => s.toggleYaml);
  const setYamlOpen = useUIStore((s) => s.setYamlOpen);
  const setError = useUIStore((s) => s.setError);
  const requestFit = useUIStore((s) => s.requestFit);
  const error = useUIStore((s) => s.error);
  const errorKind = useUIStore((s) => s.errorKind);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function load(next: Config) {
    resetDoc(next);
    setPage(0);
    setError(null);
    setYamlOpen(false);
    requestFit();
  }

  function handleImport(text: string) {
    const result = importConfig(text);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    load(result.config);
  }

  function handleFileImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => handleImport(reader.result as string);
    reader.readAsText(file);
    event.target.value = '';
  }

  function handleExport() {
    const blob = new Blob([exportConfig(config)], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filenameFor(config);
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleOpen(id: string) {
    useUIStore.getState().askConfirm({
      message: 'Replace the current document? Unsaved changes are lost (export first if you need them).',
      action: 'Replace',
      onConfirm: () => {
        clearPersistedConfig();
        load(id === 'blank' ? BLANK_CONFIG : loadExample(id));
      },
    });
  }

  function insert(type: string) {
    const { pageIndex, selection, select } = useSelectionStore.getState();
    const node = createNode(type);
    let path = null as ReturnType<typeof insertionPoint> | null;
    useDocumentStore.getState().dispatch((c) => {
      path = insertionPoint(c, pageIndex, selection);
      return insertNode(c, pageIndex, path, node);
    });
    if (path) select({ pageIndex, path });
  }

  const pageIndex = useSelectionStore((s) => s.pageIndex);
  const openComponent = scopeComponent(config, pageIndex);
  // An instance of the component being edited would contain itself.
  const components = Object.keys(config.components ?? {}).filter((c) => c !== openComponent);
  const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
  const componentItems: MenuItem[] = [
    { id: 'action:create', label: 'Create component', hint: isMac ? '⌥⌘K' : 'Ctrl+Alt+K' },
    ...(openComponent ? [{ id: 'action:slot', label: 'Slot', hint: 'where instances put content' }] : []),
    ...(components.length ? [{ header: 'In this document' }, ...components.map((c) => ({ id: `doc:${c}`, label: c }))] : []),
    { header: 'Library' },
    ...PRESETS.filter((p) => p.kind === 'block').map((p) => ({ id: `preset:${p.id}`, label: p.label, hint: p.description })),
  ];

  function pickComponent(id: string) {
    const [kind, value] = [id.slice(0, id.indexOf(':')), id.slice(id.indexOf(':') + 1)];
    if (kind === 'action' && value === 'create') return openCreateComponent();
    if (kind === 'action' && value === 'slot') return insertSlot();
    if (kind === 'preset') return insertPreset(value);
    if (kind === 'doc') return insert(value);
  }

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 bg-[#2c2c2c] px-4">
      <div className="flex items-center gap-3">
        <span className="text-[13px] font-bold tracking-tight text-white/90">neucli</span>
        <span className="h-4 w-px bg-white/10" />
        <span className="text-[12px] text-white/50">{config.meta.name}</span>
        <span className="h-4 w-px bg-white/10" />
        <div className="flex items-center gap-0.5">
          {PRIMITIVES.map((p) => (
            <button
              key={p.type}
              type="button"
              title={`Insert ${p.label.toLowerCase()}`}
              onClick={() => insert(p.type)}
              className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-white/55 transition hover:bg-white/5 hover:text-white/90"
            >
              <span className="w-3 text-center text-[11px] text-white/35">{p.icon}</span>
              {p.label}
            </button>
          ))}
          <Menu label="Component" items={componentItems} onPick={pickComponent} wide />
        </div>
      </div>

      <div className="flex items-center gap-1">
        {error && <span className={`mr-2 max-w-[320px] truncate text-[11px] ${errorKind === 'info' ? 'text-neutral-400' : 'text-red-300/80'}`} title={error}>{error}</span>}
        <IconButton title="Undo (Ctrl Z)" disabled={!canUndo} onClick={undo}>&#x21BA;</IconButton>
        <IconButton title="Redo (Ctrl Shift Z)" disabled={!canRedo} onClick={redo}>&#x21BB;</IconButton>

        <span className="mx-1 h-4 w-px bg-white/10" />

        <Menu label="Open" items={[...EXAMPLES.map((e) => ({ id: e.id, label: e.label })), { id: 'blank', label: 'Blank site' }]} onPick={handleOpen} />
        <GhostButton onClick={() => fileInputRef.current?.click()}>Import</GhostButton>
        <GhostButton onClick={handleExport}>Export</GhostButton>

        <span className="mx-1 h-4 w-px bg-white/10" />

        <button
          type="button"
          onClick={toggleYaml}
          className={['rounded px-2.5 py-1 text-[11px] font-medium transition', yamlOpen ? 'bg-white/15 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white/80'].join(' ')}
        >
          {'</>'} YAML
        </button>
      </div>

      <input ref={fileInputRef} type="file" accept=".yml,.yaml" className="hidden" onChange={handleFileImport} />
    </header>
  );
}

type MenuItem = { id: string; label: string; hint?: string } | { header: string };

function Menu({ label, items, onPick, wide }: { label: string; items: MenuItem[]; onPick: (id: string) => void; wide?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`rounded px-2.5 py-1 text-[11px] font-medium transition ${open ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white/80'}`}
      >
        {label} &#x25BE;
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={`absolute left-0 top-full z-50 mt-1 max-h-[70vh] overflow-auto rounded border border-white/10 bg-[#2c2c2c] py-1 shadow-xl shadow-black/40 ${wide ? 'w-[260px]' : 'min-w-[180px]'}`}>
            {items.map((item, i) =>
              'header' in item ? (
                <div key={`h${i}`} className="mt-1 border-t border-white/5 px-3 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                  {item.header}
                </div>
              ) : (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onPick(item.id);
                  }}
                  className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-[12px] text-white/70 hover:bg-indigo-500/20 hover:text-white"
                >
                  <span className="shrink-0">{item.label}</span>
                  {item.hint && <span className="ml-auto truncate text-[10px] text-white/30">{item.hint}</span>}
                </button>
              ),
            )}
          </div>
        </>
      )}
    </div>
  );
}

function GhostButton({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title?: string }) {
  return (
    <button type="button" onClick={onClick} title={title} className="rounded px-2.5 py-1 text-[11px] font-medium text-white/50 transition hover:bg-white/5 hover:text-white/80">
      {children}
    </button>
  );
}

function IconButton({ children, title, onClick, disabled }: { children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="rounded px-2 py-1 text-[13px] text-white/50 transition hover:bg-white/5 hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
