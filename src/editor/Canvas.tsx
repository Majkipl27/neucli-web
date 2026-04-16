import React from 'react';
import type { NeucliConfig, NeucliNode, PageSelection } from './types';
import { createDefaultNode } from './builtInDefaults';
import { insertBlockAtIndex, insertChildAtIndex } from './treeOps';
import PreviewCanvas from './PreviewCanvas';

interface CanvasProps {
  config: NeucliConfig;
  pageIndex: number;
  selection: PageSelection | null;
  onSwitchPage: (idx: number) => void;
  onAddPage: () => void;
  onSelectNode: (sel: PageSelection) => void;
  onClearSelection: () => void;
  onUpdateConfig: (fn: (prev: NeucliConfig) => NeucliConfig) => void;
  onDrop: (fromPath: number[], toParentPath: number[], toIndex: number) => void;
}

export default function Canvas({
  config,
  pageIndex,
  selection,
  onSwitchPage,
  onAddPage,
  onSelectNode,
  onClearSelection,
  onUpdateConfig,
  onDrop,
}: CanvasProps) {
  const currentPage = config.pages[pageIndex];

  return (
    <main
      className="relative flex-1 overflow-auto canvas-bg"
      onClick={() => onClearSelection()}
    >
      <div className="sticky top-0 z-10 flex items-center gap-0.5 border-b border-white/10 bg-[#1e1e1e]/90 backdrop-blur-sm px-8 pt-4 pb-0">
        {config.pages.map((page, idx) => (
          <button
            key={idx}
            type="button"
            onClick={(e) => { e.stopPropagation(); onSwitchPage(idx); }}
            className={[
              'rounded-t px-3 py-1.5 text-[11px] font-medium transition',
              idx === pageIndex
                ? 'bg-white text-slate-900 shadow-sm'
                : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60',
            ].join(' ')}
          >
            {page.name}
          </button>
        ))}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onAddPage(); }}
          className="rounded-t px-2 py-1.5 text-[11px] text-white/30 hover:bg-white/5 hover:text-white/50 transition"
        >
          +
        </button>
      </div>

      <div className="p-8 pb-[50vh]" style={{ minWidth: 'max-content' }}>
        <div
          className="mx-auto rounded-lg bg-white shadow-2xl shadow-black/40 overflow-hidden"
          style={{ width: 1280, minHeight: 600 }}
          onClick={(e) => e.stopPropagation()}
        >
          <PreviewCanvas
            nodes={currentPage?.sections ?? []}
            selectedPath={selection?.path ?? null}
            onSelect={(path) => onSelectNode({ pageIndex, path })}
            onInsertAtIndex={(index, type) => {
              onUpdateConfig((prev) => insertBlockAtIndex(prev, pageIndex, index, createDefaultNode(type, '')));
            }}
            onInsertChildAtPath={(parentPath, index, type) => {
              onUpdateConfig((prev) =>
                insertChildAtIndex(prev, { pageIndex, path: parentPath }, index, createDefaultNode(type, '')),
              );
            }}
            onDrop={onDrop}
          />
        </div>
      </div>
    </main>
  );
}
