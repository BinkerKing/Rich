import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * React 16+ error boundary —— 兜底防止子树渲染异常把整个 app 黑屏。
 * 出错时显示错误信息 + reset 按钮，便于看到栈和恢复。
 */

interface Props {
  children: ReactNode;
  /** 可选：错误时显示的备用 UI（默认显示堆栈） */
  fallback?: (err: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error);
    console.error("[ErrorBoundary] info", info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);
    return (
      <div style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        color: "#ff9a8a",
        padding: "40px 32px",
        font: "13px ui-monospace, Menlo, monospace",
        overflow: "auto",
        zIndex: 9999,
      }}>
        <h2 style={{ color: "#8ffef7", margin: "0 0 12px" }}>UI 渲染异常</h2>
        <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
          {this.state.error.message}{"\n"}
          {this.state.error.stack}
        </pre>
        <button
          type="button"
          onClick={this.reset}
          style={{
            marginTop: 20,
            padding: "8px 14px",
            background: "rgba(143, 254, 247, .14)",
            border: "1px solid rgba(143, 254, 247, .55)",
            borderRadius: 6,
            color: "#8ffef7",
            cursor: "pointer",
          }}
        >重试</button>
      </div>
    );
  }
}
