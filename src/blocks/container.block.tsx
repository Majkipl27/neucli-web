import React from 'react';
import type { BlockDefinition } from './types';
import { joinClasses } from './fields';

const ContainerBlock: BlockDefinition = {
  type: 'container',
  label: 'Container',
  icon: '\u22A1',
  isContainer: true,
  createDefault: () => ({
    type: 'container',
    className: '',
  }),
  Renderer: ({ node, children, interactionProps, selectionClass, AddChildSlot }) => (
    <div
      {...interactionProps}
      className={joinClasses(node.className, 'cursor-pointer transition-shadow', selectionClass)}
    >
      {children}
      <AddChildSlot />
    </div>
  ),
  PropsFields: () => (
    <p className="text-[11px] text-white/30">
      A bare wrapper. Use the Layout and Classes sections to shape it.
    </p>
  ),
};

export default ContainerBlock;
