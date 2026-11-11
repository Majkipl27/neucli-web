/**
 * The canvas iframe's document, for code outside the canvas that needs to
 * measure what's rendered (fixed sizes from the panel, a group's flow).
 */

let current: Document | null = null;

export function setCanvasDocument(doc: Document | null): void {
  current = doc;
}

export function canvasDocument(): Document | null {
  return current;
}
