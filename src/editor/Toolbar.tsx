import React, { useRef } from 'react';
import { builtInBlockTypes } from './builtInBlockTypes';

interface ToolbarProps {
  siteName: string;
  addType: string;
  showYaml: boolean;
  onAddTypeChange: (type: string) => void;
  onAddToPage: () => void;
  onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExport: () => void;
  onToggleYaml: () => void;
}

export default function Toolbar({
  siteName,
  addType,
  showYaml,
  onAddTypeChange,
  onAddToPage,
  onImportFile,
  onExport,
  onToggleYaml,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 bg-[#2c2c2c] px-4">
      <div className="flex items-center gap-3">
        <span className="text-[13px] font-bold tracking-tight text-white/90">neucli</span>
        <span className="h-4 w-px bg-white/10" />
        <span className="text-[12px] text-white/50">{siteName}</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-md bg-white/5 px-2 py-1">
          <select
            className="bg-transparent text-[12px] text-white/70 outline-none"
            value={addType}
            onChange={(e) => onAddTypeChange(e.target.value)}
          >
            {builtInBlockTypes.map((t) => (
              <option value={t} key={t} className="bg-[#2c2c2c] text-white">
                {t}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onAddToPage}
            className="rounded bg-indigo-500 px-2.5 py-0.5 text-[11px] font-medium text-white hover:bg-indigo-400 transition"
          >
            + Add
          </button>
        </div>

        <span className="h-4 w-px bg-white/10" />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded px-2.5 py-1 text-[11px] font-medium text-white/50 hover:text-white/80 hover:bg-white/5 transition"
        >
          Import
        </button>
        <button
          type="button"
          onClick={onExport}
          className="rounded px-2.5 py-1 text-[11px] font-medium text-white/50 hover:text-white/80 hover:bg-white/5 transition"
        >
          Export
        </button>

        <span className="h-4 w-px bg-white/10" />

        <button
          type="button"
          onClick={onToggleYaml}
          className={[
            'rounded px-2.5 py-1 text-[11px] font-medium transition',
            showYaml
              ? 'bg-white/15 text-white'
              : 'text-white/50 hover:text-white/80 hover:bg-white/5',
          ].join(' ')}
        >
          {'</>'}  YAML
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".yml,.yaml,.json"
        className="hidden"
        onChange={onImportFile}
      />
    </header>
  );
}
