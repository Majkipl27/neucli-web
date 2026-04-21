import React from 'react';
import type { BlockDefinition } from './types';
import { DarkTextArea, LinksEditor, joinClasses, splitLayoutClasses, sv } from './fields';

interface FooterLink {
  label?: string;
  href?: string;
}

const FooterBlock: BlockDefinition = {
  type: 'footer',
  label: 'Footer',
  icon: '\u25AC',
  isContainer: true,
  createDefault: () => ({
    type: 'footer',
    className: '',
    props: {
      text: 'Footer text',
      links: [{ label: 'Link', href: '#' }],
    },
  }),
  Renderer: ({ node, children, interactionProps, selectionClass, AddChildSlot }) => {
    const { layout } = splitLayoutClasses(node.className);
    const links = (node.props?.links ?? []) as FooterLink[];
    const text = sv(node.props?.text);
    return (
      <footer
        {...interactionProps}
        className={joinClasses(node.className, 'cursor-pointer transition-shadow', selectionClass)}
      >
        <div className={joinClasses('mx-auto max-w-6xl px-4 py-10', layout)}>
          {links.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-5 text-sm">
              {links.map((link, i) => (
                <a key={i} href={link.href ?? '#'} onClick={(e) => e.preventDefault()}>
                  {link.label ?? 'Link'}
                </a>
              ))}
            </div>
          )}
          {text && <p className="opacity-70">{text}</p>}
          {children}
          <AddChildSlot />
        </div>
      </footer>
    );
  },
  PropsFields: ({ node, setProp, setProps }) => (
    <div className="space-y-2">
      <DarkTextArea
        label="Footer text"
        value={sv(node.props?.text)}
        onChange={(v) => setProp('text', v)}
      />
      <LinksEditor
        links={(node.props?.links as FooterLink[] | undefined)?.map((l) => ({
          label: l.label ?? '',
          href: l.href ?? '',
        })) ?? []}
        onChange={(links) => setProps({ links })}
      />
    </div>
  ),
};

export default FooterBlock;
