import React, { useState } from 'react';
import type { NeucliNode } from './types';

function pathEquals(a: number[] | null | undefined, b: number[] | null | undefined): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
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

const CONTAINER_TYPES = new Set(['hero', 'section', 'container', 'grid', 'card', 'footer', 'navbar']);

export interface DragPayload {
  fromPath: number[];
}

export default function NodeTree({
  nodes,
  selectedPath,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDrop,
}: {
  nodes: NeucliNode[];
  selectedPath: number[] | null;
  onSelect: (path: number[]) => void;
  onMoveUp: (path: number[]) => void;
  onMoveDown: (path: number[]) => void;
  onDrop: (fromPath: number[], toParentPath: number[], toIndex: number) => void;
}) {
  const [dragFrom, setDragFrom] = useState<number[] | null>(null);
  const [dropTarget, setDropTarget] = useState<{ parentPath: number[]; index: number } | null>(null);

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
      onDrop={() => {
        if (dragFrom && dropTarget) {
          onDrop(dragFrom, dropTarget.parentPath, dropTarget.index);
        }
        setDragFrom(null);
        setDropTarget(null);
      }}
      onDragEnd={() => {
        setDragFrom(null);
        setDropTarget(null);
      }}
    >
      <DropZone
        parentPath={[]}
        index={0}
        active={!!dragFrom}
        isOver={dropTarget?.parentPath.length === 0 && dropTarget?.index === 0}
        onHover={() => setDropTarget({ parentPath: [], index: 0 })}
      />
      {nodes.map((n, idx) => (
        <React.Fragment key={idx}>
          <TreeNode
            node={n}
            index={idx}
            pathPrefix={[]}
            selectedPath={selectedPath}
            onSelect={onSelect}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            depth={0}
            totalSiblings={nodes.length}
            dragFrom={dragFrom}
            onDragStart={setDragFrom}
            dropTarget={dropTarget}
            onDropHover={setDropTarget}
          />
          <DropZone
            parentPath={[]}
            index={idx + 1}
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
  parentPath: _parentPath,
  index: _index,
  active,
  isOver,
  onHover,
}: {
  parentPath: number[];
  index: number;
  active: boolean;
  isOver: boolean;
  onHover: () => void;
}) {
  if (!active) return null;
  return (
    <div
      className={[
        'mx-1 h-1 rounded-full transition-colors',
        isOver ? 'bg-indigo-500' : 'bg-transparent',
      ].join(' ')}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onHover();
      }}
    />
  );
}

function TreeNode({
  node,
  index,
  pathPrefix,
  selectedPath,
  onSelect,
  onMoveUp,
  onMoveDown,
  depth,
  totalSiblings,
  dragFrom,
  onDragStart,
  dropTarget,
  onDropHover,
}: {
  node: NeucliNode;
  index: number;
  pathPrefix: number[];
  selectedPath: number[] | null;
  onSelect: (path: number[]) => void;
  onMoveUp: (path: number[]) => void;
  onMoveDown: (path: number[]) => void;
  depth: number;
  totalSiblings: number;
  dragFrom: number[] | null;
  onDragStart: (path: number[]) => void;
  dropTarget: { parentPath: number[]; index: number } | null;
  onDropHover: (target: { parentPath: number[]; index: number }) => void;
}) {
  const path = [...pathPrefix, index];
  const selected = pathEquals(path, selectedPath);
  const icon = TYPE_ICONS[node.type.toLowerCase()] ?? '·';
  const hasChildren = node.children && node.children.length > 0;
  const isContainer = CONTAINER_TYPES.has(node.type.toLowerCase());
  const isDragging = dragFrom && pathEquals(path, dragFrom);

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
          className={[
            'flex w-full items-center gap-1 rounded px-2 py-[5px] text-left transition-colors',
            selected
              ? 'bg-indigo-500/20 text-white'
              : 'text-white/60 hover:bg-white/5 hover:text-white/80',
          ].join(' ')}
          style={{ paddingLeft: 8 + depth * 16 }}
        >
          <span className="cursor-grab text-[8px] text-white/20 hover:text-white/50 mr-0.5">⠿</span>
          <span className="w-4 shrink-0 text-center text-[10px] opacity-50">{icon}</span>
          <span className="flex-1 truncate text-[12px]">{node.type}</span>
          {hasChildren && (
            <span className="text-[10px] text-white/30">{node.children!.length}</span>
          )}
        </button>

        {selected && (
          <div className="absolute right-1 top-0.5 flex items-center gap-0.5">
            {index > 0 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onMoveUp(path); }}
                className="rounded p-0.5 text-[10px] text-white/30 hover:bg-white/10 hover:text-white/70"
                title="Move up"
              >
                ▲
              </button>
            )}
            {index < totalSiblings - 1 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onMoveDown(path); }}
                className="rounded p-0.5 text-[10px] text-white/30 hover:bg-white/10 hover:text-white/70"
                title="Move down"
              >
                ▼
              </button>
            )}
          </div>
        )}
      </div>

      {hasChildren && (
        <div>
          {isContainer && dragFrom && (
            <DropZone
              parentPath={path}
              index={0}
              active
              isOver={dropTarget?.parentPath.length === path.length && pathEquals(dropTarget?.parentPath, path) && dropTarget?.index === 0}
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
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
                depth={depth + 1}
                totalSiblings={node.children!.length}
                dragFrom={dragFrom}
                onDragStart={onDragStart}
                dropTarget={dropTarget}
                onDropHover={onDropHover}
              />
              {isContainer && dragFrom && (
                <DropZone
                  parentPath={path}
                  index={childIdx + 1}
                  active
                  isOver={dropTarget?.parentPath.length === path.length && pathEquals(dropTarget?.parentPath, path) && dropTarget?.index === childIdx + 1}
                  onHover={() => onDropHover({ parentPath: path, index: childIdx + 1 })}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      {!hasChildren && isContainer && dragFrom && (
        <DropZone
          parentPath={path}
          index={0}
          active
          isOver={dropTarget?.parentPath.length === path.length && pathEquals(dropTarget?.parentPath, path) && dropTarget?.index === 0}
          onHover={() => onDropHover({ parentPath: path, index: 0 })}
        />
      )}
    </div>
  );
}

