/** Keep page content visible even when motion is interrupted or unavailable. */
export function PageTransition({ children, className = '' }) {
  return (
    <div className={`page-transition ${className}`}>
      {children}
    </div>
  );
}
