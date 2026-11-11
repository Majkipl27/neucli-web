/**
 * The page, rendered in an iframe so it gets its own document: real Tailwind
 * v4 CSS from the config's theme, no editor styles leaking in, and media
 * queries that see the simulated viewport width.
 *
 * The iframe grows to the page's height (scrolling happens in the editor), so
 * element rects inside it are page coordinates and the overlay can use them
 * directly.
 */

import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { googleFontsUrl } from 'neucli/core';
import type { Config, Page } from 'neucli/core';
import { PageView, NID_ATTR } from './render';
import { classesIn, compilerFor, pinViewportUnits } from './tailwind';

const SRC_DOC = '<!doctype html><html><head><meta charset="utf-8"><style id="nc-tw"></style></head><body><div id="root"></div></body></html>';

export interface CanvasFrameProps {
  config: Config;
  page: Page;
  width: number;
  viewportHeight: number;
  onHeight: (height: number) => void;
  /** Something moved: content, CSS or fonts. Re-measure overlays. */
  onLayout: () => void;
  onPick: (nid: string | null) => void;
  onHover: (nid: string | null) => void;
  /** Wheel over the page, with coordinates in page pixels. */
  onWheel: (event: WheelEvent) => void;
  onDocument: (doc: Document | null) => void;
}

/** Closest page node under an event target. Elements come from the iframe's realm, so no `instanceof Element`. */
function nidAt(target: EventTarget | null): string | null {
  const node = target as (Node & Partial<Element>) | null;
  const el = node && typeof node.closest === 'function' ? (node as Element) : node?.parentElement ?? null;
  return el?.closest(`[${NID_ATTR}]`)?.getAttribute(NID_ATTR) ?? null;
}

function CanvasFrame(props: CanvasFrameProps) {
  const { config, page, width, viewportHeight } = props;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [doc, setDoc] = useState<Document | null>(null);
  const [height, setHeight] = useState(viewportHeight);

  // Latest callbacks without re-binding listeners.
  const cb = useRef(props);
  cb.current = props;

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const ready = () => {
      const d = iframe.contentDocument;
      if (d?.getElementById('root')) setDoc(d);
    };
    iframe.addEventListener('load', ready);
    ready();
    return () => iframe.removeEventListener('load', ready);
  }, []);

  useEffect(() => {
    cb.current.onDocument(doc);
    return () => cb.current.onDocument(null);
  }, [doc]);

  // Pointer, wheel and keyboard: the page is a picture of the site, not a live site.
  useEffect(() => {
    if (!doc) return;
    const win = doc.defaultView!;
    let hovered: string | null = null;
    const stop = (e: Event) => e.preventDefault();
    const onClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      cb.current.onPick(nidAt(e.target));
    };
    const onMove = (e: MouseEvent) => {
      const nid = nidAt(e.target);
      if (nid !== hovered) {
        hovered = nid;
        cb.current.onHover(nid);
      }
    };
    const onLeave = () => {
      hovered = null;
      cb.current.onHover(null);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cb.current.onWheel(e);
    };
    const onKey = (e: KeyboardEvent) => {
      const forwarded = new KeyboardEvent(e.type, {
        key: e.key, code: e.code, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey, altKey: e.altKey,
        repeat: e.repeat, bubbles: true, cancelable: true,
      });
      window.dispatchEvent(forwarded);
      if (forwarded.defaultPrevented) e.preventDefault();
    };
    doc.addEventListener('mousedown', stop, true);
    doc.addEventListener('click', onClick, true);
    doc.addEventListener('auxclick', stop, true);
    doc.addEventListener('dblclick', stop, true);
    doc.addEventListener('submit', stop, true);
    doc.addEventListener('dragstart', stop, true);
    doc.addEventListener('mousemove', onMove);
    doc.documentElement.addEventListener('mouseleave', onLeave);
    win.addEventListener('wheel', onWheel, { passive: false });
    win.addEventListener('keydown', onKey);
    return () => {
      doc.removeEventListener('mousedown', stop, true);
      doc.removeEventListener('click', onClick, true);
      doc.removeEventListener('auxclick', stop, true);
      doc.removeEventListener('dblclick', stop, true);
      doc.removeEventListener('submit', stop, true);
      doc.removeEventListener('dragstart', stop, true);
      doc.removeEventListener('mousemove', onMove);
      doc.documentElement.removeEventListener('mouseleave', onLeave);
      win.removeEventListener('wheel', onWheel);
      win.removeEventListener('keydown', onKey);
    };
  }, [doc]);

  // <html lang> and Google Fonts, as in the generated index.html.
  const fontsUrl = googleFontsUrl(config.theme);
  useEffect(() => {
    if (!doc) return;
    doc.documentElement.lang = config.meta.lang ?? 'en';
    doc.title = page.title ?? page.name;
    let link = doc.getElementById('nc-fonts') as HTMLLinkElement | null;
    if (!fontsUrl) {
      link?.remove();
      return;
    }
    if (!link) {
      link = doc.createElement('link');
      link.id = 'nc-fonts';
      link.rel = 'stylesheet';
      doc.head.prepend(link);
    }
    if (link.href !== fontsUrl) {
      link.href = fontsUrl;
      link.onload = () => doc.fonts.ready.then(() => cb.current.onLayout());
    }
  }, [doc, fontsUrl, config.meta.lang, page]);

  // Tailwind: compile exactly the classes on the page after every render.
  const theme = config.theme;
  useLayoutEffect(() => {
    if (!doc) return;
    let cancelled = false;
    const candidates = classesIn(doc);
    compilerFor(theme).then((build) => {
      if (cancelled) return;
      const style = doc.getElementById('nc-tw')!;
      const css = pinViewportUnits(build(candidates), viewportHeight);
      if (style.textContent !== css) style.textContent = css;
      cb.current.onLayout();
    }).catch((err) => console.error('[canvas] Tailwind compile failed', err));
    cb.current.onLayout();
    return () => {
      cancelled = true;
    };
  }, [doc, config, page, theme, viewportHeight]);

  // Grow the iframe to the page height; shrink back when content shrinks.
  useEffect(() => {
    if (!doc) return;
    const measure = () => {
      const h = Math.max(viewportHeight, Math.ceil(doc.body.getBoundingClientRect().height));
      setHeight((prev) => (prev === h ? prev : h));
      cb.current.onLayout();
    };
    const ro = new ResizeObserver(measure);
    ro.observe(doc.body);
    measure();
    return () => ro.disconnect();
  }, [doc, viewportHeight]);

  useEffect(() => {
    cb.current.onHeight(height);
  }, [height]);

  return (
    <>
      <iframe
        ref={iframeRef}
        title="Page canvas"
        srcDoc={SRC_DOC}
        scrolling="no"
        style={{ width, height, border: 0, display: 'block', background: 'white' }}
      />
      {doc && createPortal(<PageView config={config} page={page} />, doc.getElementById('root')!)}
    </>
  );
}

export default memo(CanvasFrame);
