import React from 'react';
import { isInstance } from 'neucli/core';
import type { Node, Path } from '../document/types';
import { useDocumentStore } from '../store/useDocument';
import { useSelectionStore } from '../store/useSelection';
import { useUIStore } from '../store/useUI';
import type { DropTarget } from '../store/useUI';
import { moveSibling as cmdMoveSibling, moveTo as cmdMoveTo } from '../document/commands';
import { pathEquals, pathKey } from '../document/tree';
import { acceptsChildren, iconFor, labelFor } from '../document/palette';
import { rootsOf } from '../document/scope';

function cls(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export default function LayerTree() {
  const pageIndex = useSelectionStore((s) => s.pageIndex);
  const selection = useSelectionStore((s) => s.selection);
  const paths = useSelectionStore((s) => s.paths);
  const select = useSelectionStore((s) => s.select);

  const dispatch = useDocumentStore((s) => s.dispatch);
  const config = useDocumentStore((s) => s.config);
  const nodes = React.useMemo(() => rootsOf(config, pageIndex), [config, pageIndex]);

  const dragFrom = useUIStore((s) => s.dragFrom);
  const dropTarget = useUIStore((s) => s.dropTarget);
  const endDrag = useUIStore((s) => s.endDrag);

  function handleDrop() {
    if (dragFrom && dropTarget) {
      let newPath: Path | null = null;
      dispatch((c) => {
        const res = cmdMoveTo(c, pageIndex, dragFrom, [...dropTarget.parentPath, dropTarget.index]);
        if (!res) return null;
        newPath = res.newPath;
        return res.config;
      });
      if (newPath) select({ pageIndex, path: newPath });
    }
    endDrag();
  }

  if (nodes.length === 0) {
    return <div className="px-3 py-6 text-center text-[11px] text-white/30">No layers yet. Insert one from the toolbar.</div>;
  }

  return (
    <div className="py-0.5" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop} onDragEnd={endDrag}>
      <NodeList nodes={nodes} listPath={[]} depth={0} selected={paths.length ? paths : selection ? [selection.path] : []} />
    </div>
  );
}

function NodeList({ nodes, listPath, depth, selected }: { nodes: Node[]; listPath: Path; depth: number; selected: Path[] }) {
  const dragFrom = useUIStore((s) => s.dragFrom);
  return (
    <div>
      <DropZone listPath={listPath} index={0} active={!!dragFrom} />
      {nodes.map((node, idx) => (
        <React.Fragment key={idx}>
          <TreeNode node={node} path={[...listPath, idx]} depth={depth} siblings={nodes.length} selectedPaths={selected} />
          <DropZone listPath={listPath} index={idx + 1} active={!!dragFrom} />
        </React.Fragment>
      ))}
    </div>
  );
}

function DropZone({ listPath, index, active }: { listPath: Path; index: number; active: boolean }) {
  const dropTarget = useUIStore((s) => s.dropTarget);
  const setDropTarget = useUIStore((s) => s.setDropTarget);
  if (!active) return null;
  const isOver = !!dropTarget && pathEquals(dropTarget.parentPath, listPath) && dropTarget.index === index;
  const target: DropTarget = { parentPath: listPath, index };
  return (
    <div
      className={cls('mx-1 h-1 rounded-full transition-colors', isOver ? 'bg-indigo-500' : 'bg-transparent')}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isOver) setDropTarget(target);
      }}
    />
  );
}

function TreeNode({ node, path, depth, siblings, selectedPaths }: { node: Node; path: Path; depth: number; siblings: number; selectedPaths: Path[] }) {
  const pageIndex = useSelectionStore((s) => s.pageIndex);
  const select = useSelectionStore((s) => s.select);
  const toggle = useSelectionStore((s) => s.toggle);
  const primary = useSelectionStore((s) => s.selection?.path ?? null);
  const dispatch = useDocumentStore((s) => s.dispatch);
  const config = useDocumentStore((s) => s.config);
  const dragFrom = useUIStore((s) => s.dragFrom);
  const startDrag = useUIStore((s) => s.startDrag);
  const hoverKey = useUIStore((s) => s.hoverKey);
  const setHoverKey = useUIStore((s) => s.setHoverKey);

  const key = pathKey(path);
  const selected = selectedPaths.some((p) => pathEquals(p, path));
  const isPrimary = pathEquals(path, primary);
  const index = path[path.length - 1] as number;
  const children = 'children' in node ? node.children ?? [] : [];
  const slots = isInstance(node) ? Object.entries(node.slots ?? {}) : [];
  const canNest = acceptsChildren(config, node);

  function move(direction: 'up' | 'down') {
    let newPath: Path | null = null;
    dispatch((c) => {
      const res = cmdMoveSibling(c, { pageIndex, path }, direction);
      if (!res) return null;
      newPath = res.newPath;
      return res.config;
    });
    if (newPath) select({ pageIndex, path: newPath });
  }

  return (
    <div className={dragFrom && pathEquals(path, dragFrom) ? 'opacity-40' : ''}>
      <div
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          startDrag(path);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onMouseEnter={() => setHoverKey(key)}
        onMouseLeave={() => hoverKey === key && setHoverKey(null)}
        className="group relative"
      >
        <button
          type="button"
          onClick={(e) => (e.shiftKey ? toggle(path) : select({ pageIndex, path }))}
          className={cls(
            'flex w-full items-center gap-1 rounded px-2 py-[5px] text-left transition-colors',
            selected ? 'bg-indigo-500/20 text-white' : hoverKey === key ? 'bg-white/5 text-white/80' : 'text-white/60 hover:bg-white/5 hover:text-white/80',
          )}
          style={{ paddingLeft: 8 + depth * 14 }}
        >
          <span className={cls('w-4 shrink-0 text-center text-[10px]', isInstance(node) ? 'text-violet-300' : 'opacity-50')}>{iconFor(node)}</span>
          <span className={cls('flex-1 truncate text-[12px]', isInstance(node) && 'text-violet-200')}>{labelFor(node)}</span>
          {children.length > 0 && <span className="text-[10px] text-white/30">{children.length}</span>}
        </button>

        {isPrimary && selectedPaths.length === 1 && (
          <div className="absolute right-1 top-0.5 flex items-center gap-0.5">
            {index > 0 && (
              <button type="button" onClick={() => move('up')} className="rounded p-0.5 text-[10px] text-white/30 hover:bg-white/10 hover:text-white/70" title="Move up">
                &#x25B2;
              </button>
            )}
            {index < siblings - 1 && (
              <button type="button" onClick={() => move('down')} className="rounded p-0.5 text-[10px] text-white/30 hover:bg-white/10 hover:text-white/70" title="Move down">
                &#x25BC;
              </button>
            )}
          </div>
        )}
      </div>

      {(children.length > 0 || (canNest && dragFrom)) && (
        <NodeList nodes={children} listPath={path} depth={depth + 1} selected={selectedPaths} />
      )}
      {slots.map(([name, list]) => (
        <div key={name}>
          <div className="py-[3px] text-[10px] uppercase tracking-wider text-white/25" style={{ paddingLeft: 8 + (depth + 1) * 14 + 20 }}>
            {name}
          </div>
          <NodeList nodes={list} listPath={[...path, name]} depth={depth + 1} selected={selectedPaths} />
        </div>
      ))}
    </div>
  );
}
