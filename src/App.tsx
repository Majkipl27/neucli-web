import React from 'react';
import { useUIStore } from './store/useUI';
import {
  Toolbar,
  LeftSidebar,
  Canvas,
  RightPanel,
  YamlDrawer,
  ErrorBoundary,
  useKeyboardShortcuts,
  useDocumentTitle,
} from './shell';

export default function App() {
  const yamlOpen = useUIStore((s) => s.yamlOpen);
  useKeyboardShortcuts();
  useDocumentTitle();

  return (
    <ErrorBoundary label="Editor failed to load">
      <div className="flex h-screen flex-col">
        <Toolbar />

        <div className="flex min-h-0 flex-1">
          <LeftSidebar />
          <Canvas />
          <RightPanel />
        </div>

        {yamlOpen && <YamlDrawer />}
      </div>
    </ErrorBoundary>
  );
}
