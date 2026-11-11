import React, { useRef, useState } from 'react';
import type { Page as NeucliPage } from '../document/types';
import { useDocumentStore } from '../store/useDocument';
import { useSelectionStore } from '../store/useSelection';
import { useUIStore } from '../store/useUI';
import {
  addPage as cmdAddPage,
  deletePage as cmdDeletePage,
  duplicatePage as cmdDuplicatePage,
  updatePage as cmdUpdatePage,
  setMeta as cmdSetMeta,
  setToken,
  deleteToken,
} from '../document/commands';
import { renameTokenEverywhere, tokenUses } from '../document/tokens';
import type { Config } from '../document/types';

const cmdSetThemeColor = (c: Config, k: string, v: string) => setToken(c, 'colors', k, v);
const cmdSetThemeFont = (c: Config, k: string, v: string) => setToken(c, 'fonts', k, v);

type TokenKind = 'colors' | 'fonts';

/** Rename a token and every reference to it; refuse a name that's already taken. */
function renameTokenCmd(kind: TokenKind, from: string, to: string) {
  const { config, dispatch } = useDocumentStore.getState();
  if (config.theme?.[kind]?.[to] !== undefined) return useUIStore.getState().flash(`"${to}" already exists.`);
  dispatch((c) => renameTokenEverywhere(c, kind, from, to));
}

/** Delete a token only when nothing uses it, so the document never stops validating. */
function deleteTokenCmd(kind: TokenKind, name: string) {
  const { config, dispatch } = useDocumentStore.getState();
  const uses = tokenUses(config, kind, name);
  if (uses > 0) {
    return useUIStore.getState().flash(`"${name}" is used ${uses} time${uses === 1 ? '' : 's'}. Change those first, or rename the token.`);
  }
  dispatch((c) => deleteToken(c, kind, name));
}
import LayerTree from './LayerTree';

// ─────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────

export default function LeftSidebar() {
  const config = useDocumentStore((s) => s.config);
  const dispatch = useDocumentStore((s) => s.dispatch);

  const pageIndex = useSelectionStore((s) => s.pageIndex);
  const setPage = useSelectionStore((s) => s.setPage);
  const clearSelection = useSelectionStore((s) => s.clear);

  const editingPageIndex = useUIStore((s) => s.editingPageIndex);
  const setEditingPageIndex = useUIStore((s) => s.setEditingPageIndex);

  const currentPage = config.pages[pageIndex];

  function addPage() {
    const result = cmdAddPage(config);
    dispatch(() => result.config);
    setPage(result.newIndex);
  }

  function deletePage(idx: number) {
    if (config.pages.length <= 1) return;
    const pagesAfter = config.pages.length - 1;
    dispatch((c) => cmdDeletePage(c, idx));
    if (pageIndex >= pagesAfter) setPage(Math.max(0, pagesAfter - 1));
    else if (idx < pageIndex) setPage(pageIndex - 1);
    else clearSelection();
  }

  function duplicatePage(idx: number) {
    const result = cmdDuplicatePage(config, idx);
    dispatch(() => result.config);
    setPage(result.newIndex);
  }

  function updatePage(idx: number, updates: Partial<NeucliPage>) {
    dispatch((c) => cmdUpdatePage(c, idx, updates), { mode: 'coalesce', group: `page:${idx}` });
  }

  return (
    <aside className="flex w-[240px] shrink-0 flex-col overflow-hidden border-r border-white/10 bg-[#252526]">
      {/* Pages ── fixed at top */}
      <PagesSection
        pages={config.pages}
        activeIndex={pageIndex}
        onSwitch={setPage}
        onAdd={addPage}
        onDelete={deletePage}
        onDuplicate={duplicatePage}
        onStartEdit={setEditingPageIndex}
      />

      {editingPageIndex !== null && config.pages[editingPageIndex] && (
        <PageSettingsInline
          page={config.pages[editingPageIndex]}
          onChange={(updates) => updatePage(editingPageIndex, updates)}
          onClose={() => setEditingPageIndex(null)}
        />
      )}

      {/* All scrollable content below */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {/* Layers */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
            Layers
          </span>
          <span className="truncate text-[10px] text-white/25">{currentPage?.name}</span>
        </div>
        <div className="px-1 py-1">
          <LayerTree />
        </div>

        {/* Tokens */}
        <DesignTokens />

        {/* Site meta */}
        <SiteMeta />
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────
// Pages section
// ─────────────────────────────────────────────

function PagesSection({
  pages,
  activeIndex,
  onSwitch,
  onAdd,
  onDelete,
  onDuplicate,
  onStartEdit,
}: {
  pages: NeucliPage[];
  activeIndex: number;
  onSwitch: (idx: number) => void;
  onAdd: () => void;
  onDelete: (idx: number) => void;
  onDuplicate: (idx: number) => void;
  onStartEdit: (idx: number) => void;
}) {
  return (
    <div className="shrink-0 border-b border-white/10">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
          Pages
        </span>
        <button
          type="button"
          onClick={onAdd}
          className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px] text-white/50 transition hover:bg-white/10 hover:text-white/80"
        >
          +
        </button>
      </div>
      <div className="max-h-[180px] overflow-y-auto px-1 pb-1">
        {pages.map((page, idx) => (
          <div key={idx} className="group relative">
            <button
              type="button"
              onClick={() => onSwitch(idx)}
              onDoubleClick={() => onStartEdit(idx)}
              className={[
                'flex w-full items-center gap-2 rounded px-2 py-[5px] text-left transition-colors',
                idx === activeIndex
                  ? 'bg-indigo-500/20 text-white'
                  : 'text-white/60 hover:bg-white/5 hover:text-white/80',
              ].join(' ')}
            >
              <span className="w-4 shrink-0 text-center text-[10px] opacity-50">&#x22A1;</span>
              <span className="flex-1 truncate text-[12px]">{page.name}</span>
              <span className="shrink-0 text-[10px] text-white/30">{page.path}</span>
            </button>
            <div className="absolute right-1 top-0.5 hidden items-center gap-0.5 group-hover:flex">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDuplicate(idx); }}
                className="rounded p-0.5 text-[10px] text-white/30 hover:bg-white/10 hover:text-white/70"
                title="Duplicate"
              >
                &#x29C9;
              </button>
              {pages.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDelete(idx); }}
                  className="rounded p-0.5 text-[10px] text-red-400/50 hover:bg-red-500/10 hover:text-red-400"
                  title="Delete"
                >
                  &#x2715;
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Inline page editor
// ─────────────────────────────────────────────

function PageSettingsInline({
  page,
  onChange,
  onClose,
}: {
  page: NeucliPage;
  onChange: (u: Partial<NeucliPage>) => void;
  onClose: () => void;
}) {
  const inp =
    'w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-[12px] text-white/80 outline-none focus:border-indigo-500/50';
  return (
    <div className="shrink-0 space-y-2 border-b border-white/10 px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
          Edit page
        </span>
        <button type="button" onClick={onClose} className="text-[10px] text-white/30 hover:text-white/60">
          Done
        </button>
      </div>
      <input className={inp} value={page.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Name" />
      <input className={inp} value={page.path} onChange={(e) => onChange({ path: e.target.value })} placeholder="/path" />
      <input className={inp} value={page.title ?? ''} onChange={(e) => onChange({ title: e.target.value })} placeholder="<title>" />
      <input className={inp} value={page.description ?? ''} onChange={(e) => onChange({ description: e.target.value })} placeholder="Meta description" />
    </div>
  );
}

// ─────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────

function DesignTokens() {
  const config = useDocumentStore((s) => s.config);
  const dispatch = useDocumentStore((s) => s.dispatch);

  const [addingColor, setAddingColor] = useState(false);
  const [addingFont, setAddingFont] = useState(false);

  const colors = Object.entries(config.theme?.colors ?? {});
  const fonts = Object.entries(config.theme?.fonts ?? {});

  return (
    <div className="shrink-0 border-t border-white/10">
      {/* Color tokens */}
      <SectionHeader
        label="Color tokens"
        onAdd={() => { setAddingColor(true); setAddingFont(false); }}
      />
      <div className="space-y-0.5 px-2 pb-1">
        {colors.map(([key, val]) => (
          <ColorTokenRow
            key={key}
            name={key}
            value={typeof val === 'string' ? val : '#000000'}
            onChangeName={(newName) => renameTokenCmd('colors', key, newName)}
            onChangeValue={(v) =>
              dispatch((c) => cmdSetThemeColor(c, key, v), { mode: 'coalesce', group: `color:${key}` })
            }
            onDelete={() => deleteTokenCmd('colors', key)}
          />
        ))}
        {addingColor && (
          <NewTokenRow
            type="color"
            onConfirm={(name, value) => {
              dispatch((c) => cmdSetThemeColor(c, name, value));
              setAddingColor(false);
            }}
            onCancel={() => setAddingColor(false)}
          />
        )}
        {colors.length === 0 && !addingColor && (
          <EmptyHint>No color tokens yet</EmptyHint>
        )}
      </div>

      {/* Font tokens */}
      <SectionHeader
        label="Font tokens"
        onAdd={() => { setAddingFont(true); setAddingColor(false); }}
      />
      <div className="space-y-0.5 px-2 pb-2">
        {fonts.map(([key, val]) => (
          <FontTokenRow
            key={key}
            name={key}
            value={typeof val === 'string' ? val : ''}
            onChangeName={(newName) => renameTokenCmd('fonts', key, newName)}
            onChangeValue={(v) =>
              dispatch((c) => cmdSetThemeFont(c, key, v), { mode: 'coalesce', group: `font:${key}` })
            }
            onDelete={() => deleteTokenCmd('fonts', key)}
          />
        ))}
        {addingFont && (
          <NewTokenRow
            type="font"
            onConfirm={(name, value) => {
              dispatch((c) => cmdSetThemeFont(c, name, value));
              setAddingFont(false);
            }}
            onCancel={() => setAddingFont(false)}
          />
        )}
        {fonts.length === 0 && !addingFont && (
          <EmptyHint>No font tokens yet</EmptyHint>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ label, onAdd }: { label: string; onAdd: () => void }) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
        {label}
      </span>
      <button
        type="button"
        onClick={onAdd}
        className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px] text-white/50 transition hover:bg-white/10 hover:text-white/80"
      >
        +
      </button>
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 py-1 text-[11px] text-white/20">{children}</p>
  );
}

function ColorTokenRow({
  name,
  value,
  onChangeName,
  onChangeValue,
  onDelete,
}: {
  name: string;
  value: string;
  onChangeName: (n: string) => void;
  onChangeValue: (v: string) => void;
  onDelete: () => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [draft, setDraft] = useState(name);

  function commitName() {
    const trimmed = draft.trim().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/gi, '');
    if (trimmed && trimmed !== name) onChangeName(trimmed);
    else setDraft(name);
    setEditingName(false);
  }

  return (
    <div className="group flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-white/[0.03]">
      <label className="relative h-4 w-4 shrink-0 cursor-pointer overflow-hidden rounded-[3px] ring-1 ring-inset ring-white/15" style={{ background: value }} title="Pick a color">
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'}
          onChange={(e) => onChangeValue(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
      {editingName ? (
        <input
          autoFocus
          onFocus={(e) => e.target.select()}
          className="min-w-0 flex-1 rounded bg-white/10 px-1 text-[11px] text-white/90 outline-none"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') commitName();
            if (e.key === 'Escape') { setDraft(name); setEditingName(false); }
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => { setDraft(name); setEditingName(true); }}
          className="min-w-0 flex-1 truncate text-left text-[11px] text-white/70 hover:text-white/90"
          title="Click to rename"
        >
          {name}
        </button>
      )}
      <input
        className="w-[72px] shrink-0 rounded bg-transparent px-1 font-mono text-[10px] text-white/45 outline-none hover:bg-white/5 focus:bg-white/10 focus:text-white/85"
        value={value}
        title={`CSS color. Use it as fill: ${name}, color: ${name}/60, or classes like bg-${name}`}
        onChange={(e) => onChangeValue(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
      />
      <button
        type="button"
        onClick={onDelete}
        className="hidden shrink-0 rounded p-0.5 text-[9px] text-red-400/40 transition hover:text-red-400 group-hover:block"
        title="Remove token"
      >
        &#x2715;
      </button>
    </div>
  );
}

function FontTokenRow({
  name,
  value,
  onChangeName,
  onChangeValue,
  onDelete,
}: {
  name: string;
  value: string;
  onChangeName: (n: string) => void;
  onChangeValue: (v: string) => void;
  onDelete: () => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(name);

  function commitName() {
    const trimmed = draftName.trim().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/gi, '');
    if (trimmed && trimmed !== name) onChangeName(trimmed);
    else setDraftName(name);
    setEditingName(false);
  }

  return (
    <div className="group flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-white/[0.03]">
      <span className="shrink-0 text-[10px] text-white/25">T</span>
      {editingName ? (
        <input
          autoFocus
          onFocus={(e) => e.target.select()}
          className="min-w-0 w-[60px] rounded bg-white/10 px-1 text-[11px] text-white/90 outline-none"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') commitName();
            if (e.key === 'Escape') { setDraftName(name); setEditingName(false); }
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => { setDraftName(name); setEditingName(true); }}
          className="w-[60px] truncate text-left text-[11px] text-white/70 hover:text-white/90"
          title="Click to rename"
        >
          {name}
        </button>
      )}
      <input
        className="min-w-0 flex-1 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px] text-white/70 outline-none focus:border-indigo-500/50"
        value={value}
        onChange={(e) => onChangeValue(e.target.value)}
        placeholder="Inter, sans-serif"
      />
      <button
        type="button"
        onClick={onDelete}
        className="hidden shrink-0 rounded p-0.5 text-[9px] text-red-400/40 transition hover:text-red-400 group-hover:block"
        title="Remove token"
      >
        &#x2715;
      </button>
    </div>
  );
}

function NewTokenRow({
  type,
  onConfirm,
  onCancel,
}: {
  type: 'color' | 'font';
  onConfirm: (name: string, value: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [value, setValue] = useState(type === 'color' ? '#6366f1' : '');
  const nameRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    nameRef.current?.focus();
  }, []);

  function commit() {
    const key = name.trim().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/gi, '');
    if (!key) return;
    onConfirm(key, value);
  }

  return (
    <div className="flex items-center gap-1.5 rounded border border-indigo-500/30 bg-indigo-500/5 px-1 py-1">
      {type === 'color' ? (
        <input
          type="color"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-5 w-5 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
        />
      ) : (
        <span className="shrink-0 text-[10px] text-white/25">T</span>
      )}
      <input
        ref={nameRef}
        className="min-w-0 flex-1 rounded bg-white/10 px-1 text-[11px] text-white/90 outline-none placeholder:text-white/30"
        placeholder="token-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
            e.stopPropagation();
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') onCancel();
        }}
      />
      {type === 'font' && (
        <input
          className="min-w-0 w-[80px] rounded bg-white/10 px-1 text-[11px] text-white/70 outline-none placeholder:text-white/30"
          placeholder="Inter"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') onCancel();
          }}
        />
      )}
      <button
        type="button"
        onClick={commit}
        className="shrink-0 rounded bg-indigo-500/30 px-1.5 py-0.5 text-[10px] text-indigo-300 transition hover:bg-indigo-500/50"
      >
        Add
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="shrink-0 text-[10px] text-white/30 hover:text-white/60"
      >
        &#x2715;
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Site meta (name, description, lang, favicon)
// ─────────────────────────────────────────────

function SiteMeta() {
  const config = useDocumentStore((s) => s.config);
  const dispatch = useDocumentStore((s) => s.dispatch);

  function update(key: 'name' | 'description' | 'lang' | 'favicon', value: string) {
    dispatch((c) => cmdSetMeta(c, { [key]: value }), { mode: 'coalesce', group: `site:${key}` });
  }

  const inp =
    'w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-[12px] text-white/80 outline-none focus:border-indigo-500/50';

  return (
    <div className="shrink-0 space-y-2 border-t border-white/10 px-3 py-2.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Site</span>
      <input className={inp} value={config.meta.name} onChange={(e) => update('name', e.target.value)} placeholder="Site name" />
      <input className={inp} value={config.meta.description ?? ''} onChange={(e) => update('description', e.target.value)} placeholder="Description" />
      <div className="flex gap-1.5">
        <input
          className="min-w-0 flex-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-[12px] text-white/80 outline-none focus:border-indigo-500/50"
          value={config.meta.lang ?? 'en'}
          onChange={(e) => update('lang', e.target.value)}
          placeholder="Lang"
        />
        <input
          className="min-w-0 flex-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-[12px] text-white/80 outline-none focus:border-indigo-500/50"
          value={config.meta.favicon ?? ''}
          onChange={(e) => update('favicon', e.target.value)}
          placeholder="Favicon URL"
        />
      </div>
    </div>
  );
}
