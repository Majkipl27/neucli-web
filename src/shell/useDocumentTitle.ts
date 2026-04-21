import { useEffect } from 'react';
import { useDocumentStore } from '../store/useDocument';

const BASE_TITLE = 'Neucli Web';

/**
 * Keep the browser tab title in sync with the current site meta so multiple
 * open editor tabs are distinguishable. Falls back to the base title when the
 * site has no name.
 */
export function useDocumentTitle(): void {
  const name = useDocumentStore((s) => s.config.meta.name);

  useEffect(() => {
    const trimmed = name?.trim();
    document.title = trimmed ? `${trimmed} - ${BASE_TITLE}` : BASE_TITLE;
  }, [name]);
}
