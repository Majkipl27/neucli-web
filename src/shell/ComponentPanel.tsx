import React, { useEffect, useState } from 'react';
import { collectSlots } from 'neucli/core';
import type { Config, PropDef, PropType } from '../document/types';
import { useDocumentStore } from '../store/useDocument';
import { useUIStore } from '../store/useUI';
import { Row, Section, Select, TextField } from '../panel/controls';
import {
  addProp, deleteComponent, normalizeProp, removeProp, renameComponent, renameProp, setPropDef, usageOf,
} from '../document/components';
import { closeComponent, insertSlot } from './componentActions';

const PROP_TYPES: { value: PropType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'url', label: 'URL' },
  { value: 'image', label: 'Image' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
];

/**
 * An input that commits on Enter or blur and reverts on Esc. For edits that
 * rewrite references (renames), where every keystroke shouldn't count.
 */
export function DraftField({ value, onCommit, mono, placeholder, className = '' }: {
  value: string;
  onCommit: (v: string) => void;
  mono?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      className={`h-6 w-full min-w-0 rounded border border-transparent bg-white/[0.06] px-1.5 text-[11px] text-white/85 outline-none placeholder:text-white/25 hover:border-white/10 focus:border-violet-400/60 ${mono ? 'font-mono' : ''} ${className}`}
      value={draft}
      placeholder={placeholder}
      spellCheck={false}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setDraft(value);
          requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
        }
      }}
    />
  );
}

/** The open main component, when nothing on it is selected: name, props, slots, usage. */
export default function ComponentPanel({ config, name }: { config: Config; name: string }) {
  const dispatch = useDocumentStore((s) => s.dispatch);
  const flash = useUIStore((s) => s.flash);
  const def = config.components?.[name];
  if (!def) return null;
  const use = usageOf(config, name);
  const slots = def.root ? collectSlots(def) : null;
  const props = Object.entries(def.props ?? {}).map(([k, v]) => [k, normalizeProp(v)] as const);

  function rename(to: string) {
    const res = renameComponent(useDocumentStore.getState().config, name, to.trim());
    if (!res.ok) return flash(res.error);
    dispatch(() => res.config);
  }

  function remove() {
    const res = deleteComponent(useDocumentStore.getState().config, name);
    if (!res.ok) return flash(res.error);
    useUIStore.getState().askConfirm({
      message: `Delete the ${name} component? Nothing uses it. Undo brings it back.`,
      action: 'Delete',
      onConfirm: () => {
        closeComponent();
        dispatch(() => res.config);
      },
    });
  }

  const usedAs: string[] = [];
  if (use.instances) usedAs.push(`${use.instances} instance${use.instances === 1 ? '' : 's'}`);
  if (use.isDefaultLayout) usedAs.push('the site layout');
  else if (use.layoutPages) usedAs.push(`layout of ${use.layoutPages} page${use.layoutPages === 1 ? '' : 's'}`);

  return (
    <>
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <span className="text-[12px] text-violet-300">&#x25C6;</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-medium text-white/90">{name}</div>
          <div className="text-[10px] text-white/35">main component{usedAs.length ? ` · ${usedAs.join(', ')}` : ' · unused'}</div>
        </div>
        <button type="button" onClick={closeComponent} title="Back to the page"
          className="rounded px-1.5 py-0.5 text-[11px] text-white/50 transition hover:bg-white/10 hover:text-white/80">
          Done
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <Section title="Component">
          <Row label="Name"><DraftField value={name} onCommit={rename} /></Row>
          <p className="px-0.5 text-[10px] leading-relaxed text-white/30">
            Edits here change every instance. Select a layer on the canvas to style it.
          </p>
        </Section>

        <Section
          title="Props"
          actions={
            <button type="button" title="Add a prop" className="rounded px-1.5 text-[13px] text-white/45 hover:bg-white/10 hover:text-white/80"
              onClick={() => {
                const res = addProp(useDocumentStore.getState().config, name, 'text');
                if (res.ok) dispatch(() => res.config);
              }}>
              +
            </button>
          }
        >
          {props.length === 0 && (
            <p className="text-[11px] text-white/30">No props. Add one, then bind a text to it from the text's panel.</p>
          )}
          {props.map(([prop, d]) => (
            <PropRow key={prop} component={name} prop={prop} def={d} />
          ))}
        </Section>

        <Section title="Slots">
          {slots && (slots.hasDefault || slots.named.size > 0) ? (
            <div className="space-y-1 text-[11px] text-white/60">
              {slots.hasDefault && <div><span className="font-mono text-violet-300/80">slot</span> <span className="text-white/35">instance children{use.layoutPages || use.isDefaultLayout ? ', page content' : ''}</span></div>}
              {[...slots.named].map((s) => (
                <div key={s}><span className="font-mono text-violet-300/80">{s}</span> <span className="text-white/35">named slot</span></div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-white/30">No slots, so instances can't hold their own layers.</p>
          )}
          <button type="button" onClick={insertSlot} className="mt-1 text-[11px] text-violet-300/70 hover:text-violet-200">
            Insert slot
          </button>
        </Section>

        <Section title="Danger" open={false}>
          <button type="button" onClick={remove} className="text-[11px] text-red-400/70 hover:text-red-300">
            Delete component
          </button>
        </Section>
      </div>
    </>
  );
}

function PropRow({ component, prop, def }: { component: string; prop: string; def: PropDef }) {
  const dispatch = useDocumentStore((s) => s.dispatch);
  const flash = useUIStore((s) => s.flash);
  const setDef = (next: PropDef) =>
    dispatch((c) => setPropDef(c, component, prop, next), { mode: 'coalesce', group: `propdef:${component}:${prop}` });

  return (
    <div className="space-y-1 rounded bg-white/[0.03] p-1.5">
      <div className="flex items-center gap-1">
        <DraftField
          mono
          value={prop}
          className="flex-1"
          onCommit={(to) => {
            const res = renameProp(useDocumentStore.getState().config, component, prop, to.trim());
            if (!res.ok) return flash(res.error);
            dispatch(() => res.config);
          }}
        />
        <Select
          value={def.type}
          options={PROP_TYPES}
          className="w-[76px]"
          onChange={(t) => t && setDef({ type: t, ...(t === def.type ? { default: def.default } : {}) })}
        />
        <button type="button" title={`Remove ${prop}`}
          onClick={() => dispatch((c) => removeProp(c, component, prop))}
          className="rounded px-1 text-[11px] text-white/30 hover:bg-red-500/10 hover:text-red-300">
          &#x2715;
        </button>
      </div>
      {def.type === 'boolean' ? (
        <label className="flex items-center gap-1.5 pl-0.5 text-[11px] text-white/45">
          <input type="checkbox" className="accent-violet-500" checked={def.default === true}
            onChange={(e) => setDef({ type: 'boolean', default: e.target.checked || undefined })} />
          on by default
        </label>
      ) : (
        <TextField
          value={def.default === undefined ? '' : String(def.default)}
          placeholder="default"
          mono={def.type === 'number'}
          onChange={(v) => setDef({
            type: def.type,
            default: def.type === 'number' ? (v === '' || Number.isNaN(Number(v)) ? undefined : Number(v)) : v,
          })}
        />
      )}
    </div>
  );
}
