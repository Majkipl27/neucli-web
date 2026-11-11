import React, { useEffect, useMemo, useState } from 'react';
import { useDocumentStore } from '../store/useDocument';
import { selectedPaths, useSelectionStore } from '../store/useSelection';
import { useUIStore } from '../store/useUI';
import { getAt } from '../document/tree';
import { rootsOf } from '../document/scope';
import { normalizePaths } from '../document/multi';
import { labelFor } from '../document/palette';
import { componentNameProblem, createComponent, freeComponentName, propNameProblem, textCandidates } from '../document/components';
import type { TextCandidate } from '../document/components';
import type { Node } from '../document/types';

/**
 * Create component (Ctrl/Cmd+Alt+K): asks for a name and which texts should
 * become props, then swaps the selection for an instance in one undo step.
 */
export default function CreateComponentDialog() {
  const open = useUIStore((s) => s.createComponentOpen);
  if (!open) return null;
  return <Dialog />;
}

function Dialog() {
  const close = () => useUIStore.getState().setCreateComponentOpen(false);
  const config = useDocumentStore((s) => s.config);
  const pageIndex = useSelectionStore((s) => s.pageIndex);
  const paths = useMemo(() => normalizePaths(selectedPaths()), []);

  // Several siblings become one frame first; texts are found in all of them, in order.
  const nodes = useMemo(
    () => paths.map((p) => getAt(rootsOf(config, pageIndex), p)).filter((n): n is Node => !!n),
    // Computed once when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const candidates = useMemo<TextCandidate[]>(() => {
    if (nodes.length === 1) return textCandidates(nodes[0]);
    return textCandidates({ type: 'frame', children: nodes } as Node);
  }, [nodes]);

  const [name, setName] = useState(() => freeComponentName(config, suggestedName(nodes)));
  const [picked, setPicked] = useState<boolean[]>(() => candidates.map(() => true));
  const [propNames, setPropNames] = useState<string[]>(() => candidates.map((c) => c.prop));
  const [error, setError] = useState<string | null>(null);

  const nameProblem = componentNameProblem(config, name);
  const chosen = candidates.map((c, i) => ({ ...c, prop: propNames[i] })).filter((_, i) => picked[i]);
  const dupe = chosen.find((c, i) => chosen.findIndex((d) => d.prop === c.prop) !== i);
  const badProp = chosen.map((c) => propNameProblem({}, c.prop)).find(Boolean) ?? (dupe ? `Two props are called ${dupe.prop}.` : null);
  const problem = nameProblem ?? badProp;

  function create() {
    if (problem) return setError(problem);
    const res = createComponent(useDocumentStore.getState().config, pageIndex, paths, name, chosen);
    if (!res.ok) return setError(res.error);
    useDocumentStore.getState().dispatch(() => res.config);
    useSelectionStore.getState().select({ pageIndex, path: res.path });
    useUIStore.getState().flash(`Created ${name}. Open it from Components to edit every copy at once.`, 'info');
    close();
  }

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
      e.stopPropagation();
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, []);

  const input = 'w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-[12px] text-white/90 outline-none focus:border-violet-400/60';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[14vh]" onMouseDown={close}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Create component"
        className="w-[400px] rounded-md border border-white/10 bg-[#2c2c2c] text-[12px] text-white/80 shadow-2xl shadow-black/60"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
          <span className="text-violet-300">&#x25C6;</span>
          <span className="font-medium text-white/90">Create component</span>
          <span className="ml-auto text-[10px] text-white/30">{paths.length > 1 ? `${paths.length} layers, grouped first` : labelFor(nodes[0] ?? ({ type: 'frame' } as Node))}</span>
        </div>
        <div className="space-y-3 px-4 py-3">
          <label className="block">
            <span className="mb-1 block text-[11px] text-white/40">Name</span>
            <input autoFocus className={input} value={name} onChange={(e) => { setName(e.target.value); setError(null); }} spellCheck={false} />
            {nameProblem && name && <span className="mt-1 block text-[11px] text-amber-300/80">{nameProblem}</span>}
          </label>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] text-white/40">Turn text into props</span>
              {candidates.length > 1 && (
                <button type="button" className="text-[10px] text-white/35 hover:text-white/70"
                  onClick={() => setPicked(picked.map(() => !picked.every(Boolean)))}>
                  {picked.every(Boolean) ? 'None' : 'All'}
                </button>
              )}
            </div>
            {candidates.length === 0 ? (
              <div className="text-[11px] text-white/30">No plain text inside. You can add props later in the component's panel.</div>
            ) : (
              <div className="max-h-[220px] space-y-1 overflow-auto">
                {candidates.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="checkbox" className="accent-violet-500" checked={picked[i]}
                      onChange={(e) => setPicked(picked.map((v, j) => (j === i ? e.target.checked : v)))} />
                    <input
                      className="w-[104px] rounded border border-white/10 bg-white/5 px-1.5 py-1 font-mono text-[11px] text-white/80 outline-none focus:border-violet-400/60 disabled:opacity-40"
                      value={propNames[i]}
                      disabled={!picked[i]}
                      spellCheck={false}
                      onChange={(e) => setPropNames(propNames.map((v, j) => (j === i ? e.target.value : v)))}
                    />
                    <span className="min-w-0 flex-1 truncate text-[11px] text-white/45" title={c.value}>{c.value}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-2 text-[10px] leading-relaxed text-white/30">
              Each prop starts with the current text as its default, so nothing changes on the page. Copies can then set their own.
            </p>
          </div>
          {error && <div className="text-[11px] text-red-300/90">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 border-t border-white/10 px-4 py-2.5">
          <button type="button" onClick={close} className="rounded px-3 py-1.5 text-white/60 hover:bg-white/10 hover:text-white">Cancel</button>
          <button type="submit" disabled={!!problem}
            className="rounded bg-violet-500 px-3 py-1.5 font-medium text-white hover:bg-violet-400 disabled:opacity-40">
            Create
          </button>
        </div>
      </form>
    </div>
  );
}

/** A starting name: the layer name, else the frame's HTML tag (section, nav...), else the node type. */
function suggestedName(nodes: Node[]): string {
  if (nodes.length !== 1) return 'Group';
  const n = nodes[0] as Node & { name?: string; tag?: string };
  if (n.name) return n.name;
  if (n.tag && n.tag !== 'div') return n.tag;
  return n.type === 'frame' ? 'Block' : n.type;
}
