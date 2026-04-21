/**
 * Canonical types for Neucli documents.
 *
 * Wire format is fixed: these shapes must round-trip through the Neucli CLI's
 * YAML parser without loss. `id` on NeucliNode is editor-only metadata and
 * stripped on export (see document/io.ts).
 */

export interface NeucliConfig {
  meta: NeucliMeta;
  theme?: NeucliTheme;
  globals?: NeucliGlobals;
  pages: NeucliPage[];
  dependencies?: Record<string, string>;
  components?: Record<string, unknown>;
}

export interface NeucliMeta {
  name: string;
  description?: string;
  lang?: string;
  favicon?: string;
}

export interface NeucliTheme {
  colors?: Record<string, string>;
  fonts?: Record<string, string>;
  extend?: unknown;
}

export interface NeucliGlobals {
  navbar?: NeucliNode;
  footer?: NeucliNode;
}

export interface NeucliPage {
  path: string;
  name: string;
  title?: string;
  meta?: {
    description?: string;
  };
  sections: NeucliNode[];
}

export interface NeucliNode {
  type: string;
  /** Editor-only; not persisted to YAML. */
  id?: string;
  className?: string;
  props?: Record<string, unknown>;
  attrs?: Record<string, unknown>;
  children?: NeucliNode[];
  /** Legacy textual content; prefer props.content for new blocks. */
  text?: string;
  /** Legacy semantic tag hint; prefer props.tag. */
  tag?: string;
}

/**
 * Path into a tree of NeucliNodes. An empty path refers to the root node list
 * (a page's `sections`); `[0]` is the first section; `[2, 1]` is the second
 * child of the third section; and so on.
 */
export type Path = number[];

export interface Selection {
  pageIndex: number;
  path: Path;
}

export type Target =
  | { kind: 'sections'; pageIndex: number }
  | { kind: 'node'; pageIndex: number; path: Path };
