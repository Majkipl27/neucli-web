import type { NeucliConfig, NeucliNode, PageSelection } from './types';

function clonePages(config: NeucliConfig) {
  return [...config.pages];
}

function updateNodesAtPath(nodes: NeucliNode[], path: number[], updater: (node: NeucliNode) => NeucliNode): NeucliNode[] {
  if (path.length === 0) return nodes;
  const idx = path[0];

  if (path.length === 1) {
    return nodes.map((n, i) => (i === idx ? updater(n) : n));
  }

  return nodes.map((n, i) => {
    if (i !== idx) return n;
    const children = n.children ?? [];
    return {
      ...n,
      children: updateNodesAtPath(children, path.slice(1), updater),
    };
  });
}

export function getNodeAtPath(config: NeucliConfig, selection: PageSelection): NeucliNode | null {
  const nodes = config.pages[selection.pageIndex]?.sections ?? [];
  let current: NeucliNode | undefined;
  let list: NeucliNode[] = nodes;

  for (let depth = 0; depth < selection.path.length; depth++) {
    const idx = selection.path[depth];
    current = list[idx];
    if (!current) return null;
    list = current.children ?? [];
  }

  return current ?? null;
}

export function updateNodeClassName(config: NeucliConfig, selection: PageSelection, className: string): NeucliConfig {
  const pages = clonePages(config);
  pages[selection.pageIndex] = {
    ...pages[selection.pageIndex],
    sections: updateNodesAtPath(pages[selection.pageIndex].sections, selection.path, (node) => ({
      ...node,
      className,
    })),
  };
  return { ...config, pages };
}

export function updateNodeText(config: NeucliConfig, selection: PageSelection, text: string): NeucliConfig {
  const pages = clonePages(config);
  pages[selection.pageIndex] = {
    ...pages[selection.pageIndex],
    sections: updateNodesAtPath(pages[selection.pageIndex].sections, selection.path, (node) => ({
      ...node,
      text,
    })),
  };
  return { ...config, pages };
}

export function updateNodeProp(
  config: NeucliConfig,
  selection: PageSelection,
  key: string,
  value: string | number,
): NeucliConfig {
  const pages = clonePages(config);
  pages[selection.pageIndex] = {
    ...pages[selection.pageIndex],
    sections: updateNodesAtPath(pages[selection.pageIndex].sections, selection.path, (node) => ({
      ...node,
      props: {
        ...(node.props ?? {}),
        [key]: value,
      },
    })),
  };
  return { ...config, pages };
}

export function updateNodeLinks(
  config: NeucliConfig,
  selection: PageSelection,
  links: Array<{ label: string; href: string }>,
): NeucliConfig {
  const pages = clonePages(config);
  pages[selection.pageIndex] = {
    ...pages[selection.pageIndex],
    sections: updateNodesAtPath(pages[selection.pageIndex].sections, selection.path, (node) => ({
      ...node,
      props: {
        ...(node.props ?? {}),
        links,
      },
    })),
  };
  return { ...config, pages };
}

export function addBlockToSections(
  config: NeucliConfig,
  pageIndex: number,
  node: NeucliNode,
): NeucliConfig {
  const pages = clonePages(config);
  const page = pages[pageIndex];
  const newNode: NeucliNode = { ...node };
  if (newNode.children && newNode.children.length === 0) {
    delete (newNode as any).children;
  }
  pages[pageIndex] = { ...page, sections: [...page.sections, newNode] };
  return { ...config, pages };
}

export function insertBlockAtIndex(
  config: NeucliConfig,
  pageIndex: number,
  index: number,
  node: NeucliNode,
): NeucliConfig {
  const pages = clonePages(config);
  const page = pages[pageIndex];
  const newNode: NeucliNode = { ...node };
  if (newNode.children && newNode.children.length === 0) {
    delete (newNode as any).children;
  }
  const sections = [...page.sections];
  sections.splice(index, 0, newNode);
  pages[pageIndex] = { ...page, sections };
  return { ...config, pages };
}

export function insertChildAtIndex(
  config: NeucliConfig,
  selection: PageSelection,
  index: number,
  node: NeucliNode,
): NeucliConfig {
  const pages = clonePages(config);
  const page = pages[selection.pageIndex];
  const child: NeucliNode = { ...node };
  if (child.children && child.children.length === 0) {
    delete (child as any).children;
  }

  pages[selection.pageIndex] = {
    ...page,
    sections: updateNodesAtPath(page.sections, selection.path, (selected) => {
      const children = selected.children ? [...selected.children] : [];
      children.splice(index, 0, child);
      return { ...selected, children };
    }),
  };

  return { ...config, pages };
}

export function addChildBlock(config: NeucliConfig, selection: PageSelection, node: NeucliNode): NeucliConfig {
  const pages = clonePages(config);
  const page = pages[selection.pageIndex];
  const child: NeucliNode = { ...node };
  if (child.children && child.children.length === 0) {
    delete (child as any).children;
  }

  pages[selection.pageIndex] = {
    ...page,
    sections: updateNodesAtPath(page.sections, selection.path, (selected) => {
      const children = selected.children ? [...selected.children] : [];
      children.push(child);
      return { ...selected, children };
    }),
  };

  return { ...config, pages };
}

export function addSiblingBlock(config: NeucliConfig, selection: PageSelection, node: NeucliNode): NeucliConfig {
  if (selection.path.length === 0) return config;

  const pages = clonePages(config);
  const page = pages[selection.pageIndex];

  const insertAfterIndex = selection.path[selection.path.length - 1];
  const parentPath = selection.path.slice(0, -1);
  const sibling: NeucliNode = { ...node };
  if (sibling.children && sibling.children.length === 0) {
    delete (sibling as any).children;
  }

  if (parentPath.length === 0) {
    const sections = [...page.sections];
    sections.splice(insertAfterIndex + 1, 0, sibling);
    pages[selection.pageIndex] = { ...page, sections };
    return { ...config, pages };
  }

  pages[selection.pageIndex] = {
    ...page,
    sections: updateNodesAtPath(page.sections, parentPath, (parentNode) => {
      const siblings = parentNode.children ? [...parentNode.children] : [];
      siblings.splice(insertAfterIndex + 1, 0, sibling);
      return { ...parentNode, children: siblings };
    }),
  };

  return { ...config, pages };
}

export function moveNodeInDirection(
  config: NeucliConfig,
  selection: PageSelection,
  direction: 'up' | 'down',
): { config: NeucliConfig; newPath: number[] } | null {
  if (selection.path.length === 0) return null;

  const idx = selection.path[selection.path.length - 1];
  const parentPath = selection.path.slice(0, -1);

  const siblings = getSiblings(config, selection.pageIndex, parentPath);
  if (!siblings) return null;

  const newIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (newIdx < 0 || newIdx >= siblings.length) return null;

  const pages = clonePages(config);
  const page = pages[selection.pageIndex];

  if (parentPath.length === 0) {
    const sections = [...page.sections];
    [sections[idx], sections[newIdx]] = [sections[newIdx], sections[idx]];
    pages[selection.pageIndex] = { ...page, sections };
  } else {
    pages[selection.pageIndex] = {
      ...page,
      sections: updateNodesAtPath(page.sections, parentPath, (parent) => {
        const children = [...(parent.children ?? [])];
        [children[idx], children[newIdx]] = [children[newIdx], children[idx]];
        return { ...parent, children };
      }),
    };
  }

  return {
    config: { ...config, pages },
    newPath: [...parentPath, newIdx],
  };
}

export function moveNodeToPosition(
  config: NeucliConfig,
  pageIndex: number,
  fromPath: number[],
  toParentPath: number[],
  toIndex: number,
): { config: NeucliConfig; newPath: number[] } | null {
  if (fromPath.length === 0) return null;

  const node = getNodeAtPath(config, { pageIndex, path: fromPath });
  if (!node) return null;

  let result = deleteBlockAtPath(config, { pageIndex, path: fromPath });

  const fromIdx = fromPath[fromPath.length - 1];
  const fromParent = fromPath.slice(0, -1);
  const sameParent = fromParent.length === toParentPath.length &&
    fromParent.every((v, i) => v === toParentPath[i]);

  let adjustedIndex = toIndex;
  if (sameParent && fromIdx < toIndex) {
    adjustedIndex = toIndex - 1;
  }

  if (toParentPath.length === 0) {
    result = insertBlockAtIndex(result, pageIndex, adjustedIndex, node);
  } else {
    result = insertChildAtIndex(
      result,
      { pageIndex, path: toParentPath },
      adjustedIndex,
      node,
    );
  }

  return {
    config: result,
    newPath: [...toParentPath, adjustedIndex],
  };
}

function getSiblings(config: NeucliConfig, pageIndex: number, parentPath: number[]): NeucliNode[] | null {
  if (parentPath.length === 0) {
    return config.pages[pageIndex]?.sections ?? null;
  }
  const parent = getNodeAtPath(config, { pageIndex, path: parentPath });
  return parent?.children ?? null;
}

export function convertToContainer(
  config: NeucliConfig,
  selection: PageSelection,
): NeucliConfig {
  const node = getNodeAtPath(config, selection);
  if (!node) return config;

  const propsChildren: NeucliNode[] = [];
  const type = node.type.toLowerCase();

  if (type === 'hero' || type === 'section') {
    if (node.props?.title) {
      propsChildren.push({
        type: 'text',
        className: type === 'hero'
          ? 'text-5xl font-bold tracking-tight'
          : 'mb-8 text-3xl font-bold',
        props: { tag: type === 'hero' ? 'h1' : 'h2', content: node.props.title },
      });
    }
    if (node.props?.subtitle) {
      propsChildren.push({
        type: 'text',
        className: 'mx-auto mt-5 max-w-2xl text-lg opacity-90',
        props: { tag: 'p', content: node.props.subtitle },
      });
    }
  } else if (type === 'card') {
    if (node.props?.image) {
      propsChildren.push({
        type: 'image',
        className: 'h-48 w-full rounded-t-lg object-cover',
        props: { src: node.props.image, alt: node.props?.title ?? '' },
      });
    }
    if (node.props?.title) {
      propsChildren.push({
        type: 'text',
        className: 'text-xl font-semibold',
        props: { tag: 'h3', content: node.props.title },
      });
    }
    if (node.props?.description) {
      propsChildren.push({
        type: 'text',
        className: 'mt-2 text-sm opacity-80',
        props: { tag: 'p', content: node.props.description },
      });
    }
  } else if (type === 'navbar') {
    if (node.props?.brand) {
      propsChildren.push({
        type: 'text',
        className: 'text-lg font-bold',
        props: { tag: 'div', content: node.props.brand },
      });
    }
    if (node.props?.links?.length) {
      for (const link of node.props.links) {
        propsChildren.push({
          type: 'button',
          className: 'text-sm',
          props: { label: link.label ?? 'Link', href: link.href ?? '#' },
        });
      }
    }
  } else if (type === 'footer') {
    if (node.props?.links?.length) {
      for (const link of node.props.links) {
        propsChildren.push({
          type: 'button',
          className: 'text-sm',
          props: { label: link.label ?? 'Link', href: link.href ?? '#' },
        });
      }
    }
    if (node.props?.text) {
      propsChildren.push({
        type: 'text',
        className: 'opacity-70',
        props: { tag: 'p', content: node.props.text },
      });
    }
  }

  const allChildren = [...propsChildren, ...(node.children ?? [])];

  const baseClass = node.className ?? '';
  let containerClass = baseClass;
  if (type === 'hero') {
    containerClass = [baseClass, 'mx-auto max-w-6xl px-4 py-20 text-center'].filter(Boolean).join(' ');
  } else if (type === 'section') {
    containerClass = [baseClass, 'mx-auto max-w-6xl px-4 py-16'].filter(Boolean).join(' ');
  } else if (type === 'navbar') {
    containerClass = [baseClass, 'mx-auto flex max-w-6xl items-center justify-between px-4 py-4'].filter(Boolean).join(' ');
  } else if (type === 'footer') {
    containerClass = [baseClass, 'mx-auto max-w-6xl px-4 py-10'].filter(Boolean).join(' ');
  } else if (type === 'card') {
    containerClass = [baseClass, 'p-6'].filter(Boolean).join(' ');
  }

  const pages = clonePages(config);
  pages[selection.pageIndex] = {
    ...pages[selection.pageIndex],
    sections: updateNodesAtPath(pages[selection.pageIndex].sections, selection.path, () => ({
      type: 'container',
      className: containerClass,
      children: allChildren.length > 0 ? allChildren : undefined,
    })),
  };
  return { ...config, pages };
}

export function deleteBlockAtPath(config: NeucliConfig, selection: PageSelection): NeucliConfig {
  if (selection.path.length === 0) return config;

  const pages = clonePages(config);
  const page = pages[selection.pageIndex];

  const deleteIndex = selection.path[selection.path.length - 1];
  const parentPath = selection.path.slice(0, -1);

  if (parentPath.length === 0) {
    const sections = page.sections.filter((_, i) => i !== deleteIndex);
    pages[selection.pageIndex] = { ...page, sections };
    return { ...config, pages };
  }

  pages[selection.pageIndex] = {
    ...page,
    sections: updateNodesAtPath(page.sections, parentPath, (parentNode) => {
      const children = (parentNode.children ?? []).filter((_, i) => i !== deleteIndex);
      return { ...parentNode, children };
    }),
  };

  return { ...config, pages };
}

