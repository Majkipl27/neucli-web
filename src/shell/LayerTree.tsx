import React from 'react';
import type { NeucliNode, Path } from '../document/types';
import { iconFor, isContainer as isContainerType } from '../blocks';
import { useDocumentStore } from '../store/useDocument';
import { useSelectionStore } from '../store/useSelection';
import { useUIStore } from '../store/useUI';
import { moveSibling as cmdMoveSibling, moveTo as cmdMoveTo } from '../document/commands';
import { joinClasses } from '../blocks/fields';

function pathEquals(a: Path | null | undefined, b: Path | null | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

export default function LayerTree() {
  const pageIndex = useSelectionStore((s) => s.pageIndex);
  const selection = useSelectionStore((s) => s.selection);
  const select = useSelectionStore((s) => s.select);

  const dispatch = useDocumentStore((s) => s.dispatch);
  const nodes = useDocumentStore((s) => s.config.pages[pageIndex]?.sections ?? []);

  const dragFrom = useUIStore((s) => s.dragFrom);
  const dropTarget = useUIStore((s) => s.dropTarget);
  const startDrag = useUIStore((s) => s.startDrag);
  const setDropTarget = useUIStore((s) => s.setDropTarget);
  const endDrag = useUIStore((s) => s.endDrag);

  const selectedPath = selection?.path ?? null;

  function handleSelect(path: Path) {
    select({ pageIndex, path });
  }

  function handleMove(path: Path, direction: 'up' | 'down') {
    let newPath: Path | null = null;
    dispatch((c) => {
      const res = cmdMoveSibling(c, { pageIndex, path }, direction);
      if (!res) return null;
      newPath = res.newPath;
      return res.config;
    });
    if (newPath) select({ pageIndex, path: newPath });
  }

  function handleDrop() {
    if (dragFrom && dropTarget) {
      let newPath: Path | null = null;
      dispatch((c) => {
        const res = cmdMoveTo(c, pageIndex, dragFrom, [
          ...dropTarget.parentPath,
          dropTarget.index,
        ]);
        if (!res) return null;
        newPath = res.newPath;
        return res.config;
      });
      if (newPath) select({ pageIndex, path: newPath });
    }
    endDrag();
  }

  if (nodes.length === 0) {
    return (
      <div className="px-3 py-6 text-center text-[11px] text-white/30">
        No layers yet. Add a block from the toolbar.
      </div>
    );
  }

  return (
    <div
      className="py-0.5"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onDragEnd={endDrag}
    >
      <DropZone
        active={!!dragFrom}
        isOver={dropTarget?.parentPath.length === 0 && dropTarget?.index === 0}
        onHover={() => setDropTarget({ parentPath: [], index: 0 })}
      />
      {nodes.map((node, idx) => (
        <React.Fragment key={idx}>
          <TreeNode
            node={node}
            index={idx}
            pathPrefix={[]}
            selectedPath={selectedPath}
            onSelect={handleSelect}
            onMove={handleMove}
            onDragStart={startDrag}
            onDropHover={setDropTarget}
            dragFrom={dragFrom}
            dropTarget={dropTarget}
            depth={0}
            totalSiblings={nodes.length}
          />
          <DropZone
            active={!!dragFrom}
            isOver={dropTarget?.parentPath.length === 0 && dropTarget?.index === idx + 1}
            onHover={() => setDropTarget({ parentPath: [], index: idx + 1 })}
          />
        </React.Fragment>
      ))}
    </div>
  );
}

function DropZone({
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
      className={joinClasses('mx-1 h-1 rounded-full transition-colors', isOver ? 'bg-indigo-500' : 'bg-transparent')}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onHover();
      }}
    />
  );
}

interface TreeNodeProps {
  node: NeucliNode;
  index: number;
  pathPrefix: Path;
  selectedPath: Path | null;
  onSelect: (path: Path) => void;
  onMove: (path: Path, direction: 'up' | 'down') => void;
  onDragStart: (path: Path) => void;
  onDropHover: (target: { parentPath: Path; index: number }) => void;
  dragFrom: Path | null;
  dropTarget: { parentPath: Path; index: number } | null;
  depth: number;
  totalSiblings: number;
}

function TreeNode({
  node,
  index,
  pathPrefix,
  selectedPath,
  onSelect,
  onMove,
  onDragStart,
  onDropHover,
  dragFrom,
  dropTarget,
  depth,
  totalSiblings,
}: TreeNodeProps) {
  const path = [...pathPrefix, index];
  const selected = pathEquals(path, selectedPath);
  const icon = iconFor(node.type);
  const hasChildren = node.children && node.children.length > 0;
  const isContainer = isContainerType(node.type);
  const isDragging = !!dragFrom && pathEquals(path, dragFrom);

  return (
    <div className={isDragging ? 'opacity-40' : ''}>
      <div
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          onDragStart(path);
          e.dataTransfer.effectAllowed = 'move';
        }}
        className="group relative"
      >
        <button
          type="button"
          onClick={() => onSelect(path)}
          className={joinClasses(
            'flex w-full items-center gap-1 rounded px-2 py-[5px] text-left transition-colors',
            selected ? 'bg-indigo-500/20 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white/80',
          )}
          style={{ paddingLeft: 8 + depth * 16 }}
        >
          <span className="mr-0.5 cursor-grab text-[8px] text-white/20 hover:text-white/50">&#x2822;</span>
          <span className="w-4 shrink-0 text-center text-[10px] opacity-50">{icon}</span>
          <span className="flex-1 truncate text-[12px]">{node.type}</span>
          {hasChildren && <span className="text-[10px] text-white/30">{node.children!.length}</span>}
        </button>

        {selected && (
          <div className="absolute right-1 top-0.5 flex items-center gap-0.5">
            {index > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(path, 'up');
                }}
                className="rounded p-0.5 text-[10px] text-white/30 hover:bg-white/10 hover:text-white/70"
                title="Move up"
              >
                &#x25B2;
              </button>
            )}
            {index < totalSiblings - 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(path, 'down');
                }}
                className="rounded p-0.5 text-[10px] text-white/30 hover:bg-white/10 hover:text-white/70"
                title="Move down"
              >
                &#x25BC;
              </button>
            )}
          </div>
        )}
      </div>

      {hasChildren && (
        <div>
          {isContainer && dragFrom && (
            <DropZone
              active
              isOver={pathEquals(dropTarget?.parentPath, path) && dropTarget?.index === 0}
              onHover={() => onDropHover({ parentPath: path, index: 0 })}
            />
          )}
          {node.children!.map((child, childIdx) => (
            <React.Fragment key={childIdx}>
              <TreeNode
                node={child}
                index={childIdx}
                pathPrefix={path}
                selectedPath={selectedPath}
                onSelect={onSelect}
                onMove={onMove}
                onDragStart={onDragStart}
                onDropHover={onDropHover}
                dragFrom={dragFrom}
                dropTarget={dropTarget}
                depth={depth + 1}
                totalSiblings={node.children!.length}
              />
              {isContainer && dragFrom && (
                <DropZone
                  active
                  isOver={pathEquals(dropTarget?.parentPath, path) && dropTarget?.index === childIdx + 1}
                  onHover={() => onDropHover({ parentPath: path, index: childIdx + 1 })}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      {!hasChildren && isContainer && dragFrom && (
        <DropZone
          active
          isOver={pathEquals(dropTarget?.parentPath, path) && dropTarget?.index === 0}
          onHover={() => onDropHover({ parentPath: path, index: 0 })}
        />
      )}
    </div>
  );
}
