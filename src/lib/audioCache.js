/**
 * Audio Cache for TTS responses
 * 
 * Caches short audio clips (phrases under a certain length) in memory
 * to avoid repeated API calls for common utterances.
 */

const MAX_CACHE_SIZE = 50;
const MAX_CACHEABLE_LENGTH = 200; // Only cache short phrases

class AudioCache {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Generate a cache key from text and emotion
   * @param {string} text - The text content
   * @param {string} emotion - The emotion/style applied
   * @returns {string} Cache key
   */
  _key(text, emotion) {
    return `${text}::${emotion || 'default'}`;
  }

  /**
   * Check if text is short enough to be cached
   * @param {string} text - Text to check
   * @returns {boolean} Whether the text can be cached
   */
  isCacheable(text) {
    return typeof text === 'string' && text.length <= MAX_CACHEABLE_LENGTH;
  }

  /**
   * Get cached audio for text
   * @param {string} text - The text
   * @param {string} emotion - The emotion applied
   * @returns {string|null} Data URL of cached audio, or null
   */
  get(text, emotion) {
    if (!this.isCacheable(text)) return null;
    const key = this._key(text, emotion);
    const entry = this.cache.get(key);
    if (entry) {
      // Move to end (LRU behavior)
      this.cache.delete(key);
      this.cache.set(key, entry);
      return entry;
    }
    return null;
  }

  /**
   * Store audio in cache
   * @param {string} text - The text
   * @param {string} emotion - The emotion applied
   * @param {string} audioDataUrl - Base64 data URL of the audio
   */
  set(text, emotion, audioDataUrl) {
    if (!this.isCacheable(text)) return;
    const key = this._key(text, emotion);
    
    // Evict oldest if at capacity
    if (this.cache.size >= MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    
    this.cache.set(key, audioDataUrl);
  }

  /**
   * Clear all cached audio
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get current cache size
   * @returns {number} Number of cached entries
   */
  get size() {
    return this.cache.size;
  }
}

export const audioCache = new AudioCache();
