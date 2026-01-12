import { useState, useMemo, useCallback } from 'react';
import { canonicalCardKey } from '../../shared/vision/cardNameMapping.js';
import { usePreferences } from '../contexts/PreferencesContext';
import { generateId } from '../lib/utils';
import { isVisionResearchEnabled } from './useFeatureFlags';

const MAX_VISION_UPLOADS = 5;

const getVisionConflictsForCards = (cardsInfoList = [], results = [], deckStyle = 'rws-1909') => {
  if (!Array.isArray(results) || results.length === 0) return [];
  const normalizedDeck = deckStyle || 'rws-1909';
  const cardKeys = new Set(
    cardsInfoList
      .map(card => {
        if (card?.canonicalKey) {
          return card.canonicalKey;
        }
        const candidateName = card?.canonicalName || card?.card || card?.name;
        return canonicalCardKey(candidateName, normalizedDeck);
      })
      .filter(Boolean)
  );
  if (cardKeys.size === 0) return [];
  return results.filter(result => {
    const candidateKey = canonicalCardKey(
      result?.predictedCard || result?.topMatch?.cardName || result?.matches?.[0]?.cardName,
      normalizedDeck
    );
    return candidateKey && !cardKeys.has(candidateKey);
  });
};

const summarizeVisionInsights = (insights = []) => {
  if (!Array.isArray(insights) || insights.length === 0) {
    return null;
  }
  const uploads = insights.length;
  const avgConfidence = insights.reduce((sum, entry) => sum + (entry.confidence ?? 0), 0) / uploads;
  const focusedSymbols = insights.reduce((sum, entry) => {
    if (!Array.isArray(entry.attention?.symbolAlignment)) {
      return sum;
    }
    return sum + entry.attention.symbolAlignment.filter((symbol) => symbol.isModelFocused).length;
  }, 0);
  const symbolMatchSamples = insights.filter((entry) => typeof entry.symbolVerification?.matchRate === 'number');
  const avgSymbolMatch = symbolMatchSamples.length > 0
    ? symbolMatchSamples.reduce((sum, entry) => sum + entry.symbolVerification.matchRate, 0) / symbolMatchSamples.length
    : null;
  return {
    uploads,
    avgConfidence,
    focusedSymbols,
    avgSymbolMatch
  };
};

let anonymousVisionLabelCounter = 0;

const deriveVisionLabel = (entry) => {
  if (entry?.label && entry.label.trim()) {
    return entry.label.trim();
  }
  if (entry?.userFile?.name && entry.userFile.name.trim()) {
    return entry.userFile.name.trim();
  }
  if (entry?.imagePath && typeof entry.imagePath === 'string' && entry.imagePath.trim()) {
    return entry.imagePath.trim();
  }
  if (entry?.topMatch?.cardName) {
    return `uploaded-${entry.topMatch.cardName}`;
  }
  anonymousVisionLabelCounter += 1;
  return `uploaded-image-${anonymousVisionLabelCounter}`;
};

const normalizeVisionEntry = (entry) => {
  if (!entry || typeof entry !== 'object') return null;
  const normalizedLabel = deriveVisionLabel(entry);
  const uploadId = entry.uploadId || entry?.userFile?.__visionUploadId || generateId('vision-upload');
  return {
    ...entry,
    label: normalizedLabel,
    uploadId
  };
};

const mergeVisionResults = (existing = [], incoming = []) => {
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return existing;
  }

  const map = new Map();

  const addBatch = (batch) => {
    batch.forEach((item) => {
      const normalized = normalizeVisionEntry(item);
      if (!normalized) return;
      map.set(normalized.uploadId, normalized);
    });
  };

  addBatch(existing);
  addBatch(incoming);

  const merged = Array.from(map.values());
  return merged.slice(-MAX_VISION_UPLOADS);
};

export function useVisionAnalysis(reading = []) {
  const { deckStyleId } = usePreferences();
  const [visionResults, setVisionResults] = useState([]);
  const [visionConflicts, setVisionConflicts] = useState([]);
  const [visionProof, setVisionProof] = useState(null);
  const [visionSummarySnapshot, setVisionSummarySnapshot] = useState(null);

  const visionResearchEnabled = isVisionResearchEnabled();
  const isVisionReady = visionResearchEnabled && visionResults.length > 0 && visionConflicts.length === 0;
  const hasVisionData = visionResearchEnabled && visionResults.length > 0;

  const liveVisionSummary = useMemo(() => {
    if (!visionResearchEnabled || !visionResults.length) return null;
    const uploads = visionResults.length;
    const avgConfidence = visionResults.reduce((sum, entry) => sum + (entry.confidence ?? 0), 0) / uploads;
    const focusedSymbols = visionResults.reduce((sum, entry) => {
      if (!Array.isArray(entry.attention?.symbolAlignment)) {
        return sum;
      }
      const focused = entry.attention.symbolAlignment.filter((symbol) => symbol.isModelFocused).length;
      return sum + focused;
    }, 0);
    const symbolMatchSamples = visionResults.filter((entry) => typeof entry.symbolVerification?.matchRate === 'number');
    const avgSymbolMatch = symbolMatchSamples.length > 0
      ? symbolMatchSamples.reduce((sum, entry) => sum + entry.symbolVerification.matchRate, 0) / symbolMatchSamples.length
      : null;
    return {
      uploads,
      avgConfidence,
      focusedSymbols,
      avgSymbolMatch
    };
  }, [visionResults, visionResearchEnabled]);

  const feedbackVisionSummary = visionResearchEnabled ? (visionSummarySnapshot || liveVisionSummary) : null;

  const resetVisionProof = useCallback(() => {
    setVisionProof(null);
    setVisionSummarySnapshot(null);
  }, []);

  const handleVisionResults = useCallback((results) => {
    if (!visionResearchEnabled || !Array.isArray(results) || results.length === 0) {
      return;
    }

    resetVisionProof();
    setVisionResults((prev) => {
      const merged = mergeVisionResults(prev, results);
      if (Array.isArray(reading) && reading.length) {
        setVisionConflicts(getVisionConflictsForCards(reading, merged, deckStyleId));
      } else {
        setVisionConflicts([]);
      }
      return merged;
    });
  }, [reading, deckStyleId, resetVisionProof, visionResearchEnabled]);

  const handleRemoveVisionResult = useCallback((label) => {
    if (!visionResearchEnabled || !label) return;
    resetVisionProof();
    setVisionResults((prev) => {
      const filtered = prev.filter((entry) => {
        if (entry.uploadId) {
          return entry.uploadId !== label;
        }
        return entry.label?.toLowerCase() !== label.toLowerCase();
      });
      if (Array.isArray(reading) && reading.length && filtered.length) {
        setVisionConflicts(getVisionConflictsForCards(reading, filtered, deckStyleId));
      } else {
        setVisionConflicts([]);
      }
      return filtered;
    });
  }, [reading, deckStyleId, resetVisionProof, visionResearchEnabled]);

  const handleClearVisionResults = useCallback(() => {
    if (!visionResearchEnabled) return;
    resetVisionProof();
    setVisionResults([]);
    setVisionConflicts([]);
  }, [resetVisionProof, visionResearchEnabled]);

  const ensureVisionProof = useCallback(async () => {
    const now = Date.now();
    if (visionProof?.expiresAt && Date.parse(visionProof.expiresAt) > now + 2000) {
      return visionProof;
    }
    const evidence = visionResults
      .slice(0, 5)
      .map((entry) => ({
        label: entry.label,
        dataUrl: entry.dataUrl
      }))
      .filter((entry) => typeof entry.dataUrl === 'string' && entry.dataUrl.startsWith('data:'));

    if (evidence.length === 0) {
      throw new Error('Vision uploads missing photo data. Please re-upload the drawn cards.');
    }

    const response = await fetch('/api/vision-proof', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deckStyle: deckStyleId, evidence })
    });

    if (!response.ok) {
      let message = 'Unable to verify card photos. Please try again.';
      try {
        const payload = await response.json();
        if (payload?.error) {
          message = payload.error;
        }
      } catch (err) {
        console.debug('vision-proof parse failed:', err);
      }
      throw new Error(message);
    }

    const data = await response.json();
    if (!data?.proof) {
      throw new Error('Vision verification response malformed.');
    }
    setVisionProof(data.proof);
    setVisionSummarySnapshot(summarizeVisionInsights(data.proof.insights));
    return data.proof;
  }, [deckStyleId, visionProof, visionResults]);

  const checkConflicts = useCallback((cardsInfo) => {
    const conflicts = getVisionConflictsForCards(cardsInfo, visionResults, deckStyleId);
    setVisionConflicts(conflicts);
    return conflicts;
  }, [visionResults, deckStyleId]);

  const clearConflicts = useCallback(() => {
    setVisionConflicts([]);
  }, []);

  return {
    visionResults,
    visionConflicts,
    visionProof,
    feedbackVisionSummary,
    isVisionReady,
    hasVisionData,
    handleVisionResults,
    handleRemoveVisionResult,
    handleClearVisionResults,
    ensureVisionProof,
    resetVisionProof,
    setVisionResults,
    setVisionConflicts,
    liveVisionSummary,
    checkConflicts,
    clearConflicts,
    getVisionConflictsForCards // Exported for direct use if needed
  };
}
