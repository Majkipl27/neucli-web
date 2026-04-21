import React from 'react';

interface LayoutControlsProps {
  className: string;
  onChange: (className: string) => void;
}

const DIRECTION_OPTIONS = [
  { value: '', label: 'Default', icon: '—' },
  { value: 'flex flex-row', label: 'Row', icon: '→' },
  { value: 'flex flex-col', label: 'Column', icon: '↓' },
  { value: 'flex flex-row-reverse', label: 'Row rev', icon: '←' },
  { value: 'flex flex-col-reverse', label: 'Col rev', icon: '↑' },
];

const JUSTIFY_OPTIONS = [
  { value: '', label: 'Default', icon: '—' },
  { value: 'justify-start', label: 'Start', icon: '⫿' },
  { value: 'justify-center', label: 'Center', icon: '⫾' },
  { value: 'justify-end', label: 'End', icon: '⫽' },
  { value: 'justify-between', label: 'Between', icon: '⟺' },
  { value: 'justify-around', label: 'Around', icon: '⟷' },
  { value: 'justify-evenly', label: 'Evenly', icon: '⋯' },
];

const ALIGN_OPTIONS = [
  { value: '', label: 'Default', icon: '—' },
  { value: 'items-start', label: 'Start', icon: '⬆' },
  { value: 'items-center', label: 'Center', icon: '⬌' },
  { value: 'items-end', label: 'End', icon: '⬇' },
  { value: 'items-stretch', label: 'Stretch', icon: '⬍' },
];

const GAP_OPTIONS = [
  { value: '', label: '0' },
  { value: 'gap-1', label: '1' },
  { value: 'gap-2', label: '2' },
  { value: 'gap-3', label: '3' },
  { value: 'gap-4', label: '4' },
  { value: 'gap-6', label: '6' },
  { value: 'gap-8', label: '8' },
  { value: 'gap-10', label: '10' },
  { value: 'gap-12', label: '12' },
];

const PADDING_OPTIONS = [
  { value: '', label: '0' },
  { value: 'p-1', label: '1' },
  { value: 'p-2', label: '2' },
  { value: 'p-3', label: '3' },
  { value: 'p-4', label: '4' },
  { value: 'p-6', label: '6' },
  { value: 'p-8', label: '8' },
  { value: 'p-10', label: '10' },
  { value: 'p-12', label: '12' },
  { value: 'p-16', label: '16' },
  { value: 'px-4 py-2', label: 'x4 y2' },
  { value: 'px-6 py-3', label: 'x6 y3' },
  { value: 'px-8 py-4', label: 'x8 y4' },
];

const TEXT_ALIGN_OPTIONS = [
  { value: '', label: 'Default', icon: '—' },
  { value: 'text-left', label: 'Left', icon: '⬑' },
  { value: 'text-center', label: 'Center', icon: '⬒' },
  { value: 'text-right', label: 'Right', icon: '⬓' },
];

const FONT_SIZE_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'text-xs', label: 'XS' },
  { value: 'text-sm', label: 'SM' },
  { value: 'text-base', label: 'Base' },
  { value: 'text-lg', label: 'LG' },
  { value: 'text-xl', label: 'XL' },
  { value: 'text-2xl', label: '2XL' },
  { value: 'text-3xl', label: '3XL' },
  { value: 'text-4xl', label: '4XL' },
  { value: 'text-5xl', label: '5XL' },
];

const FONT_WEIGHT_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'font-light', label: 'Light' },
  { value: 'font-normal', label: 'Normal' },
  { value: 'font-medium', label: 'Medium' },
  { value: 'font-semibold', label: 'Semi' },
  { value: 'font-bold', label: 'Bold' },
  { value: 'font-extrabold', label: 'XBold' },
];

const ROUNDED_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'rounded', label: 'SM' },
  { value: 'rounded-md', label: 'MD' },
  { value: 'rounded-lg', label: 'LG' },
  { value: 'rounded-xl', label: 'XL' },
  { value: 'rounded-2xl', label: '2XL' },
  { value: 'rounded-full', label: 'Full' },
];

const OPACITY_OPTIONS = [
  { value: '', label: '100' },
  { value: 'opacity-90', label: '90' },
  { value: 'opacity-80', label: '80' },
  { value: 'opacity-70', label: '70' },
  { value: 'opacity-60', label: '60' },
  { value: 'opacity-50', label: '50' },
  { value: 'opacity-40', label: '40' },
  { value: 'opacity-20', label: '20' },
];

const FONT_FAMILY_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'font-sans', label: 'Sans' },
  { value: 'font-serif', label: 'Serif' },
  { value: 'font-mono', label: 'Mono' },
];

const OVERFLOW_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'overflow-hidden', label: 'Hidden' },
  { value: 'overflow-auto', label: 'Auto' },
  { value: 'overflow-visible', label: 'Visible' },
];

const WIDTH_OPTIONS = [
  { value: '', label: 'Auto' },
  { value: 'w-full', label: 'Full' },
  { value: 'w-1/2', label: '1/2' },
  { value: 'w-1/3', label: '1/3' },
  { value: 'w-2/3', label: '2/3' },
  { value: 'w-1/4', label: '1/4' },
  { value: 'w-3/4', label: '3/4' },
  { value: 'max-w-sm', label: 'sm' },
  { value: 'max-w-md', label: 'md' },
  { value: 'max-w-lg', label: 'lg' },
  { value: 'max-w-xl', label: 'xl' },
  { value: 'max-w-2xl', label: '2xl' },
  { value: 'max-w-4xl', label: '4xl' },
  { value: 'max-w-6xl', label: '6xl' },
];

type OptionGroup = { value: string; label: string; icon?: string }[];

function extractCurrent(classes: string, options: OptionGroup): string {
  const tokens = new Set(classes.split(/\s+/).filter(Boolean));
  for (let i = options.length - 1; i >= 0; i--) {
    const opt = options[i];
    if (!opt.value) continue;
    const parts = opt.value.split(/\s+/);
    if (parts.every((p) => tokens.has(p))) return opt.value;
  }
  return '';
}

function replaceGroup(classes: string, options: OptionGroup, newValue: string): string {
  const allTokens = new Set<string>();
  for (const opt of options) {
    for (const t of opt.value.split(/\s+/)) {
      if (t) allTokens.add(t);
    }
  }

  const existing = classes.split(/\s+/).filter((t) => t && !allTokens.has(t));
  if (newValue) existing.push(...newValue.split(/\s+/));
  return existing.join(' ');
}

export default function LayoutControls({ className, onChange }: LayoutControlsProps) {
  function set(options: OptionGroup, value: string) {
    onChange(replaceGroup(className, options, value));
  }

  return (
    <div className="space-y-3">
      <Row label="Direction">
        <SegmentedPicker
          options={DIRECTION_OPTIONS}
          value={extractCurrent(className, DIRECTION_OPTIONS)}
          onChange={(v) => set(DIRECTION_OPTIONS, v)}
        />
      </Row>

      <Row label="Justify">
        <SegmentedPicker
          options={JUSTIFY_OPTIONS}
          value={extractCurrent(className, JUSTIFY_OPTIONS)}
          onChange={(v) => set(JUSTIFY_OPTIONS, v)}
        />
      </Row>

      <Row label="Align">
        <SegmentedPicker
          options={ALIGN_OPTIONS}
          value={extractCurrent(className, ALIGN_OPTIONS)}
          onChange={(v) => set(ALIGN_OPTIONS, v)}
        />
      </Row>

      <Row label="Gap">
        <SelectPicker
          options={GAP_OPTIONS}
          value={extractCurrent(className, GAP_OPTIONS)}
          onChange={(v) => set(GAP_OPTIONS, v)}
        />
      </Row>

      <Row label="Padding">
        <SelectPicker
          options={PADDING_OPTIONS}
          value={extractCurrent(className, PADDING_OPTIONS)}
          onChange={(v) => set(PADDING_OPTIONS, v)}
        />
      </Row>

      <Row label="Width">
        <SelectPicker
          options={WIDTH_OPTIONS}
          value={extractCurrent(className, WIDTH_OPTIONS)}
          onChange={(v) => set(WIDTH_OPTIONS, v)}
        />
      </Row>

      <div className="my-1 border-t border-white/5" />

      <Row label="Text align">
        <SegmentedPicker
          options={TEXT_ALIGN_OPTIONS}
          value={extractCurrent(className, TEXT_ALIGN_OPTIONS)}
          onChange={(v) => set(TEXT_ALIGN_OPTIONS, v)}
        />
      </Row>

      <Row label="Font family">
        <SegmentedPicker
          options={FONT_FAMILY_OPTIONS}
          value={extractCurrent(className, FONT_FAMILY_OPTIONS)}
          onChange={(v) => set(FONT_FAMILY_OPTIONS, v)}
        />
      </Row>

      <Row label="Font size">
        <SelectPicker
          options={FONT_SIZE_OPTIONS}
          value={extractCurrent(className, FONT_SIZE_OPTIONS)}
          onChange={(v) => set(FONT_SIZE_OPTIONS, v)}
        />
      </Row>

      <Row label="Font weight">
        <SelectPicker
          options={FONT_WEIGHT_OPTIONS}
          value={extractCurrent(className, FONT_WEIGHT_OPTIONS)}
          onChange={(v) => set(FONT_WEIGHT_OPTIONS, v)}
        />
      </Row>

      <div className="my-1 border-t border-white/5" />

      <Row label="Rounded">
        <SelectPicker
          options={ROUNDED_OPTIONS}
          value={extractCurrent(className, ROUNDED_OPTIONS)}
          onChange={(v) => set(ROUNDED_OPTIONS, v)}
        />
      </Row>

      <Row label="Opacity">
        <SelectPicker
          options={OPACITY_OPTIONS}
          value={extractCurrent(className, OPACITY_OPTIONS)}
          onChange={(v) => set(OPACITY_OPTIONS, v)}
        />
      </Row>

      <Row label="Overflow">
        <SelectPicker
          options={OVERFLOW_OPTIONS}
          value={extractCurrent(className, OVERFLOW_OPTIONS)}
          onChange={(v) => set(OVERFLOW_OPTIONS, v)}
        />
      </Row>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] text-white/35">{label}</label>
      {children}
    </div>
  );
}

function SegmentedPicker({
  options,
  value,
  onChange,
}: {
  options: OptionGroup;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-0.5">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value + opt.label}
            type="button"
            onClick={() => onChange(opt.value)}
            className={[
              'rounded px-1.5 py-1 text-[10px] font-medium transition',
              active
                ? 'bg-indigo-500/30 text-indigo-300 ring-1 ring-indigo-500/40'
                : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60',
            ].join(' ')}
            title={opt.label}
          >
            {opt.icon ?? opt.label}
          </button>
        );
      })}
    </div>
  );
}

function SelectPicker({
  options,
  value,
  onChange,
}: {
  options: OptionGroup;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/70 outline-none focus:border-indigo-500/50"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((opt) => (
        <option key={opt.value + opt.label} value={opt.value} className="bg-[#252526] text-white">
          {opt.label}
        </option>
      ))}
    </select>
  );
}
