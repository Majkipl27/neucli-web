import React from 'react';

export function DarkField({
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

export function DarkTextArea({
  label,
  value,
  onChange,
  placeholder,
  mono,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  mono?: boolean;
  rows?: number;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] text-white/40">{label}</label>
      <textarea
        className={[
          'w-full resize-none rounded border border-white/10 bg-white/5 p-2 text-[12px] text-white/80 outline-none placeholder:text-white/20 focus:border-indigo-500/50',
          mono ? 'font-mono' : '',
        ].join(' ')}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

export interface LinkItem {
  label: string;
  href: string;
}

export function LinksEditor({
  links,
  onChange,
}: {
  links: LinkItem[];
  onChange: (links: LinkItem[]) => void;
}) {
  function updateLink(index: number, field: keyof LinkItem, value: string) {
    onChange(links.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }
  function addLink() {
    onChange([...links, { label: 'Link', href: '#' }]);
  }
  function removeLink(index: number) {
    onChange(links.filter((_, i) => i !== index));
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-[11px] text-white/40">Links</label>
        <button
          type="button"
          onClick={addLink}
          className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/50 transition hover:bg-white/10 hover:text-white/80"
        >
          + Add
        </button>
      </div>
      {links.length === 0 && <p className="text-[11px] text-white/20">No links yet.</p>}
      <div className="space-y-2">
        {links.map((link, i) => (
          <div key={i} className="rounded border border-white/10 bg-white/[0.02] p-2">
            <div className="flex items-start justify-between gap-1">
              <div className="flex-1 space-y-1.5">
                <input
                  className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-[12px] text-white/80 outline-none placeholder:text-white/20 focus:border-indigo-500/50"
                  value={link.label}
                  onChange={(e) => updateLink(i, 'label', e.target.value)}
                  placeholder="Label"
                />
                <input
                  className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-[12px] text-white/80 outline-none placeholder:text-white/20 focus:border-indigo-500/50"
                  value={link.href}
                  onChange={(e) => updateLink(i, 'href', e.target.value)}
                  placeholder="/about, #features, https://..."
                />
              </div>
              <button
                type="button"
                onClick={() => removeLink(i)}
                className="mt-0.5 shrink-0 rounded p-1 text-[10px] text-red-400/50 transition hover:bg-red-500/10 hover:text-red-400"
                title="Remove link"
              >
                &#x2715;
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function sv(value: unknown): string {
  return value == null ? '' : String(value);
}

export function joinClasses(...parts: Array<string | undefined | null | false>): string {
  return parts.filter(Boolean).join(' ');
}

const LAYOUT_PATTERNS = [
  /^flex$/,
  /^flex-(row|col|wrap|nowrap|row-reverse|col-reverse)$/,
  /^gap-/,
  /^justify-/,
  /^items-/,
  /^self-/,
  /^content-/,
  /^space-(x|y)-/,
  /^flex-1$/,
  /^grow/,
  /^shrink/,
];

/**
 * Splits a className string into layout-related tokens and everything else.
 * Used by block renderers whose inner wrapper needs to pick up layout hints
 * authored on the outer node's className.
 */
export function splitLayoutClasses(className?: string): { layout: string; visual: string } {
  if (!className) return { layout: '', visual: '' };
  const tokens = className.split(/\s+/).filter(Boolean);
  const layout: string[] = [];
  const visual: string[] = [];
  for (const t of tokens) {
    if (LAYOUT_PATTERNS.some((p) => p.test(t))) layout.push(t);
    else visual.push(t);
  }
  return { layout: layout.join(' '), visual: visual.join(' ') };
}
