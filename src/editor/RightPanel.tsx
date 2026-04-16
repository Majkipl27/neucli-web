import React from 'react';
import type { NeucliNode, NeucliPage } from './types';
import NodeEditorPanel from './NodeEditorPanel';

interface RightPanelProps {
  selectedNode: NeucliNode | null;
  currentPage: NeucliPage | undefined;
  addType: string;
  hasSelection: boolean;
  onChangeClassName: (className: string) => void;
  onChangeText: (text: string) => void;
  onChangeProp: (key: string, value: string) => void;
  onChangeLinks: (links: Array<{ label: string; href: string }>) => void;
  onAddChild: () => void;
  onAddSibling: () => void;
  onDelete: () => void;
  onConvertToContainer: () => void;
  onUpdatePage: (updates: Partial<NeucliPage>) => void;
}

export default function RightPanel({
  selectedNode,
  currentPage,
  addType,
  hasSelection,
  onChangeClassName,
  onChangeText,
  onChangeProp,
  onChangeLinks,
  onAddChild,
  onAddSibling,
  onDelete,
  onConvertToContainer,
  onUpdatePage,
}: RightPanelProps) {
  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-l border-white/10 bg-[#252526]">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
          {selectedNode ? 'Design' : 'Properties'}
        </span>
        {selectedNode && (
          <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300">
            {selectedNode.type}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {selectedNode ? (
          <NodeEditorPanel
            selectedNode={selectedNode}
            addType={addType}
            onChangeClassName={onChangeClassName}
            onChangeText={onChangeText}
            onChangeProp={onChangeProp}
            onChangeLinks={onChangeLinks}
            onAddChild={onAddChild}
            onAddSibling={onAddSibling}
            onDelete={onDelete}
            onConvertToContainer={onConvertToContainer}
            hasSelection={hasSelection}
          />
        ) : (
          <PagePropertiesPanel page={currentPage} onChange={onUpdatePage} />
        )}
      </div>
    </aside>
  );
}

function PagePropertiesPanel({
  page,
  onChange,
}: {
  page: NeucliPage | undefined;
  onChange: (updates: Partial<NeucliPage>) => void;
}) {
  if (!page) return null;

  return (
    <div>
      <div className="border-b border-white/10 px-3 py-2.5">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">Page settings</div>
        <div className="space-y-2">
          <DarkField label="Name" value={page.name} onChange={(v) => onChange({ name: v })} />
          <DarkField label="Path" value={page.path} onChange={(v) => onChange({ path: v })} placeholder="/" />
          <DarkField label="Title" value={page.title ?? ''} onChange={(v) => onChange({ title: v })} placeholder="Page title" />
          <DarkField
            label="Description"
            value={page.meta?.description ?? ''}
            onChange={(v) => onChange({ meta: { ...page.meta, description: v } })}
            placeholder="Meta description"
          />
        </div>
      </div>
      <div className="px-3 py-4 text-center">
        <p className="text-[11px] text-white/30">
          Select a layer or click a block on the canvas to edit its properties.
        </p>
      </div>
    </div>
  );
}

function DarkField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] text-white/40">{label}</label>
      <input
        className="w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-[12px] text-white/80 outline-none placeholder:text-white/20 focus:border-indigo-500/50"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
