const BASE_STROKE_WIDTH = 1.8;

function getBaseSvgProps({ color, weight: _weight, mirrored: _mirrored, ...props } = {}) {
  return {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color || 'currentColor',
    strokeWidth: BASE_STROKE_WIDTH,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    ...props
  };
}

export function JournalBookIcon(props) {
  const svgProps = getBaseSvgProps(props);
  return (
    <svg {...svgProps}>
      <path d="M12 5.2c-2.6-1.2-5.3-1.3-7.5-.4v15.5c2.2-.9 4.9-.8 7.5.4" />
      <path d="M12 5.2c2.6-1.2 5.3-1.3 7.5-.4v15.5c-2.2-.9-4.9-.8-7.5.4" />
      <path d="M12 5.2v15.5" />
    </svg>
  );
}

export function JournalCardsAddIcon(props) {
  const svgProps = getBaseSvgProps(props);
  return (
    <svg {...svgProps}>
      <rect x="9" y="4" width="10" height="14" rx="2" />
      <rect x="5" y="6" width="10" height="14" rx="2" />
      <path d="M10.5 13h4" />
      <path d="M12.5 11v4" />
    </svg>
  );
}

export function JournalCardAddIcon(props) {
  const svgProps = getBaseSvgProps(props);
  return (
    <svg {...svgProps}>
      <rect x="6" y="4" width="12" height="16" rx="2" />
      <path d="M12 8v4" />
      <path d="M10 10h4" />
      <path d="M9.5 15.5h5" />
    </svg>
  );
}

export function JournalSlidersIcon(props) {
  const svgProps = getBaseSvgProps(props);
  return (
    <svg {...svgProps}>
      <path d="M4 7h16" />
      <circle cx="7.5" cy="7" r="2.1" />
      <path d="M4 12h16" />
      <circle cx="16.5" cy="12" r="2.1" />
      <path d="M4 17h16" />
      <circle cx="12" cy="17" r="2.1" />
    </svg>
  );
}

export function JournalSearchIcon(props) {
  const svgProps = getBaseSvgProps(props);
  return (
    <svg {...svgProps}>
      <circle cx="11" cy="11" r="6" />
      <circle cx="11" cy="11" r="3" opacity="0.65" />
      <path d="M15.5 15.5L20 20" />
    </svg>
  );
}

export function JournalRefreshIcon(props) {
  const svgProps = getBaseSvgProps(props);
  return (
    <svg {...svgProps}>
      <path d="M20 7v5h-5" />
      <path d="M19.5 12a7.5 7.5 0 0 0-13.1-4.6" />
      <path d="M4 17v-5h5" />
      <path d="M4.5 12a7.5 7.5 0 0 0 13.1 4.6" />
    </svg>
  );
}

export function JournalCommentAddIcon(props) {
  const svgProps = getBaseSvgProps(props);
  return (
    <svg {...svgProps}>
      <path d="M6.5 5.5h11a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H10l-4 4v-4H6.5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" />
      <path d="M12 9v4" />
      <path d="M10 11h4" />
    </svg>
  );
}

export function JournalPlusCircleIcon(props) {
  const svgProps = getBaseSvgProps(props);
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  );
}

export function JournalPercentCircleIcon(props) {
  const svgProps = getBaseSvgProps(props);
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 15L15 9" />
      <circle cx="9.2" cy="9.3" r="1.2" />
      <circle cx="14.8" cy="14.7" r="1.2" />
    </svg>
  );
}

export function JournalBookmarkIcon(props) {
  const svgProps = getBaseSvgProps(props);
  return (
    <svg {...svgProps}>
      <path d="M7 4.5h10A1.5 1.5 0 0 1 18.5 6v16l-6.5-3.6L5.5 22V6A1.5 1.5 0 0 1 7 4.5Z" />
    </svg>
  );
}

export function JournalTrashIcon(props) {
  const svgProps = getBaseSvgProps(props);
  return (
    <svg {...svgProps}>
      <path d="M9 4.5h6" />
      <path d="M6 6h12" />
      <rect x="7" y="6.5" width="10" height="14.5" rx="2" />
      <path d="M10 10.5v7" />
      <path d="M14 10.5v7" />
    </svg>
  );
}

export function JournalUserAddIcon(props) {
  const svgProps = getBaseSvgProps(props);
  return (
    <svg {...svgProps}>
      <path d="M6 12h4" />
      <path d="M8 10v4" />
      <circle cx="16" cy="9" r="3" />
      <path d="M11 20a5 5 0 0 1 10 0" />
    </svg>
  );
}

export function JournalShareIcon(props) {
  const svgProps = getBaseSvgProps(props);
  return (
    <svg {...svgProps}>
      <circle cx="7" cy="12" r="2.2" />
      <circle cx="17" cy="7" r="2.2" />
      <circle cx="17" cy="17" r="2.2" />
      <path d="M8.8 11L15.2 8" />
      <path d="M8.8 13L15.2 16" />
    </svg>
  );
}
