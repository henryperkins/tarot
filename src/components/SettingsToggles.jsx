import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { Tooltip } from './Tooltip';
import { HelperToggle } from './HelperToggle';

export function SettingsToggles({
  voiceOn,
  setVoiceOn,
  ambienceOn,
  setAmbienceOn,
  reversalFramework,
  setReversalFramework,
  theme,
  setTheme
}) {
  const tileBaseClass =
    'block rounded-2xl border px-3 py-3 sm:px-4 bg-slate-900/70 cursor-pointer transition focus-within:ring-2 focus-within:ring-emerald-400/70 focus-within:ring-offset-2 focus-within:ring-offset-slate-950 min-h-[44px]';

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <label
            className={`${tileBaseClass} ${voiceOn ? 'border-emerald-400/50 shadow-inner shadow-emerald-900/30' : 'border-slate-700/60 hover:border-emerald-400/40'}`}
          >
            <input
              id="voice-toggle"
              type="checkbox"
              checked={voiceOn}
              onChange={event => setVoiceOn(event.target.checked)}
              aria-describedby="voice-description"
              className="sr-only"
            />
            <div className="flex flex-col gap-2">
              <div className="flex flex-col items-start gap-2 xs:flex-row xs:items-center xs:justify-between">
                <span className="text-amber-100/90 text-sm font-medium">Reader voice</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs-plus ${voiceOn ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200' : 'bg-slate-800/60 border-slate-600/60 text-slate-300'}`}>
                  {voiceOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                  {voiceOn ? 'Enabled' : 'Off'}
                </span>
              </div>
              <p className="text-[clamp(0.85rem,2.4vw,0.95rem)] leading-snug text-amber-100/70">
                Gentle narration for card flips and full readings.
              </p>
            </div>
          </label>
          <span id="voice-description" className="sr-only">
            Enable AI-generated voice narration for card reveals and full readings
          </span>
        </div>

        <div>
          <label
            className={`${tileBaseClass} ${ambienceOn ? 'border-emerald-400/50 shadow-inner shadow-emerald-900/30' : 'border-slate-700/60 hover:border-emerald-400/40'}`}
          >
            <input
              id="ambience-toggle"
              type="checkbox"
              checked={ambienceOn}
              onChange={event => setAmbienceOn(event.target.checked)}
              aria-describedby="ambience-description"
              className="sr-only"
            />
            <div className="flex flex-col gap-2">
              <div className="flex flex-col items-start gap-2 xs:flex-row xs:items-center xs:justify-between">
                <span className="text-amber-100/90 text-sm font-medium">Table ambience</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs-plus ${ambienceOn ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200' : 'bg-slate-800/60 border-slate-600/60 text-slate-300'}`}>
                  {ambienceOn ? 'Playing' : 'Muted'}
                </span>
              </div>
              <p className="text-[clamp(0.85rem,2.4vw,0.95rem)] leading-snug text-amber-100/70">
                Soft shuffle, candle crackle, and mystic room tone beneath your reading.
              </p>
            </div>
          </label>
          <span id="ambience-description" className="sr-only">
            Play soft background ambience sound during readings
          </span>
        </div>

        <div>
          <label
            className={`${tileBaseClass} ${theme === 'light' ? 'border-emerald-400/50 shadow-inner shadow-emerald-900/30' : 'border-slate-700/60 hover:border-emerald-400/40'}`}
          >
            <input
              id="theme-toggle"
              type="checkbox"
              checked={theme === 'light'}
              onChange={event => setTheme(event.target.checked ? 'light' : 'dark')}
              aria-describedby="theme-description"
              className="sr-only"
            />
            <div className="flex flex-col gap-2">
              <div className="flex flex-col items-start gap-2 xs:flex-row xs:items-center xs:justify-between">
                <span className="text-amber-100/90 text-sm font-medium">Light Mode</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs-plus ${theme === 'light' ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200' : 'bg-slate-800/60 border-slate-600/60 text-slate-300'}`}>
                  {theme === 'light' ? 'Enabled' : 'Off'}
                </span>
              </div>
              <p className="text-[clamp(0.85rem,2.4vw,0.95rem)] leading-snug text-amber-100/70">
                Switch to a lighter theme for better visibility.
              </p>
            </div>
          </label>
          <span id="theme-description" className="sr-only">
            Toggle between dark and light theme
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 space-y-3">
        <div className="flex items-center gap-2 text-amber-100/80 text-xs sm:text-sm">
          <div className="flex items-center gap-1">
            <label htmlFor="reversal-framework-select" className="whitespace-nowrap">
              Reversal lens (advanced):
            </label>
            <Tooltip
              content="Choose how reversed cards are interpreted in AI-generated readings. Auto lets the system choose a framework for you; each option offers an advanced lens for reading reversed cards."
              position="top"
            />
          </div>
          <select
            id="reversal-framework-select"
            className="bg-slate-900/80 border border-amber-500/40 rounded px-2 py-2 text-amber-100/90 text-xs sm:text-sm cursor-pointer w-full sm:w-auto"
            value={reversalFramework || 'auto'}
            onChange={e => {
              const value = e.target.value === 'auto' ? null : e.target.value;
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
        </div>
        <span id="reversal-description" className="sr-only">
          Choose how reversed cards are interpreted in AI-generated readings
        </span>
      </div>

      {reversalFramework && (
        <HelperToggle className="mt-2">
          <div className="text-amber-200/80 text-[clamp(0.8rem,2.2vw,0.95rem)] leading-snug bg-slate-900/40 rounded-lg px-3 py-2 border border-amber-500/20">
            {reversalFramework === 'blocked' && (
              <>
                <span className="font-semibold text-amber-300">Blocked energy:</span> Reversed cards indicate obstructed, challenged, or resisted energy. The card's themes face barriers or opposition.
              </>
            )}
            {reversalFramework === 'delayed' && (
              <>
                <span className="font-semibold text-amber-300">Timing & delays:</span> Reversed cards suggest the timing isn't right yet. Themes are emerging slowly or waiting for the right moment to manifest.
              </>
            )}
            {reversalFramework === 'internalized' && (
              <>
                <span className="font-semibold text-amber-300">Internal process:</span> Reversed cards point to private, internal work. The card's energy is processing beneath the surface or kept within.
              </>
            )}
            {reversalFramework === 'contextual' && (
              <>
                <span className="font-semibold text-amber-300">Context-based:</span> Reversed meanings adapt dynamically based on the card, position, and surrounding cards for nuanced interpretation.
              </>
            )}
          </div>
        </HelperToggle>
      )}
    </div>
  );
}
