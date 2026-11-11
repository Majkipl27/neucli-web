/**
 * Dense, Figma-like panel controls. Every control reports changes with a
 * `ChangeKind` so the caller can map them to undo steps:
 * - 'commit': typed value confirmed (Enter / blur / click) -> one step
 * - 'nudge':  arrow keys -> coalesced while you keep pressing
 * - 'scrub':  dragging a label -> one step per drag, however long
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Theme } from 'neucli/core';
import { PALETTE_FAMILIES, PALETTE_SHADES, cssColor, joinColor, paletteColor, splitColor } from './colors';

export type ChangeKind = 'commit' | 'nudge' | 'scrub';
export type OnChange<T> = (value: T, kind: ChangeKind, gesture?: string) => void;

let gestureCounter = 0;

// --- layout -------------------------------------------------------------------

export function Section({
  title,
  children,
  actions,
  open: initialOpen = true,
  marker,
}: {
  title: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  open?: boolean;
  marker?: React.ReactNode;
}) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <div className="border-b border-white/[0.07]">
      <div className="flex h-8 items-center gap-1 pl-3 pr-1.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-1.5 text-left text-[11px] font-semibold text-white/80"
        >
          {title}
          {marker}
          {!open && <span className="text-[9px] font-normal text-white/25">hidden</span>}
        </button>
        {actions}
      </div>
      {open && children && <div className="space-y-1.5 px-3 pb-3">{children}</div>}
    </div>
  );
}

export type MarkTone = 'breakpoint' | 'instance';

/** Small dot next to a label: the value is overridden here. Click resets it. */
export function Mark({ tone, title, onReset }: { tone: MarkTone; title: string; onReset?: () => void }) {
  return (
    <button
      type="button"
      title={onReset ? `${title} — click to reset` : title}
      onClick={(e) => {
        e.stopPropagation();
        onReset?.();
      }}
      className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone === 'instance' ? 'bg-violet-400' : 'bg-sky-400'} ${onReset ? 'hover:ring-2 hover:ring-white/30' : ''}`}
    />
  );
}

export function Row({ label, mark, children }: { label: string; mark?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[26px] items-center gap-2">
      <div className="flex w-[58px] shrink-0 items-center gap-1 text-[11px] text-white/45">
        <span className="truncate">{label}</span>
        {mark}
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">{children}</div>
    </div>
  );
}

export function IconButton({
  title,
  onClick,
  active,
  children,
  disabled,
}: {
  title: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-6 min-w-6 items-center justify-center rounded px-1 text-[12px] leading-none transition disabled:opacity-25 ${
        active ? 'bg-white/15 text-white' : 'text-white/45 hover:bg-white/[0.07] hover:text-white/85'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Select the whole value when a field gains focus, and keep it selected through
 * the mouseup of the click that focused it (which would otherwise drop a caret
 * in the middle and make typing insert into the old value).
 */
function useSelectOnFocus() {
  const justFocused = useRef(false);
  return {
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      justFocused.current = true;
      e.target.select();
    },
    onMouseUp: (e: React.MouseEvent<HTMLInputElement>) => {
      if (justFocused.current) e.preventDefault();
      justFocused.current = false;
    },
  };
}

// --- number / length -----------------------------------------------------------

const fieldBox =
  'flex h-6 min-w-0 items-center rounded border border-transparent bg-white/[0.06] hover:border-white/10 focus-within:!border-indigo-400/60';

function format(v: number): string {
  return String(Math.round(v * 1000) / 1000);
}

/**
 * Number field with a scrubbable label (drag left/right; Shift = x10), arrow
 * keys (+-step, Shift x10) and typed values. `text` lets typed non-numbers
 * through (e.g. "50%", "screen") for length fields.
 */
export function NumberField({
  value,
  onChange,
  label,
  title,
  placeholder,
  step = 1,
  min,
  max,
  scale = 1,
  text,
  suffix,
  className = '',
}: {
  value: number | string | undefined;
  onChange: OnChange<number | string | undefined>;
  /** Short glyph shown inside the field and used as the scrub handle. */
  label?: React.ReactNode;
  title?: string;
  placeholder?: string;
  step?: number;
  min?: number;
  max?: number;
  /** Display multiplier: opacity stored 0..1, shown 0..100. */
  scale?: number;
  text?: (raw: string) => boolean;
  suffix?: string;
  className?: string;
}) {
  const shown = typeof value === 'number' ? format(value * scale) : value ?? '';
  const [draft, setDraftState] = useState<string | null>(null);
  // Mirrors `draft` synchronously: Enter commits and then blurs, and the blur must not commit again.
  const draftRef = useRef<string | null>(null);
  const setDraft = (v: string | null) => {
    draftRef.current = v;
    setDraftState(v);
  };
  const inputRef = useRef<HTMLInputElement>(null);
  const select = useSelectOnFocus();

  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
  const numeric = typeof value === 'number' ? value * scale : Number(value);
  const base = Number.isFinite(numeric) ? numeric : 0;
  const emit = (displayed: number, kind: ChangeKind, gesture?: string) =>
    onChange(clamp(Math.round(displayed / step) * step) / scale, kind, gesture);

  function commitDraft() {
    if (draftRef.current === null) return;
    const raw = draftRef.current.trim();
    setDraft(null);
    if (raw === shown) return;
    if (raw === '') return onChange(undefined, 'commit');
    const n = Number(raw);
    if (Number.isFinite(n)) return emit(n, 'commit');
    if (text?.(raw)) onChange(raw, 'commit');
  }

  function startScrub(e: React.PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const start = base;
    const gesture = `scrub:${++gestureCounter}`;
    let last = start;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const next = start + Math.round(dx / 2) * step * (ev.shiftKey ? 10 : 1);
      if (next === last) return;
      last = next;
      emit(next, 'scrub', gesture);
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      document.body.style.cursor = '';
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    document.body.style.cursor = 'ew-resize';
  }

  return (
    <label className={`${fieldBox} ${className}`} title={title}>
      {label !== undefined && (
        <span
          onPointerDown={startScrub}
          className="flex h-full w-6 shrink-0 cursor-ew-resize select-none items-center justify-center text-[10px] text-white/35"
        >
          {label}
        </span>
      )}
      <input
        ref={inputRef}
        className={`h-full w-full min-w-0 bg-transparent font-mono text-[11px] tabular-nums text-white/85 outline-none placeholder:text-white/25 ${label === undefined ? 'pl-1.5' : ''}`}
        value={draft ?? shown}
        placeholder={placeholder}
        {...select}
        onFocus={(e) => {
          setDraft(String(shown));
          select.onFocus(e);
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commitDraft();
            inputRef.current?.blur();
          } else if (e.key === 'Escape') {
            setDraft(null);
            inputRef.current?.blur();
          } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const delta = (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
            const next = clamp(base + delta);
            setDraft(format(next));
            emit(next, 'nudge');
          }
          e.stopPropagation();
        }}
      />
      {suffix && <span className="pr-1.5 text-[10px] text-white/30">{suffix}</span>}
    </label>
  );
}

// --- choice -----------------------------------------------------------------------

export interface SegOption<T> {
  value: T;
  label: React.ReactNode;
  title: string;
}

export function Seg<T extends string | number | boolean | null | undefined>({
  options,
  value,
  onChange,
  className = '',
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={`flex h-6 items-center gap-px rounded bg-white/[0.06] p-px ${className}`}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          title={o.title}
          onClick={() => onChange(o.value)}
          className={`flex h-full flex-1 items-center justify-center rounded-[3px] px-1.5 text-[11px] leading-none transition ${
            o.value === value ? 'bg-white/15 text-white' : 'text-white/45 hover:text-white/80'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  placeholder,
  className = '',
  title,
}: {
  value: T | undefined;
  options: { value: T; label: string }[];
  onChange: (v: T | undefined) => void;
  placeholder?: string;
  className?: string;
  title?: string;
}) {
  return (
    <select
      title={title}
      value={value ?? ''}
      onChange={(e) => onChange((e.target.value || undefined) as T | undefined)}
      className={`h-6 min-w-0 rounded border border-transparent bg-white/[0.06] px-1 text-[11px] text-white/85 outline-none hover:border-white/10 focus:border-indigo-400/60 ${className}`}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({ checked, onChange, label, title }: { checked: boolean; onChange: (v: boolean) => void; label: string; title?: string }) {
  return (
    <label title={title} className="flex h-6 cursor-pointer items-center gap-1.5 text-[11px] text-white/60">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-3 w-3 accent-indigo-500" />
      {label}
    </label>
  );
}

export function TextField({
  value,
  onChange,
  placeholder,
  mono,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <input
      className={`h-6 w-full min-w-0 rounded border border-transparent bg-white/[0.06] px-1.5 text-[11px] text-white/85 outline-none placeholder:text-white/25 hover:border-white/10 focus:border-indigo-400/60 ${mono ? 'font-mono' : ''} ${className}`}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.stopPropagation()}
    />
  );
}

// --- color ----------------------------------------------------------------------

function Swatch({ css, size = 14, title }: { css: string | null; size?: number; title?: string }) {
  return (
    <span
      title={title}
      className="relative inline-block shrink-0 overflow-hidden rounded-[3px] ring-1 ring-inset ring-white/15"
      style={{
        width: size,
        height: size,
        backgroundImage:
          'linear-gradient(45deg,#555 25%,transparent 25%),linear-gradient(-45deg,#555 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#555 75%),linear-gradient(-45deg,transparent 75%,#555 75%)',
        backgroundSize: '6px 6px',
        backgroundPosition: '0 0,0 3px,3px -3px,-3px 0',
        backgroundColor: '#888',
      }}
    >
      <span className="absolute inset-0" style={{ background: css ?? 'transparent' }} />
      {!css && <span className="absolute inset-0 flex items-center justify-center text-[9px] text-red-300">?</span>}
    </span>
  );
}

/**
 * A color value field: swatch (opens the picker) + the value as text. Accepts
 * theme tokens, Tailwind palette names, keywords and hex, with /opacity.
 */
export function ColorField({
  value,
  onChange,
  theme,
  placeholder = 'None',
}: {
  value: string | undefined;
  onChange: (v: string | undefined, kind: ChangeKind) => void;
  theme: Theme | undefined;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraftState] = useState<string | null>(null);
  const draftRef = useRef<string | null>(null);
  const setDraft = (v: string | null) => {
    draftRef.current = v;
    setDraftState(v);
  };
  const anchor = useRef<HTMLButtonElement>(null);
  const select = useSelectOnFocus();

  function commit() {
    if (draftRef.current === null) return;
    const v = draftRef.current.trim();
    setDraft(null);
    if (v !== (value ?? '')) onChange(v || undefined, 'commit');
  }

  return (
    <div className={`${fieldBox} flex-1 pl-1`}>
      <button ref={anchor} type="button" title="Pick a color" onClick={() => setOpen((v) => !v)} className="flex shrink-0 items-center">
        <Swatch css={value ? cssColor(value, theme) : 'transparent'} />
      </button>
      <input
        className="h-full w-full min-w-0 bg-transparent pl-1.5 font-mono text-[11px] text-white/85 outline-none placeholder:text-white/25"
        value={draft ?? value ?? ''}
        placeholder={placeholder}
        {...select}
        onFocus={(e) => {
          setDraft(value ?? '');
          select.onFocus(e);
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') {
            setDraft(null);
            (e.target as HTMLInputElement).blur();
          }
          e.stopPropagation();
        }}
      />
      {open && anchor.current && (
        <ColorPicker
          anchor={anchor.current}
          value={value}
          theme={theme}
          onPick={(v, kind) => onChange(v, kind)}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function ColorPicker({
  anchor,
  value,
  theme,
  onPick,
  onClose,
}: {
  anchor: HTMLElement;
  value: string | undefined;
  theme: Theme | undefined;
  onPick: (v: string | undefined, kind: ChangeKind) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const parsed = value ? splitColor(value) : { base: '' };
  const [hex, setHex] = useState(parsed.base.startsWith('#') ? parsed.base : '');

  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect();
    const h = ref.current?.offsetHeight ?? 420;
    const w = ref.current?.offsetWidth ?? 240;
    setPos({ top: Math.max(8, Math.min(r.top - 8, window.innerHeight - h - 8)), left: Math.max(8, r.left - w - 12) });
  }, [anchor]);

  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (ref.current?.contains(e.target as Node) || anchor.contains(e.target as Node)) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('keydown', key);
    };
  }, [anchor, onClose]);

  const pick = (base: string) => onPick(joinColor({ base, alpha: parsed.alpha }), 'commit');
  const tokens = Object.keys(theme?.colors ?? {});
  const cell = 'h-3.5 w-3.5 rounded-[2px] ring-inset transition hover:scale-125 hover:ring-1 hover:ring-white';

  return createPortal(
    <div
      ref={ref}
      style={{ top: pos.top, left: pos.left }}
      className="fixed z-50 w-[236px] rounded-md border border-white/10 bg-[#2c2c2c] p-2.5 text-[11px] text-white/70 shadow-2xl shadow-black/60"
    >
      {tokens.length > 0 && (
        <>
          <div className="mb-1 text-[10px] uppercase tracking-wider text-white/35">Theme</div>
          <div className="mb-2.5 flex flex-wrap gap-1">
            {tokens.map((t) => (
              <button
                key={t}
                type="button"
                title={t}
                onClick={() => pick(t)}
                className={`flex items-center gap-1 rounded px-1 py-0.5 hover:bg-white/10 ${parsed.base === t ? 'bg-white/15 text-white' : ''}`}
              >
                <Swatch css={cssColor(t, theme)} size={12} />
                <span className="text-[10px]">{t}</span>
              </button>
            ))}
          </div>
        </>
      )}
      <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-white/35">
        <span>Tailwind</span>
        <span className="flex gap-1 normal-case tracking-normal">
          {['white', 'black', 'transparent'].map((k) => (
            <button key={k} type="button" title={k} onClick={() => pick(k)} className={`rounded px-1 hover:bg-white/10 ${parsed.base === k ? 'text-white' : ''}`}>
              {k}
            </button>
          ))}
        </span>
      </div>
      <div className="max-h-[230px] space-y-px overflow-y-auto pr-1">
        {PALETTE_FAMILIES.map((family) => (
          <div key={family} className="flex items-center gap-px">
            <span className="w-[46px] shrink-0 truncate text-[9px] text-white/30">{family}</span>
            {PALETTE_SHADES.map((shade) => {
              const name = `${family}-${shade}`;
              const css = paletteColor(name);
              return (
                <button
                  key={shade}
                  type="button"
                  title={name}
                  onClick={() => pick(name)}
                  className={`${cell} ${parsed.base === name ? 'ring-2 ring-white' : ''}`}
                  style={{ background: css }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex items-center gap-1.5">
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(hex) ? hex : '#000000'}
          onChange={(e) => {
            setHex(e.target.value);
            onPick(joinColor({ base: e.target.value, alpha: parsed.alpha }), 'nudge');
          }}
          className="h-6 w-6 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
          title="Custom color"
        />
        <input
          value={hex}
          placeholder="#hex"
          onChange={(e) => setHex(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) pick(hex);
            e.stopPropagation();
          }}
          className="h-6 w-[76px] rounded bg-white/[0.06] px-1.5 font-mono text-[11px] text-white/85 outline-none"
        />
        <NumberField
          className="w-[72px]"
          label="%"
          title="Opacity"
          value={parsed.base ? parsed.alpha ?? 100 : undefined}
          min={0}
          max={100}
          onChange={(v, kind) => {
            if (!parsed.base) return;
            const a = typeof v === 'number' ? v : 100;
            onPick(joinColor({ base: parsed.base, alpha: a }), kind === 'commit' ? 'commit' : 'nudge');
          }}
        />
      </div>
      {value && (
        <button type="button" onClick={() => { onPick(undefined, 'commit'); onClose(); }} className="mt-2 text-[10px] text-white/35 hover:text-red-300">
          Remove color
        </button>
      )}
    </div>,
    document.body,
  );
}
