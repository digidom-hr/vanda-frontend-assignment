"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  readonly children: ReactNode;
  /** Shown instead of the children after a render error; receives a reset. */
  readonly fallback: (reset: () => void) => ReactNode;
}

interface State {
  readonly failed: boolean;
}

/**
 * Contains a render error to one panel so the rest of the page keeps working.
 * Error boundaries are the one place React still requires a class component.
 */
export class PanelErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[panel] render failed", error, info.componentStack);
  }

  private readonly reset = () => this.setState({ failed: false });

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback(this.reset) : this.props.children;
  }
}
