import React from 'react';
import type { BlockDefinition } from './types';
import { DarkField, LinksEditor, joinClasses, splitLayoutClasses, sv } from './fields';

interface NavbarLink {
  label?: string;
  href?: string;
}

const NavbarBlock: BlockDefinition = {
  type: 'navbar',
  label: 'Navbar',
  icon: '\u25AC',
  isContainer: true,
  createDefault: () => ({
    type: 'navbar',
    className: '',
    props: {
      brand: 'Brand',
      links: [{ label: 'Home', href: '/' }],
    },
  }),
  Renderer: ({ node, interactionProps, selectionClass, AddChildSlot }) => {
    const { layout } = splitLayoutClasses(node.className);
    const links = (node.props?.links ?? []) as NavbarLink[];
    return (
      <nav
        {...interactionProps}
        className={joinClasses(node.className, 'cursor-pointer transition-shadow', selectionClass)}
      >
        <div className={joinClasses('mx-auto flex max-w-6xl items-center justify-between px-4 py-4', layout)}>
          <div className="text-lg font-bold">{String(node.props?.brand ?? 'Brand')}</div>
          <div className="flex items-center gap-5 text-sm">
            {links.map((link, i) => (
              <a key={i} href={link.href ?? '#'} onClick={(e) => e.preventDefault()}>
                {link.label ?? 'Link'}
              </a>
            ))}
          </div>
        </div>
        <AddChildSlot />
      </nav>
    );
  },
  PropsFields: ({ node, setProp, setProps }) => (
    <div className="space-y-2">
      <DarkField
        label="Brand"
        value={sv(node.props?.brand)}
        onChange={(v) => setProp('brand', v)}
      />
      <LinksEditor
        links={(node.props?.links as NavbarLink[] | undefined)?.map((l) => ({
          label: l.label ?? '',
          href: l.href ?? '',
        })) ?? []}
        onChange={(links) => setProps({ links })}
      />
    </div>
  ),
};

export default NavbarBlock;
