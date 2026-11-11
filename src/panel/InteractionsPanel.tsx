/**
 * Interactions for the selected node: the state it declares, a preview of
 * state values for the canvas (never saved), actions (`on`), `visibleWhen`
 * and state styles (`when`). Picking a state style routes the style panel's
 * edits into it and previews it on the canvas.
 */

import React, { useEffect, useState } from 'react';
import { isInstance, parseValue } from 'neucli/core';
import type { Node, StateValue } from 'neucli/core';
import { useDocumentStore } from '../store/useDocument';
import { useUIStore } from '../store/useUI';
import { updateAt, pathKey } from '../document/tree';
import { withRoots } from '../document/scope';
import type { Selection } from '../document/types';
import {
  actionProblem, conditionProblem, defaultAction, defaultCondition, freeStateName, previewFor, renameKey,
  setNodeKey, stateAt, whenOf, type ScopedState,
} from '../document/interactions';
import { IconButton, Row, Section, Seg, Select } from './controls';

type Obj = Record<string, unknown>;

const EVENTS = [
  { value: 'click', label: 'Click' },
  { value: 'submit', label: 'Submit' },
  { value: 'mouseenter', label: 'Hover in' },
  { value: 'mouseleave', label: 'Hover out' },
] as const;

/** A text input that commits on Enter or blur (Esc reverts), so half-typed values never reach the document. */
function CommitField({ value, onCommit, placeholder, invalid, title, className = '' }: {
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  invalid?: boolean;
  title?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft !== value) onCommit(draft);
  };
  return (
    <input
      title={title}
      value={draft}
      placeholder={placeholder}
      spellCheck={false}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setDraft(value);
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={`h-6 w-full min-w-0 rounded border bg-white/[0.06] px-1.5 font-mono text-[11px] text-white/85 outline-none placeholder:text-white/25 hover:border-white/10 focus:border-indigo-400/60 ${
        invalid ? 'border-amber-400/50' : 'border-transparent'
      } ${className}`}
    />
  );
}

function Problem({ text }: { text: string | null }) {
  if (!text) return null;
  return <div className="pl-[66px] text-[10px] leading-snug text-amber-300/80">{text}</div>;
}

function formatValue(v: StateValue): string {
  return typeof v === 'string' ? v : String(v);
}

/** A value control by type: a two-way switch for booleans, a field otherwise (keeps the type). */
function ValueInput({ value, onChange, title }: { value: StateValue; onChange: (v: StateValue) => void; title: string }) {
  if (typeof value === 'boolean') {
    return (
      <Seg
        className="w-[96px] shrink-0"
        value={value}
        onChange={(v) => onChange(v)}
        options={[{ value: false, label: 'false', title }, { value: true, label: 'true', title }]}
      />
    );
  }
  return (
    <CommitField
      className="w-[96px] shrink-0"
      title={title}
      value={formatValue(value)}
      onCommit={(raw) => {
        const parsed = parseValue(raw);
        // Keep the type: a number stays a number.
        if (typeof value === 'number' && typeof parsed !== 'number') return;
        onChange(typeof value === 'string' ? String(raw) : parsed);
      }}
    />
  );
}

export default function InteractionsPanel({ node, selection }: { node: Node; selection: Selection }) {
  const config = useDocumentStore((s) => s.config);
  const dispatch = useDocumentStore((s) => s.dispatch);
  const statePreview = useUIStore((s) => s.statePreview);
  const setStatePreview = useUIStore((s) => s.setStatePreview);
  const stateStyle = useUIStore((s) => s.stateStyle);
  const setStateStyle = useUIStore((s) => s.setStateStyle);

  if (node.type === 'slot') return null;
  const n = node as unknown as Obj;
  const scope = selection.pageIndex;
  const nodeKey = `${scope}|${pathKey(selection.path)}`;
  const inScope = stateAt(config, scope, selection.path);
  const outer = inScope.filter((s) => !s.own);
  const own = (n.state as Record<string, StateValue> | undefined) ?? {};
  const on = (n.on as Record<string, string> | undefined) ?? {};
  const when = whenOf(node);
  const instance = isInstance(node);
  const canDeclare = node.type === 'frame';
  const canAct = node.type === 'frame' || node.type === 'text' || node.type === 'link';
  const canStyle = !instance;

  const update = (fn: (n: Node) => Node) =>
    dispatch((c) => withRoots(c, selection.pageIndex, (s) => updateAt(s, selection.path, fn)));

  const previewValues = statePreview.scope === scope ? statePreview.values : {};
  const previewOf = (s: ScopedState): StateValue => previewValues[pathKey(s.at)]?.[s.name] ?? s.value;
  const isPreviewed = (s: ScopedState) => previewValues[pathKey(s.at)]?.[s.name] !== undefined;

  const has = Object.keys(own).length > 0 || Object.keys(on).length > 0 || typeof n.visibleWhen === 'string' || Object.keys(when).length > 0;

  // --- state -------------------------------------------------------------------
  const setState = (next: Record<string, StateValue> | undefined) =>
    update((x) => setNodeKey(x, 'state', next && Object.keys(next).length ? next : undefined));

  const addState = () => {
    const name = freeStateName('open', inScope.map((s) => s.name));
    setState({ ...own, [name]: false });
  };

  // --- actions -----------------------------------------------------------------
  const setOn = (next: Record<string, string>) => update((x) => setNodeKey(x, 'on', Object.keys(next).length ? next : undefined));
  const addAction = () => {
    const action = defaultAction(inScope);
    if (!action) return;
    const event = EVENTS.find((e) => !(e.value in on))?.value;
    if (!event) return;
    setOn({ ...on, [event]: action });
  };

  // --- state styles ------------------------------------------------------------
  const setWhen = (next: Record<string, Obj>) => update((x) => setNodeKey(x, 'when', Object.keys(next).length ? next : undefined));
  const editing = stateStyle?.node === nodeKey ? stateStyle.when : null;

  const startEditing = (cond: string) => {
    setStateStyle({ node: nodeKey, when: cond });
    const p = previewFor(cond, inScope);
    if (p) for (const [name, value] of Object.entries(p.values)) setStatePreview(scope, p.nid, name, value);
  };
  const stopEditing = () => {
    if (editing) {
      const p = previewFor(editing, inScope);
      if (p) for (const name of Object.keys(p.values)) setStatePreview(scope, p.nid, name, undefined);
    }
    setStateStyle(null);
  };
  const addWhen = () => {
    const cond = defaultCondition(inScope);
    if (!cond || cond in when) return;
    setWhen({ ...when, [cond]: {} });
    startEditing(cond);
  };

  return (
    <Section title="Interactions" open={has || inScope.length > 0}>
      {/* State this frame declares */}
      {canDeclare && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wide text-white/35">State</span>
            <IconButton title="Add state on this frame" onClick={addState}>+</IconButton>
          </div>
          {Object.entries(own).map(([name, value]) => (
            <div key={name} className="flex items-center gap-1.5">
              <CommitField
                className="w-[58px] shrink-0"
                title="State name"
                value={name}
                invalid={!/^[A-Za-z_]\w*$/.test(name)}
                onCommit={(to) => {
                  if (!/^[A-Za-z_]\w*$/.test(to) || to in own) return;
                  setState(renameKey(own, name, to));
                }}
              />
              <ValueInput value={value} title="Initial value" onChange={(v) => setState({ ...own, [name]: v })} />
              <Select
                className="w-[52px]"
                title="Type"
                value={typeof value}
                options={[{ value: 'boolean', label: 'bool' }, { value: 'number', label: 'num' }, { value: 'string', label: 'text' }]}
                onChange={(t) => setState({ ...own, [name]: t === 'number' ? 0 : t === 'string' ? 'a' : false })}
              />
              <IconButton title={`Remove ${name}`} onClick={() => setState(Object.fromEntries(Object.entries(own).filter(([k]) => k !== name)))}>&#x2715;</IconButton>
            </div>
          ))}
          {Object.keys(own).length === 0 && (
            <div className="text-[10px] text-white/30">Values this frame and its contents can change, like open or tab.</div>
          )}
        </div>
      )}

      {/* Preview values on the canvas (edit mode, never saved) */}
      {inScope.length > 0 && (
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wide text-white/35" title="Shows these values on the canvas. Not saved.">
              Preview
            </span>
            {inScope.some(isPreviewed) && (
              <button
                type="button"
                className="text-[10px] text-white/40 hover:text-white/80"
                onClick={() => inScope.forEach((s) => setStatePreview(scope, pathKey(s.at), s.name, undefined))}
              >
                Reset
              </button>
            )}
          </div>
          {inScope.map((s) => (
            <Row key={`${pathKey(s.at)}:${s.name}`} label={s.name} mark={isPreviewed(s) ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" title="Previewed" /> : undefined}>
              <ValueInput
                value={previewOf(s)}
                title={`Preview ${s.name} on the canvas (not saved)`}
                onChange={(v) => setStatePreview(scope, pathKey(s.at), s.name, v === s.value ? undefined : v)}
              />
              {!s.own && <span className="truncate text-[10px] text-white/25">from parent</span>}
            </Row>
          ))}
        </div>
      )}

      {/* Actions */}
      {canAct && (
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wide text-white/35">Actions</span>
            <IconButton title={inScope.length ? 'Add an action' : 'Add state on this frame or one around it first'} disabled={!inScope.length} onClick={addAction}>+</IconButton>
          </div>
          {Object.entries(on).map(([event, src]) => {
            const problem = actionProblem(src, inScope) ?? (event === 'submit' && (n.tag !== 'form') ? 'submit fires on a frame with tag: form' : null);
            return (
              <React.Fragment key={event}>
                <div className="flex items-center gap-1.5">
                  <Select
                    className="w-[58px] shrink-0"
                    value={event}
                    options={EVENTS.map((e) => ({ value: e.value, label: e.label }))}
                    onChange={(to) => {
                      if (!to || to === event || to in on) return;
                      setOn(renameKey(on, event, to));
                    }}
                  />
                  <CommitField value={src} invalid={!!problem} placeholder="toggle open" onCommit={(v) => setOn({ ...on, [event]: v.trim() })} />
                  <IconButton title="Remove action" onClick={() => setOn(Object.fromEntries(Object.entries(on).filter(([k]) => k !== event)))}>&#x2715;</IconButton>
                </div>
                <Problem text={problem} />
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Visible when (reads enclosing frames' state) */}
      <div className="space-y-1 pt-1">
        <Row label="Visible">
          <CommitField
            value={typeof n.visibleWhen === 'string' ? n.visibleWhen : ''}
            placeholder={outer.length ? `always, or e.g. ${defaultCondition(outer)}` : 'always'}
            invalid={typeof n.visibleWhen === 'string' && !!conditionProblem(n.visibleWhen, outer)}
            onCommit={(v) => update((x) => setNodeKey(x, 'visibleWhen', v.trim() || undefined))}
          />
        </Row>
        {typeof n.visibleWhen === 'string' && <Problem text={conditionProblem(n.visibleWhen, outer)} />}
      </div>

      {/* State styles */}
      {canStyle && (
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wide text-white/35">State styles</span>
            <IconButton title={inScope.length ? 'Style this layer while a condition holds' : 'Add state first'} disabled={!inScope.length} onClick={addWhen}>+</IconButton>
          </div>
          {Object.keys(when).map((cond) => {
            const problem = conditionProblem(cond, inScope);
            const active = editing === cond;
            return (
              <React.Fragment key={cond}>
                <div className="flex items-center gap-1.5">
                  <CommitField
                    value={cond}
                    invalid={!!problem}
                    onCommit={(to) => {
                      const next = to.trim();
                      if (!next || next === cond || next in when) return;
                      setWhen(renameKey(when, cond, next));
                      if (active) setStateStyle({ node: nodeKey, when: next });
                    }}
                  />
                  <IconButton
                    title={active ? 'Done: style panel edits go back to the base style' : 'Edit these styles in the style panel (and preview them)'}
                    active={active}
                    onClick={() => (active ? stopEditing() : startEditing(cond))}
                  >
                    {active ? 'Done' : 'Edit'}
                  </IconButton>
                  <IconButton
                    title="Remove this state style"
                    onClick={() => {
                      if (active) stopEditing();
                      setWhen(Object.fromEntries(Object.entries(when).filter(([k]) => k !== cond)));
                    }}
                  >
                    &#x2715;
                  </IconButton>
                </div>
                <Problem text={problem} />
              </React.Fragment>
            );
          })}
          {Object.keys(when).length > 1 && <div className="text-[10px] text-white/30">The first condition that holds wins.</div>}
        </div>
      )}
    </Section>
  );
}
