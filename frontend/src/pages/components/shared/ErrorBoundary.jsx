// ============================================================
// 🛡️ ErrorBoundary — catches render crashes so one bad branch
// can never blank the whole app again.
//
// Usage: wrap any subtree, e.g.
//   <ErrorBoundary><Riders /></ErrorBoundary>
// On error it shows a themed fallback panel with a recovery button
// ("Try again" resets the boundary; "Go home" navigates away).
// ============================================================

import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary] Render crash caught:", error, info?.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) this.props.onReset();
  };

  render() {
    if (this.state.hasError) {
      const tc = this.props.tc || {};
      return (
        <div className="min-h-[40vh] flex items-center justify-center p-6">
          <div
            className={`max-w-md w-full rounded-2xl border p-6 text-center ${
              tc.card || "bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
            }`}
          >
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-red-500/15 flex items-center justify-center">
              <i className="fa fa-triangle-exclamation text-red-500 text-xl"></i>
            </div>
            <p className="font-black text-base mb-1">Something went wrong</p>
            <p className={`text-xs mb-1 ${tc.sub || "text-gray-500"}`}>
              This section crashed instead of loading. Your data is safe.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <p className="text-[11px] font-mono text-red-400/90 bg-red-500/10 rounded-lg px-2 py-1.5 mb-4 break-words">
                {String(this.state.error.message || this.state.error)}
              </p>
            )}
            <div className="flex gap-2 justify-center mt-4">
              <button
                onClick={this.handleRetry}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-orange-500 text-white hover:bg-orange-600 transition-colors"
              >
                <i className="fa fa-rotate-right mr-1.5"></i>Try again
              </button>
              <a
                href="/home"
                className="px-4 py-2 rounded-xl text-sm font-bold bg-gray-500/20 hover:bg-gray-500/30 transition-colors"
              >
                Go home
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
