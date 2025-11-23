/**
 * Centralized feature flag checking
 * 
 * Provides consistent feature flag evaluation across the application.
 * All environment-based feature flags should be checked through this hook.
 */

import { useMemo } from 'react';

export function useFeatureFlags() {
  const flags = useMemo(() => ({
    // Vision Research Mode
    visionResearch: import.meta.env?.VITE_ENABLE_VISION_RESEARCH === 'true',
    
    // Future flags can be added here
    // Example: betaFeatures: import.meta.env?.VITE_BETA_FEATURES === 'true',
  }), []);

  return flags;
}

/**
 * Direct feature flag check (for non-hook contexts)
 */
export function isVisionResearchEnabled() {
  return import.meta.env?.VITE_ENABLE_VISION_RESEARCH === 'true';
}