/**
 * Hero's Journey Color Script
 * 
 * Dynamically shifts the visual palette based on narrative arc and emotional tone.
 * Creates a "kaleidoscopic adventure" that evolves as the reading progresses.
 * 
 * Narrative Phases:
 * - struggle: Challenge, inner turmoil (cool blues, deep greys)
 * - revelation: Blossoming optimism (sunny yellows, warm saturated hues)
 * - resolution: Balance, stability (earthy browns, soft greens)
 */

export const COLOR_SCRIPTS = {
  struggle: {
    name: 'The Struggle',
    emotionalTone: 'challenge',
    palette: {
      primary: '#4a6fa5',       // Cool blue
      secondary: '#5f6c7b',     // Steel grey
      accent: '#7b9cc7',        // Muted blue-grey
      glow: '#3d5a80',          // Deep blue
      warmth: 0.3,              // Cool temperature
      contrast: 1.2,            // High contrast
      saturation: 0.7           // Reduced saturation
    },
    cssVars: {
      '--phase-color': '#4a6fa5',
      '--phase-warmth': '0.3',
      '--phase-contrast': '1.2',
      '--phase-saturation': '0.7'
    },
    atmosphere: 'isolation-depth'
  },

  revelation: {
    name: 'The Revelation',
    emotionalTone: 'blossoming',
    palette: {
      primary: '#f6b756',       // Sunny yellow
      secondary: '#e89b3c',     // Warm gold
      accent: '#ffca7a',        // Light amber
      glow: '#ffd89b',          // Soft golden glow
      warmth: 0.9,              // Very warm
      contrast: 0.9,            // Softer contrast
      saturation: 1.1           // Enhanced saturation
    },
    cssVars: {
      '--phase-color': '#f6b756',
      '--phase-warmth': '0.9',
      '--phase-contrast': '0.9',
      '--phase-saturation': '1.1'
    },
    atmosphere: 'golden-hour-clarity'
  },

  resolution: {
    name: 'The Resolution',
    emotionalTone: 'balance',
    palette: {
      primary: '#7a9b76',       // Soft sage
      secondary: '#8b7355',     // Earthy brown
      accent: '#a8c69f',        // Light green
      glow: '#c4d7b2',          // Pale green glow
      warmth: 0.6,              // Balanced warmth
      contrast: 1.0,            // Neutral contrast
      saturation: 0.85          // Natural saturation
    },
    cssVars: {
      '--phase-color': '#7a9b76',
      '--phase-warmth': '0.6',
      '--phase-contrast': '1.0',
      '--phase-saturation': '0.85'
    },
    atmosphere: 'grounded-harmonious'
  },

  neutral: {
    name: 'Neutral',
    emotionalTone: 'default',
    palette: {
      primary: '#e5c48e',       // Default gold
      secondary: '#d4a574',     // Warm amber
      accent: '#f0d5a8',        // Light cream
      glow: '#f4d18c',          // Soft gold glow
      warmth: 0.7,              // Slightly warm
      contrast: 1.0,            // Default contrast
      saturation: 1.0           // Default saturation
    },
    cssVars: {
      '--phase-color': '#e5c48e',
      '--phase-warmth': '0.7',
      '--phase-contrast': '1.0',
      '--phase-saturation': '1.0'
    },
    atmosphere: 'default'
  }
};

const ALL_COLOR_SCRIPT_VARS = new Set(
  Object.values(COLOR_SCRIPTS).flatMap((script) => Object.keys(script?.cssVars || {}))
);

/**
 * Determine color script from narrative analysis
 */
export function determineColorScript(narrativePhase, emotionalTone, reasoning) {
  // Default to neutral
  if (!narrativePhase || narrativePhase === 'idle') {
    return COLOR_SCRIPTS.neutral;
  }

  // Check for explicit arc information in reasoning
  if (reasoning?.narrativeArc?.key) {
    const arcKey = reasoning.narrativeArc.key.toLowerCase();
    
    if (arcKey.includes('struggle') || arcKey.includes('conflict') || arcKey.includes('shadow')) {
      return COLOR_SCRIPTS.struggle;
    }
    
    if (arcKey.includes('revelation') || arcKey.includes('breakthrough') || arcKey.includes('illumination')) {
      return COLOR_SCRIPTS.revelation;
    }
    
    if (arcKey.includes('resolution') || arcKey.includes('integration') || arcKey.includes('balance')) {
      return COLOR_SCRIPTS.resolution;
    }
  }

  // Check emotional tone
  if (emotionalTone?.emotion) {
    const emotion = emotionalTone.emotion.toLowerCase();
    
    // Map emotional keywords to phases
    const struggleEmotions = ['conflicted', 'cautionary', 'grieving', 'weary', 'challenging'];
    const revelationEmotions = ['triumphant', 'hopeful', 'loving', 'inspiring', 'expansive'];
    const resolutionEmotions = ['grounded', 'peaceful', 'accepting', 'wise', 'serene'];

    if (struggleEmotions.some(e => emotion.includes(e))) {
      return COLOR_SCRIPTS.struggle;
    }
    
    if (revelationEmotions.some(e => emotion.includes(e))) {
      return COLOR_SCRIPTS.revelation;
    }
    
    if (resolutionEmotions.some(e => emotion.includes(e))) {
      return COLOR_SCRIPTS.resolution;
    }
  }

  // Default based on narrative phase progression
  if (narrativePhase === 'cards' || narrativePhase === 'tension') {
    return COLOR_SCRIPTS.struggle;
  }
  
  if (narrativePhase === 'synthesis' || narrativePhase === 'guidance') {
    return COLOR_SCRIPTS.resolution;
  }

  return COLOR_SCRIPTS.neutral;
}

/**
 * Apply color script to document
 */
export function applyColorScript(colorScript) {
  if (!colorScript || typeof document === 'undefined') return;

  const root = document.documentElement;
  const scriptVars = colorScript?.cssVars || {};
  
  // Apply CSS custom properties
  Object.entries(scriptVars).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });

  // Remove stale variables from prior scripts
  ALL_COLOR_SCRIPT_VARS.forEach((property) => {
    if (!Object.prototype.hasOwnProperty.call(scriptVars, property)) {
      root.style.removeProperty(property);
    }
  });

  // Add atmosphere class
  const atmosphereClass = `color-atmosphere--${colorScript.atmosphere}`;
  
  // Remove old atmosphere classes
  Array.from(root.classList).forEach(className => {
    if (className.startsWith('color-atmosphere--')) {
      root.classList.remove(className);
    }
  });
  
  // Add new atmosphere class
  root.classList.add(atmosphereClass);
}

/**
 * Remove color script (reset to default)
 */
export function resetColorScript() {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  
  // Reset CSS variables
  ALL_COLOR_SCRIPT_VARS.forEach((property) => {
    root.style.removeProperty(property);
  });

  // Remove atmosphere classes
  Array.from(root.classList).forEach(className => {
    if (className.startsWith('color-atmosphere--')) {
      root.classList.remove(className);
    }
  });
}
