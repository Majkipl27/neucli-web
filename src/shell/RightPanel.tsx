import React, { useState } from 'react';
import type { NeucliNode, NeucliPage, Selection } from '../document/types';
import { get as getBlock, iconFor } from '../blocks';
import { useDocumentStore } from '../store/useDocument';
import { useSelectionStore } from '../store/useSelection';
import { getAt } from '../document/tree';
import {
  deleteNode as cmdDeleteNode,
  setClassName as cmdSetClassName,
  setProp as cmdSetProp,
  setProps as cmdSetProps,
  setText as cmdSetText,
  updatePage as cmdUpdatePage,
} from '../document/commands';
import { convertToContainer } from '../document/convert';
import LayoutControls from './LayoutControls';
import ErrorBoundary from './ErrorBoundary';

export default function RightPanel() {
  const config = useDocumentStore((s) => s.config);
  const dispatch = useDocumentStore((s) => s.dispatch);

  const pageIndex = useSelectionStore((s) => s.pageIndex);
  const selection = useSelectionStore((s) => s.selection);
  const clearSelection = useSelectionStore((s) => s.clear);

  const selectedNode = selection
    ? getAt(config.pages[selection.pageIndex]?.sections ?? [], selection.path)
    : null;

  const currentPage = config.pages[pageIndex];

  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-l border-white/10 bg-[#252526]">
      {selectedNode && selection ? (
        <NodePanel
          node={selectedNode}
          selection={selection}
          onDelete={() => {
            dispatch((c) => cmdDeleteNode(c, selection));
            clearSelection();
          }}
          onConvert={() => {
            dispatch((c) => convertToContainer(c, selection));
          }}
        />
      ) : (
        <PagePanel
          page={currentPage}
          onChange={(updates) => {
            dispatch((c) => cmdUpdatePage(c, pageIndex, updates), {
              mode: 'coalesce',
              group: `page:${pageIndex}`,
            });
          }}
        />
      )}
    </aside>
  );
}

interface NodePanelProps {
  node: NeucliNode;
  selection: Selection;
  onDelete: () => void;
  onConvert: () => void;
}

function NodePanel({ node, selection, onDelete, onConvert }: NodePanelProps) {
  const dispatch = useDocumentStore((s) => s.dispatch);
  const def = getBlock(node.type);

  const setProp = (key: string, value: unknown) => {
    dispatch((c) => cmdSetProp(c, selection, key, value), {
      mode: 'coalesce',
      group: `prop:${key}:${pathKey(selection)}`,
    });
  };

  const setText = (value: string) => {
    dispatch((c) => cmdSetText(c, selection, value), {
      mode: 'coalesce',
      group: `text:${pathKey(selection)}`,
    });
  };

  const setProps = (patch: Record<string, unknown>) => {
    dispatch((c) => cmdSetProps(c, selection, patch), {
      mode: 'coalesce',
      group: `props:${pathKey(selection)}`,
    });
  };

  const setClassName = (className: string) => {
    dispatch((c) => cmdSetClassName(c, selection, className), {
      mode: 'coalesce',
      group: `class:${pathKey(selection)}`,
    });
  };

  const canConvert = ['hero', 'section', 'card', 'navbar', 'footer'].includes(
    node.type.toLowerCase(),
  );

  return (
    <>
      <StickyHeader node={node} onDelete={onDelete} onConvert={canConvert ? onConvert : null} />

      <div className="flex-1 overflow-auto">
        <Section title="Content" defaultOpen>
          {def?.PropsFields ? (
            <ErrorBoundary resetKey={pathKey(selection)} label="Property editor crashed">
              <def.PropsFields
                node={node}
                selection={selection}
                setProp={setProp}
                setText={setText}
                setProps={setProps}
              />
            </ErrorBoundary>
          ) : (
            <p className="text-[11px] text-white/30">
              No editable properties for this block type.
            </p>
          )}
        </Section>

        <Section title="Layout" defaultOpen={false}>
          <LayoutControls className={node.className ?? ''} onChange={setClassName} />
        </Section>

        <Section title="Classes" defaultOpen={false}>
          <ClassesEditor
            value={node.className ?? ''}
            onChange={setClassName}
          />
        </Section>
      </div>
    </>
  );
}

function StickyHeader({
  node,
  onDelete,
  onConvert,
}: {
  node: NeucliNode;
  onDelete: () => void;
  onConvert: (() => void) | null;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="sticky top-0 z-10 border-b border-white/10 bg-[#252526]/95 backdrop-blur-sm">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded bg-indigo-500/20 text-[11px] font-bold text-indigo-300">
          {iconFor(node.type)}
        </span>
        <div className="flex-1 overflow-hidden">
          <div className="truncate text-[12px] font-semibold text-white/90">{node.type}</div>
          <div className="truncate text-[10px] text-white/40">Selected block</div>
        </div>

        {onConvert && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded p-1 text-white/40 transition hover:bg-white/10 hover:text-white/80"
              title="More actions"
            >
              &#x22EF;
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-md border border-white/10 bg-[#2c2c2c] shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      onConvert();
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-amber-300 transition hover:bg-amber-500/10"
                  >
                    Convert to raw container
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                onDelete();
                setConfirmDelete(false);
              }}
              className="rounded bg-red-500 px-2 py-1 text-[10px] font-semibold text-white transition hover:bg-red-400"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="rounded px-1.5 py-1 text-[10px] text-white/50 transition hover:text-white/80"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="rounded p-1 text-red-400/60 transition hover:bg-red-500/10 hover:text-red-400"
            title="Delete block"
          >
            &#x2715;
          </button>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left transition hover:bg-white/[0.02]"
      >
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
          {title}
        </span>
        <span className="text-[10px] text-white/30">{open ? '\u25BE' : '\u25B8'}</span>
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

function PagePanel({
  page,
  onChange,
}: {
  page: NeucliPage | undefined;
  onChange: (updates: Partial<NeucliPage>) => void;
}) {
  if (!page) return null;
  return (
    <>
      <div className="sticky top-0 z-10 border-b border-white/10 bg-[#252526]/95 px-3 py-2.5 backdrop-blur-sm">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Page</div>
        <div className="truncate text-[12px] font-semibold text-white/90">{page.name}</div>
      </div>

      <div className="flex-1 overflow-auto">
        <Section title="Page settings" defaultOpen>
          <div className="space-y-2">
            <PageField label="Name" value={page.name} onChange={(v) => onChange({ name: v })} />
            <PageField label="Path" value={page.path} onChange={(v) => onChange({ path: v })} placeholder="/" />
            <PageField label="Title" value={page.title ?? ''} onChange={(v) => onChange({ title: v })} placeholder="Page title" />
            <PageField
              label="Description"
              value={page.meta?.description ?? ''}
              onChange={(v) => onChange({ meta: { ...page.meta, description: v } })}
              placeholder="Meta description"
            />
          </div>
        </Section>

        <div className="px-3 py-6 text-center">
          <p className="text-[11px] text-white/30">
            Select a layer or click a block on the canvas to edit its properties.
          </p>
        </div>
      </div>
    </>
  );
}

function PageField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
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

function ClassesEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const config = useDocumentStore((s) => s.config);
  const colors = Object.entries(config.theme?.colors ?? {});
  const fonts = Object.entries(config.theme?.fonts ?? {});
  const hasTokens = colors.length > 0 || fonts.length > 0;

  /**
   * Replace-or-append: strip any existing token matching `family` (e.g. all
   * `bg-[...]` tokens) then append the new one. Keeps the className tidy when
   * users swap between tokens.
   */
  function apply(family: RegExp, cls: string) {
    const tokens = value.split(/\s+/).filter((t) => t && !family.test(t));
    tokens.push(cls);
    onChange(tokens.join(' '));
  }

  return (
    <div className="space-y-2">
      <textarea
        className="w-full resize-none rounded border border-white/10 bg-white/5 p-2 font-mono text-[12px] text-white/80 outline-none placeholder:text-white/20 focus:border-indigo-500/50"
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="bg-indigo-600 text-white px-6 py-3"
      />
      {hasTokens && (
        <div>
          <p className="mb-1.5 text-[10px] text-white/30">
            Click a token to apply. Same-family classes are replaced, not stacked.
          </p>
          {colors.length > 0 && (
            <div className="mb-1.5 flex flex-wrap gap-1">
              {colors.map(([key, val]) => (
                <TokenMenu
                  key={key}
                  label={key}
                  color={typeof val === 'string' ? val : undefined}
                  varName={`--nc-${key}`}
                  onPick={(use, cls) => apply(use.family, cls)}
                />
              ))}
            </div>
          )}
          {fonts.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {fonts.map(([key]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    apply(/^font-\[family-name:.+\]$/, 'font-[family-name:--nc-font-' + key + ']')
                  }
                  title={'font-[family-name:--nc-font-' + key + ']'}
                  className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/50 transition hover:bg-white/10 hover:text-white/80"
                >
                  T {key}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ColorUse {
  label: string;
  /** Matches any existing class of this family so it can be swapped. */
  family: RegExp;
  cls: (v: string) => string;
}

// Template literals are avoided here so Tailwind's JIT scanner does not
// misread `${v}` inside the source as a literal arbitrary-value class.
const COLOR_USES: ColorUse[] = [
  { label: 'bg', family: /^bg-\[.+\]$/, cls: (v) => 'bg-[' + v + ']' },
  { label: 'text', family: /^text-\[(?!family-name).+\]$/, cls: (v) => 'text-[' + v + ']' },
  { label: 'border', family: /^border-\[.+\]$/, cls: (v) => 'border-[' + v + ']' },
  { label: 'ring', family: /^ring-\[.+\]$/, cls: (v) => 'ring-[' + v + ']' },
];

function TokenMenu({
  label,
  color,
  varName,
  onPick,
}: {
  label: string;
  color?: string;
  varName: string;
  onPick: (use: ColorUse, cls: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/60 transition hover:bg-white/10 hover:text-white/90"
      >
        {color && (
          <span
            className="h-3 w-3 shrink-0 rounded-sm border border-white/10"
            style={{ backgroundColor: color }}
          />
        )}
        {label}
        <span className="text-white/25">&#x25BE;</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-0.5 min-w-[160px] overflow-hidden rounded border border-white/10 bg-[#2c2c2c] shadow-xl">
            {COLOR_USES.map((use) => (
              <button
                key={use.label}
                type="button"
                onClick={() => {
                  onPick(use, use.cls(varName));
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] text-white/60 transition hover:bg-white/5 hover:text-white/90"
              >
                <code className="font-mono text-[10px] text-indigo-300/70">{use.label}</code>
                <span className="truncate text-white/30">{use.cls(varName)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function pathKey(selection: Selection): string {
  return `${selection.pageIndex}/${selection.path.join('.')}`;
}
