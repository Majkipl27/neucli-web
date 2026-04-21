/**
 * In-memory clipboard for node subtrees.
 *
 * Lives outside the zustand stores because it needs no reactivity: copy/paste
 * is driven by keyboard events, and only the paste action reads it back.
 * Stored as a JSON string so callers cannot accidentally mutate the source
 * node via the returned reference.
 */

import type { NeucliNode } from './types';

let payload: string | null = null;

export function setClipboardNode(node: NeucliNode): void {
  try {
    payload = JSON.stringify(node);
  } catch {
    payload = null;
  }
}

export function getClipboardNode(): NeucliNode | null {
  if (!payload) return null;
  try {
    return JSON.parse(payload) as NeucliNode;
  } catch {
    return null;
  }
}

export function hasClipboardNode(): boolean {
  return payload !== null;
}

export function clearClipboard(): void {
  payload = null;
}
