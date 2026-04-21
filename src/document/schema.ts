/**
 * Zod schemas for NeucliConfig.
 *
 * The schema is deliberately *lenient* on import: unknown keys pass through,
 * legacy fields (`text`, `tag`) are accepted, and the CLI remains the source
 * of truth for what's semantically valid. The goal here is structural safety
 * (so a malformed YAML doesn't crash the editor) and friendly error messages.
 */

import { z } from 'zod';

export const NeucliNodeSchema: z.ZodType<NeucliNodeShape> = z.lazy(() =>
  z.object({
    type: z.string().min(1, 'type is required'),
    id: z.string().optional(),
    className: z.string().optional(),
    props: z.record(z.unknown()).optional(),
    attrs: z.record(z.unknown()).optional(),
    children: z.array(NeucliNodeSchema).optional(),
    text: z.string().optional(),
    tag: z.string().optional(),
  }).passthrough(),
);

export const NeucliPageSchema = z.object({
  path: z.string(),
  name: z.string(),
  title: z.string().optional(),
  meta: z
    .object({
      description: z.string().optional(),
    })
    .passthrough()
    .optional(),
  sections: z.array(NeucliNodeSchema),
}).passthrough();

export const NeucliConfigSchema = z.object({
  meta: z
    .object({
      name: z.string(),
      description: z.string().optional(),
      lang: z.string().optional(),
      favicon: z.string().optional(),
    })
    .passthrough(),
  theme: z
    .object({
      colors: z.record(z.string()).optional(),
      fonts: z.record(z.string()).optional(),
      extend: z.unknown().optional(),
    })
    .passthrough()
    .optional(),
  globals: z
    .object({
      navbar: NeucliNodeSchema.optional(),
      footer: NeucliNodeSchema.optional(),
    })
    .passthrough()
    .optional(),
  pages: z.array(NeucliPageSchema).min(1, 'at least one page is required'),
  dependencies: z.record(z.string()).optional(),
  components: z.record(z.unknown()).optional(),
}).passthrough();

interface NeucliNodeShape {
  type: string;
  id?: string;
  className?: string;
  props?: Record<string, unknown>;
  attrs?: Record<string, unknown>;
  children?: NeucliNodeShape[];
  text?: string;
  tag?: string;
}

/** Formats a zod error into a single human-readable string. */
export function formatZodError(error: z.ZodError): string {
  const first = error.issues[0];
  if (!first) return error.message;
  const path = first.path.length > 0 ? first.path.join('.') : '(root)';
  return `${path}: ${first.message}`;
}
