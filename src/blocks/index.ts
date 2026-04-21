/**
 * Auto-discovery entry point for block definitions.
 *
 * Drop a new `<name>.block.tsx` file in this directory; the file must
 * default-export a `BlockDefinition`. Registration happens at module load via
 * `import.meta.glob({ eager: true })`, so all blocks are bundled synchronously.
 * File ordering is alphabetical; pickers should sort by their own criteria.
 */

import { register } from './registry';
import type { BlockDefinition } from './types';

const modules = import.meta.glob<{ default: BlockDefinition }>('./*.block.tsx', {
  eager: true,
});

for (const [path, mod] of Object.entries(modules)) {
  const def = mod.default;
  if (!def || typeof def !== 'object' || !def.type || !def.createDefault || !def.Renderer) {
    console.warn(
      `[blocks] ${path} does not default-export a valid BlockDefinition (missing type, createDefault, or Renderer), skipping`,
    );
    continue;
  }
  register(def);
}

export * from './registry';
export type { BlockDefinition, BlockRenderContext, BlockPropsFieldsContext } from './types';
