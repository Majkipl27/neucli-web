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
import { ComponentView, PageView } from './render';
import type { StatePreview } from './render';
import { classesIn, compilerFor, pinViewportUnits } from './tailwind';

const SRC_DOC =
  '<!doctype html><html><head><meta charset="utf-8">' +
  '<style id="nc-base">html[data-nc-instant] *, html[data-nc-instant] *::before, html[data-nc-instant] *::after { transition: none !important; }</style>' +
  '<style id="nc-tw"></style></head><body><div id="root"></div></body></html>';

/**
 * Swap the compiled Tailwind CSS without `transition-*` classes animating from the
 * old styles (or from unstyled, on first load). Transitions are off while the new
 * CSS is applied, a forced style read commits it, then they're back on.
 */
function setCanvasCss(doc: Document, css: string) {
  const style = doc.getElementById('nc-tw');
  if (!style || style.textContent === css) return;
  const root = doc.documentElement;
  const first = !style.textContent;
  root.setAttribute('data-nc-instant', '');
  style.textContent = css;
  void doc.body.offsetHeight;
  root.removeAttribute('data-nc-instant');
  // Dev: when each frame first gets styled, for measuring board load time.
  if (import.meta.env.DEV && first) performance.mark('nc-frame-styled');
}

export interface CanvasFrameProps {
  config: Config;
  /** The page to render, or null when a main component is open. */
  page: Page | null;
  /** A main component to render on its own (Figma's main component). */
  component?: string | null;
  /** Show drop targets for empty named slots (while dragging). */
  dropSlots?: boolean;
  width: number;
  viewportHeight: number;
  onHeight: (height: number) => void;
  /** Something moved: content, CSS or fonts. Re-measure overlays. */
  onLayout: () => void;
  /** Mouse input over the page, in page px. The canvas decides what it means. */
  onPointer: (event: CanvasPointer) => void;
  /** Bumped to rebuild the page's DOM (after editing text in place). */
  renderKey: number;
  /** Wheel over the page, with coordinates in page pixels. */
  onWheel: (event: WheelEvent) => void;
  onDocument: (doc: Document | null) => void;
  /** Preview: interactions run, and clicks go to the page instead of the editor. */
  live?: boolean;
  /** Edit mode: state values previewed from the panel. */
  statePreview?: StatePreview;
  /** Preview: an internal link was clicked (e.g. `/pricing`). */
  onNavigate?: (href: string) => void;
  /** The part of the page the editor shows, page px: modal dialogs center in it. */
  view?: { top: number; height: number };
}

/**
 * The iframe is as tall as the page, so `position: fixed` would center a
 * modal in the middle of the whole page. Pin modals to the part on screen.
 */
const LIVE_CSS = `dialog:modal{position:absolute;inset-inline:0;top:calc(var(--nc-view-top,0px) + var(--nc-view-h,100vh) / 2);bottom:auto;translate:0 -50%;max-height:calc(var(--nc-view-h,100vh) - 32px)}`;

export interface CanvasPointer {
  type: 'down' | 'move' | 'up' | 'dblclick' | 'leave';
  x: number;
  y: number;
  button: number;
  shift: boolean;
  /** Cmd on macOS, Ctrl elsewhere. */
  mod: boolean;
  alt: boolean;
  event: MouseEvent;
}

/** Is the event inside text being edited in place? Elements come from the iframe's realm, so no `instanceof`. */
function inEditable(target: EventTarget | null): boolean {
  const node = target as (Node & Partial<HTMLElement>) | null;
  const el = node && typeof node.closest === 'function' ? (node as HTMLElement) : node?.parentElement ?? null;
  return !!el?.closest('[contenteditable="plaintext-only"], [contenteditable="true"]');
}

function pointer(type: CanvasPointer['type'], e: MouseEvent): CanvasPointer {
  return { type, x: e.clientX, y: e.clientY, button: e.button, shift: e.shiftKey, mod: e.metaKey || e.ctrlKey, alt: e.altKey, event: e };
}

function CanvasFrame(props: CanvasFrameProps) {
  const { config, page, component, dropSlots, width, viewportHeight, renderKey, live, statePreview } = props;
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

  // Preview: the page is live. Links and forms stay inside the editor; the wheel still scrolls it.
  useEffect(() => {
    if (!doc || !live) return;
    const win = doc.defaultView!;
    const onClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      const a = el && typeof el.closest === 'function' ? (el.closest('a[href]') as HTMLAnchorElement | null) : null;
      if (!a) return;
      e.preventDefault();
      const href = a.getAttribute('href') ?? '';
      if (href.startsWith('/') && !href.startsWith('//')) cb.current.onNavigate?.(href);
    };
    const onSubmit = (e: Event) => e.preventDefault();
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cb.current.onWheel(e);
    };
    // Esc leaves Preview, unless the page uses it (an open dialog closes first).
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || doc.querySelector('dialog[open]')) return;
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    };
    doc.addEventListener('click', onClick, true);
    doc.addEventListener('submit', onSubmit, true);
    win.addEventListener('wheel', onWheel, { passive: false });
    win.addEventListener('keydown', onKey);
    let style = doc.getElementById('nc-live') as HTMLStyleElement | null;
    if (!style) {
      style = doc.createElement('style');
      style.id = 'nc-live';
      style.textContent = LIVE_CSS;
      doc.head.appendChild(style);
    }
    return () => {
      doc.removeEventListener('click', onClick, true);
      doc.removeEventListener('submit', onSubmit, true);
      win.removeEventListener('wheel', onWheel);
      win.removeEventListener('keydown', onKey);
      doc.getElementById('nc-live')?.remove();
    };
  }, [doc, live]);

  useEffect(() => {
    if (!doc || !props.view) return;
    doc.documentElement.style.setProperty('--nc-view-top', `${Math.round(props.view.top)}px`);
    doc.documentElement.style.setProperty('--nc-view-h', `${Math.round(props.view.height)}px`);
  }, [doc, props.view?.top, props.view?.height]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pointer, wheel and keyboard: the page is a picture of the site, not a live site.
  useEffect(() => {
    if (!doc || live) return;
    const win = doc.defaultView!;
    const stop = (e: Event) => {
      if (!inEditable(e.target)) e.preventDefault();
    };
    const onDown = (e: MouseEvent) => {
      if (inEditable(e.target)) return;
      e.preventDefault();
      cb.current.onPointer(pointer('down', e));
    };
    const onClick = (e: MouseEvent) => {
      if (inEditable(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    const onDbl = (e: MouseEvent) => {
      if (inEditable(e.target)) return;
      e.preventDefault();
      cb.current.onPointer(pointer('dblclick', e));
    };
    const onMove = (e: MouseEvent) => cb.current.onPointer(pointer('move', e));
    const onUp = (e: MouseEvent) => cb.current.onPointer(pointer('up', e));
    const onLeave = (e: MouseEvent) => cb.current.onPointer(pointer('leave', e));
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cb.current.onWheel(e);
    };
    const onKey = (e: KeyboardEvent) => {
      if (inEditable(e.target)) return;
      const forwarded = new KeyboardEvent(e.type, {
        key: e.key, code: e.code, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey, altKey: e.altKey,
        repeat: e.repeat, bubbles: true, cancelable: true,
      });
      window.dispatchEvent(forwarded);
      if (forwarded.defaultPrevented) e.preventDefault();
    };
    doc.addEventListener('mousedown', onDown, true);
    doc.addEventListener('click', onClick, true);
    doc.addEventListener('auxclick', stop, true);
    doc.addEventListener('dblclick', onDbl, true);
    doc.addEventListener('submit', stop, true);
    doc.addEventListener('dragstart', stop, true);
    doc.addEventListener('mousemove', onMove);
    doc.addEventListener('mouseup', onUp);
    doc.documentElement.addEventListener('mouseleave', onLeave);
    win.addEventListener('wheel', onWheel, { passive: false });
    win.addEventListener('keydown', onKey);
    // Keyup too: holding Space pans the board, and the editor has to see it released.
    win.addEventListener('keyup', onKey);
    return () => {
      doc.removeEventListener('mousedown', onDown, true);
      doc.removeEventListener('click', onClick, true);
      doc.removeEventListener('auxclick', stop, true);
      doc.removeEventListener('dblclick', onDbl, true);
      doc.removeEventListener('submit', stop, true);
      doc.removeEventListener('dragstart', stop, true);
      doc.removeEventListener('mousemove', onMove);
      doc.removeEventListener('mouseup', onUp);
      doc.documentElement.removeEventListener('mouseleave', onLeave);
      win.removeEventListener('wheel', onWheel);
      win.removeEventListener('keydown', onKey);
      win.removeEventListener('keyup', onKey);
    };
  }, [doc, live]);

  // <html lang> and Google Fonts, as in the generated index.html.
  const fontsUrl = googleFontsUrl(config.theme);
  useEffect(() => {
    if (!doc) return;
    doc.documentElement.lang = config.meta.lang ?? 'en';
    doc.title = component ?? page?.title ?? page?.name ?? '';
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
  }, [doc, fontsUrl, config.meta.lang, page, component]);

  // Tailwind: compile exactly the classes on the page after every render.
  const theme = config.theme;
  useLayoutEffect(() => {
    if (!doc) return;
    let cancelled = false;
    const candidates = classesIn(doc);
    compilerFor(theme).then((build) => {
      if (cancelled) return;
      setCanvasCss(doc, pinViewportUnits(build(candidates), viewportHeight));
      cb.current.onLayout();
    }).catch((err) => console.error('[canvas] Tailwind compile failed', err));
    cb.current.onLayout();
    return () => {
      cancelled = true;
    };
  }, [doc, config, page, component, dropSlots, theme, viewportHeight, renderKey, live, statePreview]);

  // Preview: interactions add elements and classes after render (an opened dialog, a
  // state style). Compile again when a class shows up that the last build didn't have.
  useEffect(() => {
    if (!doc || !live) return;
    let built = new Set(classesIn(doc));
    let frame = 0;
    const rebuild = () => {
      frame = 0;
      const now = classesIn(doc);
      if (now.every((c) => built.has(c))) return;
      built = new Set(now);
      compilerFor(theme).then((build) => {
        setCanvasCss(doc, pinViewportUnits(build(now), viewportHeight));
        cb.current.onLayout();
      }).catch((err) => console.error('[canvas] Tailwind compile failed', err));
    };
    const observer = new MutationObserver(() => {
      if (!frame) frame = requestAnimationFrame(rebuild);
    });
    observer.observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [doc, live, theme, viewportHeight]);

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
      {doc && createPortal(
        component
          ? <ComponentView key={`c:${component}:${renderKey}:${live ? 'live' : 'edit'}`} config={config} name={component} dropSlots={dropSlots} live={live} preview={statePreview} />
          : page && <PageView key={`${renderKey}:${live ? 'live' : 'edit'}`} config={config} page={page} dropSlots={dropSlots} live={live} preview={statePreview} />,
        doc.getElementById('root')!,
      )}
    </>
  );
}

export default memo(CanvasFrame);
