import { SpeakerHigh, SpeakerSlash, MusicNotes, Info } from '@phosphor-icons/react';
import { Tooltip } from './Tooltip';
import { GlowToggle } from './GlowToggle';
import { usePreferences } from '../contexts/PreferencesContext';

/**
 * AudioControls - Unified audio settings panel
 * Groups Voice (TTS) and Ambience controls together
 */
export function AudioControls({ className = '' }) {
  const { voiceOn, setVoiceOn, ambienceOn, setAmbienceOn, autoNarrate, setAutoNarrate } = usePreferences();

  const controlShellClass =
    'rounded-3xl border border-secondary/25 bg-surface/80 p-4 sm:p-5 shadow-md shadow-secondary/15 backdrop-blur-lg';
  const tileBaseClass =
    'group flex items-center gap-3 rounded-2xl border border-secondary/20 bg-surface/75 px-3 py-2.5 transition-colors duration-200 touch-manipulation';
  const activeTileClass =
    'border-secondary/50 bg-secondary/10 shadow-lg shadow-secondary/25';
  const inactiveTileClass = 'hover:border-accent/35 hover:bg-surface/80';

  const iconWrapperBase =
    'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border transition-colors duration-200';
  const activeIconWrapper =
    'border-secondary/60 bg-secondary/20 text-secondary shadow-md shadow-secondary/20';
  const inactiveIconWrapper =
    'border-accent/25 bg-surface/85 text-muted group-hover:text-main';

  // Info button - subtle icon, 44px touch target but no visible border
  const infoButtonClass =
    'inline-flex min-w-[44px] min-h-[44px] items-center justify-center rounded-full text-muted/60 transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 touch-manipulation -ml-2 -mr-3';

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
      Icon: VoiceIcon,
      onMessage: 'Narration will read card reveals and full readings.',
      offMessage: 'Voice narration stays muted.',
      onToggle: value => setVoiceOn(value),
      disabled: false
    },
    {
      id: 'auto-narrate-toggle',
      label: 'Auto-narrate',
      tooltipContent: voiceOn
        ? 'Automatically play narration as your reading streams in (first view only).'
        : 'Enable "Reader voice" first to use auto-narration.',
      tooltipAria: 'About auto-narration with streaming',
      srDescription: 'Automatically start voice narration when a new reading appears.',
      active: autoNarrate && voiceOn,
      Icon: SpeakerHigh,
      onMessage: 'Narration starts automatically with new readings.',
      offMessage: voiceOn ? "You'll tap \"Read this aloud\" manually." : 'Requires Reader voice to be enabled.',
      onToggle: value => setAutoNarrate(value),
      disabled: !voiceOn
    },
    {
      id: 'ambience-toggle',
      label: 'Table ambience',
      tooltipContent:
        'Soft shuffle, candle crackle, and mystic room tone beneath your reading.',
      tooltipAria: 'About ambience soundscape',
      srDescription: 'Play soft background ambience sound during readings.',
      active: ambienceOn,
      Icon: MusicNotes,
      onMessage: 'Ambient table sounds are playing.',
      offMessage: 'Ambient sounds are muted.',
      onToggle: value => setAmbienceOn(value),
      disabled: false
    }
  ];

  return (
    <div className={`${controlShellClass} ${className}`}>
      <div className="mb-3">
        <h3 className="flex items-center gap-2 font-serif text-xs uppercase tracking-[0.12em] text-accent sm:text-sm">
          <SpeakerHigh className="h-4 w-4" aria-hidden="true" />
          Audio Settings
        </h3>
        <p className="mt-1 text-[0.7rem] text-muted">
          Voice narration, auto-play, and ambient soundscape
        </p>
      </div>

      <div
        className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"
        role="group"
        aria-label="Audio controls"
      >
        {audioToggles.map(item => {
          const ItemIcon = item.Icon;
          const labelId = `${item.id}-label`;
          const descriptionId = `${item.id}-description`;

          return (
            <div
              key={item.id}
              className={`${tileBaseClass} ${item.active ? activeTileClass : inactiveTileClass} ${item.disabled ? 'opacity-50' : ''}`}
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
                  <span id={labelId} className={`text-sm font-semibold ${item.disabled ? 'text-muted' : 'text-main'}`}>
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
                disabled={item.disabled}
                labelId={labelId}
                describedBy={descriptionId}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}