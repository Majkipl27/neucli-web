/**
 * In-memory clipboard for node subtrees. Stored as JSON so the source node
 * can't be mutated through the returned value.
 */

import type { Node } from './types';

let payload: string | null = null;

export function setClipboardNode(node: Node): void {
  payload = JSON.stringify(node);
}

export function getClipboardNode(): Node | null {
  return payload ? (JSON.parse(payload) as Node) : null;
}
