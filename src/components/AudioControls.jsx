import React from 'react';
import { SpeakerHigh, SpeakerSlash, MusicNotes, Info } from '@phosphor-icons/react';
import { Tooltip } from './Tooltip';
import { usePreferences } from '../contexts/PreferencesContext';

/**
 * AudioControls - Unified audio settings panel
 * Groups Voice (TTS) and Ambience controls together
 */
export function AudioControls({ className = '' }) {
  const { voiceOn, setVoiceOn, ambienceOn, setAmbienceOn, autoNarrate, setAutoNarrate } = usePreferences();

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

  const VoiceIcon = voiceOn ? SpeakerHigh : SpeakerSlash;

  const audioToggles = [
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
      id: 'auto-narrate-toggle',
      label: 'Auto-narrate',
      tooltipContent: 'Automatically play narration as your reading streams in (first view only).',
      tooltipAria: 'About auto-narration with streaming',
      srDescription: 'Automatically start voice narration when a new reading appears.',
      active: autoNarrate,
      statusLabel: autoNarrate ? 'Auto' : 'Manual',
      Icon: SpeakerHigh,
      onToggle: value => setAutoNarrate(value)
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
      Icon: MusicNotes,
      onToggle: value => setAmbienceOn(value)
    }
  ];

  return (
    <div className={`${controlShellClass} ${className}`}>
      <div className="mb-3">
        <h3 className="text-xs sm:text-sm font-serif text-accent uppercase tracking-[0.12em] flex items-center gap-2">
          <SpeakerHigh className="w-4 h-4" aria-hidden="true" />
          Audio Settings
        </h3>
        <p className="text-[0.7rem] text-muted mt-1">Voice narration, auto-play, and ambient soundscape</p>
      </div>

      <div
        className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 sm:gap-3"
        role="group"
        aria-label="Audio controls"
      >
        {audioToggles.map(item => {
          const ItemIcon = item.Icon;
          return (
            <React.Fragment key={item.id}>
              <label
                className={`${tileBaseClass} ${
                  item.active ? activeTileClass : inactiveTileClass
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
                    className={`${iconWrapperBase} ${
                      item.active ? activeIconWrapper : inactiveIconWrapper
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
                      className={`${badgeBaseClass} ${
                        item.active ? activeBadgeClass : inactiveBadgeClass
                      } ${item.active ? 'animate-pulse' : ''}`}
                    >
                      {item.statusLabel}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`${switchTrackBase} ${
                        item.active ? activeSwitchTrack : inactiveSwitchTrack
                      }`}
                    >
                      <span
                        className={`${switchThumbBase} ${
                          item.active ? activeSwitchThumb : inactiveSwitchThumb
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
      </div>
    </div>
  );
}