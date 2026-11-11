import React, { useEffect, useState } from 'react';
import { parse } from 'yaml';
import { toYaml } from '../document/io';
import { isInstance, validate } from 'neucli/core';
import type { Node, Page, PrimitiveNode, PropDef, Selection } from '../document/types';
import { useDocumentStore } from '../store/useDocument';
import { useSelectionStore } from '../store/useSelection';
import { getAt, pathKey } from '../document/tree';
import { iconFor, labelFor } from '../document/palette';
import {
  deleteNode as cmdDeleteNode,
  patchNode as cmdPatchNode,
  replaceNode as cmdReplaceNode,
  setInstanceProp as cmdSetInstanceProp,
  updatePage as cmdUpdatePage,
} from '../document/commands';
import ErrorBoundary from './ErrorBoundary';

/**
 * Minimal properties panel for now: content fields per node type, and the
 * node's YAML for everything else (styles included). The real auto layout
 * panel is Phase 4.
 */
export default function RightPanel() {
  const config = useDocumentStore((s) => s.config);
  const dispatch = useDocumentStore((s) => s.dispatch);
  const pageIndex = useSelectionStore((s) => s.pageIndex);
  const selection = useSelectionStore((s) => s.selection);
  const clearSelection = useSelectionStore((s) => s.clear);

  const node = selection ? getAt(config.pages[selection.pageIndex]?.sections ?? [], selection.path) : null;
  const page = config.pages[pageIndex];

  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-l border-white/10 bg-[#252526]">
      {node && selection ? (
        <ErrorBoundary resetKey={pathKey(selection.path)} label="Property panel crashed">
          <NodePanel
            key={`${selection.pageIndex}:${pathKey(selection.path)}`}
            node={node}
            selection={selection}
            onDelete={() => {
              dispatch((c) => cmdDeleteNode(c, selection));
              clearSelection();
            }}
          />
        </ErrorBoundary>
      ) : page ? (
        <PagePanel
          page={page}
          layouts={Object.keys(config.components ?? {})}
          defaultLayout={config.layout}
          onChange={(updates) => dispatch((c) => cmdUpdatePage(c, pageIndex, updates), { mode: 'coalesce', group: `page:${pageIndex}` })}
        />
      ) : null}
    </aside>
  );
}

// --- node --------------------------------------------------------------------

function NodePanel({ node: any, selection, onDelete }: { node: Node; selection: Selection; onDelete: () => void }) {
  const node = any as PrimitiveNode;
  const config = useDocumentStore((s) => s.config);
  const dispatch = useDocumentStore((s) => s.dispatch);
  const key = pathKey(selection.path);

  const patch = (field: string, value: unknown) =>
    dispatch((c) => cmdPatchNode(c, selection, { [field]: value }), { mode: 'coalesce', group: `${field}:${key}` });
  /** Optional string fields: empty removes the key. */
  const optional = (field: string) => (v: string) => patch(field, v === '' ? undefined : v);

  const def = isInstance(any) ? config.components?.[any.type] : undefined;

  return (
    <>
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
        <span className={`text-[12px] ${isInstance(any) ? 'text-violet-300' : 'text-white/50'}`}>{iconFor(any)}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-medium text-white/90">{labelFor(any)}</div>
          <div className="text-[10px] text-white/35">{isInstance(any) ? `instance of ${any.type}` : any.type}</div>
        </div>
        <button
          type="button"
          onClick={onDelete}
          title="Delete (Del)"
          className="rounded px-1.5 py-0.5 text-[11px] text-red-400/60 transition hover:bg-red-500/10 hover:text-red-400"
        >
          Delete
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <Section title="Content">
          {node.type === 'text' && (
            <>
              <TextArea label="Content" value={String(node.content)} onChange={(v) => patch('content', v)} />
              <Field label="Tag" value={node.tag ?? ''} placeholder="p" onChange={optional('tag')} />
            </>
          )}
          {node.type === 'link' && (
            <>
              <Field label="Href" value={node.href} onChange={(v) => patch('href', v)} />
              {node.content !== undefined && <Field label="Text" value={String(node.content)} onChange={(v) => patch('content', v)} />}
              <Check label="Open in new tab" checked={!!node.newTab} onChange={(v) => patch('newTab', v || undefined)} />
            </>
          )}
          {node.type === 'image' && (
            <>
              <Field label="Source" value={node.src} onChange={(v) => patch('src', v)} />
              <Field label="Alt text" value={node.alt ?? ''} onChange={optional('alt')} />
            </>
          )}
          {node.type === 'input' && (
            <>
              <Field label="Field name" value={node.field ?? ''} onChange={optional('field')} />
              <Field label="Placeholder" value={node.placeholder ?? ''} onChange={optional('placeholder')} />
              <Field label="Input type" value={node.inputType ?? ''} placeholder="text" onChange={optional('inputType')} />
            </>
          )}
          {node.type === 'frame' && <Field label="Tag" value={node.tag ?? ''} placeholder="div" onChange={optional('tag')} />}
          {def && <InstanceProps node={any} props={(def.props ?? {}) as Record<string, PropDef | string>} selection={selection} />}
        </Section>

        <Section title="Layer">
          <Field label="Layer name" value={'name' in any ? any.name ?? '' : ''} placeholder={labelFor({ ...any, name: undefined } as Node)} onChange={optional('name')} />
          <Field label="HTML id" value={'id' in any ? any.id ?? '' : ''} onChange={optional('id')} />
          <Field label="Extra classes" value={'className' in any ? any.className ?? '' : ''} mono onChange={optional('className')} />
        </Section>

        <Section title="YAML">
          <NodeYaml node={any} selection={selection} key={JSON.stringify(any)} />
        </Section>
      </div>
    </>
  );
}

function InstanceProps({ node, props, selection }: { node: Node; props: Record<string, PropDef | string>; selection: Selection }) {
  const dispatch = useDocumentStore((s) => s.dispatch);
  const values = (node as { props?: Record<string, unknown> }).props ?? {};
  const entries = Object.entries(props);
  if (entries.length === 0) return <div className="text-[11px] text-white/30">This component has no props.</div>;

  const set = (prop: string, value: unknown) =>
    dispatch((c) => cmdSetInstanceProp(c, selection, prop, value), { mode: 'coalesce', group: `prop:${prop}:${pathKey(selection.path)}` });

  return (
    <>
      {entries.map(([prop, raw]) => {
        const d: PropDef = typeof raw === 'string' ? { type: raw as PropDef['type'] } : raw;
        const value = values[prop];
        const placeholder = d.default !== undefined ? String(d.default) : '';
        if (d.type === 'boolean') {
          return <Check key={prop} label={prop} checked={value === undefined ? d.default === true : !!value} onChange={(v) => set(prop, v)} />;
        }
        if (d.type === 'number') {
          return (
            <Field
              key={prop}
              label={prop}
              value={value === undefined ? '' : String(value)}
              placeholder={placeholder}
              onChange={(v) => set(prop, v === '' || Number.isNaN(Number(v)) ? undefined : Number(v))}
            />
          );
        }
        return <Field key={prop} label={`${prop} (${d.type})`} value={value === undefined ? '' : String(value)} placeholder={placeholder} onChange={(v) => set(prop, v)} />;
      })}
    </>
  );
}

/** The node as YAML. Edit and apply with Cmd/Ctrl+Enter or the button; only valid documents are applied. */
function NodeYaml({ node, selection }: { node: Node; selection: Selection }) {
  const dispatch = useDocumentStore((s) => s.dispatch);
  const original = toYaml(node);
  const [text, setText] = useState(original);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setText(original), [original]);

  function apply() {
    let next: unknown;
    try {
      next = parse(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return;
    }
    const candidate = cmdReplaceNode(useDocumentStore.getState().config, selection, next as Node);
    const result = validate(candidate);
    if (result.errors.length > 0) {
      setError(result.errors.slice(0, 3).join('\n'));
      return;
    }
    setError(null);
    dispatch(() => candidate);
  }

  return (
    <div>
      <textarea
        className="h-56 w-full resize-y rounded border border-white/10 bg-black/20 p-2 font-mono text-[11px] leading-relaxed text-emerald-200/80 outline-none focus:border-indigo-500/50"
        spellCheck={false}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            apply();
          }
        }}
      />
      {error && <pre className="mt-1 whitespace-pre-wrap font-mono text-[10px] text-red-300/90">{error}</pre>}
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[10px] text-white/25">Styles are edited here until the layout panel lands.</span>
        <button
          type="button"
          disabled={text === original}
          onClick={apply}
          className="rounded bg-indigo-500/20 px-2 py-1 text-[11px] text-indigo-300 transition hover:bg-indigo-500/30 disabled:opacity-30"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

// --- page --------------------------------------------------------------------

function PagePanel({ page, layouts, defaultLayout, onChange }: { page: Page; layouts: string[]; defaultLayout?: string; onChange: (u: Partial<Page>) => void }) {
  const layoutValue = page.layout === false ? '__none' : page.layout ?? '';
  return (
    <>
      <div className="border-b border-white/10 px-3 py-2.5">
        <div className="text-[10px] uppercase tracking-wider text-white/35">Page</div>
        <div className="text-[13px] font-medium text-white/90">{page.name}</div>
      </div>
      <div className="flex-1 overflow-auto">
        <Section title="Page settings">
          <Field label="Name" value={page.name} onChange={(v) => onChange({ name: v })} />
          <Field label="Path" value={page.path} onChange={(v) => onChange({ path: v })} />
          <Field label="Title" value={page.title ?? ''} onChange={(v) => onChange({ title: v || undefined })} />
          <TextArea label="Description" value={page.description ?? ''} onChange={(v) => onChange({ description: v || undefined })} />
          <div>
            <label className="mb-1 block text-[11px] text-white/40">Layout</label>
            <select
              value={layoutValue}
              onChange={(e) => {
                const v = e.target.value;
                onChange({ layout: v === '' ? undefined : v === '__none' ? false : v });
              }}
              className="w-full rounded border border-white/10 bg-[#1e1e1e] px-2 py-1.5 text-[12px] text-white/80 outline-none focus:border-indigo-500/50"
            >
              <option value="">Default{defaultLayout ? ` (${defaultLayout})` : ' (none)'}</option>
              <option value="__none">No layout</option>
              {layouts.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
        </Section>
        <div className="px-3 py-4 text-center text-[11px] text-white/30">Select a layer or click the canvas to edit it.</div>
      </div>
    </>
  );
}

// --- fields --------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-white/10">
      <div className="px-3 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wider text-white/40">{title}</div>
      <div className="space-y-2.5 px-3 pb-3">{children}</div>
    </div>
  );
}

const inputCls =
  'w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-[12px] text-white/80 outline-none placeholder:text-white/20 focus:border-indigo-500/50';

function Field({ label, value, onChange, placeholder, mono }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] text-white/40">{label}</label>
      <input className={`${inputCls} ${mono ? 'font-mono text-[11px]' : ''}`} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] text-white/40">{label}</label>
      <textarea className={`${inputCls} resize-y`} rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-[12px] text-white/60">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-indigo-500" />
      {label}
    </label>
  );
}
