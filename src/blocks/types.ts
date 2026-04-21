/**
 * Block registry contract.
 *
 * One `*.block.tsx` file per block type, each default-exporting a
 * BlockDefinition. The registry is populated via `import.meta.glob`, so
 * dropping a new file in `src/blocks/` is the only edit required to add a
 * block type.
 */

import type { ComponentType, CSSProperties, MouseEvent, ReactNode } from 'react';
import type { NeucliNode, Path, Selection } from '../document/types';

/** Props spread onto the outermost DOM element rendered by a block. */
export interface BlockInteractionProps {
  id?: string;
  onClick: (event: MouseEvent) => void;
  draggable: true;
  onDragStart: (event: React.DragEvent) => void;
  style?: CSSProperties;
  [extra: string]: unknown;
}

export interface BlockRenderContext {
  node: NeucliNode;
  path: Path;
  selected: boolean;
  isDragging: boolean;
  /** Pre-composed children from the recursive tree walk, or null if none. */
  children: ReactNode | null;
  /** Spread onto the block's outer element. Does NOT include `className`. */
  interactionProps: BlockInteractionProps;
  /** Selection ring / hover-ring classes. Compose with `node.className`. */
  selectionClass: string;
  /** Button shown inside a selected container block. Render where you want it; noop for non-containers. */
  AddChildSlot: ComponentType;
}

export interface BlockPropsFieldsContext {
  node: NeucliNode;
  selection: Selection;
  setProp: (key: string, value: unknown) => void;
  setText: (value: string) => void;
  setProps: (props: Record<string, unknown>) => void;
}

export interface BlockDefinition {
  /** Unique discriminator (matches NeucliNode.type). Compared case-insensitively. */
  type: string;
  /** Human label shown in pickers. */
  label: string;
  /** Single-glyph icon for pickers and the layer tree. */
  icon: string;
  /** Can this block accept children? Controls drop zones and "Add inside" UX. */
  isContainer: boolean;
  /** Returns a fresh node of this type with sensible default props and className. */
  createDefault: () => NeucliNode;
  /**
   * Optional: flatten this block into a primitive `container` and children.
   * Used by the "Convert to raw container" action.
   */
  toPrimitives?: (node: NeucliNode) => NeucliNode;
  /** Canvas renderer. Required in the new shell. */
  Renderer: ComponentType<BlockRenderContext>;
  /** Content-fields editor shown at the top of the right panel. */
  PropsFields?: ComponentType<BlockPropsFieldsContext>;
}
