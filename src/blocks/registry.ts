/**
 * Block registry.
 *
 * Implemented as a Map of lowercase type to BlockDefinition. Populated once
 * at module load via auto-discovery in `./index.ts`. Re-registering the same
 * type throws so duplicate files surface as build-time errors instead of
 * silently shadowing.
 */

import type { NeucliNode } from '../document/types';
import type { BlockDefinition } from './types';

const blocks = new Map<string, BlockDefinition>();

export function register(definition: BlockDefinition): void {
  const key = definition.type.toLowerCase();
  if (blocks.has(key)) {
    const existing = blocks.get(key)!;
    throw new Error(
      `Duplicate block registration for type "${definition.type}". ` +
      `Already registered as "${existing.label}". ` +
      `Check for a duplicate *.block.tsx file in src/blocks/.`,
    );
  }
  blocks.set(key, definition);
}

export function get(type: string): BlockDefinition | null {
  return blocks.get(type.toLowerCase()) ?? null;
}

export function has(type: string): boolean {
  return blocks.has(type.toLowerCase());
}

export function list(): BlockDefinition[] {
  return Array.from(blocks.values());
}

export function types(): string[] {
  return Array.from(blocks.keys()).sort();
}

export function iconFor(type: string): string {
  return get(type)?.icon ?? '·';
}

export function isContainer(type: string): boolean {
  return get(type)?.isContainer ?? false;
}

/** Create a default node for a known type, or a generic `{type, className}` for unknowns. */
export function createDefault(type: string, className: string = ''): NeucliNode {
  const def = get(type);
  if (def) {
    const node = def.createDefault();
    return className ? { ...node, className: [node.className, className].filter(Boolean).join(' ') } : node;
  }
  return { type, className };
}

/** Test-only: clear the registry. Exported so specs can start fresh. */
export function _resetForTests(): void {
  blocks.clear();
}
