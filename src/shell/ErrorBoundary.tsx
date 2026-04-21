import React from 'react';

interface Props {
  /**
   * React key used to automatically reset the boundary. When it changes the
   * boundary discards its error state and re-renders children. Callers pass
   * the selection or page id so a user action that would change context also
   * re-attempts the render.
   */
  resetKey?: string | number;
  /** Short label shown in the fallback. */
  label?: string;
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render/runtime errors inside a subtree. Used to isolate the canvas
 * preview and the right-panel property fields so one bad block definition
 * cannot white-screen the whole editor.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Keep the details in the console so developers can debug without needing
    // React DevTools or source maps on every error surface.
    console.error('[neucli] render error', error, info.componentStack);
  }

  componentDidUpdate(prev: Props): void {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  handleReset = (): void => {
    this.setState({ error: null });
  };

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex h-full w-full items-center justify-center p-8">
        <div className="max-w-md rounded border border-red-500/30 bg-red-500/5 p-4 text-[12px]">
          <div className="mb-1 font-medium text-red-300">
            {this.props.label ?? 'Something went wrong'}
          </div>
          <div className="mb-3 font-mono text-[11px] text-red-200/80 break-words">
            {error.message || String(error)}
          </div>
          <button
            type="button"
            onClick={this.handleReset}
            className="rounded border border-red-400/40 bg-red-500/10 px-2.5 py-1 text-[11px] font-medium text-red-200 transition hover:bg-red-500/20"
          >
            Retry render
          </button>
        </div>
      </div>
    );
  }
}
