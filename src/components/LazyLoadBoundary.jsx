import { Component } from 'react';
import PropTypes from 'prop-types';

/**
 * Keeps the app on screen when a lazily loaded part fails to render, most
 * often because its code could not be downloaded (offline, a dropped mobile
 * connection, a stale deploy). Without a boundary React unmounts the whole
 * tree and leaves a blank page.
 *
 * "Try again" reloads the page: browsers may keep a failed module import for
 * the page's lifetime, and a reading in progress is restored after the reload
 * (lib/readingSnapshot).
 */
export class LazyLoadBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false, online: typeof navigator === 'undefined' ? true : navigator.onLine !== false };
    this.handleConnectivity = this.handleConnectivity.bind(this);
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    if (import.meta.env?.DEV) {
      console.warn('[LazyLoadBoundary] A lazily loaded section failed to render.', error);
    }
  }

  componentDidMount() {
    window.addEventListener('online', this.handleConnectivity);
    window.addEventListener('offline', this.handleConnectivity);
  }

  componentWillUnmount() {
    window.removeEventListener('online', this.handleConnectivity);
    window.removeEventListener('offline', this.handleConnectivity);
  }

  handleConnectivity() {
    this.setState({ online: navigator.onLine !== false });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const { title, className } = this.props;
    const { online } = this.state;
    return (
      <section role="alert" className={`mx-auto max-w-xl rounded-2xl border border-secondary/40 bg-surface px-5 py-6 text-center ${className}`}>
        <h2 className="font-serif text-xl text-main">{title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {online
            ? 'Part of this page did not load. Your question and cards are kept, so you can try again now.'
            : 'You appear to be offline. Your question and cards are kept; reconnect, then try again.'}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 inline-flex min-h-touch items-center justify-center rounded-full border border-secondary/50 px-5 py-2 text-sm font-semibold text-main hover:bg-secondary/10 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-(--focus-ring-color)"
        >
          Try again
        </button>
      </section>
    );
  }
}

LazyLoadBoundary.propTypes = {
  children: PropTypes.node,
  title: PropTypes.string,
  className: PropTypes.string
};

LazyLoadBoundary.defaultProps = {
  title: 'This step did not load',
  className: ''
};
