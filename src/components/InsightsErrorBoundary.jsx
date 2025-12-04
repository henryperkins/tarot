import React from 'react';

/**
 * Catches rendering errors inside JournalInsightsPanel so the whole
 * Journal page does not blank out when an unexpected issue occurs.
 */
export class InsightsErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Surface to console for debugging; production stays graceful.
    console.error('Journal insights crashed:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-3xl border border-error/30 bg-error/5 p-4 text-sm text-error">
          Insights are temporarily unavailable. You can continue browsing your journal.
        </div>
      );
    }
    return this.props.children;
  }
}
