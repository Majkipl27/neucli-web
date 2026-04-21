import type { NeucliConfig, NeucliNode, Selection } from './types';
import { getAt, updateAt } from './tree';

interface LegacyLink {
  label?: string;
  href?: string;
}

/**
 * Flatten a semantic block (hero, section, card, navbar, footer) into a
 * primitive `container` + text/button/image children. Preserves the existing
 * visual output so converting and rendering look identical.
 */
export function convertToContainer(config: NeucliConfig, selection: Selection): NeucliConfig {
  const sections = config.pages[selection.pageIndex]?.sections ?? [];
  const node = getAt(sections, selection.path);
  if (!node) return config;

  const type = node.type.toLowerCase();
  const propsChildren = propsToChildren(type, node);
  const allChildren = [...propsChildren, ...(node.children ?? [])];
  const containerClass = wrapperClassFor(type, node.className ?? '');

  const replacement: NeucliNode = {
    type: 'container',
    className: containerClass,
    ...(allChildren.length > 0 ? { children: allChildren } : {}),
  };

  return {
    ...config,
    pages: config.pages.map((page, i) =>
      i === selection.pageIndex
        ? { ...page, sections: updateAt(page.sections, selection.path, () => replacement) }
        : page,
    ),
  };
}

function propsToChildren(type: string, node: NeucliNode): NeucliNode[] {
  const props = node.props ?? {};
  const children: NeucliNode[] = [];

  if (type === 'hero' || type === 'section') {
    if (props.title) {
      children.push({
        type: 'text',
        className:
          type === 'hero' ? 'text-5xl font-bold tracking-tight' : 'mb-8 text-3xl font-bold',
        props: { tag: type === 'hero' ? 'h1' : 'h2', content: String(props.title) },
      });
    }
    if (props.subtitle) {
      children.push({
        type: 'text',
        className: 'mx-auto mt-5 max-w-2xl text-lg opacity-90',
        props: { tag: 'p', content: String(props.subtitle) },
      });
    }
  } else if (type === 'card') {
    if (props.image) {
      children.push({
        type: 'image',
        className: 'h-48 w-full rounded-t-lg object-cover',
        props: { src: String(props.image), alt: props.title ? String(props.title) : '' },
      });
    }
    if (props.title) {
      children.push({
        type: 'text',
        className: 'text-xl font-semibold',
        props: { tag: 'h3', content: String(props.title) },
      });
    }
    if (props.description) {
      children.push({
        type: 'text',
        className: 'mt-2 text-sm opacity-80',
        props: { tag: 'p', content: String(props.description) },
      });
    }
  } else if (type === 'navbar') {
    if (props.brand) {
      children.push({
        type: 'text',
        className: 'text-lg font-bold',
        props: { tag: 'div', content: String(props.brand) },
      });
    }
    const links = (props.links as LegacyLink[] | undefined) ?? [];
    for (const link of links) {
      children.push({
        type: 'button',
        className: 'text-sm',
        props: { label: link.label ?? 'Link', href: link.href ?? '#' },
      });
    }
  } else if (type === 'footer') {
    const links = (props.links as LegacyLink[] | undefined) ?? [];
    for (const link of links) {
      children.push({
        type: 'button',
        className: 'text-sm',
        props: { label: link.label ?? 'Link', href: link.href ?? '#' },
      });
    }
    if (props.text) {
      children.push({
        type: 'text',
        className: 'opacity-70',
        props: { tag: 'p', content: String(props.text) },
      });
    }
  }

  return children;
}

function wrapperClassFor(type: string, baseClass: string): string {
  const extras: Record<string, string> = {
    hero: 'mx-auto max-w-6xl px-4 py-20 text-center',
    section: 'mx-auto max-w-6xl px-4 py-16',
    navbar: 'mx-auto flex max-w-6xl items-center justify-between px-4 py-4',
    footer: 'mx-auto max-w-6xl px-4 py-10',
    card: 'p-6',
  };
  const extra = extras[type];
  if (!extra) return baseClass;
  return [baseClass, extra].filter(Boolean).join(' ');
}
