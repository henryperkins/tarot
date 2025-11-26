import { useId } from 'react';
import { Sun, Moon, Stack, ArrowCounterClockwise, Info } from '@phosphor-icons/react';
import { Tooltip } from './Tooltip';
import { GlowToggle } from './GlowToggle';
import { HelperToggle } from './HelperToggle';
import { usePreferences } from '../contexts/PreferencesContext';

/**
 * ExperienceSettings - Non-audio reading preferences
 * Groups theme, deck size, and reversal framework controls
 */
export function ExperienceSettings({ className = '' }) {
  const {
    theme,
    setTheme,
    includeMinors,
    setIncludeMinors,
    deckSize,
    minorsDataIncomplete,
    reversalFramework,
    setReversalFramework
  } = usePreferences();

  const idPrefix = useId();
  const getId = suffix => `${idPrefix}-${suffix}`;

  const controlShellClass =
    'rounded-[1.75rem] border border-secondary/40 bg-surface/75 p-3 xs:p-4 shadow-lg shadow-secondary/20 backdrop-blur-xl';
  const tileBaseClass =
    'group flex items-center gap-2 xs:gap-3 rounded-2xl border border-secondary/10 bg-surface/65 px-3 py-2 xs:py-2.5 transition-colors duration-200 touch-manipulation min-h-[56px]';
  const activeTileClass =
    'border-secondary/70 bg-secondary/10 shadow-lg shadow-secondary/30';
  const inactiveTileClass = 'border-accent/20 hover:border-accent/40 hover:bg-surface/70';

  const iconWrapperBase =
    'flex h-8 w-8 xs:h-9 xs:w-9 flex-shrink-0 items-center justify-center rounded-xl border text-secondary transition-colors duration-200';
  const activeIconWrapper =
    'border-secondary/60 bg-secondary/20 text-secondary shadow-md shadow-secondary/20';
  const inactiveIconWrapper =
    'border-accent/20 bg-surface/80 text-muted group-hover:text-main';

  // Info button - subtle icon, 44px touch target but no visible border
  const infoButtonClass =
    'inline-flex min-w-[44px] min-h-[44px] items-center justify-center rounded-full text-muted/60 transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 touch-manipulation -ml-2 -mr-3';

  const reversalSelectClass =
    'w-full rounded-2xl border border-secondary/25 bg-surface/70 px-3 py-2.5 min-h-[44px] text-[0.72rem] uppercase tracking-[0.08em] text-main transition focus:outline-none focus:ring-2 focus:ring-accent/50';

  const LightIcon = theme === 'light' ? Sun : Moon;

  const experienceToggles = [
    {
      id: getId('theme-toggle'),
      label: 'Light mode',
      tooltipContent:
        'Switch to a brighter palette if you prefer more contrast while reading.',
      tooltipAria: 'About light mode',
      srDescription: 'Toggle between dark and light theme.',
      active: theme === 'light',
      Icon: LightIcon,
      onToggle: value => setTheme(value ? 'light' : 'dark')
    },
    {
      id: getId('deck-toggle'),
      label: 'Full deck',
      tooltipContent:
        'Toggle the Minor Arcana to focus on archetypal majors or explore the full 78-card deck.',
      tooltipAria: 'About deck size',
      srDescription:
        'Toggle between the full 78-card deck and the Major Arcana-only deck.',
      active: includeMinors,
      Icon: Stack,
      onToggle: value => setIncludeMinors?.(value)
    }
  ];

  return (
    <div className={`${controlShellClass} ${className}`}>
      <div className="mb-3">
        <h3 className="text-xs sm:text-sm font-serif text-accent uppercase tracking-[0.12em] flex items-center gap-2">
          <Stack className="w-4 h-4" aria-hidden="true" />
          Experience Preferences
        </h3>
        <p className="text-[0.7rem] text-muted mt-1">Theme, deck scope, and interpretation lens</p>
      </div>

      <div className="space-y-2 sm:space-y-3">
        {/* Theme and Deck toggles */}
        <div
          className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3"
          role="group"
          aria-label="Theme and deck controls"
        >
          {experienceToggles.map(item => {
            const ItemIcon = item.Icon;
            const labelId = `${item.id}-label`;
            const descriptionId = `${item.id}-description`;

            return (
              <div
                key={item.id}
                className={`${tileBaseClass} ${item.active ? activeTileClass : inactiveTileClass}`}
              >
                <span
                  className={`${iconWrapperBase} ${
                    item.active ? activeIconWrapper : inactiveIconWrapper
                  }`}
                  aria-hidden="true"
                >
                  <ItemIcon className="h-4 w-4" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span id={labelId} className="text-sm font-semibold text-main">
                      {item.label}
                    </span>
                    <Tooltip
                      content={item.tooltipContent}
                      position="top"
                      triggerClassName={infoButtonClass}
                      ariaLabel={item.tooltipAria}
                    >
                      <Info className="h-3.5 w-3.5" />
                    </Tooltip>
                  </div>
                  <span id={descriptionId} className="sr-only">
                    {item.srDescription}
                  </span>
                </div>

                <GlowToggle
                  checked={item.active}
                  onChange={item.onToggle}
                  labelId={labelId}
                  describedBy={descriptionId}
                />
              </div>
            );
          })}
        </div>

        {/* Reversal Framework */}
        <div className={`${tileBaseClass} ${activeTileClass}`}>
          <span className={`${iconWrapperBase} ${activeIconWrapper}`} aria-hidden="true">
            <ArrowCounterClockwise className="h-4 w-4" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-sm font-semibold text-main">Reversal lens</span>
              <Tooltip
                content="Choose how reversed cards are interpreted in AI narratives. Auto selects the best-fit lens for each spread."
                position="top"
                triggerClassName={infoButtonClass}
                ariaLabel="About reversal lens options"
              >
                <Info className="h-3.5 w-3.5" />
              </Tooltip>
            </div>
            <select
              id={getId('reversal-framework-select')}
              className={`${reversalSelectClass} w-full`}
              value={reversalFramework || 'auto'}
              onChange={event => {
                const value = event.target.value === 'auto' ? null : event.target.value;
                setReversalFramework(value);
              }}
              aria-describedby={getId('reversal-description')}
            >
              <option value="auto">Auto (recommended)</option>
              <option value="blocked">Blocked energy</option>
              <option value="delayed">Timing & delays</option>
              <option value="internalized">Internal process</option>
              <option value="contextual">Context-based</option>
            </select>
          </div>
        </div>
      </div>

      <span id={getId('reversal-description')} className="sr-only">
        Choose how reversed cards are interpreted in AI-generated readings.
      </span>

      {reversalFramework && (
        <HelperToggle className="mt-2 max-w-xl">
          <div className="rounded-2xl border border-secondary/25 bg-secondary/5 px-3 py-2 text-[clamp(0.78rem,2vw,0.92rem)] leading-snug text-muted">
            {reversalFramework === 'blocked' && (
              <>
                <span className="font-semibold text-secondary">Blocked energy:</span>{' '}
                Reversed cards indicate obstructed, challenged, or resisted energy. The card&rsquo;s themes face barriers or opposition.
              </>
            )}
            {reversalFramework === 'delayed' && (
              <>
                <span className="font-semibold text-secondary">Timing & delays:</span>{' '}
                Reversed cards suggest the timing isn&rsquo;t right yet. Themes are emerging slowly or waiting for the right moment to manifest.
              </>
            )}
            {reversalFramework === 'internalized' && (
              <>
                <span className="font-semibold text-secondary">Internal process:</span>{' '}
                Reversed cards point to private, internal work. The card&rsquo;s energy is processing beneath the surface or kept within.
              </>
            )}
            {reversalFramework === 'contextual' && (
              <>
                <span className="font-semibold text-secondary">Context-based:</span>{' '}
                Reversed meanings adapt dynamically based on the card, position, and surrounding cards for nuanced interpretation.
              </>
            )}
          </div>
        </HelperToggle>
      )}
    </div>
  );
}
