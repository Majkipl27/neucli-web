import React from 'react';
import type { BlockDefinition } from './types';
import { DarkField, DarkTextArea, joinClasses, splitLayoutClasses, sv } from './fields';

const CardBlock: BlockDefinition = {
  type: 'card',
  label: 'Card',
  icon: '\u25A7',
  isContainer: true,
  createDefault: () => ({
    type: 'card',
    className: '',
    props: {
      title: 'Card title',
      description: 'Card description',
      image: 'https://placehold.co/800x400',
    },
  }),
  Renderer: ({ node, children, interactionProps, selectionClass, AddChildSlot }) => {
    const { layout } = splitLayoutClasses(node.className);
    const title = sv(node.props?.title);
    const description = sv(node.props?.description);
    const image = sv(node.props?.image);
    return (
      <div
        {...interactionProps}
        className={joinClasses(node.className, 'cursor-pointer transition-shadow overflow-visible', selectionClass)}
      >
        {image && (
          <img src={image} alt={title} className="w-full rounded-t-lg object-cover" />
        )}
        <div className={joinClasses('p-6', layout)}>
          {title && <h3 className="text-xl font-semibold">{title}</h3>}
          {description && <p className="mt-2 text-sm opacity-80">{description}</p>}
          {children}
          <AddChildSlot />
        </div>
      </div>
    );
  },
  PropsFields: ({ node, setProp }) => (
    <div className="space-y-2">
      <DarkField label="Title" value={sv(node.props?.title)} onChange={(v) => setProp('title', v)} />
      <DarkTextArea
        label="Description"
        value={sv(node.props?.description)}
        onChange={(v) => setProp('description', v)}
      />
      <DarkField label="Image URL" value={sv(node.props?.image)} onChange={(v) => setProp('image', v)} />
    </div>
  ),
};

export default CardBlock;
