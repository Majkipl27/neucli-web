/** "The canvas moved": content, CSS, fonts or size. Overlays re-measure on it. */

const listeners = new Set<() => void>();
let scheduled = false;

/** Coalesced into one microtask, so overlays update right after the commit that moved things, before paint. */
export function notifyLayout(): void {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    listeners.forEach((l) => l());
  });
}

export function onLayout(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
