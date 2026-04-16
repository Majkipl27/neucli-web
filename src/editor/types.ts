export interface NeucliConfig {
  meta: {
    name: string;
    description?: string;
    lang?: string;
    favicon?: string;
  };
  theme?: {
    colors?: Record<string, string>;
    fonts?: Record<string, string>;
    extend?: any;
  };
  globals?: {
    navbar?: NeucliNode;
    footer?: NeucliNode;
  };
  pages: NeucliPage[];
  dependencies?: Record<string, string>;
  components?: Record<string, any>;
}

export interface NeucliPage {
  path: string;
  name: string;
  title?: string;
  meta?: {
    description?: string;
  };
  sections: NeucliNode[];
}

export interface NeucliNode {
  type: string;
  id?: string;
  className?: string;
  props?: Record<string, any>;
  attrs?: Record<string, any>;
  children?: NeucliNode[];
  text?: string;
  tag?: string;
}

export interface PageSelection {
  pageIndex: number;
  /**
   * Path to the selected node inside `config.pages[pageIndex].sections`.
   * Example:
   * - [0] -> sections[0]
   * - [2,1] -> sections[2].children[1]
   */
  path: number[];
}

