import React from 'react';
import type { NeucliNode } from './types';
import LayoutControls from './LayoutControls';

const CONVERTIBLE_TYPES = new Set(['hero', 'section', 'card', 'navbar', 'footer']);

export default function NodeEditorPanel({
  selectedNode,
  addType,
  onChangeClassName,
  onChangeText,
  onChangeProp,
  onChangeLinks,
  onAddChild,
  onAddSibling,
  onDelete,
  onConvertToContainer,
  hasSelection,
}: {
  selectedNode: NeucliNode | null;
  addType: string;
  onChangeClassName: (className: string) => void;
  onChangeText: (text: string) => void;
  onChangeProp: (key: string, value: string) => void;
  onChangeLinks: (links: Array<{ label: string; href: string }>) => void;
  onAddChild: () => void;
  onAddSibling: () => void;
  onDelete: () => void;
  onConvertToContainer: () => void;
  hasSelection: boolean;
}) {
  if (!hasSelection || !selectedNode) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center">
        <p className="text-[12px] leading-relaxed text-white/30">
          Select a layer or click a block on the canvas to inspect and edit its properties.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* ── Content section ── */}
      <Section title="Content">
        <ContentFields
          node={selectedNode}
          onChangeText={onChangeText}
          onChangeProp={onChangeProp}
          onChangeLinks={onChangeLinks}
        />
      </Section>

      {/* ── Layout section ── */}
      <Section title="Layout">
        <LayoutControls
          className={selectedNode.className ?? ''}
          onChange={onChangeClassName}
        />
      </Section>

      {/* ── Raw classes section ── */}
      <Section title="All classes">
        <DarkTextArea
          label="Tailwind (raw)"
          value={selectedNode.className ?? ''}
          onChange={onChangeClassName}
          placeholder="bg-indigo-600 text-white px-6 py-3"
          mono
        />
      </Section>

      {/* ── Actions section ── */}
      <Section title="Actions">
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={onAddChild}
            className="flex items-center justify-center gap-1.5 rounded bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-white/70 hover:bg-white/10 hover:text-white transition border border-white/10"
          >
            + Add child <TypeBadge type={addType} />
          </button>
          <button
            type="button"
            onClick={onAddSibling}
            className="flex items-center justify-center gap-1.5 rounded bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-white/70 hover:bg-white/10 hover:text-white transition border border-white/10"
          >
            + Add sibling <TypeBadge type={addType} />
          </button>
          {CONVERTIBLE_TYPES.has(selectedNode.type.toLowerCase()) && (
            <button
              type="button"
              onClick={onConvertToContainer}
              className="rounded bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-medium text-amber-300 hover:bg-amber-500/20 transition border border-amber-500/20"
            >
              Convert to raw container
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="rounded bg-red-500/10 px-2.5 py-1.5 text-[11px] font-medium text-red-400 hover:bg-red-500/20 transition border border-red-500/20"
          >
            Delete layer
          </button>
        </div>
      </Section>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="rounded bg-indigo-500/20 px-1 py-px text-[10px] text-indigo-300">
      {type}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-white/10">
      <div className="px-3 py-2">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
          {title}
        </div>
        {children}
      </div>
    </div>
  );
}

function ContentFields({
  node,
  onChangeText,
  onChangeProp,
  onChangeLinks,
}: {
  node: NeucliNode;
  onChangeText: (text: string) => void;
  onChangeProp: (key: string, value: string) => void;
  onChangeLinks: (links: Array<{ label: string; href: string }>) => void;
}) {
  const type = node.type.toLowerCase();

  switch (type) {
    case 'hero':
      return (
        <div className="space-y-2">
          <DarkField label="Title" value={sv(node.props?.title)} onChange={(v) => onChangeProp('title', v)} />
          <DarkField label="Subtitle" value={sv(node.props?.subtitle)} onChange={(v) => onChangeProp('subtitle', v)} />
        </div>
      );
    case 'section':
      return <DarkField label="Title" value={sv(node.props?.title)} onChange={(v) => onChangeProp('title', v)} />;
    case 'text':
      return (
        <div className="space-y-2">
          <DarkField label="Tag" value={sv(node.props?.tag || 'p')} onChange={(v) => onChangeProp('tag', v)} placeholder="p, h1, h2, span" />
          <DarkTextArea
            label="Content"
            value={sv(node.props?.content ?? node.text)}
            onChange={(v) => {
              if (node.props?.content !== undefined) onChangeProp('content', v);
              else onChangeText(v);
            }}
          />
        </div>
      );
    case 'button':
      return (
        <div className="space-y-2">
          <DarkField
            label="Label"
            value={sv(node.props?.label ?? node.text)}
            onChange={(v) => {
              if (node.props?.label !== undefined) onChangeProp('label', v);
              else onChangeText(v);
            }}
          />
          <DarkField label="Href" value={sv(node.props?.href)} onChange={(v) => onChangeProp('href', v)} placeholder="/about, #, https://..." />
        </div>
      );
    case 'card':
      return (
        <div className="space-y-2">
          <DarkField label="Title" value={sv(node.props?.title)} onChange={(v) => onChangeProp('title', v)} />
          <DarkTextArea label="Description" value={sv(node.props?.description)} onChange={(v) => onChangeProp('description', v)} />
          <DarkField label="Image URL" value={sv(node.props?.image)} onChange={(v) => onChangeProp('image', v)} />
        </div>
      );
    case 'image':
      return (
        <div className="space-y-2">
          <DarkField label="Source URL" value={sv(node.props?.src)} onChange={(v) => onChangeProp('src', v)} />
          <DarkField label="Alt text" value={sv(node.props?.alt)} onChange={(v) => onChangeProp('alt', v)} />
        </div>
      );
    case 'navbar':
      return (
        <div className="space-y-2">
          <DarkField label="Brand" value={sv(node.props?.brand)} onChange={(v) => onChangeProp('brand', v)} />
          <LinksEditor links={node.props?.links ?? []} onChange={onChangeLinks} />
        </div>
      );
    case 'footer':
      return (
        <div className="space-y-2">
          <DarkTextArea label="Footer text" value={sv(node.props?.text)} onChange={(v) => onChangeProp('text', v)} />
          <LinksEditor links={node.props?.links ?? []} onChange={onChangeLinks} />
        </div>
      );
    case 'grid':
      return <DarkField label="Columns" value={sv(node.props?.columns ?? 3)} onChange={(v) => onChangeProp('columns', v)} placeholder="1-6" />;
    default:
      if (node.text !== undefined) {
        return <DarkTextArea label="Text" value={sv(node.text)} onChange={onChangeText} />;
      }
      return <p className="text-[11px] text-white/30">No editable properties for this block type.</p>;
  }
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

function DarkTextArea({
  label,
  value,
  onChange,
  placeholder,
  mono,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] text-white/40">{label}</label>
      <textarea
        className={[
          'w-full resize-none rounded border border-white/10 bg-white/5 p-2 text-[12px] text-white/80 outline-none placeholder:text-white/20 focus:border-indigo-500/50',
          mono ? 'font-mono' : '',
        ].join(' ')}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function LinksEditor({
  links,
  onChange,
}: {
  links: Array<{ label: string; href: string }>;
  onChange: (links: Array<{ label: string; href: string }>) => void;
}) {
  function updateLink(index: number, field: 'label' | 'href', value: string) {
    const updated = links.map((l, i) => (i === index ? { ...l, [field]: value } : l));
    onChange(updated);
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
          className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/50 hover:bg-white/10 hover:text-white/80 transition border border-white/10"
        >
          + Add
        </button>
      </div>
      {links.length === 0 && (
        <p className="text-[11px] text-white/20">No links yet.</p>
      )}
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
                className="mt-0.5 shrink-0 rounded p-1 text-[10px] text-red-400/50 hover:bg-red-500/10 hover:text-red-400 transition"
                title="Remove link"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function sv(value: unknown) {
  return value == null ? '' : String(value);
}
