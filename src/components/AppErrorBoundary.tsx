import { AlertTriangle, Grid2X2, RotateCcw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Floorplan startup failure", error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    const restartWithoutRecovery = () => {
      try {
        globalThis.sessionStorage?.setItem("floorplan-skip-recovery-once", "1");
      } finally {
        globalThis.location.reload();
      }
    };
    return (
      <main className="fatal-shell">
        <section className="fatal-card" role="alert">
          <div className="fatal-brand"><span className="brand-mark"><Grid2X2 size={19} /></span><strong>Floorplan</strong></div>
          <AlertTriangle className="fatal-icon" size={28} />
          <p className="eyebrow">Startup recovery</p>
          <h1>Floorplan could not finish loading</h1>
          <p>Your downloaded project files are unaffected. Reload the application, or skip the recovery check once if a local snapshot is preventing startup.</p>
          <div className="fatal-actions">
            <button type="button" className="button primary" onClick={() => globalThis.location.reload()}><RotateCcw size={16} />Reload</button>
            <button type="button" className="button secondary" onClick={restartWithoutRecovery}>Start without recovery</button>
          </div>
          <details>
            <summary>Technical details</summary>
            <code>{this.state.error.message || "Unknown startup error"}</code>
          </details>
        </section>
      </main>
    );
  }
}

export function LoadingShell() {
  return (
    <main className="loading-shell" aria-label="Loading Floorplan">
      <header className="loading-toolbar"><span className="brand-mark"><Grid2X2 size={19} /></span><strong>Floorplan</strong></header>
      <div className="loading-grid" aria-hidden="true"><span /><span /><span /></div>
      <p role="status">Preparing the 2D workspace…</p>
    </main>
  );
}
