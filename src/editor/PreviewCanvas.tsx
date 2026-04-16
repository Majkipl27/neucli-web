import React, { useState } from 'react';
import type { NeucliNode } from './types';
import { builtInBlockTypes } from './builtInBlockTypes';

const CONTAINER_TYPES = new Set(['hero', 'section', 'container', 'grid', 'card', 'footer', 'navbar']);

const LAYOUT_PATTERNS = [
  /^flex$/, /^flex-(row|col|wrap|nowrap|row-reverse|col-reverse)$/,
  /^gap-/, /^justify-/, /^items-/, /^self-/, /^content-/,
  /^space-(x|y)-/, /^flex-1$/, /^grow/, /^shrink/,
];

function splitLayoutClasses(className?: string): { layout: string; visual: string } {
  if (!className) return { layout: '', visual: '' };
  const tokens = className.split(/\s+/).filter(Boolean);
  const layout: string[] = [];
  const visual: string[] = [];
  for (const t of tokens) {
    if (LAYOUT_PATTERNS.some((p) => p.test(t))) {
      layout.push(t);
    } else {
      visual.push(t);
    }
  }
  return { layout: layout.join(' '), visual: visual.join(' ') };
}

export default function PreviewCanvas({
  nodes,
  selectedPath,
  onSelect,
  onInsertAtIndex,
  onInsertChildAtPath,
  onDrop,
}: {
  nodes: NeucliNode[];
  selectedPath: number[] | null;
  onSelect: (path: number[]) => void;
  onInsertAtIndex: (index: number, type: string) => void;
  onInsertChildAtPath: (parentPath: number[], index: number, type: string) => void;
  onDrop: (fromPath: number[], toParentPath: number[], toIndex: number) => void;
}) {
  const [dragFrom, setDragFrom] = useState<number[] | null>(null);
  const [dropTarget, setDropTarget] = useState<{ parentPath: number[]; index: number } | null>(null);

  function handleDragEnd() {
    if (dragFrom && dropTarget) {
      onDrop(dragFrom, dropTarget.parentPath, dropTarget.index);
    }
    setDragFrom(null);
    setDropTarget(null);
  }

  return (
    <div
      className="min-h-full bg-white text-slate-900"
      onDragEnd={handleDragEnd}
    >
      {nodes.length === 0 ? (
        <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 p-8">
          <p className="text-sm text-slate-400">Start building your page</p>
          <InsertBar onInsert={(type) => onInsertAtIndex(0, type)} />
        </div>
      ) : (
        <div>
          <CanvasDropZone
            active={!!dragFrom}
            isOver={dropTarget?.parentPath.length === 0 && dropTarget?.index === 0}
            onHover={() => setDropTarget({ parentPath: [], index: 0 })}
          />
          <InsertLine onInsert={(type) => onInsertAtIndex(0, type)} />
          {nodes.map((node, index) => (
            <React.Fragment key={index}>
              <PreviewNode
                node={node}
                path={[index]}
                selectedPath={selectedPath}
                onSelect={onSelect}
                onInsertChildAtPath={onInsertChildAtPath}
                dragFrom={dragFrom}
                onDragStart={setDragFrom}
                dropTarget={dropTarget}
                onDropHover={setDropTarget}
              />
              <CanvasDropZone
                active={!!dragFrom}
                isOver={dropTarget?.parentPath.length === 0 && dropTarget?.index === index + 1}
                onHover={() => setDropTarget({ parentPath: [], index: index + 1 })}
              />
              <InsertLine onInsert={(type) => onInsertAtIndex(index + 1, type)} />
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

function CanvasDropZone({
  active,
  isOver,
  onHover,
}: {
  active: boolean;
  isOver: boolean | undefined;
  onHover: () => void;
}) {
  if (!active) return null;
  return (
    <div
      className={[
        'mx-4 rounded-full transition-all',
        isOver ? 'h-1.5 bg-indigo-500 my-0.5' : 'h-0.5 bg-indigo-200/20',
      ].join(' ')}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onHover();
      }}
    />
  );
}

function InsertLine({ onInsert }: { onInsert: (type: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="group relative flex h-0 items-center justify-center overflow-visible" style={{ zIndex: 5 }}>
      <div className="absolute inset-x-4 h-px bg-transparent group-hover:bg-indigo-400 transition" />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="relative z-10 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[11px] font-bold text-indigo-500 opacity-0 shadow ring-1 ring-indigo-300 transition group-hover:opacity-100 hover:bg-indigo-500 hover:text-white hover:ring-indigo-500"
      >
        +
      </button>

      {open && (
        <QuickPicker
          onPick={(type) => {
            onInsert(type);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function InsertBar({ onInsert }: { onInsert: (type: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-2.5 text-[12px] text-slate-500 hover:border-indigo-400 hover:text-indigo-500 transition"
      >
        + Add a block
      </button>

      {open && (
        <QuickPicker
          onPick={(type) => {
            onInsert(type);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function AddChildButton({
  parentPath,
  childCount,
  onInsertChildAtPath,
}: {
  parentPath: number[];
  childCount: number;
  onInsertChildAtPath: (parentPath: number[], index: number, type: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative mt-2 flex justify-center">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="rounded border border-dashed border-slate-300 bg-white px-3 py-1 text-[11px] text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition shadow-sm"
      >
        + Add inside
      </button>

      {open && (
        <QuickPicker
          onPick={(type) => {
            onInsertChildAtPath(parentPath, childCount, type);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function QuickPicker({
  onPick,
  onClose,
}: {
  onPick: (type: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div className="absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl" style={{ minWidth: 180 }}>
        <div className="mb-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Add block
        </div>
        {builtInBlockTypes.map((type) => (
          <button
            key={type}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPick(type);
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-100 text-[10px] font-bold text-slate-500">
              {TYPE_ICONS[type] ?? '·'}
            </span>
            {type}
          </button>
        ))}
      </div>
    </>
  );
}

const TYPE_ICONS: Record<string, string> = {
  navbar: '▬',
  hero: '◆',
  section: '▢',
  container: '⊡',
  grid: '⊞',
  card: '▧',
  text: 'T',
  button: '▸',
  image: '⊙',
  footer: '▬',
};

function PreviewNode({
  node,
  path,
  selectedPath,
  onSelect,
  onInsertChildAtPath,
  dragFrom,
  onDragStart,
  dropTarget,
  onDropHover,
}: {
  node: NeucliNode;
  path: number[];
  selectedPath: number[] | null;
  onSelect: (path: number[]) => void;
  onInsertChildAtPath: (parentPath: number[], index: number, type: string) => void;
  dragFrom: number[] | null;
  onDragStart: (path: number[]) => void;
  dropTarget: { parentPath: number[]; index: number } | null;
  onDropHover: (target: { parentPath: number[]; index: number }) => void;
}) {
  const selected = isSelected(path, selectedPath);
  const isContainer = CONTAINER_TYPES.has(node.type.toLowerCase());
  const isDragging = dragFrom && isSelected(path, dragFrom);
  const highlightClass = selected
    ? 'ring-2 ring-indigo-500 ring-offset-2'
    : 'hover:ring-2 hover:ring-slate-300 hover:ring-offset-1';

  const dragProps = {
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.stopPropagation();
      onDragStart(path);
      e.dataTransfer.effectAllowed = 'move';
    },
  };

  const sharedProps = {
    id: node.id,
    ...node.attrs,
    ...dragProps,
    onClick: (event: React.MouseEvent) => {
      event.stopPropagation();
      onSelect(path);
    },
    className: joinClasses(node.className, 'cursor-pointer transition-shadow', highlightClass),
    style: isDragging ? { opacity: 0.4 } : undefined,
  };

  const childContent = renderChildren(
    node, path, selectedPath, onSelect, onInsertChildAtPath,
    dragFrom, onDragStart, dropTarget, onDropHover,
  );
  const addChildBtn = isContainer && selected ? (
    <AddChildButton
      parentPath={path}
      childCount={node.children?.length ?? 0}
      onInsertChildAtPath={onInsertChildAtPath}
    />
  ) : null;

  switch (node.type.toLowerCase()) {
    case 'navbar': {
      const { layout: navLayout } = splitLayoutClasses(node.className);
      return (
        <nav {...sharedProps}>
          <div className={joinClasses('mx-auto flex max-w-6xl items-center justify-between px-4 py-4', navLayout)}>
            <div className="text-lg font-bold">{node.props?.brand ?? 'Brand'}</div>
            <div className="flex items-center gap-5 text-sm">
              {(node.props?.links ?? []).map((link: { label?: string; href?: string }, i: number) => (
                <a key={i} href={link.href ?? '#'} onClick={(e) => e.preventDefault()}>
                  {link.label ?? 'Link'}
                </a>
              ))}
            </div>
          </div>
          {addChildBtn}
        </nav>
      );
    }
    case 'hero': {
      const { layout: heroLayout } = splitLayoutClasses(node.className);
      return (
        <section {...sharedProps}>
          <div className={joinClasses('mx-auto max-w-6xl px-4 py-20 text-center', heroLayout)}>
            {node.props?.title && <h1 className="text-5xl font-bold tracking-tight">{node.props.title}</h1>}
            {node.props?.subtitle && <p className="mx-auto mt-5 max-w-2xl text-lg opacity-90">{node.props.subtitle}</p>}
            {childContent && <div className="mt-8 flex flex-wrap items-center justify-center gap-4">{childContent}</div>}
            {addChildBtn}
          </div>
        </section>
      );
    }
    case 'section': {
      const { layout: sectionLayout } = splitLayoutClasses(node.className);
      return (
        <section {...sharedProps}>
          <div className={joinClasses('mx-auto max-w-6xl px-4 py-16', sectionLayout)}>
            {node.props?.title?.trim() && <h2 className="mb-8 text-3xl font-bold">{node.props.title}</h2>}
            {childContent}
            {addChildBtn}
          </div>
        </section>
      );
    }
    case 'container':
      return (
        <div {...sharedProps}>
          {childContent}
          {addChildBtn}
        </div>
      );
    case 'grid': {
      const cols = Number(node.props?.columns) || 3;
      return (
        <div
          {...sharedProps}
          className={joinClasses(
            node.className,
            'grid gap-6 cursor-pointer transition-shadow',
            highlightClass,
          )}
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            ...(isDragging ? { opacity: 0.4 } : {}),
          }}
        >
          {childContent}
          {addChildBtn}
        </div>
      );
    }
    case 'card': {
      const { layout: cardLayout } = splitLayoutClasses(node.className);
      return (
        <div {...sharedProps} className={joinClasses(node.className, 'cursor-pointer transition-shadow overflow-visible', highlightClass)}>
          {node.props?.image && (
            <img src={node.props.image} alt={node.props?.title ?? ''} className="w-full rounded-t-lg object-cover" />
          )}
          <div className={joinClasses('p-6', cardLayout)}>
            {node.props?.title && <h3 className="text-xl font-semibold">{node.props.title}</h3>}
            {node.props?.description && <p className="mt-2 text-sm opacity-80">{node.props.description}</p>}
            {childContent}
            {addChildBtn}
          </div>
        </div>
      );
    }
    case 'text': {
      const Tag = (node.props?.tag ?? 'p') as keyof JSX.IntrinsicElements;
      return (
        <Tag {...sharedProps}>
          {node.props?.content ?? node.text ?? 'Text'}
          {childContent}
        </Tag>
      );
    }
    case 'button':
      if (node.props?.href) {
        return (
          <a {...sharedProps} href={node.props.href} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(path); }}>
            {node.props?.label ?? node.text ?? 'Button'}
          </a>
        );
      }
      return <button {...sharedProps}>{node.props?.label ?? node.text ?? 'Button'}</button>;
    case 'image':
      return <img {...sharedProps} src={node.props?.src ?? 'https://placehold.co/800x500'} alt={node.props?.alt ?? ''} />;
    case 'footer': {
      const { layout: footerLayout } = splitLayoutClasses(node.className);
      return (
        <footer {...sharedProps}>
          <div className={joinClasses('mx-auto max-w-6xl px-4 py-10', footerLayout)}>
            {(node.props?.links ?? []).length > 0 && (
              <div className="mb-4 flex flex-wrap gap-5 text-sm">
                {(node.props?.links ?? []).map((link: { label?: string; href?: string }, i: number) => (
                  <a key={i} href={link.href ?? '#'} onClick={(e) => e.preventDefault()}>
                    {link.label ?? 'Link'}
                  </a>
                ))}
              </div>
            )}
            {node.props?.text && <p className="opacity-70">{node.props.text}</p>}
            {childContent}
            {addChildBtn}
          </div>
        </footer>
      );
    }
    default:
      return (
        <div {...sharedProps}>
          {node.text ?? null}
          {childContent}
          {addChildBtn}
        </div>
      );
  }
}

function renderChildren(
  node: NeucliNode,
  parentPath: number[],
  selectedPath: number[] | null,
  onSelect: (path: number[]) => void,
  onInsertChildAtPath: (parentPath: number[], index: number, type: string) => void,
  dragFrom: number[] | null,
  onDragStart: (path: number[]) => void,
  dropTarget: { parentPath: number[]; index: number } | null,
  onDropHover: (target: { parentPath: number[]; index: number }) => void,
) {
  if (!node.children?.length) return null;

  return (
    <>
      {dragFrom && (
        <CanvasDropZone
          active
          isOver={pathEquals(dropTarget?.parentPath, parentPath) && dropTarget?.index === 0}
          onHover={() => onDropHover({ parentPath, index: 0 })}
        />
      )}
      {node.children.map((child, index) => (
        <React.Fragment key={index}>
          <PreviewNode
            node={child}
            path={[...parentPath, index]}
            selectedPath={selectedPath}
            onSelect={onSelect}
            onInsertChildAtPath={onInsertChildAtPath}
            dragFrom={dragFrom}
            onDragStart={onDragStart}
            dropTarget={dropTarget}
            onDropHover={onDropHover}
          />
          {dragFrom && (
            <CanvasDropZone
              active
              isOver={pathEquals(dropTarget?.parentPath, parentPath) && dropTarget?.index === index + 1}
              onHover={() => onDropHover({ parentPath, index: index + 1 })}
            />
          )}
        </React.Fragment>
      ))}
    </>
  );
}

function pathEquals(a: number[] | null | undefined, b: number[] | null | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

function gridColumnsClass(columns?: number) {
  switch (columns) {
    case 1: return 'grid-cols-1';
    case 2: return 'grid-cols-1 md:grid-cols-2';
    case 4: return 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4';
    case 5: return 'grid-cols-1 md:grid-cols-2 xl:grid-cols-5';
    case 6: return 'grid-cols-2 md:grid-cols-3 xl:grid-cols-6';
    default: return 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3';
  }
}

function isSelected(path: number[], selectedPath: number[] | null) {
  if (!selectedPath || path.length !== selectedPath.length) return false;
  return path.every((part, index) => part === selectedPath[index]);
}

function joinClasses(...parts: Array<string | undefined | null | false>) {
  return parts.filter(Boolean).join(' ');
}
