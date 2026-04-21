import React, { useMemo } from 'react';
import { useDocumentStore } from '../store/useDocument';
import { useSelectionStore } from '../store/useSelection';
import { useUIStore } from '../store/useUI';
import { exportConfig, filenameFor, importConfig } from '../document/io';

export default function YamlDrawer() {
  const config = useDocumentStore((s) => s.config);
  const resetDoc = useDocumentStore((s) => s.reset);

  const setPage = useSelectionStore((s) => s.setPage);
  const clearSelection = useSelectionStore((s) => s.clear);

  const error = useUIStore((s) => s.error);
  const setError = useUIStore((s) => s.setError);
  const setYamlOpen = useUIStore((s) => s.setYamlOpen);

  const yamlText = useMemo(() => exportConfig(config), [config]);
  const pageCount = config.pages.length;

  async function pasteAndLoad() {
    try {
      const text = await navigator.clipboard.readText();
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
    } catch {
      setError('Clipboard access denied');
    }
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

  return (
    <div className="absolute inset-x-0 bottom-0 z-50 flex max-h-[50vh] flex-col border-t border-white/10 bg-[#1e1e1e]">
      <div className="flex items-center justify-between border-b border-white/10 bg-[#2c2c2c] px-4 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
          Generated YAML
        </span>
        <div className="flex items-center gap-2">
          {error && <span className="text-[10px] text-red-400">{error}</span>}
          <span className="text-[10px] text-white/30">
            {pageCount} page{pageCount > 1 ? 's' : ''}, routing {pageCount > 1 ? 'enabled' : 'off'}
          </span>
          <DrawerButton onClick={() => navigator.clipboard.writeText(yamlText)}>Copy</DrawerButton>
          <DrawerButton onClick={handleExport}>Download .yml</DrawerButton>
          <button
            type="button"
            onClick={pasteAndLoad}
            className="rounded bg-indigo-500/20 px-2.5 py-1 text-[11px] text-indigo-300 transition hover:bg-indigo-500/30"
          >
            Paste and load
          </button>
        </div>
      </div>
      <pre className="flex-1 overflow-auto p-4 font-mono text-[12px] leading-relaxed text-emerald-300/80">
        {yamlText}
      </pre>
    </div>
  );
}

function DrawerButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded bg-white/10 px-2.5 py-1 text-[11px] text-white/70 transition hover:bg-white/15"
    >
      {children}
    </button>
  );
}
