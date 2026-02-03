const BASE_STROKE_WIDTH = 1.6;

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
      <path d="M4.5 6.5c2.5-1.4 5.6-1.5 7.5-.5v13.8c-2-1-5-.9-7.5.5z" />
      <path d="M19.5 6.5c-2.5-1.4-5.6-1.5-7.5-.5v13.8c2-1 5-.9 7.5.5z" />
      <path d="M12 6v14.2" />
      <path d="M7.5 10h3" />
      <path d="M13.5 10h3" />
      <path d="M18 3.8v2.4" />
      <path d="M16.8 5h2.4" />
    </svg>
  );
}

export function JournalCardsAddIcon(props) {
  const svgProps = getBaseSvgProps(props);
  return (
    <svg {...svgProps}>
      <rect x="8" y="5" width="11" height="15" rx="2.2" />
      <path d="M5 8V6.5a2 2 0 0 1 2-2h7" />
      <path d="M13 11v4" />
      <path d="M11 13h4" />
      <path d="M18.5 4.2v2" />
      <path d="M17.5 5.2h2" />
    </svg>
  );
}

export function JournalCardAddIcon(props) {
  const svgProps = getBaseSvgProps(props);
  return (
    <svg {...svgProps}>
      <rect x="6.5" y="4.5" width="11" height="15" rx="2.2" />
      <path d="M12 8.5v4" />
      <path d="M10 10.5h4" />
      <path d="M9.5 15.5h5" />
    </svg>
  );
}

export function JournalCardIcon(props) {
  const svgProps = getBaseSvgProps(props);
  return (
    <svg {...svgProps}>
      <rect x="6.5" y="4.5" width="11" height="15" rx="2.2" />
      <path d="M9.5 9.2h5" />
      <path d="M9.5 13.6h5" />
      <circle cx="12" cy="17.2" r="0.8" />
    </svg>
  );
}

export function JournalSlidersIcon(props) {
  const svgProps = getBaseSvgProps(props);
  return (
    <svg {...svgProps}>
      <path d="M4 7h16" />
      <circle cx="8" cy="7" r="2" />
      <path d="M4 12h16" />
      <circle cx="15.5" cy="12" r="2" />
      <path d="M4 17h16" />
      <circle cx="11.5" cy="17" r="2" />
      <path d="M18.5 4.5v2" />
      <path d="M17.5 5.5h2" />
    </svg>
  );
}

export function JournalSearchIcon(props) {
  const svgProps = getBaseSvgProps(props);
  return (
    <svg {...svgProps}>
      <circle cx="11" cy="11" r="6" />
      <path d="M15.5 15.5L20 20" />
      <path d="M11 8.5v2.5" />
      <path d="M9.8 9.8h2.5" />
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
      <path d="M18.2 4.2v2" />
      <path d="M17.2 5.2h2" />
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
      <path d="M18 4.2v2" />
      <path d="M17 5.2h2" />
    </svg>
  );
}

export function JournalPlusCircleIcon(props) {
  const svgProps = getBaseSvgProps(props);
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M12 8.5v7" />
      <path d="M8.5 12h7" />
      <path d="M18.3 6.2v1.6" />
      <path d="M17.5 7h1.6" />
    </svg>
  );
}

export function JournalPercentCircleIcon(props) {
  const svgProps = getBaseSvgProps(props);
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M9 15L15 9" />
      <circle cx="9.3" cy="9.4" r="1.2" />
      <circle cx="14.7" cy="14.6" r="1.2" />
      <path d="M18.3 6.2v1.6" />
      <path d="M17.5 7h1.6" />
    </svg>
  );
}

export function JournalBookmarkIcon(props) {
  const svgProps = getBaseSvgProps(props);
  return (
    <svg {...svgProps}>
      <path d="M7 4.5h10A1.8 1.8 0 0 1 18.8 6.3v15.2L12 17.7 5.2 21.5V6.3A1.8 1.8 0 0 1 7 4.5Z" />
      <path d="M9.5 9h5" />
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
      <path d="M18.3 4.2v2" />
      <path d="M17.3 5.2h2" />
    </svg>
  );
}

export function JournalUserAddIcon(props) {
  const svgProps = getBaseSvgProps(props);
  return (
    <svg {...svgProps}>
      <path d="M6.5 12h4" />
      <path d="M8.5 10v4" />
      <circle cx="16" cy="9" r="3" />
      <path d="M11 20a5 5 0 0 1 10 0" />
      <path d="M18.5 4.2v2" />
      <path d="M17.5 5.2h2" />
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
      <path d="M18.5 4.2v2" />
      <path d="M17.5 5.2h2" />
    </svg>
  );
}

export function JournalThemesIcon(props) {
  const svgProps = getBaseSvgProps(props);
  return (
    <svg {...svgProps}>
      <path d="M4.5 8h9" />
      <circle cx="14" cy="8" r="1.2" />
      <path d="M4.5 12h11" />
      <circle cx="16" cy="12" r="1.2" />
      <path d="M4.5 16h8" />
      <circle cx="13" cy="16" r="1.2" />
      <path d="M18.5 6v2" />
      <path d="M17.5 7h2" />
      <path d="M18.5 14v2" />
      <path d="M17.5 15h2" />
    </svg>
  );
}

export function JournalNarrativeIcon(props) {
  const svgProps = getBaseSvgProps(props);
  return (
    <svg {...svgProps}>
      <path d="M6 6.5h9a3 3 0 0 1 3 3v8" />
      <path d="M6 6.5v12a2 2 0 0 0 2 2h7" />
      <path d="M9 10.5h6" />
      <path d="M9 14h6" />
      <path d="M15 20.5l3-3" />
    </svg>
  );
}

export function JournalSymbolsIcon(props) {
  const svgProps = getBaseSvgProps(props);
  return (
    <svg {...svgProps}>
      <circle cx="10.5" cy="11" r="5.5" />
      <path d="M14.5 15.5L19 20" />
      <path d="M10.5 8.5v2.5" />
      <path d="M9.2 9.8h2.6" />
    </svg>
  );
}
