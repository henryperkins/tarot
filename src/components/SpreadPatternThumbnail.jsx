
/**
 * SpreadPatternThumbnail - Visual SVG diagram showing spread layout pattern
 * @param {string} spreadKey - The spread identifier (single, threeCard, etc.)
 * @param {string} className - Additional CSS classes
 * @param {object} preview - Optional preview artwork { src, width, height, alt }
 * @param {string} spreadName - Name used for accessible alt text
 */
export function SpreadPatternThumbnail({ spreadKey, className = '', preview = null, spreadName = '' }) {
  // If we have custom artwork, prefer that over the vector fallback
  if (preview?.src) {
    const aspectRatio = preview.aspectRatio || (preview.width && preview.height ? `${preview.width} / ${preview.height}` : '2 / 1');
    const altText = preview.alt || `${spreadName || spreadKey} spread layout`;

    return (
      <div
        className={`relative overflow-hidden rounded-[14px] bg-[#0f0c14] ${className}`}
        style={{ aspectRatio }}
      >
        <img
          src={preview.src}
          alt={altText}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div
          className="pointer-events-none absolute inset-0 rounded-[14px] border border-white/10 shadow-[0_0_0_1px_rgba(232,218,195,0.08)]"
          aria-hidden="true"
        ></div>
      </div>
    );
  }

  const baseClass = 'w-full h-full';
  const cardClass = 'fill-accent/15 stroke-accent stroke-1';
  const highlightClass = 'fill-accent/30 stroke-accent stroke-[1.5]';

  const patterns = {
    single: (
      <svg viewBox="0 0 100 80" className={baseClass} aria-hidden="true">
        <title>One-card layout</title>
        <rect x="35" y="15" width="30" height="50" rx="3" className={highlightClass} />
      </svg>
    ),

    threeCard: (
      <svg viewBox="0 0 100 80" className={baseClass} aria-hidden="true">
        <title>Three-card row layout</title>
        <rect x="8" y="15" width="24" height="50" rx="3" className={cardClass} />
        <rect x="38" y="15" width="24" height="50" rx="3" className={highlightClass} />
        <rect x="68" y="15" width="24" height="50" rx="3" className={cardClass} />
      </svg>
    ),

    fiveCard: (
      <svg viewBox="0 0 100 110" className={baseClass} aria-hidden="true">
        <title>Five-card cross layout</title>
        {/* Center */}
        <rect x="38" y="32" width="24" height="40" rx="3" className={highlightClass} />
        {/* Top */}
        <rect x="38" y="8" width="24" height="20" rx="2" className={cardClass} />
        {/* Bottom */}
        <rect x="38" y="85" width="24" height="20" rx="2" className="fill-accent/10 stroke-accent/70 stroke-1" />
        {/* Left */}
        <rect x="8" y="32" width="24" height="40" rx="3" className={cardClass} />
        {/* Right */}
        <rect x="68" y="32" width="24" height="40" rx="3" className={cardClass} />
      </svg>
    ),

    decision: (
      <svg viewBox="0 0 100 80" className={baseClass} aria-hidden="true">
        <title>Decision two-path layout</title>
        {/* Center question */}
        <rect x="38" y="5" width="24" height="35" rx="3" className={highlightClass} />
        {/* Path A */}
        <rect x="8" y="45" width="24" height="35" rx="3" className={cardClass} />
        {/* Path B */}
        <rect x="68" y="45" width="24" height="35" rx="3" className={cardClass} />
        {/* Connecting lines */}
        <path d="M 50 40 L 20 45" stroke="var(--brand-accent)" strokeWidth="1" opacity="0.3" fill="none" />
        <path d="M 50 40 L 80 45" stroke="var(--brand-accent)" strokeWidth="1" opacity="0.3" fill="none" />
        {/* Clarifier dots */}
        <circle cx="50" cy="65" r="2" className="fill-accent/50" />
        <circle cx="50" cy="75" r="2" className="fill-accent/40" />
      </svg>
    ),

    relationship: (
      <svg viewBox="0 0 100 80" className={baseClass} aria-hidden="true">
        <title>Relationship triangle layout</title>
        {/* You */}
        <rect x="8" y="45" width="24" height="35" rx="3" className={cardClass} />
        {/* Them */}
        <rect x="68" y="45" width="24" height="35" rx="3" className={cardClass} />
        {/* Connection */}
        <rect x="38" y="10" width="24" height="35" rx="3" className={highlightClass} />
        {/* Triangle lines */}
        <path d="M 20 45 L 50 45" stroke="var(--brand-accent)" strokeWidth="1" opacity="0.2" fill="none" />
        <path d="M 80 45 L 50 45" stroke="var(--brand-accent)" strokeWidth="1" opacity="0.2" fill="none" />
      </svg>
    ),

    celtic: (
      <svg viewBox="0 0 110 120" className={baseClass} aria-hidden="true">
        <title>Celtic Cross layout</title>
        {/* Cross base */}
        <rect x="38" y="32" width="24" height="36" rx="3" className={highlightClass} />
        {/* Crossing card */}
        <rect x="33" y="46" width="34" height="8" rx="2" className="fill-accent/40 stroke-accent stroke-[1.5]" />
        
        {/* Cardinal positions */}
        <rect x="38" y="10" width="24" height="20" rx="2" className={cardClass} />
        <rect x="38" y="76" width="24" height="20" rx="2" className={cardClass} />
        <rect x="8" y="32" width="24" height="36" rx="3" className={cardClass} />
        <rect x="68" y="32" width="24" height="36" rx="3" className={cardClass} />
        
        {/* Staff column (right side) */}
        <rect x="82" y="12" width="18" height="20" rx="2" className="fill-accent/10 stroke-accent/60 stroke-1" />
        <rect x="82" y="36" width="18" height="20" rx="2" className="fill-accent/10 stroke-accent/60 stroke-1" />
        <rect x="82" y="60" width="18" height="20" rx="2" className="fill-accent/10 stroke-accent/60 stroke-1" />
        <rect x="82" y="84" width="18" height="20" rx="2" className="fill-accent/10 stroke-accent/60 stroke-1" />
      </svg>
    )
  };

  return (
    <div className={`relative overflow-hidden rounded-[14px] bg-[#0f0c14] ${className}`} aria-hidden="true">
      {patterns[spreadKey] || patterns.single}
      <div className="pointer-events-none absolute inset-0 rounded-[14px] border border-white/10 shadow-[0_0_0_1px_rgba(232,218,195,0.08)]" aria-hidden="true"></div>
    </div>
  );
}
