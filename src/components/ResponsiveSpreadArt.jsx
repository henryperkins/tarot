export function ResponsiveSpreadArt({
  alt,
  aspectRatio = '16 / 9',
  sources = [],
  fallbackSrc,
  fallbackWidth,
  fallbackHeight,
  sizes = '(max-width: 640px) 88vw, (max-width: 1024px) 46vw, 340px',
  className = ''
}) {
  const pictureSources = Array.isArray(sources) ? sources : [];
  const safeAlt = alt || 'Spread artwork';

  return (
    <div
      className={`relative w-full h-full ${className}`.trim()}
      style={{ aspectRatio }}
    >
      <picture>
        {pictureSources.map((source, index) => (
          <source
            key={`${source.type || 'source'}-${index}`}
            type={source.type}
            srcSet={source.srcSet}
            sizes={sizes}
          />
        ))}
        <img
          src={fallbackSrc}
          width={fallbackWidth || undefined}
          height={fallbackHeight || undefined}
          alt={safeAlt}
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
          sizes={sizes}
          onError={(event) => {
            // Hide broken images to reveal the fallback background
            event.currentTarget.style.display = 'none';
          }}
        />
      </picture>
    </div>
  );
}
