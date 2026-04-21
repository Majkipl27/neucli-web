import React from 'react';
import type { BlockDefinition } from './types';
import { DarkField, joinClasses, splitLayoutClasses, sv } from './fields';

const SectionBlock: BlockDefinition = {
  type: 'section',
  label: 'Section',
  icon: '\u25A2',
  isContainer: true,
  createDefault: () => ({
    type: 'section',
    className: '',
    props: {
      title: 'Section title',
    },
  }),
  Renderer: ({ node, children, interactionProps, selectionClass, AddChildSlot }) => {
    const { layout } = splitLayoutClasses(node.className);
    const title = sv(node.props?.title).trim();
    return (
      <section
        {...interactionProps}
        className={joinClasses(node.className, 'cursor-pointer transition-shadow', selectionClass)}
      >
        <div className={joinClasses('mx-auto max-w-6xl px-4 py-16', layout)}>
          {title && <h2 className="mb-8 text-3xl font-bold">{title}</h2>}
          {children}
          <AddChildSlot />
        </div>
      </section>
    );
  },
  PropsFields: ({ node, setProp }) => (
    <DarkField
      label="Title"
      value={sv(node.props?.title)}
      onChange={(v) => setProp('title', v)}
    />
  ),
};

export default SectionBlock;
