/**
 * Example sites from the CLI repo, bundled so the editor opens with something
 * real and both stay in sync.
 */

import nova from 'neucli/examples/nova.yml?raw';
import landing from 'neucli/examples/landing-page.yaml?raw';
import { importConfig } from './io';
import type { Config } from './types';

export const EXAMPLES: { id: string; label: string; yaml: string }[] = [
  { id: 'nova', label: 'Nova (multi-page)', yaml: nova },
  { id: 'landing', label: 'Acme landing page', yaml: landing },
];

export function loadExample(id: string): Config {
  const example = EXAMPLES.find((e) => e.id === id) ?? EXAMPLES[0];
  const result = importConfig(example.yaml);
  if (!result.ok) throw new Error(`Example ${example.id} doesn't validate: ${result.error}`);
  return result.config;
}

export const BLANK_CONFIG: Config = {
  meta: { name: 'Untitled site' },
  pages: [{ path: '/', name: 'Home', sections: [] }],
};
