// components/ErrorBoundary.js
// Catches any React render error and shows a friendly fallback UI
import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("🔴 [ErrorBoundary] Caught render error:", error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#06080f",
            color: "white",
            fontFamily: "'Outfit', sans-serif",
            gap: "20px",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "20px",
              background: "linear-gradient(135deg, #ef4444, #b91c1c)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "32px",
              boxShadow: "0 10px 30px rgba(239,68,68,0.35)",
            }}
          >
            ⚠️
          </div>
          <h2 style={{ fontSize: "24px", fontWeight: "800", margin: 0 }}>
            Something went wrong
          </h2>
          <p style={{ color: "#94a3b8", maxWidth: "420px", lineHeight: 1.6, margin: 0 }}>
            An unexpected error occurred in this section. Your data is safe —
            refreshing will restore the workspace.
          </p>
          {this.state.error && (
            <details
              style={{
                background: "rgba(239,68,68,0.06)",
                border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: "10px",
                padding: "12px 20px",
                maxWidth: "560px",
                cursor: "pointer",
                fontSize: "13px",
                color: "#fca5a5",
                textAlign: "left",
              }}
            >
              <summary style={{ fontWeight: 700, marginBottom: "8px" }}>
                Error details
              </summary>
              <code style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {this.state.error.toString()}
              </code>
            </details>
          )}
          <button
            onClick={this.handleReload}
            style={{
              background: "linear-gradient(135deg, #3b82f6, #2563eb)",
              color: "white",
              border: "none",
              padding: "12px 28px",
              borderRadius: "12px",
              fontSize: "15px",
              fontWeight: "700",
              cursor: "pointer",
              boxShadow: "0 4px 15px rgba(59,130,246,0.35)",
            }}
          >
            🔄 Reload Workspace
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
