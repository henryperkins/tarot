import { useState, useEffect } from 'react';
import { 
  SpeakerHigh, 
  SpeakerSlash, 
  Play, 
  Pause, 
  Stop 
} from '@phosphor-icons/react';
import { 
  speakWithHume, 
  stopHumeAudio, 
  isHumeTTSAvailable,
  HUME_VOICES 
} from '../lib/audioHume';

/**
 * HumeAudioControls Component
 * 
 * Provides UI controls for Hume AI Octave TTS functionality in tarot readings.
 * Allows users to select voices, adjust speed, and control playback.
 */
export default function HumeAudioControls({ 
  readingText, 
  context = 'full-reading',
  onPlaybackStart,
  onPlaybackEnd,
  className = ''
}) {
  const [availability, setAvailability] = useState({ checked: false, ok: false });
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('ITO');
  const [speed, setSpeed] = useState(1.0);
  const [currentAudio, setCurrentAudio] = useState(null);
  const [error, setError] = useState(null);

  // Check if Hume TTS is available on mount
  useEffect(() => {
    let isMounted = true;
    isHumeTTSAvailable()
      .then(ok => { if (isMounted) setAvailability({ checked: true, ok }); })
      .catch(() => { if (isMounted) setAvailability({ checked: true, ok: false }); });
    return () => { isMounted = false; };
  }, []);

  const handlePlay = async () => {
    if (!readingText) {
      setError('No text to read');
      return;
    }

    try {
      setError(null);
      setIsPlaying(true);
      
      if (onPlaybackStart) {
        onPlaybackStart();
      }

      const result = await speakWithHume(readingText, {
        context,
        voiceName: selectedVoice,
        speed
      });

      setCurrentAudio(result);

      // Play the audio
      await result.play();

      // Handle audio end
      result.audio.onended = () => {
        setIsPlaying(false);
        if (onPlaybackEnd) {
          onPlaybackEnd();
        }
      };

      // Handle audio errors
      result.audio.onerror = (e) => {
        console.error('Audio playback error:', e);
        setError('Audio playback failed');
        setIsPlaying(false);
      };

    } catch (err) {
      console.error('Hume TTS error:', err);
      setError(err.message || 'Failed to generate speech');
      setIsPlaying(false);
    }
  };

  const handlePause = () => {
    if (currentAudio) {
      currentAudio.pause();
      setIsPlaying(false);
    }
  };

  const handleStop = () => {
    stopHumeAudio();
    setCurrentAudio(null);
    setIsPlaying(false);
  };

  if (!availability.checked) {
    return (
      <div className={`text-sm text-gray-500 ${className}`}>
        Checking Hume voice…
      </div>
    );
  }

  if (!availability.ok) {
    return (
      <div className={`text-sm text-gray-500 ${className}`}>
        <SpeakerSlash className="inline mr-2" size={16} />
        Hume AI voice not configured
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center">
          <SpeakerHigh className="mr-2" size={20} />
          Mystical Voice Reading
        </h3>
      </div>

      {error && (
        <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded">
          {error}
        </div>
      )}

      {/* Voice Selection */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          Voice
        </label>
        <select
          value={selectedVoice}
          onChange={(e) => setSelectedVoice(e.target.value)}
          disabled={isPlaying}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md 
                   bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                   focus:ring-2 focus:ring-purple-500 focus:border-transparent
                   disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <optgroup label="Mystical (Recommended)">
            {HUME_VOICES.mystical.map(voice => (
              <option key={voice} value={voice}>{voice}</option>
            ))}
          </optgroup>
          <optgroup label="Narrators">
            {HUME_VOICES.narrators.map(voice => (
              <option key={voice} value={voice}>{voice}</option>
            ))}
          </optgroup>
          <optgroup label="Conversational">
            {HUME_VOICES.conversational.map(voice => (
              <option key={voice} value={voice}>{voice}</option>
            ))}
          </optgroup>
          <optgroup label="Dramatic">
            {HUME_VOICES.dramatic.map(voice => (
              <option key={voice} value={voice}>{voice}</option>
            ))}
          </optgroup>
        </select>
      </div>

      {/* Speed Control */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          Speed: {speed.toFixed(1)}x
        </label>
        <input
          type="range"
          min="0.5"
          max="2.0"
          step="0.1"
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
          disabled={isPlaying}
          className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer
                   disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
          <span>Slower</span>
          <span>Faster</span>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="flex gap-2">
        {!isPlaying ? (
          <button
            onClick={handlePlay}
            disabled={!readingText}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 
                     bg-purple-600 hover:bg-purple-700 text-white rounded-md
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors duration-200"
          >
            <Play size={16} weight="fill" />
            <span className="text-sm font-medium">Listen to Reading</span>
          </button>
        ) : (
          <>
            <button
              onClick={handlePause}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 
                       bg-amber-600 hover:bg-amber-700 text-white rounded-md
                       transition-colors duration-200"
            >
              <Pause size={16} weight="fill" />
              <span className="text-sm font-medium">Pause</span>
            </button>
            <button
              onClick={handleStop}
              className="flex items-center justify-center gap-2 px-4 py-2 
                       bg-gray-600 hover:bg-gray-700 text-white rounded-md
                       transition-colors duration-200"
            >
              <Stop size={16} weight="fill" />
            </button>
          </>
        )}
      </div>

      {/* Info Text */}
      <p className="mt-3 text-xs text-gray-600 dark:text-gray-400 text-center">
        Powered by Hume AI&apos;s Octave TTS
      </p>
    </div>
  );
}
