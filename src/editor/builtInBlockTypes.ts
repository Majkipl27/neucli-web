export const builtInBlockTypes = [
  'navbar',
  'hero',
  'section',
  'container',
  'grid',
  'card',
  'text',
  'button',
  'image',
  'footer',
] as const;

export type BuiltInBlockType = (typeof builtInBlockTypes)[number];

