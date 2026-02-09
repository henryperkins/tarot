export function IdleScene({
  title = 'Prepare Your Reading',
  subtitle = '',
  showTitle = true,
  children,
  className = ''
}) {
  return (
    <section className={`scene-stage scene-stage--idle relative px-3 xs:px-4 sm:px-6 py-6 sm:py-8 ${className}`} data-scene="idle">
      <div className="scene-stage__panel scene-stage__panel--idle max-w-5xl mx-auto">
        {showTitle ? (
          <div className="mb-4 sm:mb-5 text-center">
            <h2 className="text-xl sm:text-2xl font-serif text-accent">{title}</h2>
            {subtitle ? <p className="text-sm text-muted mt-2">{subtitle}</p> : null}
          </div>
        ) : null}
        {children}
      </div>
    </section>
  );
}
