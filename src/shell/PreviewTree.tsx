import React, { useCallback } from 'react';
import type { NeucliNode, Path } from '../document/types';
import { get as getBlock, iconFor, isContainer as isContainerType, list as listBlocks } from '../blocks';
import type { BlockDefinition, BlockInteractionProps, BlockRenderContext } from '../blocks/types';
import { joinClasses } from '../blocks/fields';

interface DropTarget {
  parentPath: Path;
  index: number;
}

interface TreeWalkerProps {
  nodes: NeucliNode[];
  selectedPath: Path | null;
  onSelect: (path: Path) => void;
  onInsertAtIndex: (index: number, type: string) => void;
  onInsertChildAtPath: (parentPath: Path, index: number, type: string) => void;
  onDrop: (from: Path, toParentPath: Path, toIndex: number) => void;
  dragFrom: Path | null;
  setDragFrom: (path: Path | null) => void;
  dropTarget: DropTarget | null;
  setDropTarget: (target: DropTarget | null) => void;
}

/**
 * Recursive tree walker used by the canvas preview. Does not own drag state;
 * the parent Canvas threads it in so drop zones can render outside of any
 * particular node.
 */
export default function PreviewTree(props: TreeWalkerProps) {
  const {
    nodes,
    selectedPath,
    onSelect,
    onInsertAtIndex,
    onInsertChildAtPath,
    onDrop,
    dragFrom,
    setDragFrom,
    dropTarget,
    setDropTarget,
  } = props;

  const handleDragEnd = useCallback(() => {
    if (dragFrom && dropTarget) {
      onDrop(dragFrom, dropTarget.parentPath, dropTarget.index);
    }
    setDragFrom(null);
    setDropTarget(null);
  }, [dragFrom, dropTarget, onDrop, setDragFrom, setDropTarget]);

  if (nodes.length === 0) {
    return (
      <div
        className="flex min-h-[420px] flex-col items-center justify-center gap-4 p-8"
        onDragEnd={handleDragEnd}
      >
        <p className="text-sm text-slate-400">Start building your page</p>
        <InsertBar onInsert={(type) => onInsertAtIndex(0, type)} />
      </div>
    );
  }

  return (
    <div onDragEnd={handleDragEnd}>
      <DropLine
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
            setDragFrom={setDragFrom}
            dropTarget={dropTarget}
            setDropTarget={setDropTarget}
          />
          <DropLine
            active={!!dragFrom}
            isOver={dropTarget?.parentPath.length === 0 && dropTarget?.index === index + 1}
            onHover={() => setDropTarget({ parentPath: [], index: index + 1 })}
          />
          <InsertLine onInsert={(type) => onInsertAtIndex(index + 1, type)} />
        </React.Fragment>
      ))}
    </div>
  );
}

interface PreviewNodeProps {
  node: NeucliNode;
  path: Path;
  selectedPath: Path | null;
  onSelect: (path: Path) => void;
  onInsertChildAtPath: (parentPath: Path, index: number, type: string) => void;
  dragFrom: Path | null;
  setDragFrom: (path: Path | null) => void;
  dropTarget: DropTarget | null;
  setDropTarget: (target: DropTarget | null) => void;
}

function PreviewNode(props: PreviewNodeProps) {
  const {
    node,
    path,
    selectedPath,
    onSelect,
    onInsertChildAtPath,
    dragFrom,
    setDragFrom,
    dropTarget,
    setDropTarget,
  } = props;

  const selected = pathEquals(path, selectedPath);
  const isDragging = !!dragFrom && pathEquals(path, dragFrom);
  const isContainer = isContainerType(node.type);

  const selectionClass = selected
    ? 'ring-2 ring-indigo-500 ring-offset-2'
    : 'hover:ring-2 hover:ring-slate-300 hover:ring-offset-1';

  const interactionProps: BlockInteractionProps = {
    id: node.id,
    ...node.attrs,
    draggable: true,
    onDragStart: (e) => {
      e.stopPropagation();
      setDragFrom(path);
      e.dataTransfer.effectAllowed = 'move';
    },
    onClick: (e) => {
      e.stopPropagation();
      onSelect(path);
    },
    style: isDragging ? { opacity: 0.4 } : undefined,
  };

  const children = renderChildren(
    node,
    path,
    selectedPath,
    onSelect,
    onInsertChildAtPath,
    dragFrom,
    setDragFrom,
    dropTarget,
    setDropTarget,
  );

  const AddChildSlot = selected && isContainer
    ? () => (
        <AddChildButton
          parentPath={path}
          childCount={node.children?.length ?? 0}
          onInsertChildAtPath={onInsertChildAtPath}
        />
      )
    : EmptySlot;

  const def = getBlock(node.type);
  if (def) {
    return (
      <def.Renderer
        node={node}
        path={path}
        selected={selected}
        isDragging={isDragging}
        children={children}
        interactionProps={interactionProps}
        selectionClass={selectionClass}
        AddChildSlot={AddChildSlot}
      />
    );
  }

  return (
    <FallbackRenderer
      node={node}
      path={path}
      selected={selected}
      isDragging={isDragging}
      children={children}
      interactionProps={interactionProps}
      selectionClass={selectionClass}
      AddChildSlot={AddChildSlot}
    />
  );
}

function FallbackRenderer({
  node,
  children,
  interactionProps,
  selectionClass,
  AddChildSlot,
}: BlockRenderContext) {
  return (
    <div
      {...interactionProps}
      className={joinClasses(
        node.className,
        'cursor-pointer transition-shadow border border-dashed border-amber-400 p-2',
        selectionClass,
      )}
    >
      <div className="text-xs text-amber-500">Unknown block: {node.type}</div>
      {node.text}
      {children}
      <AddChildSlot />
    </div>
  );
}

function EmptySlot() {
  return null;
}

function renderChildren(
  node: NeucliNode,
  parentPath: Path,
  selectedPath: Path | null,
  onSelect: (path: Path) => void,
  onInsertChildAtPath: (parentPath: Path, index: number, type: string) => void,
  dragFrom: Path | null,
  setDragFrom: (path: Path | null) => void,
  dropTarget: DropTarget | null,
  setDropTarget: (target: DropTarget | null) => void,
): React.ReactNode | null {
  if (!node.children?.length) return null;

  return (
    <>
      {dragFrom && (
        <DropLine
          active
          isOver={pathEquals(dropTarget?.parentPath, parentPath) && dropTarget?.index === 0}
          onHover={() => setDropTarget({ parentPath, index: 0 })}
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
            setDragFrom={setDragFrom}
            dropTarget={dropTarget}
            setDropTarget={setDropTarget}
          />
          {dragFrom && (
            <DropLine
              active
              isOver={pathEquals(dropTarget?.parentPath, parentPath) && dropTarget?.index === index + 1}
              onHover={() => setDropTarget({ parentPath, index: index + 1 })}
            />
          )}
        </React.Fragment>
      ))}
    </>
  );
}

function DropLine({
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
      className={joinClasses(
        'mx-4 rounded-full transition-all',
        isOver ? 'h-1.5 bg-indigo-500 my-0.5' : 'h-0.5 bg-indigo-200/20',
      )}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onHover();
      }}
    />
  );
}

function InsertLine({ onInsert }: { onInsert: (type: string) => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="group relative flex h-0 items-center justify-center overflow-visible" style={{ zIndex: 5 }}>
      <div className="absolute inset-x-4 h-px bg-transparent transition group-hover:bg-indigo-400" />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="relative z-10 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[11px] font-bold text-indigo-500 opacity-0 shadow ring-1 ring-indigo-300 transition hover:bg-indigo-500 hover:text-white hover:ring-indigo-500 group-hover:opacity-100"
      >
        +
      </button>
      {open && (
        <BlockPicker
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
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-2.5 text-[12px] text-slate-500 transition hover:border-indigo-400 hover:text-indigo-500"
      >
        + Add a block
      </button>
      {open && (
        <BlockPicker
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
  parentPath: Path;
  childCount: number;
  onInsertChildAtPath: (parentPath: Path, index: number, type: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative mt-2 flex justify-center" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="rounded border border-dashed border-slate-300 bg-white px-3 py-1 text-[11px] text-slate-400 shadow-sm transition hover:border-indigo-400 hover:text-indigo-500"
      >
        + Add inside
      </button>
      {open && (
        <BlockPicker
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

function BlockPicker({
  onPick,
  onClose,
}: {
  onPick: (type: string) => void;
  onClose: () => void;
}) {
  const blocks: BlockDefinition[] = listBlocks();
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl"
        style={{ minWidth: 200 }}
      >
        <div className="mb-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Add block
        </div>
        {blocks.map((block) => (
          <button
            key={block.type}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPick(block.type);
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-600"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-100 text-[10px] font-bold text-slate-500">
              {iconFor(block.type)}
            </span>
            {block.label}
          </button>
        ))}
      </div>
    </>
  );
}

function pathEquals(a: Path | null | undefined, b: Path | null | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}
