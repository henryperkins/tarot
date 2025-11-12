import React from 'react';

export function SettingsToggles({ voiceOn, setVoiceOn, ttsAudioRef, ambienceOn, setAmbienceOn }) {
  return (
    <div className="flex flex-wrap items-center gap-4 mb-6">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={voiceOn}
          onChange={event => {
            const checked = event.target.checked;
            setVoiceOn(checked);
            if (!checked && ttsAudioRef.current) {
              ttsAudioRef.current.pause();
              ttsAudioRef.current = null;
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
    </div>
  );
}