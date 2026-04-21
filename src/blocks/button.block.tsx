import React from 'react';
import type { BlockDefinition } from './types';
import { DarkField, joinClasses, sv } from './fields';

const ButtonBlock: BlockDefinition = {
  type: 'button',
  label: 'Button',
  icon: '\u25B8',
  isContainer: false,
  createDefault: () => ({
    type: 'button',
    className: '',
    props: {
      label: 'Button',
    },
  }),
  Renderer: ({ node, interactionProps, selectionClass }) => {
    const label = sv(node.props?.label ?? node.text ?? 'Button');
    const href = sv(node.props?.href);
    const className = joinClasses(node.className, 'cursor-pointer transition-shadow', selectionClass);
    if (href) {
      const { onClick, ...rest } = interactionProps;
      return (
        <a
          {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
          href={href}
          className={className}
          onClick={(e) => {
            e.preventDefault();
            onClick(e);
          }}
        >
          {label}
        </a>
      );
    }
    return (
      <button
        type="button"
        {...(interactionProps as React.ButtonHTMLAttributes<HTMLButtonElement>)}
        className={className}
      >
        {label}
      </button>
    );
  },
  PropsFields: ({ node, setProp, setText }) => (
    <div className="space-y-2">
      <DarkField
        label="Label"
        value={sv(node.props?.label ?? node.text)}
        onChange={(v) => {
          if (node.props?.label !== undefined) setProp('label', v);
          else setText(v);
        }}
      />
      <DarkField
        label="Href"
        value={sv(node.props?.href)}
        onChange={(v) => setProp('href', v)}
        placeholder="/about, #, https://..."
      />
    </div>
  ),
};

export default ButtonBlock;
