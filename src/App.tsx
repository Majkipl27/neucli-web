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
import CreateComponentDialog from './shell/CreateComponentDialog';

/** In-app confirm: native dialogs block the page and can't be answered in every host. */
function ConfirmDialog() {
  const request = useUIStore((s) => s.confirm);
  const close = useUIStore((s) => s.closeConfirm);
  React.useEffect(() => {
    if (!request) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Enter') {
        request.onConfirm();
        close();
      }
      e.stopPropagation();
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [request, close]);
  if (!request) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[18vh]" onMouseDown={close}>
      <div
        role="alertdialog"
        aria-modal="true"
        className="w-[360px] rounded-md border border-white/10 bg-[#2c2c2c] p-4 text-[12px] text-white/80 shadow-2xl shadow-black/60"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <p className="leading-relaxed">{request.message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={close} className="rounded px-3 py-1.5 text-white/60 hover:bg-white/10 hover:text-white">
            Cancel
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => {
              request.onConfirm();
              close();
            }}
            className="rounded bg-indigo-500 px-3 py-1.5 font-medium text-white hover:bg-indigo-400"
          >
            {request.action}
          </button>
        </div>
      </div>
    </div>
  );
}

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
        <ConfirmDialog />
        <CreateComponentDialog />
      </div>
    </ErrorBoundary>
  );
}
