/**
 * What the editor can insert: the format's primitives plus the document's own
 * components, and how nodes are labelled in the layer tree and on the canvas.
 */

import { collectSlots, isInstance } from 'neucli/core';
import type { Config, Node, PrimitiveNode } from './types';

export interface PaletteItem {
  type: string;
  label: string;
  icon: string;
}

export const PRIMITIVES: PaletteItem[] = [
  { type: 'frame', label: 'Frame', icon: '#' },
  { type: 'text', label: 'Text', icon: 'T' },
  { type: 'image', label: 'Image', icon: '▣' },
  { type: 'link', label: 'Link', icon: '↗' },
  { type: 'input', label: 'Input', icon: '▭' },
];

const ICONS: Record<string, string> = { ...Object.fromEntries(PRIMITIVES.map((p) => [p.type, p.icon])), slot: '◇' };

export function iconFor(node: Node): string {
  return ICONS[node.type] ?? '◆';
}

/** A fresh node of `type`: a primitive, or an instance of a component in `config`. */
export function createNode(type: string): Node {
  switch (type) {
    case 'frame':
      return { type: 'frame', layout: { gap: 16, padding: 24 } };
    case 'text':
      return { type: 'text', content: 'Text' };
    case 'image':
      return { type: 'image', src: 'https://placehold.co/800x500', alt: '', width: 320 };
    case 'link':
      return { type: 'link', href: '/', content: 'Link' };
    case 'input':
      return { type: 'input', field: 'email', placeholder: 'you@example.com' };
    default:
      return { type };
  }
}

/** Layer name: `name:` if set, else a short preview of the content, else the type. */
export function labelFor(any: Node): string {
  if (any.name) return any.name;
  if (isInstance(any)) return any.type;
  const node = any as PrimitiveNode;
  if (node.type === 'slot') return node.name ? `slot: ${node.name}` : 'slot';
  if (node.type === 'text' || (node.type === 'link' && node.content !== undefined)) {
    const text = String((node as { content: string }).content).trim();
    return text.length > 28 ? `${text.slice(0, 27)}…` : text || node.type;
  }
  if (node.type === 'frame' && node.tag && node.tag !== 'div') return `frame <${node.tag}>`;
  return node.type;
}

/** Can the node take children right now (frame, link box, or an instance whose component has a default slot)? */
export function acceptsChildren(config: Config, any: Node): boolean {
  if (isInstance(any)) {
    const def = config.components?.[any.type];
    return !!def && collectSlots(def).hasDefault;
  }
  const node = any as PrimitiveNode;
  if (node.type === 'frame') return true;
  if (node.type === 'link') return node.content === undefined;
  return false;
}
