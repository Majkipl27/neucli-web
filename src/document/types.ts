/**
 * Editor document types. The format itself comes from `neucli/core`, so the
 * editor and the CLI read and write exactly the same shapes.
 */

export type {
  Config, Meta, Theme, Page, Node, PrimitiveNode, InstanceNode, FrameNode, TextNode, ImageNode, LinkNode,
  InputNode, SlotNode, ComponentDef, PropDef, PropType, Style,
} from 'neucli/core';

/**
 * Path from a page's `sections` to a node.
 *
 * Numbers index into a node list; a string selects an instance's named slot.
 * `[2]` is the third section, `[2, 0]` its first child, `[2, 'actions', 1]`
 * the second node in section 2's `actions` slot. The last segment is always a
 * number. A path with the last segment dropped is a *list path*: `[]` means
 * the page's sections, `[2]` section 2's children, `[2, 'actions']` that slot.
 */
export type Path = (number | string)[];

export interface Selection {
  pageIndex: number;
  path: Path;
}
