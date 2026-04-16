import type { NeucliNode } from './types';

export function createDefaultNode(type: string, className: string = ''): NeucliNode {
  const base: NeucliNode = { type, className };

  switch (type.toLowerCase()) {
    case 'navbar':
      return {
        ...base,
        props: {
          brand: 'Brand',
          links: [{ label: 'Home', href: '/' }],
        },
      };
    case 'hero':
      return {
        ...base,
        props: {
          title: 'Hero title',
          subtitle: 'Hero subtitle',
        },
      };
    case 'section':
      return {
        ...base,
        props: {
          title: 'Section title',
        },
      };
    case 'container':
      return base;
    case 'grid':
      return {
        ...base,
        props: {
          columns: 3,
        },
      };
    case 'card':
      return {
        ...base,
        props: {
          title: 'Card title',
          description: 'Card description',
          image: 'https://placehold.co/800x400',
        },
      };
    case 'text':
      return {
        ...base,
        props: {
          tag: 'p',
          content: 'Text content',
        },
      };
    case 'button':
      return {
        ...base,
        props: {
          label: 'Button',
        },
      };
    case 'image':
      return {
        ...base,
        props: {
          src: 'https://placehold.co/800x500',
          alt: 'Image',
        },
      };
    case 'footer':
      return {
        ...base,
        props: {
          text: 'Footer text',
          links: [{ label: 'Link', href: '#' }],
        },
      };
    default:
      return base;
  }
}

