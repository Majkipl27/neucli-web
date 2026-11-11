/**
 * Editing interactions on a node: state, `on`, `visibleWhen` and state
 * styles (`when`). The language itself (parsing, checking, running) is
 * neucli/core's; this file only reads what's in scope and writes keys back
 * in the places a person would put them.
 */

import { parseAction, parseCondition, actionNeeds, typeOfValue, satisfying } from 'neucli/core';
import type { Node, StateType, StateValue, Style } from 'neucli/core';
import type { Config, Path } from './types';
import { getAt, pathKey } from './tree';
import { rootsOf } from './scope';
import { NODE_KEY_ORDER, withKey } from './style';

type Obj = Record<string, unknown>;

export interface ScopedState {
  name: string;
  /** Initial value. */
  value: StateValue;
  type: StateType;
  /** Path of the frame that declares it. */
  at: Path;
  /** Declared by the node itself (visible to its on / when, not its visibleWhen). */
  own: boolean;
}

/** State visible at a node, outermost first: its own and every enclosing frame's in the same tree. */
export function stateAt(config: Config, scope: number, path: Path): ScopedState[] {
  const roots = rootsOf(config, scope);
  const out: ScopedState[] = [];
  for (let i = 1; i <= path.length; i++) {
    const prefix = path.slice(0, i);
    if (typeof prefix[prefix.length - 1] !== 'number') continue;
    const state = (getAt(roots, prefix) as { state?: Record<string, StateValue> } | null)?.state;
    for (const [name, value] of Object.entries(state ?? {})) {
      out.push({ name, value, type: typeOfValue(value), at: prefix, own: i === path.length });
    }
  }
  return out;
}

/** Set (or with undefined, remove) a top-level key on a node, in its usual place. */
export function setNodeKey(node: Node, key: string, value: unknown): Node {
  return withKey(node as unknown as Obj, key, value, NODE_KEY_ORDER) as unknown as Node;
}

/** Rename a key of a map, keeping its position. */
export function renameKey<T>(map: Record<string, T>, from: string, to: string): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(map)) out[k === from ? to : k] = v;
  return out;
}

/** A name not used yet: open, open2, open3... */
export function freeStateName(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  let name = base;
  for (let n = 2; used.has(name); n++) name = `${base}${n}`;
  return name;
}

/** A sensible first action for the state in scope. */
export function defaultAction(states: ScopedState[]): string | null {
  const bool = states.find((s) => s.type === 'boolean');
  if (bool) return `toggle ${bool.name}`;
  const num = states.find((s) => s.type === 'number');
  if (num) return `increment ${num.name}`;
  const str = states[0];
  return str ? `set ${str.name} ${String(str.value)}` : null;
}

/** A sensible first condition for the state in scope. */
export function defaultCondition(states: ScopedState[]): string | null {
  const s = states.find((x) => x.type === 'boolean') ?? states[0];
  if (!s) return null;
  if (s.type === 'boolean') return s.name;
  return `${s.name} == ${s.type === 'number' ? 1 : String(s.value)}`;
}

/** Why an action can't run here, or null when it's fine. */
export function actionProblem(src: string, states: ScopedState[]): string | null {
  const a = parseAction(src);
  if (!a) return 'Write an action: toggle open, set tab 2, increment count, next slide of 3';
  const s = states.find((x) => x.name === a.name);
  if (!s) return `"${a.name}" isn't state here`;
  if (actionNeeds(a) !== s.type) return `needs ${actionNeeds(a) === 'boolean' ? 'a boolean' : `a ${actionNeeds(a)}`}; "${a.name}" is a ${s.type}`;
  return null;
}

/** Why a condition can't be checked here, or null when it's fine. */
export function conditionProblem(src: string, states: ScopedState[]): string | null {
  const c = parseCondition(src);
  if (!c) return 'Write a condition: open, !open, tab == 2';
  const s = states.find((x) => x.name === c.name);
  if (!s) return `"${c.name}" isn't state here`;
  if (!c.op && s.type !== 'boolean') return `"${c.name}" is a ${s.type}; compare it (${c.name} == ...)`;
  if (c.op && typeOfValue(c.value!) !== s.type) return `"${c.name}" is a ${s.type}`;
  return null;
}

/** Values that make a condition true, keyed by the declaring frame's id, for previewing it. */
export function previewFor(src: string, states: ScopedState[]): { nid: string; values: Record<string, StateValue> } | null {
  const c = parseCondition(src);
  if (!c) return null;
  // The innermost declaration wins (no shadowing is allowed, but be safe).
  const s = [...states].reverse().find((x) => x.name === c.name);
  if (!s) return null;
  const values = satisfying(c, s.type);
  return values ? { nid: pathKey(s.at), values } : null;
}

// --- state styles ----------------------------------------------------------------

export function whenOf(node: Node): Record<string, Obj> {
  return ((node as { when?: Record<string, Obj> }).when ?? {}) as Record<string, Obj>;
}

/** Set one style key under `when[cond]`. The condition stays even when its styles are empty. */
export function setWhenStyle(node: Node, cond: string, key: keyof Style | 'className', value: unknown): Node {
  const when = { ...whenOf(node) };
  when[cond] = withKey({ ...(when[cond] ?? {}) }, key, value, NODE_KEY_ORDER);
  return setNodeKey(node, 'when', when);
}

const SUB_ORDER: Record<string, string[]> = {
  layout: ['direction', 'columns', 'wrap', 'gap', 'padding', 'align', 'justify'],
  font: ['family', 'size', 'weight', 'leading', 'tracking', 'align', 'transform', 'italic'],
  border: ['width', 'color', 'sides', 'style'],
};

export function setWhenStyleSub(node: Node, cond: string, key: keyof Style, sub: string, value: unknown): Node {
  const own = whenOf(node)[cond]?.[key];
  const obj = withKey(own && typeof own === 'object' && !Array.isArray(own) ? (own as Obj) : {}, sub, value, SUB_ORDER[key] ?? []);
  return setWhenStyle(node, cond, key, Object.keys(obj).length ? obj : undefined);
}
