/**
 * Hero's Journey Color Script
 * 
 * Dynamically shifts the visual palette based on narrative arc and emotional tone.
 * Creates a "kaleidoscopic adventure" that evolves as the reading progresses.
 * 
 * Narrative Phases:
 * - anticipation: Gathering tension before insight
 * - struggle: Challenge, inner turmoil (cool blues, deep greys)
 * - climax: Peak revelation surge (bright gold/white)
 * - revelation: Blossoming optimism (sunny yellows, warm saturated hues)
 * - resolution: Balance, stability (earthy browns, soft greens)
 */

export const COLOR_SCRIPTS = {
  anticipation: {
    name: 'The Anticipation',
    emotionalTone: 'build-up',
    palette: {
      primary: '#46528e',
      secondary: '#5c4f86',
      accent: '#7267b5',
      glow: '#6b61a8',
      warmth: 0.25,
      contrast: 1.25,
      saturation: 0.76
    },
    cssVars: {
      '--phase-color': '#46528e',
      '--phase-warmth': '0.25',
      '--phase-contrast': '1.25',
      '--phase-saturation': '0.76'
    },
    atmosphere: 'anticipation-depth'
  },

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

  climax: {
    name: 'The Climax',
    emotionalTone: 'breakthrough',
    palette: {
      primary: '#ffd369',
      secondary: '#fff2bf',
      accent: '#ffe9a8',
      glow: '#fff8df',
      warmth: 0.98,
      contrast: 1.35,
      saturation: 1.25
    },
    cssVars: {
      '--phase-color': '#ffd369',
      '--phase-warmth': '0.98',
      '--phase-contrast': '1.35',
      '--phase-saturation': '1.25'
    },
    atmosphere: 'climax-flash'
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
const ATMOSPHERE_CLASS_PREFIX = 'color-atmosphere--';
const DEFAULT_COLOR_SCRIPT_OWNER = 'default';

const activeColorScriptsByOwner = new Map();
const activeOwnerOrder = [];
let rootBaselineSnapshot = null;

function getAtmosphereClasses(root) {
  return Array.from(root.classList).filter((className) => className.startsWith(ATMOSPHERE_CLASS_PREFIX));
}

function normalizeOwner(ownerOrOptions) {
  if (typeof ownerOrOptions === 'string' && ownerOrOptions.trim()) {
    return ownerOrOptions.trim();
  }
  if (ownerOrOptions && typeof ownerOrOptions === 'object') {
    const owner = ownerOrOptions.owner;
    if (typeof owner === 'string' && owner.trim()) {
      return owner.trim();
    }
  }
  return DEFAULT_COLOR_SCRIPT_OWNER;
}

function captureRootBaseline(root) {
  const vars = {};
  ALL_COLOR_SCRIPT_VARS.forEach((property) => {
    vars[property] = root.style.getPropertyValue(property) || '';
  });
  return {
    vars,
    atmosphereClasses: getAtmosphereClasses(root)
  };
}

function applyScriptToRoot(root, colorScript, options = {}) {
  const scriptVars = colorScript?.cssVars || {};

  // Set variables immediately for deterministic behavior in runtime and tests.
  Object.entries(scriptVars).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });

  ALL_COLOR_SCRIPT_VARS.forEach((property) => {
    if (!Object.prototype.hasOwnProperty.call(scriptVars, property)) {
      root.style.removeProperty(property);
    }
  });

  getAtmosphereClasses(root).forEach((className) => {
    root.classList.remove(className);
  });
  if (colorScript?.atmosphere) {
    root.classList.add(`${ATMOSPHERE_CLASS_PREFIX}${colorScript.atmosphere}`);
  }
}

function restoreRootBaseline(root) {
  if (!rootBaselineSnapshot) return;

  ALL_COLOR_SCRIPT_VARS.forEach((property) => {
    const baselineValue = rootBaselineSnapshot?.vars?.[property] || '';
    if (baselineValue) {
      root.style.setProperty(property, baselineValue);
    } else {
      root.style.removeProperty(property);
    }
  });

  getAtmosphereClasses(root).forEach((className) => {
    root.classList.remove(className);
  });
  (rootBaselineSnapshot.atmosphereClasses || []).forEach((className) => {
    root.classList.add(className);
  });
}

/**
 * Determine color script from narrative analysis
 */
export function determineColorScript(narrativePhase, emotionalTone, reasoning) {
  // Default to anticipation for idle state (pre-reading tension)
  if (!narrativePhase || narrativePhase === 'idle') {
    return COLOR_SCRIPTS.anticipation;
  }

  // Check for explicit arc information in reasoning
  if (reasoning?.narrativeArc?.key) {
    const arcKey = reasoning.narrativeArc.key.toLowerCase();
    
    if (arcKey.includes('anticipation') || arcKey.includes('threshold') || arcKey.includes('awakening')) {
      return COLOR_SCRIPTS.anticipation;
    }

    if (arcKey.includes('struggle') || arcKey.includes('conflict') || arcKey.includes('shadow')) {
      return COLOR_SCRIPTS.struggle;
    }

    if (arcKey.includes('climax') || arcKey.includes('peak') || arcKey.includes('apex')) {
      return COLOR_SCRIPTS.climax;
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
    const anticipationEmotions = ['uncertain', 'anxious', 'anticipatory', 'curious', 'restless'];
    const struggleEmotions = ['conflicted', 'cautionary', 'grieving', 'weary', 'challenging'];
    const climaxEmotions = ['breakthrough', 'awestruck', 'ecstatic', 'transformed', 'illuminated'];
    const revelationEmotions = ['triumphant', 'hopeful', 'loving', 'inspiring', 'expansive'];
    const resolutionEmotions = ['grounded', 'peaceful', 'accepting', 'wise', 'serene'];

    if (anticipationEmotions.some(e => emotion.includes(e))) {
      return COLOR_SCRIPTS.anticipation;
    }

    if (struggleEmotions.some(e => emotion.includes(e))) {
      return COLOR_SCRIPTS.struggle;
    }

    if (climaxEmotions.some(e => emotion.includes(e))) {
      return COLOR_SCRIPTS.climax;
    }
    
    if (revelationEmotions.some(e => emotion.includes(e))) {
      return COLOR_SCRIPTS.revelation;
    }
    
    if (resolutionEmotions.some(e => emotion.includes(e))) {
      return COLOR_SCRIPTS.resolution;
    }
  }

  // Default based on narrative phase progression
  if (narrativePhase === 'anticipation' || narrativePhase === 'prelude') {
    return COLOR_SCRIPTS.anticipation;
  }

  if (narrativePhase === 'cards' || narrativePhase === 'tension' || narrativePhase === 'analysis') {
    return COLOR_SCRIPTS.struggle;
  }

  if (narrativePhase === 'climax' || narrativePhase === 'peak') {
    return COLOR_SCRIPTS.climax;
  }
  
  if (narrativePhase === 'synthesis' || narrativePhase === 'guidance' || narrativePhase === 'insight') {
    return COLOR_SCRIPTS.revelation;
  }

  if (narrativePhase === 'complete' || narrativePhase === 'resolution') {
    return COLOR_SCRIPTS.resolution;
  }

  return COLOR_SCRIPTS.neutral;
}

/**
 * Apply color script to document
 */
export function applyColorScript(colorScript, ownerOrOptions) {
  if (!colorScript || typeof document === 'undefined') return;

  const root = document.documentElement;
  const owner = normalizeOwner(ownerOrOptions);
  if (activeColorScriptsByOwner.size === 0) {
    rootBaselineSnapshot = captureRootBaseline(root);
  }

  activeColorScriptsByOwner.set(owner, colorScript);

  const existingIndex = activeOwnerOrder.indexOf(owner);
  if (existingIndex >= 0) {
    activeOwnerOrder.splice(existingIndex, 1);
  }
  activeOwnerOrder.push(owner);

  const animateTransition = ownerOrOptions && typeof ownerOrOptions === 'object'
    ? ownerOrOptions.animate !== false
    : true;
  const duration = ownerOrOptions && typeof ownerOrOptions === 'object'
    ? ownerOrOptions.duration
    : undefined;
  applyScriptToRoot(root, colorScript, { animate: animateTransition, duration });
}

/**
 * Remove color script (reset to default)
 */
export function resetColorScript(ownerOrOptions) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const owner = normalizeOwner(ownerOrOptions);

  if (activeColorScriptsByOwner.has(owner)) {
    activeColorScriptsByOwner.delete(owner);
    const index = activeOwnerOrder.indexOf(owner);
    if (index >= 0) {
      activeOwnerOrder.splice(index, 1);
    }
  }

  if (activeOwnerOrder.length > 0) {
    const activeOwner = activeOwnerOrder[activeOwnerOrder.length - 1];
    const activeScript = activeColorScriptsByOwner.get(activeOwner);
    if (activeScript) {
      applyScriptToRoot(root, activeScript);
      return;
    }
  }

  restoreRootBaseline(root);
  rootBaselineSnapshot = null;
}
