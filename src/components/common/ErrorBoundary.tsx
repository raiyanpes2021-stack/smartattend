import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected application error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('SMARTATTEND ErrorBoundary:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#172B35] p-6 text-[#F5F0E6]">
          <div className="w-full max-w-lg rounded-xl border border-[#D5AD70]/35 bg-[#112129] p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#D5AD70]" aria-hidden="true" />
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
                  Application Recovery Required
                </h2>
                <p className="mt-2 break-words text-xs leading-relaxed text-[#F5F0E6]/75">
                  {this.state.message}
                </p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#D5AD70] px-4 py-2 text-xs font-semibold text-[#172B35] transition-colors hover:bg-[#D5AD70]/90"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Reload SMARTATTEND</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
