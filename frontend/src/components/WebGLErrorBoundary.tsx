import { Component, type ReactNode } from "react";

const MAX_RETRIES = 3;
const RETRY_WINDOW_MS = 10_000;

interface Props {
  children: ReactNode;
}

interface State {
  remountKey: number;
  retryTimestamps: number[];
  exhausted: boolean;
}

export class WebGLErrorBoundary extends Component<Props, State> {
  state: State = { remountKey: 0, retryTimestamps: [], exhausted: false };

  static getDerivedStateFromError(): Partial<State> | null {
    return null; // handled in componentDidCatch
  }

  componentDidCatch(error: Error) {
    const now = Date.now();
    const recent = this.state.retryTimestamps.filter((t) => now - t < RETRY_WINDOW_MS);

    if (recent.length >= MAX_RETRIES) {
      console.error("[WebGLErrorBoundary] retries exhausted, giving up", error);
      this.setState({ exhausted: true });
      return;
    }

    console.warn("[WebGLErrorBoundary] recovering from render crash", error);
    this.setState((s) => ({
      remountKey: s.remountKey + 1,
      retryTimestamps: [...recent, now],
    }));
  }

  render() {
    if (this.state.exhausted) {
      return (
        <div className="flex size-full items-center justify-center bg-neutral-900 text-neutral-200">
          <p>
            The map crashed repeatedly.{" "}
            <button className="underline" onClick={() => window.location.reload()}>
              Reload the page
            </button>
          </p>
        </div>
      );
    }

    return (
      <div className="contents" key={this.state.remountKey}>
        {this.props.children}
      </div>
    );
  }
}
