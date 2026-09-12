/**
 * A decorative entrance only. CSS owns the fade and leaves content visible if
 * motion is disabled, paused, cancelled, or the page is mounted in a hidden tab.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Page content
 * @param {string} props.className - Optional className for the wrapper
 */
export function PageTransition({ children, className = '' }) {
  return (
    <div className={`page-transition ${className}`}>
      {children}
    </div>
  );
}
