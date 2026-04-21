import React from 'react';
import type { BlockDefinition } from './types';
import { DarkField, DarkTextArea, joinClasses, sv } from './fields';

const TextBlock: BlockDefinition = {
  type: 'text',
  label: 'Text',
  icon: 'T',
  isContainer: false,
  createDefault: () => ({
    type: 'text',
    className: '',
    props: {
      tag: 'p',
      content: 'Text content',
    },
  }),
  Renderer: ({ node, children, interactionProps, selectionClass }) => {
    const tag = (sv(node.props?.tag) || 'p') as string;
    const content = node.props?.content ?? node.text ?? 'Text';
    return React.createElement(
      tag,
      {
        ...interactionProps,
        className: joinClasses(node.className, 'cursor-pointer transition-shadow', selectionClass),
      },
      String(content),
      children,
    );
  },
  PropsFields: ({ node, setProp, setText }) => (
    <div className="space-y-2">
      <DarkField
        label="Tag"
        value={sv(node.props?.tag ?? 'p')}
        onChange={(v) => setProp('tag', v)}
        placeholder="p, h1, h2, span"
      />
      <DarkTextArea
        label="Content"
        value={sv(node.props?.content ?? node.text)}
        onChange={(v) => {
          if (node.props?.content !== undefined) setProp('content', v);
          else setText(v);
        }}
      />
    </div>
  ),
};

export default TextBlock;
