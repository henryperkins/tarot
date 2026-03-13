const FOCUS_OUTLINE_NONE = 'focus-visible:outline-none';
const FOCUS_RING_WIDTH = 'focus-visible:ring-2';
const FOCUS_RING_OFFSET_WIDTH = 'focus-visible:ring-offset-2';
const FOCUS_RING_OFFSET_MAIN_TOKEN = 'focus-visible:ring-offset-main';
const FOCUS_RING_OFFSET_SURFACE_TOKEN = 'focus-visible:ring-offset-surface';

const FOCUS_RING_DEFAULT_TOKEN = 'focus-visible:ring-[color:var(--focus-ring-color)]';
const FOCUS_RING_ACCENT_TOKEN = 'focus-visible:ring-accent';
const FOCUS_RING_ACCENT_50_TOKEN = 'focus-visible:ring-accent/50';
const FOCUS_RING_ACCENT_SOFT_TOKEN = 'focus-visible:ring-accent/60';
const FOCUS_RING_PRIMARY_40_TOKEN = 'focus-visible:ring-primary/40';
const FOCUS_RING_PRIMARY_50_TOKEN = 'focus-visible:ring-primary/50';
const FOCUS_RING_PRIMARY_60_TOKEN = 'focus-visible:ring-primary/60';
const FOCUS_RING_SECONDARY_TOKEN = 'focus-visible:ring-secondary';
const FOCUS_RING_SECONDARY_50_TOKEN = 'focus-visible:ring-secondary/50';
const FOCUS_RING_ERROR_40_TOKEN = 'focus-visible:ring-error/40';

function joinFocusClasses(...tokens) {
  return tokens.join(' ');
}

export const FOCUS_RING_OFFSET_2 = FOCUS_RING_OFFSET_WIDTH;
export const FOCUS_RING_OFFSET_MAIN = joinFocusClasses(
  FOCUS_RING_OFFSET_WIDTH,
  FOCUS_RING_OFFSET_MAIN_TOKEN
);
export const FOCUS_RING_OFFSET_SURFACE = joinFocusClasses(
  FOCUS_RING_OFFSET_WIDTH,
  FOCUS_RING_OFFSET_SURFACE_TOKEN
);

export const FOCUS_RING_DEFAULT = joinFocusClasses(
  FOCUS_OUTLINE_NONE,
  FOCUS_RING_WIDTH,
  FOCUS_RING_DEFAULT_TOKEN
);
export const FOCUS_RING_ACCENT = joinFocusClasses(
  FOCUS_OUTLINE_NONE,
  FOCUS_RING_WIDTH,
  FOCUS_RING_ACCENT_TOKEN
);
export const FOCUS_RING_ACCENT_50 = joinFocusClasses(
  FOCUS_OUTLINE_NONE,
  FOCUS_RING_WIDTH,
  FOCUS_RING_ACCENT_50_TOKEN
);
export const FOCUS_RING_ACCENT_SOFT = joinFocusClasses(
  FOCUS_OUTLINE_NONE,
  FOCUS_RING_WIDTH,
  FOCUS_RING_ACCENT_SOFT_TOKEN
);
export const FOCUS_RING_PRIMARY_40 = joinFocusClasses(
  FOCUS_OUTLINE_NONE,
  FOCUS_RING_WIDTH,
  FOCUS_RING_PRIMARY_40_TOKEN
);
export const FOCUS_RING_PRIMARY_50 = joinFocusClasses(
  FOCUS_OUTLINE_NONE,
  FOCUS_RING_WIDTH,
  FOCUS_RING_PRIMARY_50_TOKEN
);
export const FOCUS_RING_PRIMARY_60 = joinFocusClasses(
  FOCUS_OUTLINE_NONE,
  FOCUS_RING_WIDTH,
  FOCUS_RING_PRIMARY_60_TOKEN
);
export const FOCUS_RING_SECONDARY = joinFocusClasses(
  FOCUS_OUTLINE_NONE,
  FOCUS_RING_WIDTH,
  FOCUS_RING_SECONDARY_TOKEN
);
export const FOCUS_RING_SECONDARY_50 = joinFocusClasses(
  FOCUS_OUTLINE_NONE,
  FOCUS_RING_WIDTH,
  FOCUS_RING_SECONDARY_50_TOKEN
);
export const FOCUS_RING_ERROR_40 = joinFocusClasses(
  FOCUS_OUTLINE_NONE,
  FOCUS_RING_WIDTH,
  FOCUS_RING_ERROR_40_TOKEN
);
