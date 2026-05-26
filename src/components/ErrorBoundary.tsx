import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  /** Optional slot for a custom fallback UI. Receives the error. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches unhandled render / IPC errors anywhere in the component tree.
 * Shows a minimal recovery UI so the shell doesn't go completely blank.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to console so the Tauri log viewer can capture it.
    console.error('[ErrorBoundary]', error.message, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    const { children, fallback } = this.props;

    if (!error) return children;
    if (fallback) return fallback(error, this.reset);

    return (
      <div className="error-boundary-fallback">
        <div className="error-boundary-card">
          <span className="error-boundary-icon">!</span>
          <h3>Something went wrong</h3>
          <p className="error-boundary-message">{error.message}</p>
          <button className="primary-button" onClick={this.reset}>
            Try again
          </button>
        </div>
      </div>
    );
  }
}
