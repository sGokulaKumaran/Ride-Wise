// ============================================================
// ErrorBoundary — catches render crashes so one bad branch
// can never blank the whole app again.
//
// Usage: wrap any subtree, e.g.
//   <ErrorBoundary><Riders /></ErrorBoundary>
// On error it shows a themed fallback panel with a recovery button
// ("Try again" resets the boundary; "Go home" navigates away).
// ============================================================

import { Component } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useTheme } from "../../hooks/useTheme";
import Button from "../ui/Button";
import Icon from "../ui/Icon";

/**
 * ErrorFallback — the themed recovery panel.
 * It is a small function component so it can read the theme tokens
 * (a class component cannot use hooks). All error handling stays in
 * the class below.
 */
function ErrorFallback({ error, onRetry, tc: overrideTc }) {
  const { user } = useAuth();
  const { tc: themeTc } = useTheme(user?.id);   // themed surface + tokens
  const tc = { ...themeTc, ...(overrideTc || {}) };

  return (
    <div className="min-h-[40vh] flex items-center justify-center p-6">
      <div
        className={`max-w-md w-full rounded-xl border p-6 text-center ${tc.card}`}
      >
        <div className={`w-12 h-12 mx-auto mb-3 rounded-lg border flex items-center justify-center ${tc.dangerSoft}`}>
          <Icon name="alertTriangle" size={22} />
        </div>
        <p className="font-black text-base mb-1">Something went wrong</p>
        <p className={`text-xs mb-1 ${tc.sub}`}>
          This section crashed instead of loading. Your data is safe.
        </p>
        {import.meta.env.DEV && error && (
          <p className={`text-[11px] font-mono border rounded-lg px-2 py-1.5 mb-4 break-words ${tc.dangerSoft}`}>
            {String(error.message || error)}
          </p>
        )}
        <div className="flex gap-2 justify-center mt-4">
          <Button variant="primary" icon="refresh" tc={tc} onClick={onRetry}>
            Try again
          </Button>
          <Button as="a" href="/home" variant="secondary" tc={tc}>
            Go home
          </Button>
        </div>
      </div>
    </div>
  );
}

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
      // Themed fallback panel — see ErrorFallback above
      return (
        <ErrorFallback
          error={this.state.error}
          onRetry={this.handleRetry}
          tc={this.props.tc}
        />
      );
    }
    return this.props.children;
  }
}
