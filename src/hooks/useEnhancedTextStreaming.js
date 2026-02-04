import { useCallback, useRef, useEffect } from 'react';

/**
 * Element-based atmosphere triggers for visual/audio responses
 * Matches keywords in streaming text to trigger environmental changes
 */
export const ELEMENT_TRIGGERS = {
  fire: {
    keywords: ['passion', 'burn', 'desire', 'energy', 'drive', 'action', 'spark'],
    palette: { hue: 'red-amber', warmth: 'high', intensity: 'bright' },
    audioLayer: 'crackling-warmth'
  },
  water: {
    keywords: ['emotion', 'flow', 'intuition', 'feeling', 'depth', 'tide', 'current'],
    palette: { hue: 'blue', warmth: 'cool', intensity: 'soft' },
    audioLayer: 'gentle-waves'
  },
  air: {
    keywords: ['thought', 'clarity', 'truth', 'mind', 'communication', 'breath', 'perspective'],
    palette: { hue: 'violet-sky', warmth: 'neutral', intensity: 'clear' },
    audioLayer: 'wind-whispers'
  },
  earth: {
    keywords: ['root', 'body', 'stability', 'ground', 'material', 'foundation', 'solid'],
    palette: { hue: 'brown-green', warmth: 'medium', intensity: 'grounded' },
    audioLayer: 'forest-ambience'
  }
};

/**
 * Enhanced Text Streaming Hook with Locale-Sensitive Segmentation
 * 
 * Uses Intl.Segmenter API for proper text segmentation based on locale,
 * ensuring text reveals in coherent units (words or sentences) rather than
 * arbitrary token chunks.
 * 
 * Also includes regex-based element detection for atmospheric triggers.
 * 
 * NOTE: This hook is currently prepared for future integration into the
 * StreamingNarrative component. It provides the foundation for locale-aware
 * text streaming and element-based atmosphere detection but is not yet
 * actively used in the codebase. See Phase 3 implementation plan in
 * docs/cinematic-enhancements.md for integration details.
 */
export function useEnhancedTextStreaming({
  onElementDetected,
  locale = 'en',
  granularity = 'word',
  baseDelayMs = 45,
  punctuationDelayMs = 160,
  elementCooldownMs = 10000
} = {}) {
  const segmenterRef = useRef(null);
  const elementDetectionBufferRef = useRef('');
  const lastDetectedElementRef = useRef(null);

  // Initialize Intl.Segmenter (with fallback for older browsers)
  useEffect(() => {
    if (typeof Intl?.Segmenter === 'function') {
      try {
        segmenterRef.current = new Intl.Segmenter(locale, { granularity });
      } catch (err) {
        console.warn('Intl.Segmenter initialization failed:', err);
        segmenterRef.current = null;
      }
    }
  }, [locale, granularity]);

  /**
   * Segment text into locale-aware units
   */
  const segmentText = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];

    // Use Intl.Segmenter if available
    if (segmenterRef.current) {
      const segments = segmenterRef.current.segment(text);
      return Array.from(segments).map(s => s.segment);
    }

    // Fallback: split by spaces/punctuation
    if (granularity === 'word') {
      return text.split(/(\s+)/).filter(Boolean);
    } else if (granularity === 'sentence') {
      return text.split(/([.!?]+\s+)/).filter(Boolean);
    }

    return [text];
  }, [granularity]);

  /**
   * Detect element triggers in streaming text
   */
  const detectElementTriggers = useCallback((text) => {
    if (!text || typeof onElementDetected !== 'function') return;

    // Add to detection buffer
    elementDetectionBufferRef.current += ' ' + text.toLowerCase();
    
    // Keep buffer manageable (last 200 chars)
    if (elementDetectionBufferRef.current.length > 200) {
      elementDetectionBufferRef.current = elementDetectionBufferRef.current.slice(-200);
    }

    const buffer = elementDetectionBufferRef.current;

    // Check each element for keyword matches
    for (const [element, config] of Object.entries(ELEMENT_TRIGGERS)) {
      // Skip if this element was recently detected (avoid spam)
      if (lastDetectedElementRef.current === element) continue;

      // Check if any keyword appears in buffer (with word boundaries)
      const hasMatch = config.keywords.some(keyword => {
        const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'i');
        return regex.test(buffer);
      });

      if (hasMatch) {
        lastDetectedElementRef.current = element;
        onElementDetected(element, config);

        // Reset detection buffer after trigger
        elementDetectionBufferRef.current = '';
        
        // Allow re-detection after configurable delay
        setTimeout(() => {
          if (lastDetectedElementRef.current === element) {
            lastDetectedElementRef.current = null;
          }
        }, elementCooldownMs); // Configurable cooldown

        break; // Only trigger one element at a time
      }
    }
  }, [onElementDetected]);

  /**
   * Calculate delay for a text segment
   */
  const calculateSegmentDelay = useCallback((segment) => {
    if (!segment) return baseDelayMs;

    // Add extra delay for punctuation
    const hasPunctuation = /[.!?,;:]/.test(segment);
    const extraDelay = hasPunctuation ? punctuationDelayMs : 0;

    return baseDelayMs + extraDelay;
  }, [baseDelayMs, punctuationDelayMs]);

  /**
   * Reset element detection state
   */
  const resetElementDetection = useCallback(() => {
    elementDetectionBufferRef.current = '';
    lastDetectedElementRef.current = null;
  }, []);

  return {
    segmentText,
    detectElementTriggers,
    calculateSegmentDelay,
    resetElementDetection,
    hasSegmenter: !!segmenterRef.current
  };
}
