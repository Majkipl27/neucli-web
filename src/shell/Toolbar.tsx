import React, { useMemo, useRef } from 'react';
import { useDocumentStore } from '../store/useDocument';
import { useSelectionStore } from '../store/useSelection';
import { useUIStore } from '../store/useUI';
import { exportConfig, filenameFor, importConfig } from '../document/io';
import { DEFAULT_CONFIG } from '../document/defaults';
import { clearPersistedConfig } from '../store/persist';

export default function Toolbar() {
  const config = useDocumentStore((s) => s.config);
  const resetDoc = useDocumentStore((s) => s.reset);
  const canUndo = useDocumentStore((s) => s.canUndo());
  const canRedo = useDocumentStore((s) => s.canRedo());
  const undo = useDocumentStore((s) => s.undo);
  const redo = useDocumentStore((s) => s.redo);

  const setPage = useSelectionStore((s) => s.setPage);
  const clearSelection = useSelectionStore((s) => s.clear);

  const yamlOpen = useUIStore((s) => s.yamlOpen);
  const toggleYaml = useUIStore((s) => s.toggleYaml);
  const setYamlOpen = useUIStore((s) => s.setYamlOpen);
  const setError = useUIStore((s) => s.setError);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const yamlText = useMemo(() => exportConfig(config), [config]);

  function handleImport(text: string) {
    const result = importConfig(text);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    resetDoc(result.config);
    setPage(0);
    clearSelection();
    setError(null);
    setYamlOpen(false);
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
    const blob = new Blob([yamlText], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filenameFor(config);
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleReset() {
    const ok = window.confirm(
      'Reset the editor to the default Nova demo? This will discard all current changes.',
    );
    if (!ok) return;
    clearPersistedConfig();
    resetDoc(DEFAULT_CONFIG);
    setPage(0);
    clearSelection();
    setError(null);
    setYamlOpen(false);
  }

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 bg-[#2c2c2c] px-4">
      <div className="flex items-center gap-3">
        <span className="text-[13px] font-bold tracking-tight text-white/90">neucli</span>
        <span className="h-4 w-px bg-white/10" />
        <span className="text-[12px] text-white/50">{config.meta.name}</span>
      </div>

      <div className="flex items-center gap-1">
        <IconButton title="Undo" disabled={!canUndo} onClick={undo}>
          &#x21BA;
        </IconButton>
        <IconButton title="Redo" disabled={!canRedo} onClick={redo}>
          &#x21BB;
        </IconButton>

        <span className="mx-1 h-4 w-px bg-white/10" />

        <GhostButton onClick={() => fileInputRef.current?.click()}>Import</GhostButton>
        <GhostButton onClick={handleExport}>Export</GhostButton>
        <GhostButton onClick={handleReset} tone="danger" title="Wipe current edits and reload the default demo">
          Reset
        </GhostButton>

        <span className="mx-1 h-4 w-px bg-white/10" />

        <button
          type="button"
          onClick={toggleYaml}
          className={[
            'rounded px-2.5 py-1 text-[11px] font-medium transition',
            yamlOpen
              ? 'bg-white/15 text-white'
              : 'text-white/50 hover:bg-white/5 hover:text-white/80',
          ].join(' ')}
        >
          {'</>'} YAML
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".yml,.yaml,.json"
        className="hidden"
        onChange={handleFileImport}
      />
    </header>
  );
}

function GhostButton({
  children,
  onClick,
  tone = 'default',
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: 'default' | 'danger';
  title?: string;
}) {
  const toneClass =
    tone === 'danger'
      ? 'text-red-300/60 hover:bg-red-500/10 hover:text-red-200'
      : 'text-white/50 hover:bg-white/5 hover:text-white/80';
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`rounded px-2.5 py-1 text-[11px] font-medium transition ${toneClass}`}
    >
      {children}
    </button>
  );
}

function IconButton({
  children,
  title,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
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
