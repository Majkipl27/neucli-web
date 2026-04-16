import React from 'react';

interface YamlDrawerProps {
  yamlText: string;
  pageCount: number;
  importError: string | null;
  onCopy: () => void;
  onExport: () => void;
  onPasteAndLoad: () => void;
}

export default function YamlDrawer({
  yamlText,
  pageCount,
  importError,
  onCopy,
  onExport,
  onPasteAndLoad,
}: YamlDrawerProps) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-50 flex max-h-[50vh] flex-col border-t border-white/10 bg-[#1e1e1e]">
      <div className="flex items-center justify-between border-b border-white/10 bg-[#2c2c2c] px-4 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
          Generated YAML
        </span>
        <div className="flex items-center gap-2">
          {importError && <span className="text-[10px] text-red-400">{importError}</span>}
          <span className="text-[10px] text-white/30">
            {pageCount} page{pageCount > 1 ? 's' : ''} — routing {pageCount > 1 ? 'enabled' : 'off'}
          </span>
          <button
            type="button"
            onClick={onCopy}
            className="rounded bg-white/10 px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/15 transition"
          >
            Copy
          </button>
          <button
            type="button"
            onClick={onExport}
            className="rounded bg-white/10 px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/15 transition"
          >
            Download .yml
          </button>
          <button
            type="button"
            onClick={onPasteAndLoad}
            className="rounded bg-indigo-500/20 px-2.5 py-1 text-[11px] text-indigo-300 hover:bg-indigo-500/30 transition"
          >
            Paste and load
          </button>
        </div>
      </div>
      <pre className="flex-1 overflow-auto p-4 text-[12px] leading-relaxed text-emerald-300/80 font-mono">
        {yamlText}
      </pre>
    </div>
  );
}
