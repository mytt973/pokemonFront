import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Erreur attrapée :", error);
    console.error("Composants :", info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16, color: "crimson" }}>
          <h2>Une erreur est survenue</h2>
          <pre>{String(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}