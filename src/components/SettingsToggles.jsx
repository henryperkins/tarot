import React from 'react';
import {
  Volume2,
  VolumeX,
  Music,
  Sun,
  Moon,
  Layers,
  Info,
  RotateCcw
} from 'lucide-react';
import { Tooltip } from './Tooltip';
import { HelperToggle } from './HelperToggle';
import { usePreferences } from '../contexts/PreferencesContext';

export function SettingsToggles() {
  // Consume preferences directly from context
  const {
    voiceOn,
    setVoiceOn,
    ambienceOn,
    setAmbienceOn,
    reversalFramework,
    setReversalFramework,
    theme,
    setTheme,
    includeMinors,
    setIncludeMinors,
    deckSize,
    minorsDataIncomplete
  } = usePreferences();

  const controlShellClass =
    'rounded-[1.75rem] border border-secondary/40 bg-surface/75 p-3 sm:p-4 shadow-lg shadow-secondary/20 backdrop-blur-xl';
  const tileBaseClass =
    'group relative flex items-center gap-2 rounded-2xl border border-secondary/10 bg-surface/65 px-3 py-2 text-left text-[0.72rem] uppercase tracking-[0.08em] text-main transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/60 hover:bg-surface/70 hover:shadow-lg hover:shadow-accent/20 focus-within:ring-2 focus-within:ring-accent/40';
  const activeTileClass =
    'border-secondary/70 bg-secondary/10 shadow-lg shadow-secondary/30';
  const inactiveTileClass = 'border-accent/20';

  const iconWrapperBase =
    'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl border text-secondary transition-all duration-200';
  const activeIconWrapper =
    'border-secondary/60 bg-secondary/20 text-secondary shadow-lg shadow-secondary/20';
  const inactiveIconWrapper =
    'border-accent/20 bg-surface/80 text-muted group-hover:border-accent/50 group-hover:text-main';

  const badgeBaseClass =
    'inline-flex flex-shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.12em] transition-all duration-200';
  const activeBadgeClass =
    'border-secondary/70 bg-secondary/20 text-secondary shadow-lg shadow-secondary/20';
  const inactiveBadgeClass = 'border-accent/20 bg-surface-muted/80 text-muted';

  const switchTrackBase =
    'relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full border px-0.5 transition-all duration-200';
  const activeSwitchTrack = 'border-secondary/70 bg-secondary/30';
  const inactiveSwitchTrack = 'border-accent/20 bg-surface/80';
  const switchThumbBase =
    'h-3.5 w-3.5 rounded-full transition-all duration-200';
  const activeSwitchThumb =
    'translate-x-3 bg-accent shadow-lg shadow-accent/50';
  const inactiveSwitchThumb = 'translate-x-0 bg-muted/80';

  const infoButtonClass =
    'inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-secondary/40 bg-transparent text-secondary/80 transition hover:border-accent/60 hover:text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60';
  const reversalSelectClass =
    'w-full rounded-2xl border border-secondary/25 bg-surface/70 px-3 py-2 text-[0.72rem] uppercase tracking-[0.08em] text-main transition focus:outline-none focus:ring-2 focus:ring-accent/50 sm:w-auto';

  const VoiceIcon = voiceOn ? Volume2 : VolumeX;
  const LightIcon = theme === 'light' ? Sun : Moon;
  const deckStatusLabel = minorsDataIncomplete
    ? 'Limited'
    : includeMinors
      ? 'Full'
      : 'Majors';

  const toggleItems = [
    {
      id: 'voice-toggle',
      label: 'Reader voice',
      tooltipContent: 'Gentle narration for card flips and full readings.',
      tooltipAria: 'About reader voice narration',
      srDescription:
        'Enable AI-generated voice narration for card reveals and full readings.',
      active: voiceOn,
      statusLabel: voiceOn ? 'On' : 'Muted',
      Icon: VoiceIcon,
      onToggle: value => setVoiceOn(value)
    },
    {
      id: 'ambience-toggle',
      label: 'Table ambience',
      tooltipContent:
        'Soft shuffle, candle crackle, and mystic room tone beneath your reading.',
      tooltipAria: 'About ambience soundscape',
      srDescription: 'Play soft background ambience sound during readings.',
      active: ambienceOn,
      statusLabel: ambienceOn ? 'Playing' : 'Muted',
      Icon: Music,
      onToggle: value => setAmbienceOn(value)
    },
    {
      id: 'theme-toggle',
      label: 'Light mode',
      tooltipContent:
        'Switch to a brighter palette if you prefer more contrast while reading.',
      tooltipAria: 'About light mode',
      srDescription: 'Toggle between dark and light theme.',
      active: theme === 'light',
      statusLabel: theme === 'light' ? 'Day' : 'Night',
      Icon: LightIcon,
      onToggle: value => setTheme(value ? 'light' : 'dark')
    },
    {
      id: 'deck-toggle',
      label: `Deck ${deckSize}`,
      tooltipContent:
        'Toggle the Minor Arcana to focus on archetypal majors or explore the full 78-card deck.',
      tooltipAria: 'About deck size',
      srDescription:
        'Toggle between the full 78-card deck and the Major Arcana-only deck.',
      active: includeMinors,
      statusLabel: deckStatusLabel,
      Icon: Layers,
      onToggle: value => setIncludeMinors?.(value)
    }
  ];

  return (
    <div className={`${controlShellClass} animate-fade-in`}>
      <div
        className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3"
        role="group"
        aria-label="Experience controls"
      >
        {toggleItems.map(item => {
          const ItemIcon = item.Icon;
          return (
            <React.Fragment key={item.id}>
              <label
                className={`${tileBaseClass} ${item.active ? activeTileClass : inactiveTileClass
                  } cursor-pointer`}
                htmlFor={item.id}
              >
                <input
                  id={item.id}
                  type="checkbox"
                  className="sr-only"
                  checked={item.active}
                  onChange={event => item.onToggle?.(event.target.checked)}
                  aria-describedby={`${item.id}-description`}
                />
                <div className="flex w-full items-center gap-2">
                  <span
                    className={`${iconWrapperBase} ${item.active ? activeIconWrapper : inactiveIconWrapper
                      }`}
                    aria-hidden="true"
                  >
                    <ItemIcon className="h-4 w-4" />
                  </span>
                  <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[0.75rem] normal-case tracking-normal">
                    <span className="truncate font-semibold text-main">
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
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`${badgeBaseClass} ${item.active ? activeBadgeClass : inactiveBadgeClass
                        } ${item.active ? 'animate-pulse' : ''}`}
                    >
                      {item.statusLabel}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`${switchTrackBase} ${item.active ? activeSwitchTrack : inactiveSwitchTrack
                        }`}
                    >
                      <span
                        className={`${switchThumbBase} ${item.active ? activeSwitchThumb : inactiveSwitchThumb
                          }`}
                      />
                    </span>
                  </div>
                </div>
              </label>
              <span id={`${item.id}-description`} className="sr-only">
                {item.srDescription}
              </span>
            </React.Fragment>
          );
        })}

        <div
          className={`${tileBaseClass} ${activeTileClass} col-span-1 sm:col-span-2 cursor-default`}
        >
          <div className="flex w-full items-center gap-3 text-[0.75rem] normal-case tracking-normal">
            <span className={`${iconWrapperBase} ${activeIconWrapper}`} aria-hidden="true">
              <RotateCcw className="h-4 w-4" />
            </span>
            <div className="flex flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-main">Reversal lens</span>
                <Tooltip
                  content="Choose how reversed cards are interpreted in AI narratives. Auto selects the best-fit lens for each spread."
                  position="top"
                  triggerClassName={infoButtonClass}
                  ariaLabel="About reversal lens options"
                >
                  <Info className="h-3.5 w-3.5" />
                </Tooltip>
              </div>
              <div className="flex flex-1 flex-wrap items-center gap-2 sm:flex-nowrap">
                <select
                  id="reversal-framework-select"
                  className={`${reversalSelectClass} appearance-none pr-10 sm:flex-1`}
                  value={reversalFramework || 'auto'}
                  onChange={event => {
                    const value = event.target.value === 'auto' ? null : event.target.value;
                    setReversalFramework(value);
                  }}
                  aria-describedby="reversal-description"
                >
                  <option value="auto">Auto (recommended)</option>
                  <option value="blocked">Blocked energy</option>
                  <option value="delayed">Timing & delays</option>
                  <option value="internalized">Internal process</option>
                  <option value="contextual">Context-based</option>
                </select>
                <span
                  className={`${badgeBaseClass} ${reversalFramework ? inactiveBadgeClass : activeBadgeClass
                    } ${!reversalFramework ? 'animate-pulse' : ''}`}
                >
                  {reversalFramework ? 'Custom' : 'Auto-rec'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <span id="reversal-description" className="sr-only">
        Choose how reversed cards are interpreted in AI-generated readings.
      </span>

      {reversalFramework && (
        <HelperToggle className="mt-2 max-w-xl">
          <div className="rounded-2xl border border-secondary/25 bg-secondary/5 px-3 py-2 text-[clamp(0.78rem,2vw,0.92rem)] leading-snug text-muted">
            {reversalFramework === 'blocked' && (
              <>
                <span className="font-semibold text-secondary">Blocked energy:</span>{' '}
                Reversed cards indicate obstructed, challenged, or resisted energy. The card's themes face barriers or opposition.
              </>
            )}
            {reversalFramework === 'delayed' && (
              <>
                <span className="font-semibold text-secondary">Timing & delays:</span>{' '}
                Reversed cards suggest the timing isn't right yet. Themes are emerging slowly or waiting for the right moment to manifest.
              </>
            )}
            {reversalFramework === 'internalized' && (
              <>
                <span className="font-semibold text-secondary">Internal process:</span>{' '}
                Reversed cards point to private, internal work. The card's energy is processing beneath the surface or kept within.
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
