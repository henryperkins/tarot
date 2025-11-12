import React from 'react';
import { stopTTS } from '../lib/audio.js';

export function SettingsToggles({
  voiceOn,
  setVoiceOn,
  ambienceOn,
  setAmbienceOn,
  includeMinors,
  setIncludeMinors,
  minorsToggleDisabled
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 mb-6">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={voiceOn}
          onChange={event => {
            const checked = event.target.checked;
            setVoiceOn(checked);
            if (!checked) {
              stopTTS();
            }
          }}
          className="accent-amber-500"
        />
        <span className="text-amber-100/80 text-sm">Reader voice</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={ambienceOn}
          onChange={event => setAmbienceOn(event.target.checked)}
          className="accent-amber-500"
        />
        <span className="text-amber-100/80 text-sm">Table ambience</span>
      </label>
      <label
        className={`flex items-center gap-2 ${
          minorsToggleDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        <input
          type="checkbox"
          checked={!!includeMinors}
          onChange={e => {
            if (setIncludeMinors) setIncludeMinors(e.target.checked);
          }}
          className="accent-amber-500"
          disabled={!!minorsToggleDisabled}
        />
        <span className="text-amber-100/80 text-sm">Minors (beta)</span>
      </label>
    </div>
  );
}