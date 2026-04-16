import React, { useState } from 'react';
import type { NeucliConfig, NeucliPage, PageSelection } from './types';
import NodeTree from './NodeTree';

interface LeftSidebarProps {
  config: NeucliConfig;
  pageIndex: number;
  selection: PageSelection | null;
  onSwitchPage: (idx: number) => void;
  onAddPage: () => void;
  onDeletePage: (idx: number) => void;
  onDuplicatePage: (idx: number) => void;
  onUpdatePage: (idx: number, updates: Partial<NeucliPage>) => void;
  onUpdateConfig: (fn: (prev: NeucliConfig) => NeucliConfig) => void;
  onSelectNode: (sel: PageSelection) => void;
  onMoveUp: (path: number[]) => void;
  onMoveDown: (path: number[]) => void;
  onDrop: (fromPath: number[], toParentPath: number[], toIndex: number) => void;
}

export default function LeftSidebar({
  config,
  pageIndex,
  selection,
  onSwitchPage,
  onAddPage,
  onDeletePage,
  onDuplicatePage,
  onUpdatePage,
  onUpdateConfig,
  onSelectNode,
  onMoveUp,
  onMoveDown,
  onDrop,
}: LeftSidebarProps) {
  const [editingPageIndex, setEditingPageIndex] = useState<number | null>(null);
  const currentPage = config.pages[pageIndex];

  return (
    <aside className="flex w-[240px] shrink-0 flex-col border-r border-white/10 bg-[#252526]">
      <PagesSection
        pages={config.pages}
        activeIndex={pageIndex}
        onSwitch={onSwitchPage}
        onAdd={onAddPage}
        onDelete={onDeletePage}
        onDuplicate={onDuplicatePage}
        onStartEdit={setEditingPageIndex}
      />

      {editingPageIndex !== null && (
        <PageSettingsInline
          page={config.pages[editingPageIndex]}
          onChange={(updates) => onUpdatePage(editingPageIndex, updates)}
          onClose={() => setEditingPageIndex(null)}
        />
      )}

      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Layers</span>
        <span className="text-[10px] text-white/25">{currentPage?.name}</span>
      </div>

      <div className="flex-1 overflow-auto px-1 py-1">
        <NodeTree
          nodes={currentPage?.sections ?? []}
          selectedPath={selection?.path ?? null}
          onSelect={(path) => onSelectNode({ pageIndex, path })}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onDrop={onDrop}
        />
      </div>

      <SiteSettings config={config} onUpdateConfig={onUpdateConfig} />
    </aside>
  );
}

function PagesSection({
  pages,
  activeIndex,
  onSwitch,
  onAdd,
  onDelete,
  onDuplicate,
  onStartEdit,
}: {
  pages: NeucliPage[];
  activeIndex: number;
  onSwitch: (idx: number) => void;
  onAdd: () => void;
  onDelete: (idx: number) => void;
  onDuplicate: (idx: number) => void;
  onStartEdit: (idx: number) => void;
}) {
  return (
    <div className="border-b border-white/10">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Pages</span>
        <button
          type="button"
          onClick={onAdd}
          className="rounded bg-white/5 px-1.5 py-0.5 text-[11px] text-white/50 hover:bg-white/10 hover:text-white/80 transition border border-white/10"
        >
          +
        </button>
      </div>
      <div className="max-h-[200px] overflow-auto px-1 pb-1">
        {pages.map((page, idx) => (
          <div key={idx} className="group relative">
            <button
              type="button"
              onClick={() => onSwitch(idx)}
              onDoubleClick={() => onStartEdit(idx)}
              className={[
                'flex w-full items-center gap-2 rounded px-2 py-[5px] text-left transition-colors',
                idx === activeIndex
                  ? 'bg-indigo-500/20 text-white'
                  : 'text-white/60 hover:bg-white/5 hover:text-white/80',
              ].join(' ')}
            >
              <span className="w-4 shrink-0 text-center text-[10px] opacity-50">&#x22A1;</span>
              <span className="flex-1 truncate text-[12px]">{page.name}</span>
              <span className="text-[10px] text-white/30">{page.path}</span>
            </button>

            <div className="absolute right-1 top-0.5 hidden items-center gap-0.5 group-hover:flex">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDuplicate(idx); }}
                className="rounded p-0.5 text-[10px] text-white/30 hover:bg-white/10 hover:text-white/70"
                title="Duplicate page"
              >
                &#x29C9;
              </button>
              {pages.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDelete(idx); }}
                  className="rounded p-0.5 text-[10px] text-red-400/50 hover:bg-red-500/10 hover:text-red-400"
                  title="Delete page"
                >
                  &#x2715;
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PageSettingsInline({
  page,
  onChange,
  onClose,
}: {
  page: NeucliPage;
  onChange: (updates: Partial<NeucliPage>) => void;
  onClose: () => void;
}) {
  const inputClass =
    'w-full rounded bg-white/5 px-2 py-1 text-[12px] text-white/80 outline-none border border-white/10 focus:border-indigo-500/50';

  return (
    <div className="border-b border-white/10 px-3 py-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Edit page</span>
        <button type="button" onClick={onClose} className="text-[10px] text-white/30 hover:text-white/60">
          Done
        </button>
      </div>
      <input className={inputClass} value={page.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Page name" />
      <input className={inputClass} value={page.path} onChange={(e) => onChange({ path: e.target.value })} placeholder="/path" />
      <input className={inputClass} value={page.title ?? ''} onChange={(e) => onChange({ title: e.target.value })} placeholder="Page title (for <title> tag)" />
      <input className={inputClass} value={page.meta?.description ?? ''} onChange={(e) => onChange({ meta: { ...page.meta, description: e.target.value } })} placeholder="Page meta description" />
    </div>
  );
}

function SiteSettings({
  config,
  onUpdateConfig,
}: {
  config: NeucliConfig;
  onUpdateConfig: (fn: (prev: NeucliConfig) => NeucliConfig) => void;
}) {
  const inputClass =
    'w-full rounded bg-white/5 px-2 py-1 text-[12px] text-white/80 outline-none border border-white/10 focus:border-indigo-500/50';
  const halfInputClass =
    'flex-1 rounded bg-white/5 px-2 py-1 text-[12px] text-white/80 outline-none border border-white/10 focus:border-indigo-500/50';

  function updateMeta(key: string, value: string) {
    onUpdateConfig((prev) => ({ ...prev, meta: { ...prev.meta, [key]: value } }));
  }

  function updateFont(key: string, value: string) {
    onUpdateConfig((prev) => ({
      ...prev,
      theme: { ...prev.theme, fonts: { ...(prev.theme?.fonts ?? {}), [key]: value } },
    }));
  }

  function updateColor(key: string, value: string) {
    onUpdateConfig((prev) => ({
      ...prev,
      theme: { ...prev.theme, colors: { ...(prev.theme?.colors ?? {}), [key]: value } },
    }));
  }

  return (
    <div className="border-t border-white/10 px-3 py-2.5 space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Site</div>
      <input className={inputClass} value={config.meta.name} onChange={(e) => updateMeta('name', e.target.value)} placeholder="Site name" />
      <input className={inputClass} value={config.meta.description ?? ''} onChange={(e) => updateMeta('description', e.target.value)} placeholder="Site description" />
      <div className="flex gap-1.5">
        <input className={halfInputClass} value={config.meta.lang ?? 'en'} onChange={(e) => updateMeta('lang', e.target.value)} placeholder="Lang" />
        <input className={halfInputClass} value={config.meta.favicon ?? ''} onChange={(e) => updateMeta('favicon', e.target.value)} placeholder="Favicon URL" />
      </div>

      <div className="text-[10px] font-semibold uppercase tracking-wider text-white/30 pt-1">Fonts</div>
      <div className="flex gap-1.5">
        <input className={halfInputClass} value={config.theme?.fonts?.heading ?? ''} onChange={(e) => updateFont('heading', e.target.value)} placeholder="Heading font" />
        <input className={halfInputClass} value={config.theme?.fonts?.body ?? ''} onChange={(e) => updateFont('body', e.target.value)} placeholder="Body font" />
      </div>

      <div className="text-[10px] font-semibold uppercase tracking-wider text-white/30 pt-1">Colors</div>
      <div className="flex gap-1.5">
        <ColorPicker label="Primary" value={config.theme?.colors?.primary ?? '#6366f1'} onChange={(v) => updateColor('primary', v)} />
        <ColorPicker label="Secondary" value={config.theme?.colors?.secondary ?? '#0ea5e9'} onChange={(v) => updateColor('secondary', v)} />
      </div>
    </div>
  );
}

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-1 items-center gap-1 rounded bg-white/5 border border-white/10 px-1.5 py-0.5">
      <input
        type="color"
        className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="text-[10px] text-white/40">{label}</span>
    </div>
  );
}
