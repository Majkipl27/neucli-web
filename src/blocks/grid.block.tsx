import React from 'react';
import type { BlockDefinition } from './types';
import { DarkField, joinClasses, sv } from './fields';

const GridBlock: BlockDefinition = {
  type: 'grid',
  label: 'Grid',
  icon: '\u229E',
  isContainer: true,
  createDefault: () => ({
    type: 'grid',
    className: '',
    props: {
      columns: 3,
    },
  }),
  Renderer: ({ node, children, interactionProps, selectionClass, AddChildSlot }) => {
    const cols = Number(node.props?.columns) || 3;
    const { style: interactionStyle, ...rest } = interactionProps;
    return (
      <div
        {...rest}
        className={joinClasses(node.className, 'grid gap-6 cursor-pointer transition-shadow', selectionClass)}
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          ...(interactionStyle ?? {}),
        }}
      >
        {children}
        <AddChildSlot />
      </div>
    );
  },
  PropsFields: ({ node, setProp }) => (
    <DarkField
      label="Columns"
      value={sv(node.props?.columns ?? 3)}
      onChange={(v) => {
        const num = Number(v);
        setProp('columns', v.trim() === '' || Number.isNaN(num) ? v : num);
      }}
      placeholder="1-6"
    />
  ),
};

export default GridBlock;
