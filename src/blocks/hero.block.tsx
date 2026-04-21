import React from 'react';
import type { BlockDefinition } from './types';
import { DarkField, joinClasses, splitLayoutClasses, sv } from './fields';

const HeroBlock: BlockDefinition = {
  type: 'hero',
  label: 'Hero',
  icon: '\u25C6',
  isContainer: true,
  createDefault: () => ({
    type: 'hero',
    className: '',
    props: {
      title: 'Hero title',
      subtitle: 'Hero subtitle',
    },
  }),
  Renderer: ({ node, children, interactionProps, selectionClass, AddChildSlot }) => {
    const { layout } = splitLayoutClasses(node.className);
    const title = sv(node.props?.title);
    const subtitle = sv(node.props?.subtitle);
    return (
      <section
        {...interactionProps}
        className={joinClasses(node.className, 'cursor-pointer transition-shadow', selectionClass)}
      >
        <div className={joinClasses('mx-auto max-w-6xl px-4 py-20 text-center', layout)}>
          {title && <h1 className="text-5xl font-bold tracking-tight">{title}</h1>}
          {subtitle && <p className="mx-auto mt-5 max-w-2xl text-lg opacity-90">{subtitle}</p>}
          {children && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">{children}</div>
          )}
          <AddChildSlot />
        </div>
      </section>
    );
  },
  PropsFields: ({ node, setProp }) => (
    <div className="space-y-2">
      <DarkField
        label="Title"
        value={sv(node.props?.title)}
        onChange={(v) => setProp('title', v)}
      />
      <DarkField
        label="Subtitle"
        value={sv(node.props?.subtitle)}
        onChange={(v) => setProp('subtitle', v)}
      />
    </div>
  ),
};

export default HeroBlock;
