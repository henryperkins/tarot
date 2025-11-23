import React from 'react';

/**
 * SpreadPatternThumbnail - Visual SVG diagram showing spread layout pattern
 * @param {string} spreadKey - The spread identifier (single, threeCard, etc.)
 * @param {string} className - Additional CSS classes
 */
export function SpreadPatternThumbnail({ spreadKey, className = '' }) {
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
      <svg viewBox="0 0 100 80" className={baseClass} aria-hidden="true">
        <title>Five-card cross layout</title>
        {/* Center */}
        <rect x="38" y="30" width="24" height="40" rx="3" className={highlightClass} />
        {/* Top */}
        <rect x="38" y="5" width="24" height="20" rx="2" className={cardClass} />
        {/* Bottom */}
        <rect x="38" y="75" width="24" height="20" rx="2" className="fill-accent/10 stroke-accent/70 stroke-1" />
        {/* Left */}
        <rect x="8" y="30" width="24" height="40" rx="3" className={cardClass} />
        {/* Right */}
        <rect x="68" y="30" width="24" height="40" rx="3" className={cardClass} />
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
      <svg viewBox="0 0 100 100" className={baseClass} aria-hidden="true">
        <title>Celtic Cross layout</title>
        {/* Cross base */}
        <rect x="38" y="32" width="24" height="36" rx="3" className={highlightClass} />
        {/* Crossing card */}
        <rect x="33" y="46" width="34" height="8" rx="2" className="fill-accent/40 stroke-accent stroke-[1.5]" />
        
        {/* Cardinal positions */}
        <rect x="38" y="8" width="24" height="20" rx="2" className={cardClass} />
        <rect x="38" y="72" width="24" height="20" rx="2" className={cardClass} />
        <rect x="8" y="32" width="24" height="36" rx="3" className={cardClass} />
        <rect x="68" y="32" width="24" height="36" rx="3" className={cardClass} />
        
        {/* Staff column (right side) */}
        <rect x="78" y="12" width="18" height="20" rx="2" className="fill-accent/10 stroke-accent/60 stroke-1" />
        <rect x="78" y="35" width="18" height="20" rx="2" className="fill-accent/10 stroke-accent/60 stroke-1" />
        <rect x="78" y="58" width="18" height="20" rx="2" className="fill-accent/10 stroke-accent/60 stroke-1" />
        <rect x="78" y="81" width="18" height="20" rx="2" className="fill-accent/10 stroke-accent/60 stroke-1" />
      </svg>
    )
  };

  return (
    <div className={`${className}`} aria-hidden="true">
      {patterns[spreadKey] || patterns.single}
    </div>
  );
}