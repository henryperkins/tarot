import { SpeakerHigh, SpeakerSlash, MusicNotes, Info, Waveform, Gauge } from '@phosphor-icons/react';
import { Tooltip } from './Tooltip';
import { GlowToggle } from './GlowToggle';
import { usePreferences } from '../contexts/PreferencesContext';

/**
 * AudioControls - Unified audio settings panel
 * Groups Voice (TTS) and Ambience controls together
 */
export function AudioControls({ className = '' }) {
  const { voiceOn, setVoiceOn, ambienceOn, setAmbienceOn, autoNarrate, setAutoNarrate, ttsProvider, setTtsProvider, ttsSpeed, setTtsSpeed } = usePreferences();

  const controlShellClass =
    'rounded-3xl border border-secondary/25 bg-surface/80 p-3 xs:p-4 sm:p-5 shadow-md shadow-secondary/15 backdrop-blur-lg';
  const tileBaseClass =
    'group flex items-center gap-2 xs:gap-3 rounded-2xl border border-secondary/20 bg-surface/75 px-3 py-2 xs:py-2.5 transition-colors duration-200 touch-manipulation min-h-nav';
  const activeTileClass =
    'border-secondary/50 bg-secondary/10 shadow-lg shadow-secondary/25';
  const inactiveTileClass = 'hover:border-accent/35 hover:bg-surface/80';

  const iconWrapperBase =
    'flex h-8 w-8 xs:h-9 xs:w-9 flex-shrink-0 items-center justify-center rounded-xl border transition-colors duration-200';
  const activeIconWrapper =
    'border-secondary/60 bg-secondary/20 text-secondary shadow-md shadow-secondary/20';
  const inactiveIconWrapper =
    'border-accent/25 bg-surface/85 text-muted group-hover:text-main';

  // Info button - subtle icon, 44px touch target but no visible border
  const infoButtonClass =
    'inline-flex min-w-touch min-h-touch items-center justify-center rounded-full text-muted/60 transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 touch-manipulation -ml-2 -mr-3';

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
        <p className="mt-1 text-2xs text-muted">
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

      {/* Voice Engine Selector */}
      {voiceOn && (
        <div className="mt-3 xs:mt-4 pt-3 xs:pt-4 border-t border-secondary/20">
          <div className="flex items-center gap-2 mb-2">
            <Waveform className="h-4 w-4 text-accent" aria-hidden="true" />
            <span className="text-xs font-semibold text-accent uppercase tracking-wide">Voice Engine</span>
            <Tooltip
              content="Hume AI offers expressive voices. Azure provides clear narration, and Azure SDK adds word-by-word highlighting."
              position="top"
              triggerClassName={infoButtonClass}
              ariaLabel="About voice engine options"
            >
              <Info className="h-3.5 w-3.5" />
            </Tooltip>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-2" role="radiogroup" aria-label="Select voice engine">
            <button
              type="button"
              role="radio"
              aria-checked={ttsProvider === 'hume'}
              onClick={() => setTtsProvider('hume')}
              className={`flex-1 min-h-cta px-2 xs:px-3 py-2 rounded-xl text-sm font-medium transition-all touch-manipulation ${
                ttsProvider === 'hume'
                  ? 'bg-primary/20 border-2 border-primary text-primary shadow-md'
                  : 'bg-surface/60 border border-secondary/30 text-muted hover:text-main hover:border-secondary/50 active:bg-surface/80'
              }`}
            >
              <span className="block font-semibold text-xs xs:text-sm">Hume AI</span>
              <span className="block text-2xs xs:text-xs opacity-75">Expressive</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={ttsProvider === 'azure'}
              onClick={() => setTtsProvider('azure')}
              className={`flex-1 min-h-cta px-2 xs:px-3 py-2 rounded-xl text-sm font-medium transition-all touch-manipulation ${
                ttsProvider === 'azure'
                  ? 'bg-primary/20 border-2 border-primary text-primary shadow-md'
                  : 'bg-surface/60 border border-secondary/30 text-muted hover:text-main hover:border-secondary/50 active:bg-surface/80'
              }`}
            >
              <span className="block font-semibold text-xs xs:text-sm">Azure</span>
              <span className="block text-2xs xs:text-xs opacity-75">Clear</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={ttsProvider === 'azure-sdk'}
              onClick={() => setTtsProvider('azure-sdk')}
              className={`flex-1 min-h-cta px-2 xs:px-3 py-2 rounded-xl text-sm font-medium transition-all touch-manipulation ${
                ttsProvider === 'azure-sdk'
                  ? 'bg-primary/20 border-2 border-primary text-primary shadow-md'
                  : 'bg-surface/60 border border-secondary/30 text-muted hover:text-main hover:border-secondary/50 active:bg-surface/80'
              }`}
            >
              <span className="block font-semibold text-xs xs:text-sm">Azure SDK</span>
              <span className="block text-2xs xs:text-xs opacity-75">Word sync</span>
            </button>
          </div>
        </div>
      )}

      {/* Speed Control - only for Azure provider */}
      {voiceOn && ttsProvider === 'azure' && (
        <div className="mt-3 xs:mt-4 pt-3 xs:pt-4 border-t border-secondary/20">
          <div className="flex items-center gap-2 mb-2">
            <Gauge className="h-4 w-4 text-accent" aria-hidden="true" />
            <span className="text-xs font-semibold text-accent uppercase tracking-wide">Narration Speed</span>
            <Tooltip
              content="Adjust how fast the voice reads your narrative. Slower for contemplation, faster for reviewing."
              position="top"
              triggerClassName={infoButtonClass}
              ariaLabel="About narration speed"
            >
              <Info className="h-3.5 w-3.5" />
            </Tooltip>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-2" role="radiogroup" aria-label="Select narration speed">
            {[
              { value: 0.85, label: 'Slower', desc: 'Contemplative' },
              { value: 1.0, label: 'Normal', desc: 'Default' },
              { value: 1.15, label: 'Faster', desc: 'Efficient' }
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={ttsSpeed === opt.value}
                onClick={() => setTtsSpeed(opt.value)}
                className={`flex-1 min-h-cta px-2 xs:px-3 py-2 rounded-xl text-sm font-medium transition-all touch-manipulation ${
                  ttsSpeed === opt.value
                    ? 'bg-primary/20 border-2 border-primary text-primary shadow-md'
                    : 'bg-surface/60 border border-secondary/30 text-muted hover:text-main hover:border-secondary/50 active:bg-surface/80'
                }`}
              >
                <span className="block font-semibold text-xs xs:text-sm">{opt.label}</span>
                <span className="block text-2xs xs:text-xs opacity-75">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
