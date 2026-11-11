/**
 * Structured style controls for one node at the active breakpoint.
 *
 * Reads the effective value (desktop <- tablet <- phone) and writes to the
 * active breakpoint only: the node's own keys on desktop, `responsive.tablet`
 * / `responsive.phone` otherwise. Values set by the active (non-desktop)
 * breakpoint get a blue dot; click it to drop the override. On a component
 * instance only the keys an instance may set are shown, and values the copy
 * sets itself get a violet dot that resets to the component's value.
 */

import React from 'react';
import { isInstance, isLinkContainer, mergeStyle, OVERRIDABLE } from 'neucli/core';
import type { Breakpoint, Config, Gradient, InstanceNode, Layout, Node, Style } from 'neucli/core';
import { useDocumentStore, type DispatchOptions } from '../store/useDocument';
import { useUIStore, VIEWPORTS } from '../store/useUI';
import { updateAt, pathKey } from '../document/tree';
import type { Selection } from '../document/types';
import {
  instanceOverrides, instanceStyleAt, isOverridden, resetInstanceKey, resetOverride, setStyle, setStyleSub,
  styleAt, type StyleKey,
} from '../document/style';
import { elementFor, rectOf } from '../canvas/interaction';
import { canvasDocument } from '../canvas/registry';
import { withRoots } from '../document/scope';
import { setWhenStyle, setWhenStyleSub, whenOf } from '../document/interactions';
import {
  ColorField, IconButton, Mark, NumberField, Row, Section, Seg, Select, Toggle, type ChangeKind,
} from './controls';

type Obj = Record<string, unknown>;

// --- editing hook --------------------------------------------------------------

function optionsFor(field: string, kind: ChangeKind, gesture?: string): DispatchOptions | undefined {
  if (kind === 'scrub') return { mode: 'coalesce', group: gesture ?? field, sticky: true };
  if (kind === 'nudge') return { mode: 'coalesce', group: `nudge:${field}` };
  return undefined;
}

interface Editor {
  node: Node;
  config: Config;
  bp: Breakpoint;
  /** Editing the styles under `when[cond]` instead of the base style. */
  when: string | null;
  /** Effective style shown in the panel. */
  style: Style;
  instance: boolean;
  set: (key: StyleKey, value: unknown, kind?: ChangeKind, gesture?: string) => void;
  /** Several edits as one undo step. */
  apply: (fn: (n: Node) => Node) => void;
  setSub: (key: StyleKey, sub: string, value: unknown, kind?: ChangeKind, gesture?: string) => void;
  /** Dot + reset for a key (or one sub-key) overridden at this breakpoint / on this copy. */
  mark: (key: StyleKey, sub?: string) => React.ReactNode;
}

function useEditor(node: Node, selection: Selection): Editor {
  const config = useDocumentStore((s) => s.config);
  const dispatch = useDocumentStore((s) => s.dispatch);
  const bp = useUIStore((s) => s.breakpoint);
  const stateStyle = useUIStore((s) => s.stateStyle);
  const instance = isInstance(node);
  const key = pathKey(selection.path);

  const update = (fn: (n: Node) => Node, options?: DispatchOptions) =>
    dispatch(
      (c) => withRoots(c, selection.pageIndex, (s) => updateAt(s, selection.path, fn)),
      options,
    );

  const when = !instance && stateStyle?.node === `${selection.pageIndex}|${key}` && stateStyle.when in whenOf(node) ? stateStyle.when : null;
  if (when) return whenEditor(node, config, bp, when, selection, update);

  const style = instance ? instanceStyleAt(config, node as InstanceNode, bp) : styleAt(node, bp);

  return {
    node,
    config,
    bp,
    when: null,
    style,
    instance,
    set: (k, value, kind = 'commit', gesture) =>
      update((n) => setStyle(n, bp, k, normalize(k, value, bp)), optionsFor(`${key}:${k}`, kind, gesture)),
    // layout / font / border merge key by key across breakpoints, so one sub-key is written alone.
    setSub: (k, sub, value, kind = 'commit', gesture) =>
      update((n) => setStyleSub(n, bp, k, sub, normalize(`${k}.${sub}`, value, bp)), optionsFor(`${key}:${k}.${sub}`, kind, gesture)),
    apply: (fn) => update(fn),
    mark: (k, sub) => {
      if (instance && instanceOverrides(node as InstanceNode, bp, k)) {
        return <Mark tone="instance" title="Set on this copy" onReset={() => update((n) => resetInstanceKey(n as InstanceNode, k))} />;
      }
      if (isOverridden(node, bp, k, sub)) {
        return <Mark tone="breakpoint" title={`Overridden on ${VIEWPORTS[bp].label.toLowerCase()}`} onReset={() => update((n) => resetOverride(n, bp, k, sub))} />;
      }
      return null;
    },
  };
}

/**
 * Editing `when[cond]`: shows the style at this breakpoint with the state
 * style on top, and writes into the state style (which applies at every
 * breakpoint). Values the state style sets get an amber dot that removes them.
 */
function whenEditor(
  node: Node, config: Config, bp: Breakpoint, cond: string, selection: Selection,
  update: (fn: (n: Node) => Node, options?: DispatchOptions) => void,
): Editor {
  const own = whenOf(node)[cond] ?? {};
  const style = mergeStyle(styleAt(node, bp), own as Style);
  const flash = (m: string) => useUIStore.getState().flash(m);
  // A component's root: instances own these keys, so state styles can't set them (see docs/format.md).
  const isRoot = selection.pageIndex < 0 && selection.path.length === 1;
  const refuse = (k: StyleKey, sub?: string): boolean => {
    if (k === 'layout' && sub === 'direction') {
      flash("A state style can't change the direction. Use two frames with Visible when instead.");
      return true;
    }
    if (isRoot && (OVERRIDABLE as readonly string[]).includes(k)) {
      flash(`On a component's root, state styles can't set ${k}: instances override it. Style a frame inside instead.`);
      return true;
    }
    return false;
  };
  const tag = `${pathKey(selection.path)}:when:${cond}`;
  return {
    node,
    config,
    bp,
    when: cond,
    style,
    instance: false,
    // Unset in a state style means "same as the base", so defaults are written explicitly (as on tablet/phone).
    set: (k, value, kind = 'commit', gesture) => {
      if (refuse(k)) return;
      update((n) => setWhenStyle(n, cond, k, normalize(k, value, 'phone')), optionsFor(`${tag}:${k}`, kind, gesture));
    },
    setSub: (k, sub, value, kind = 'commit', gesture) => {
      if (refuse(k, sub)) return;
      update((n) => setWhenStyleSub(n, cond, k, sub, normalize(`${k}.${sub}`, value, 'phone')), optionsFor(`${tag}:${k}.${sub}`, kind, gesture));
    },
    apply: (fn) => update(fn),
    mark: (k, sub) => {
      const v = (own as Obj)[k];
      const set = sub === undefined ? v !== undefined : !!v && typeof v === 'object' && sub in (v as Obj);
      if (!set) return null;
      return (
        <Mark
          tone="state"
          title={`Set while ${cond}`}
          onReset={() => update((n) => (sub === undefined ? setWhenStyle(n, cond, k, undefined) : setWhenStyleSub(n, cond, k, sub, undefined)))}
        />
      );
    },
  };
}

/**
 * Values that equal the format's default. On desktop they're written as
 * "unset" (keeps YAML short); on tablet/phone they must be written explicitly,
 * because unset there means "same as the bigger breakpoint".
 */
const DEFAULTS: Record<string, unknown> = {
  opacity: 1, radius: 0, clip: false, hidden: false,
  'layout.direction': 'column', 'layout.justify': 'start', 'layout.align': 'stretch', 'layout.wrap': false,
  'font.transform': 'none', 'border.style': 'solid', 'border.sides': 'all',
};

function normalize(path: string, value: unknown, bp: Breakpoint): unknown {
  const d = DEFAULTS[path];
  if (d === undefined) return value;
  if (bp === 'desktop') return value === d ? undefined : value;
  return value === undefined ? d : value;
}

// --- panel -----------------------------------------------------------------------

export default function StylePanel({ node, selection }: { node: Node; selection: Selection }) {
  const ed = useEditor(node, selection);
  const t = node.type;
  if (t === 'slot') return null;

  const stateBanner = ed.when && (
    <div className="flex items-center gap-2 border-b border-amber-400/20 bg-amber-400/[0.08] px-3 py-1.5 text-[10px] text-amber-100/80">
      <span className="min-w-0 flex-1">
        Styling while <span className="font-mono text-amber-100">{ed.when}</span>. Applies at every breakpoint.
      </span>
      <button type="button" className="text-amber-100/60 hover:text-white" onClick={() => useUIStore.getState().setStateStyle(null)}>
        Done
      </button>
    </div>
  );

  if (ed.instance) {
    return (
      <>
        <SizeSection ed={ed} selection={selection} />
        <FillSection ed={ed} />
        <TextColorSection ed={ed} />
        <BorderSection ed={ed} />
      </>
    );
  }

  const hasLayout = t === 'frame' || (t === 'link' && isLinkContainer(node as never));
  const textual = t === 'text' || t === 'link' || t === 'input';

  return (
    <>
      {stateBanner}
      {hasLayout && <LayoutSection ed={ed} />}
      <SizeSection ed={ed} selection={selection} />
      <FillSection ed={ed} />
      <TypographySection ed={ed} open={textual} />
      <AppearanceSection ed={ed} image={t === 'image'} />
      <BorderSection ed={ed} />
    </>
  );
}

// --- auto layout -------------------------------------------------------------------

const DIR_OPTIONS = [
  { value: 'column' as const, label: <span className="text-[13px]">↓</span>, title: 'Vertical (column)' },
  { value: 'row' as const, label: <span className="text-[13px]">→</span>, title: 'Horizontal (row)' },
  { value: 'grid' as const, label: <span className="text-[11px]">▦</span>, title: 'Grid' },
];

const JUSTIFY = ['start', 'center', 'end'] as const;
const ALIGN = ['start', 'center', 'end'] as const;

function LayoutSection({ ed }: { ed: Editor }) {
  const layout: Layout = ed.style.layout ?? {};
  const dir = layout.direction ?? 'column';
  const set = (sub: keyof Layout, v: unknown, kind?: ChangeKind, g?: string) => ed.setSub('layout', sub, v, kind, g);
  const anyMark = ed.mark('layout');

  return (
    <Section title="Auto layout" marker={anyMark}>
      <Row label="Direction" mark={ed.mark('layout', 'direction')}>
        <Seg options={DIR_OPTIONS} value={dir} onChange={(v) => set('direction', v)} className="w-[96px]" />
        {dir === 'grid' ? (
          <NumberField className="w-[64px]" label="#" title="Columns" value={layout.columns} min={1} max={12} placeholder="1" onChange={(v, k, g) => set('columns', v, k, g)} />
        ) : (
          dir === 'row' && <Toggle label="Wrap" checked={!!layout.wrap} onChange={(v) => set('wrap', v)} />
        )}
      </Row>

      {dir !== 'grid' && (
        <div className="flex items-start gap-2">
          <div className="flex w-[58px] shrink-0 items-center gap-1 pt-1 text-[11px] text-white/45">
            Align {ed.mark('layout', 'align') ?? ed.mark('layout', 'justify')}
          </div>
          <AlignGrid layout={layout} dir={dir} onPick={(justify, align) =>
            ed.apply((n) =>
              setStyleSub(
                setStyleSub(n, ed.bp, 'layout', 'justify', normalize('layout.justify', justify, ed.bp)),
                ed.bp, 'layout', 'align', normalize('layout.align', align, ed.bp),
              ),
            )
          } />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Select
              title="Main axis (justify)"
              value={layout.justify}
              placeholder="Packed start"
              options={[
                { value: 'center', label: 'Packed center' },
                { value: 'end', label: 'Packed end' },
                { value: 'between', label: 'Space between' },
                { value: 'around', label: 'Space around' },
                { value: 'evenly', label: 'Space evenly' },
              ]}
              onChange={(v) => set('justify', v)}
            />
            <Select
              title="Cross axis (align)"
              value={layout.align}
              placeholder="Stretch"
              options={[
                { value: 'start', label: 'Align start' },
                { value: 'center', label: 'Align center' },
                { value: 'end', label: 'Align end' },
                { value: 'baseline', label: 'Baseline' },
              ]}
              onChange={(v) => set('align', v)}
            />
          </div>
        </div>
      )}

      <GapRow ed={ed} layout={layout} dir={dir} />
      <PaddingRow ed={ed} layout={layout} />
    </Section>
  );
}

/** Figma's 3x3 alignment box. Rows are vertical position, columns horizontal. */
function AlignGrid({ layout, dir, onPick }: { layout: Layout; dir: 'row' | 'column'; onPick: (justify: string, align: string) => void }) {
  const j = layout.justify ?? 'start';
  const a = layout.align ?? 'stretch';
  const cells: React.ReactNode[] = [];
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      // Column: vertical = justify, horizontal = align. Row: the other way round.
      const justify = dir === 'column' ? JUSTIFY[y] : JUSTIFY[x];
      const align = dir === 'column' ? ALIGN[x] : ALIGN[y];
      const on = j === justify && a === align;
      cells.push(
        <button
          key={`${x}${y}`}
          type="button"
          title={`justify ${justify}, align ${align}`}
          onClick={() => onPick(justify, align)}
          className="group flex h-[18px] w-[18px] items-center justify-center"
        >
          <span className={`block rounded-[1px] ${on ? 'h-2 w-2 bg-indigo-300' : 'h-1 w-1 bg-white/25 group-hover:bg-white/60'}`} />
        </button>,
      );
    }
  }
  return <div className="grid shrink-0 grid-cols-3 rounded bg-white/[0.06] p-0.5">{cells}</div>;
}

function GapRow({ ed, layout, dir }: { ed: Editor; layout: Layout; dir: string }) {
  const gap = layout.gap;
  const split = Array.isArray(gap);
  const canSplit = dir === 'grid' || layout.wrap;
  const set = (v: unknown, k?: ChangeKind, g?: string) => ed.setSub('layout', 'gap', v, k, g);
  return (
    <Row label="Gap" mark={ed.mark('layout', 'gap')}>
      {split ? (
        <>
          <NumberField label="↕" title="Row gap" value={gap[0]} min={0} onChange={(v, k, g) => set([v ?? 0, gap[1]], k, g)} />
          <NumberField label="↔" title="Column gap" value={gap[1]} min={0} onChange={(v, k, g) => set([gap[0], v ?? 0], k, g)} />
        </>
      ) : (
        <NumberField label="⇹" title="Gap between items" value={gap as number | undefined} min={0} placeholder="0" onChange={(v, k, g) => set(v, k, g)} />
      )}
      {(canSplit || split) && (
        <IconButton title={split ? 'One gap' : 'Separate row and column gap'} active={split}
          onClick={() => set(split ? gap[0] : [(gap as number | undefined) ?? 0, (gap as number | undefined) ?? 0])}>
          ⊞
        </IconButton>
      )}
    </Row>
  );
}

type Sides = [number, number, number, number];

function toSides(p: Layout['padding']): Sides {
  if (p === undefined) return [0, 0, 0, 0];
  if (typeof p === 'number') return [p, p, p, p];
  if (p.length === 2) return [p[0], p[1], p[0], p[1]];
  if (p.length === 3) return [p[0], p[1], p[2], p[1]];
  return [...p] as Sides;
}

/** Shortest form, like hand-written YAML: 24 | [y, x] | [t, r, b, l]. */
function fromSides([t, r, b, l]: Sides): Layout['padding'] {
  if (t === r && r === b && b === l) return t === 0 ? undefined : t;
  if (t === b && r === l) return [t, r];
  return [t, r, b, l];
}

function PaddingRow({ ed, layout }: { ed: Editor; layout: Layout }) {
  const p = layout.padding;
  const sides = toSides(p);
  const mode: 'all' | 'axis' | 'sides' = p === undefined || typeof p === 'number' ? 'all' : p.length === 2 ? 'axis' : 'sides';
  const [expanded, setExpanded] = React.useState(mode === 'sides');
  const set = (s: Sides, k?: ChangeKind, g?: string) => ed.setSub('layout', 'padding', fromSides(s), k, g);
  const n = (v: number | string | undefined) => (typeof v === 'number' ? v : 0);

  return (
    <>
      <Row label="Padding" mark={ed.mark('layout', 'padding')}>
        {mode === 'all' && !expanded ? (
          <NumberField label="▣" title="Padding (all sides)" value={p as number | undefined} min={0} placeholder="0" onChange={(v, k, g) => set([n(v), n(v), n(v), n(v)], k, g)} />
        ) : (
          <>
            <NumberField label="↔" title="Horizontal padding (left and right)" value={sides[1] === sides[3] ? sides[1] : undefined} placeholder="Mixed" min={0}
              onChange={(v, k, g) => set([sides[0], n(v), sides[2], n(v)], k, g)} />
            <NumberField label="↕" title="Vertical padding (top and bottom)" value={sides[0] === sides[2] ? sides[0] : undefined} placeholder="Mixed" min={0}
              onChange={(v, k, g) => set([n(v), sides[1], n(v), sides[3]], k, g)} />
          </>
        )}
        <IconButton title="Padding per side" active={expanded} onClick={() => setExpanded((v) => !v)}>
          ⊡
        </IconButton>
      </Row>
      {expanded && (
        <div className="grid grid-cols-4 gap-1 pl-[66px]">
          {(['T', 'R', 'B', 'L'] as const).map((label, i) => (
            <NumberField key={label} label={label} title={['Top', 'Right', 'Bottom', 'Left'][i]} value={sides[i]} min={0}
              onChange={(v, k, g) => {
                const next = [...sides] as Sides;
                next[i] = n(v);
                set(next, k, g);
              }} />
          ))}
        </div>
      )}
    </>
  );
}

// --- size ---------------------------------------------------------------------------

const LENGTH_TEXT = (raw: string) => /^(\d+(\.\d+)?%|screen|\d+(\.\d+)?(vh|vw|dvh|svh|lvh|rem|em|ch))$/.test(raw);
const SIZE_TEXT = (raw: string) => raw === 'fill' || raw === 'hug' || LENGTH_TEXT(raw);

function SizeSection({ ed, selection }: { ed: Editor; selection: Selection }) {
  const [minmax, setMinmax] = React.useState(
    ['minWidth', 'maxWidth', 'minHeight', 'maxHeight'].some((k) => (ed.style as Obj)[k] !== undefined),
  );
  const lengthField = (k: StyleKey, label: string, title: string) => (
    <NumberField label={label} title={title} value={(ed.style as Obj)[k] as number | string | undefined} min={0} placeholder="–" text={LENGTH_TEXT}
      onChange={(v, kind, g) => ed.set(k, v, kind, g)} />
  );
  return (
    <Section
      title="Size"
      actions={
        <IconButton title="Min / max sizes" active={minmax} onClick={() => setMinmax((v) => !v)}>
          <span className="text-[10px]">min/max</span>
        </IconButton>
      }
    >
      <SizeRow ed={ed} axis="width" label="W" selection={selection} />
      <SizeRow ed={ed} axis="height" label="H" selection={selection} />
      {minmax && (
        <>
          <Row label="Min" mark={ed.mark('minWidth') ?? ed.mark('minHeight')}>
            {lengthField('minWidth', 'W', 'Min width')}
            {lengthField('minHeight', 'H', 'Min height')}
          </Row>
          <Row label="Max" mark={ed.mark('maxWidth') ?? ed.mark('maxHeight')}>
            {lengthField('maxWidth', 'W', 'Max width')}
            {lengthField('maxHeight', 'H', 'Max height')}
          </Row>
        </>
      )}
      <Row label="Visible" mark={ed.mark('hidden')}>
        <Seg
          options={[
            { value: false, label: 'Shown', title: 'Shown at this breakpoint' },
            { value: true, label: 'Hidden', title: 'Hidden at this breakpoint' },
          ]}
          value={!!ed.style.hidden}
          onChange={(v) => ed.set('hidden', v)}
          className="flex-1"
        />
      </Row>
    </Section>
  );
}

type SizeMode = 'fixed' | 'hug' | 'fill';

/** Figma's sizing modes. Fixed starts from the rendered size; unset keeps the layout's natural size. */
function SizeRow({ ed, axis, label, selection }: { ed: Editor; axis: 'width' | 'height'; label: string; selection: Selection }) {
  const value = ed.style[axis];
  const mode: SizeMode | null = value === 'hug' ? 'hug' : value === 'fill' ? 'fill' : value === undefined ? null : 'fixed';
  const measured = () => {
    const r = rectOf(elementFor(canvasDocument(), selection.path));
    return r ? Math.round(axis === 'width' ? r.w : r.h) : 100;
  };
  return (
    <Row label={label === 'W' ? 'Width' : 'Height'} mark={ed.mark(axis)}>
      <NumberField
        className="w-[76px] shrink-0"
        label={label}
        title={axis}
        value={mode === 'fixed' ? (value as number | string) : undefined}
        placeholder={mode === 'hug' ? 'Hug' : mode === 'fill' ? 'Fill' : 'Auto'}
        min={0}
        text={SIZE_TEXT}
        onChange={(v, kind, g) => ed.set(axis, v, kind, g)}
      />
      <Seg
        className="flex-1"
        options={[
          { value: 'fixed' as SizeMode | null, label: 'Fixed', title: 'Fixed size' },
          { value: 'hug' as SizeMode | null, label: 'Hug', title: 'Hug contents' },
          { value: 'fill' as SizeMode | null, label: 'Fill', title: 'Fill container' },
        ]}
        value={mode}
        onChange={(m) => {
          if (m === mode) ed.set(axis, undefined);
          else ed.set(axis, m === 'fixed' ? measured() : m);
        }}
      />
    </Row>
  );
}

// --- fill -------------------------------------------------------------------------

const GRADIENT_DIRS: Gradient['gradient'][] = ['to-t', 'to-tr', 'to-r', 'to-br', 'to-b', 'to-bl', 'to-l', 'to-tl'];
const DIR_GLYPH: Record<string, string> = { 'to-t': '↑', 'to-tr': '↗', 'to-r': '→', 'to-br': '↘', 'to-b': '↓', 'to-bl': '↙', 'to-l': '←', 'to-tl': '↖' };

function FillSection({ ed }: { ed: Editor }) {
  const fill = ed.style.fill;
  const theme = ed.config.theme;
  const gradient = typeof fill === 'object' ? (fill as Gradient) : null;
  const setGradient = (g: Gradient, kind: ChangeKind = 'commit') => ed.set('fill', g, kind);

  return (
    <Section
      title="Fill"
      marker={ed.mark('fill')}
      actions={
        fill === undefined ? (
          <IconButton title="Add fill" onClick={() => ed.set('fill', 'white')}>+</IconButton>
        ) : (
          <IconButton title="Remove fill" onClick={() => ed.set('fill', undefined)}>−</IconButton>
        )
      }
    >
      {fill !== undefined && (
        <>
          <Row label="Type">
            <Seg
              className="flex-1"
              options={[
                { value: 'solid', label: 'Solid', title: 'Solid color' },
                { value: 'gradient', label: 'Gradient', title: 'Linear gradient' },
              ]}
              value={gradient ? 'gradient' : 'solid'}
              onChange={(v) => {
                if (v === 'gradient' && !gradient) setGradient({ gradient: 'to-b', from: (fill as string) || 'white', to: 'black' });
                if (v === 'solid' && gradient) ed.set('fill', gradient.from);
              }}
            />
          </Row>
          {gradient ? (
            <>
              <Row label="Direction">
                <div className="flex flex-1 flex-wrap gap-px">
                  {GRADIENT_DIRS.map((d) => (
                    <IconButton key={String(d)} title={String(d)} active={gradient.gradient === d} onClick={() => setGradient({ ...gradient, gradient: d })}>
                      {DIR_GLYPH[String(d)]}
                    </IconButton>
                  ))}
                </div>
              </Row>
              <Row label="From">
                <ColorField value={gradient.from} theme={theme} onChange={(v, k) => v && setGradient({ ...gradient, from: v }, k)} />
              </Row>
              <Row label="Via">
                <ColorField value={gradient.via} theme={theme} placeholder="—" onChange={(v, k) => {
                  const next = { ...gradient, via: v };
                  if (!v) delete next.via;
                  setGradient(next, k);
                }} />
              </Row>
              <Row label="To">
                <ColorField value={gradient.to} theme={theme} onChange={(v, k) => v && setGradient({ ...gradient, to: v }, k)} />
              </Row>
            </>
          ) : (
            <Row label="Color">
              <ColorField value={fill as string} theme={theme} onChange={(v, k) => ed.set('fill', v, k)} />
            </Row>
          )}
        </>
      )}
    </Section>
  );
}

function TextColorSection({ ed }: { ed: Editor }) {
  return (
    <Section title="Text color" marker={ed.mark('color')}>
      <Row label="Color">
        <ColorField value={ed.style.color} theme={ed.config.theme} placeholder="Inherit" onChange={(v, k) => ed.set('color', v, k)} />
      </Row>
    </Section>
  );
}

// --- typography ---------------------------------------------------------------------

const WEIGHTS = [
  ['100', 'Thin'], ['200', 'Extra light'], ['300', 'Light'], ['400', 'Regular'], ['500', 'Medium'],
  ['600', 'Semibold'], ['700', 'Bold'], ['800', 'Extra bold'], ['900', 'Black'],
] as const;

function TypographySection({ ed, open }: { ed: Editor; open: boolean }) {
  const font = ed.style.font ?? {};
  const set = (sub: string, v: unknown, k?: ChangeKind, g?: string) => ed.setSub('font', sub, v, k, g);
  const families = [
    ...Object.keys(ed.config.theme?.fonts ?? {}).map((f) => ({ value: f, label: f })),
    { value: 'sans', label: 'sans' },
    { value: 'serif', label: 'serif' },
    { value: 'mono', label: 'mono' },
  ];
  return (
    <Section title="Typography" open={open} marker={ed.mark('font') ?? ed.mark('color')}>
      <Row label="Color" mark={ed.mark('color')}>
        <ColorField value={ed.style.color} theme={ed.config.theme} placeholder="Inherit" onChange={(v, k) => ed.set('color', v, k)} />
      </Row>
      <Row label="Font" mark={ed.mark('font', 'family')}>
        <Select className="flex-1" value={font.family} placeholder="Inherit" options={families} onChange={(v) => set('family', v)} />
      </Row>
      <Row label="Size" mark={ed.mark('font', 'size') ?? ed.mark('font', 'weight')}>
        <NumberField className="w-[64px] shrink-0" label="Aa" title="Font size (px)" value={font.size} min={1} placeholder="–" onChange={(v, k, g) => set('size', v, k, g)} />
        <Select
          className="flex-1"
          value={font.weight !== undefined ? String(font.weight) as (typeof WEIGHTS)[number][0] : undefined}
          placeholder="Weight"
          options={WEIGHTS.map(([value, label]) => ({ value, label: `${value} ${label}` }))}
          onChange={(v) => set('weight', v === undefined ? undefined : Number(v))}
        />
      </Row>
      <Row label="Spacing" mark={ed.mark('font', 'leading') ?? ed.mark('font', 'tracking')}>
        <NumberField label="↕" title="Line height (multiplier)" value={font.leading} step={0.05} min={0} placeholder="Auto" onChange={(v, k, g) => set('leading', v, k, g)} />
        <NumberField label="↔" title="Letter spacing (em)" value={font.tracking} step={0.005} placeholder="0" onChange={(v, k, g) => set('tracking', v, k, g)} />
      </Row>
      <Row label="Align" mark={ed.mark('font', 'align')}>
        <Seg
          className="flex-1"
          options={[
            { value: undefined as string | undefined, label: '–', title: 'Inherit' },
            { value: 'left', label: '⇤', title: 'Left' },
            { value: 'center', label: '≡', title: 'Center' },
            { value: 'right', label: '⇥', title: 'Right' },
            { value: 'justify', label: '☰', title: 'Justify' },
          ]}
          value={font.align}
          onChange={(v) => set('align', v)}
        />
      </Row>
      <Row label="Case" mark={ed.mark('font', 'transform') ?? ed.mark('font', 'italic')}>
        <Seg
          className="flex-1"
          options={[
            { value: undefined as string | undefined, label: '–', title: 'As typed' },
            { value: 'uppercase', label: 'AG', title: 'Uppercase' },
            { value: 'lowercase', label: 'ag', title: 'Lowercase' },
            { value: 'capitalize', label: 'Ag', title: 'Capitalize' },
          ]}
          value={font.transform === 'none' ? undefined : font.transform}
          onChange={(v) => set('transform', v)}
        />
        <IconButton title="Italic" active={!!font.italic} onClick={() => set('italic', font.italic ? undefined : true)}>
          <span className="font-serif italic">I</span>
        </IconButton>
      </Row>
    </Section>
  );
}

// --- appearance ------------------------------------------------------------------

const SHADOWS = ['2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const;

function AppearanceSection({ ed, image }: { ed: Editor; image: boolean }) {
  const radius = ed.style.radius;
  const corners = Array.isArray(radius);
  const shadow = ed.style.shadow;
  const shadowSize = typeof shadow === 'object' ? shadow.size : shadow;
  const shadowColor = typeof shadow === 'object' ? shadow.color : undefined;
  const setShadow = (size: string | undefined, color: string | undefined) =>
    ed.set('shadow', size === undefined ? undefined : color ? { size, color } : size);

  return (
    <Section title="Appearance" marker={ed.mark('radius') ?? ed.mark('opacity') ?? ed.mark('shadow') ?? ed.mark('clip')}>
      <Row label="Radius" mark={ed.mark('radius')}>
        {corners ? (
          <div className="grid flex-1 grid-cols-4 gap-1">
            {(['↖', '↗', '↘', '↙'] as const).map((g, i) => (
              <NumberField key={g} label={g} title={['Top left', 'Top right', 'Bottom right', 'Bottom left'][i]} value={radius[i]} min={0}
                onChange={(v, k, gs) => {
                  const next = [...radius] as [number, number, number, number];
                  next[i] = typeof v === 'number' ? v : 0;
                  ed.set('radius', next, k, gs);
                }} />
            ))}
          </div>
        ) : (
          <NumberField label="◜" title="Corner radius (px), or type full" value={radius as number | string | undefined} min={0} placeholder="0"
            text={(raw) => raw === 'full'} onChange={(v, k, g) => ed.set('radius', v, k, g)} />
        )}
        <IconButton title={corners ? 'One radius' : 'Radius per corner'} active={corners}
          onClick={() => ed.set('radius', corners ? radius[0] : Array(4).fill(typeof radius === 'number' ? radius : 0))}>
          ⌜⌟
        </IconButton>
      </Row>
      <Row label="Opacity" mark={ed.mark('opacity')}>
        <NumberField label="%" title="Opacity" value={ed.style.opacity} scale={100} min={0} max={100} placeholder="100"
          onChange={(v, k, g) => ed.set('opacity', v === undefined ? 1 : Math.min(1, Number(v)), k, g)} />
      </Row>
      <Row label="Shadow" mark={ed.mark('shadow')}>
        <Select className="w-[72px] shrink-0" value={shadowSize === 'none' ? undefined : shadowSize} placeholder="None"
          options={SHADOWS.map((s) => ({ value: s, label: s }))} onChange={(v) => setShadow(v, shadowColor)} />
        {shadowSize && shadowSize !== 'none' && (
          <ColorField value={shadowColor} theme={ed.config.theme} placeholder="Default" onChange={(v) => setShadow(shadowSize, v)} />
        )}
      </Row>
      <Row label="Content" mark={ed.mark('clip') ?? ed.mark('fit')}>
        <Toggle label="Clip" title="Clip content that overflows" checked={!!ed.style.clip} onChange={(v) => ed.set('clip', v)} />
        {image && (
          <Select className="flex-1" value={ed.style.fit} placeholder="Fit: default"
            options={['cover', 'contain', 'fill', 'none', 'scale-down'].map((f) => ({ value: f as NonNullable<Style['fit']>, label: `Fit: ${f}` }))}
            onChange={(v) => ed.set('fit', v)} />
        )}
      </Row>
    </Section>
  );
}

// --- border ---------------------------------------------------------------------

const SIDES = [
  ['all', 'All sides'], ['x', 'Left + right'], ['y', 'Top + bottom'], ['top', 'Top'], ['right', 'Right'], ['bottom', 'Bottom'], ['left', 'Left'],
] as const;

function BorderSection({ ed }: { ed: Editor }) {
  const border = ed.style.border;
  const set = (sub: string, v: unknown, k?: ChangeKind, g?: string) => ed.setSub('border', sub, v, k, g);
  const sides = border?.sides;
  return (
    <Section
      title="Border"
      marker={ed.mark('border')}
      actions={
        border === undefined ? (
          <IconButton title="Add border" onClick={() => ed.set('border', { color: 'black/10' })}>+</IconButton>
        ) : (
          <IconButton title="Remove border" onClick={() => ed.set('border', undefined)}>−</IconButton>
        )
      }
    >
      {border !== undefined && (
        <>
          <Row label="Color" mark={ed.mark('border', 'color')}>
            <ColorField value={border.color} theme={ed.config.theme} placeholder="Current color" onChange={(v, k) => set('color', v, k)} />
          </Row>
          <Row label="Width" mark={ed.mark('border', 'width') ?? ed.mark('border', 'style')}>
            <NumberField className="w-[64px] shrink-0" label="≡" title="Width (px)" value={border.width} min={0} placeholder="1" onChange={(v, k, g) => set('width', v, k, g)} />
            <Seg
              className="flex-1"
              options={[
                { value: undefined as string | undefined, label: '—', title: 'Solid' },
                { value: 'dashed', label: '┄', title: 'Dashed' },
                { value: 'dotted', label: '┈', title: 'Dotted' },
              ]}
              value={border.style === 'solid' ? undefined : border.style}
              onChange={(v) => set('style', v)}
            />
          </Row>
          <Row label="Sides" mark={ed.mark('border', 'sides')}>
            {Array.isArray(sides) ? (
              <span className="flex-1 truncate font-mono text-[11px] text-white/50" title="Several sides: edit in the YAML">
                {sides.join(', ')}
              </span>
            ) : (
              <Select className="flex-1" value={sides === 'all' ? undefined : sides} placeholder="All sides"
                options={SIDES.slice(1).map(([value, label]) => ({ value, label }))} onChange={(v) => set('sides', v)} />
            )}
          </Row>
        </>
      )}
    </Section>
  );
}

