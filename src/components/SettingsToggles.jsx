import React, { useState } from 'react';
import { Volume2, VolumeX, ChevronDown, ChevronUp } from 'lucide-react';
import { Tooltip } from './Tooltip';

export function SettingsToggles({
  voiceOn,
  setVoiceOn,
  ambienceOn,
  setAmbienceOn,
  reversalFramework,
  setReversalFramework
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="space-y-3">
      {/* Mobile: Collapsible header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="md:hidden w-full flex items-center justify-between p-3 bg-slate-900/60 rounded-lg border border-amber-500/30 hover:bg-slate-900/80 transition"
        aria-expanded={isExpanded}
        aria-controls="settings-content"
      >
        <span className="text-amber-200 font-serif text-sm">Experience Settings</span>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-amber-300" /> : <ChevronDown className="w-4 h-4 text-amber-300" />}
      </button>

      {/* Settings content - always visible on desktop, collapsible on mobile */}
      <div
        id="settings-content"
        className={`space-y-3 ${isExpanded ? 'block' : 'hidden md:block'}`}
      >
      <div className="flex flex-wrap items-center gap-4">
      {/* Voice Toggle */}
      <div className="flex items-center gap-2">
        <input
          id="voice-toggle"
          type="checkbox"
          checked={voiceOn}
          onChange={event => setVoiceOn(event.target.checked)}
          aria-describedby="voice-description"
        />
        <label htmlFor="voice-toggle" className="text-amber-100/80 text-sm cursor-pointer select-none">
          Reader voice
        </label>
        {/* Voice Status Indicator */}
        {voiceOn ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-[10px] font-medium">
            <Volume2 className="w-3 h-3" />
            Enabled
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800/50 border border-slate-600/40 text-slate-400 text-[10px] font-medium">
            <VolumeX className="w-3 h-3" />
            Off
          </span>
        )}
        <span id="voice-description" className="sr-only">
          Enable AI-generated voice narration for card reveals and full readings
        </span>
      </div>

      {/* Ambience Toggle */}
      <div className="flex items-center gap-2">
        <input
          id="ambience-toggle"
          type="checkbox"
          checked={ambienceOn}
          onChange={event => setAmbienceOn(event.target.checked)}
          aria-describedby="ambience-description"
        />
        <label htmlFor="ambience-toggle" className="text-amber-100/80 text-sm cursor-pointer select-none">
          Table ambience
        </label>
        <span id="ambience-description" className="sr-only">
          Play soft background ambience sound during readings
        </span>
      </div>

      {/* Reversal Framework Selector */}
      <div className="flex items-center gap-2 text-amber-100/80 text-xs sm:text-sm">
        <div className="flex items-center gap-1">
          <label htmlFor="reversal-framework-select" className="whitespace-nowrap">
            Reversals:
          </label>
          <Tooltip
            content="Choose how reversed cards are interpreted. Auto lets AI pick the best framework for your spread. Each option offers a different lens for reading reversed cards."
            position="top"
          />
        </div>
        <select
          id="reversal-framework-select"
          className="bg-slate-900/80 border border-amber-500/40 rounded px-2 py-1 text-amber-100/90 text-xs sm:text-sm cursor-pointer"
          value={reversalFramework || 'auto'}
          onChange={e => {
            const value = e.target.value === 'auto' ? null : e.target.value;
            setReversalFramework(value);
          }}
          aria-describedby="reversal-description reversal-hint"
        >
          <option value="auto">Auto (recommended)</option>
          <option value="blocked">Blocked energy</option>
          <option value="delayed">Timing & delays</option>
          <option value="internalized">Internal process</option>
          <option value="contextual">Context-based</option>
        </select>
        <span id="reversal-description" className="sr-only">
          Choose how reversed cards are interpreted in AI-generated readings
        </span>
      </div>
      </div>

      {/* Reversal Framework Explanation */}
      {reversalFramework && (
        <div id="reversal-hint" className="text-amber-200/80 text-xs leading-relaxed bg-slate-900/40 rounded-lg px-3 py-2 border border-amber-500/20">
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
      )}
      </div>
    </div>
  );
}