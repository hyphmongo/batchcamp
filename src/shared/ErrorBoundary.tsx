import { Warning } from "@phosphor-icons/react";
import { Component, type ErrorInfo, type ReactNode } from "react";

import { Cta } from "@/shared/Cta";
import { captureError } from "@/shared/error-handler";
import { Wordmark } from "@/shared/Wordmark";

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    captureError(
      error,
      { react: { componentStack: errorInfo.componentStack ?? "" } },
      { operation: "react_error_boundary" },
    );
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col h-screen">
          <div className="shrink-0 bg-base-200 border-b border-base-300/70">
            <div className="mx-auto w-full max-w-4xl px-8 py-4">
              <h1 className="flex items-baseline gap-2 text-title font-semibold tracking-tight text-base-content lowercase">
                <Wordmark
                  size={20}
                  variant="color"
                  className="self-center -mt-px"
                />
                batchcamp
              </h1>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center px-8">
            <div className="flex flex-col items-center text-center gap-5 max-w-md">
              <Warning
                size={56}
                weight="regular"
                className="text-warm"
                aria-hidden="true"
              />
              <div className="space-y-2">
                <h2 className="text-display font-semibold tracking-tight leading-[1.05]">
                  Something went wrong.
                </h2>
                <p className="text-body-lg text-base-content/70 leading-relaxed">
                  The error has been logged. Please refresh the page and try
                  again.
                </p>
              </div>
              <Cta
                onClick={() => window.location.reload()}
                className="px-4 py-2 text-body focus-visible:outline-offset-2"
              >
                Reload page
              </Cta>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
