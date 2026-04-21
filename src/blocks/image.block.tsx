import React from 'react';
import type { BlockDefinition } from './types';
import { DarkField, joinClasses, sv } from './fields';

const ImageBlock: BlockDefinition = {
  type: 'image',
  label: 'Image',
  icon: '\u2299',
  isContainer: false,
  createDefault: () => ({
    type: 'image',
    className: '',
    props: {
      src: 'https://placehold.co/800x500',
      alt: 'Image',
    },
  }),
  Renderer: ({ node, interactionProps, selectionClass }) => (
    <img
      {...(interactionProps as React.ImgHTMLAttributes<HTMLImageElement>)}
      src={sv(node.props?.src) || 'https://placehold.co/800x500'}
      alt={sv(node.props?.alt)}
      className={joinClasses(node.className, 'cursor-pointer transition-shadow', selectionClass)}
    />
  ),
  PropsFields: ({ node, setProp }) => (
    <div className="space-y-2">
      <DarkField label="Source URL" value={sv(node.props?.src)} onChange={(v) => setProp('src', v)} />
      <DarkField label="Alt text" value={sv(node.props?.alt)} onChange={(v) => setProp('alt', v)} />
    </div>
  ),
};

export default ImageBlock;
