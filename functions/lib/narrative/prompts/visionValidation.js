import { formatVisionLabelForPrompt } from '../../visionLabels.js';
import { evaluateVisionInsightPromptEligibility } from '../../readingQuality.js';
import { sanitizeText } from '../../utils.js';

function normalizeCardKey(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed.replace(/^the\s+/, '').replace(/\s+/g, ' ');
}

function buildDrawnCardKeys(cardsInfo) {
  const drawn = new Set();
  if (!Array.isArray(cardsInfo)) return drawn;
  cardsInfo.forEach((card) => {
    const raw = card?.canonicalKey || card?.canonicalName || card?.card || '';
    const key = normalizeCardKey(raw);
    if (key) {
      drawn.add(key);
    }
  });
  return drawn;
}

function isDrawnCardName(cardName, drawnCardKeys) {
  if (!cardName || !drawnCardKeys || drawnCardKeys.size === 0) return false;
  const key = normalizeCardKey(cardName);
  return Boolean(key && drawnCardKeys.has(key));
}

function describeTelemetryOnlyReason(reason) {
  switch (reason) {
    case 'low_confidence':
      return 'telemetry only: low confidence';
    case 'weak_symbol_verification':
      return 'telemetry only: weak symbol verification';
    case 'match_unverified':
      return 'telemetry only: unverified match';
    case 'confidence_unavailable':
      return 'telemetry only: missing confidence';
    default:
      return 'telemetry only';
  }
}

function sanitizeEvidenceText(value, maxLength = 180) {
  return sanitizeText(String(value || ''), {
    maxLength,
    stripMarkdown: true,
    stripControlChars: true,
    filterInstructions: true
  });
}

export function buildUploadedVisibleEvidenceSection(visionEvidence = []) {
  const packets = Array.isArray(visionEvidence)
    ? visionEvidence.filter((packet) => packet?.evidenceMode === 'uploaded_image')
    : [];

  if (!packets.length) {
    return '';
  }

  const lines = ['\n**Uploaded Visible Evidence**:'];

  packets.slice(0, 5).forEach((packet) => {
    const cardName = sanitizeEvidenceText(packet.card || 'Uploaded card', 80);
    const label = sanitizeEvidenceText(packet.label || 'upload', 80);
    const confidence = typeof packet.confidence === 'number'
      ? `${(packet.confidence * 100).toFixed(1)}%`
      : 'confidence unavailable';

    lines.push(`- ${cardName} (${label}, ${confidence})`);
    (packet.visibleEvidence || []).slice(0, 5).forEach((entry) => {
      const literal = sanitizeEvidenceText(entry?.literalObservation, 180);
      if (literal) {
        lines.push(`  - Literal: ${literal}`);
      }

      const symbolic = Array.isArray(entry?.symbolicMeaning)
        ? entry.symbolicMeaning
          .map((meaning) => sanitizeEvidenceText(meaning, 60))
          .filter(Boolean)
          .slice(0, 5)
        : [];
      if (symbolic.length) {
        lines.push(`  - Symbolic: ${symbolic.join(', ')}`);
      }
    });
  });

  lines.push('');
  return `${lines.join('\n')}\n`;
}

export function buildVisionValidationSection(visionInsights, options = {}) {
  if (options.includeDiagnostics === false) {
    return '';
  }

  if (!Array.isArray(visionInsights) || visionInsights.length === 0) {
    return '';
  }

  const safeEntries = visionInsights.slice(0, 5);
  const drawnCardKeys = buildDrawnCardKeys(options.cardsInfo);
  const enforceDrawnCardFilter = drawnCardKeys.size > 0;
  const shouldAllowCardName = (cardName) => {
    if (!enforceDrawnCardFilter) return true;
    return isDrawnCardName(cardName, drawnCardKeys);
  };
  const verifiedMatches = safeEntries.filter((entry) => entry.matchesDrawnCard === true).length;
  const mismatches = safeEntries.filter((entry) => entry.matchesDrawnCard === false).length;
  const unverified = safeEntries.length - verifiedMatches - mismatches;
  const telemetryOnly = safeEntries.filter((entry) => {
    if (entry?.matchesDrawnCard !== true) return false;
    return evaluateVisionInsightPromptEligibility(entry).promptEligible !== true;
  }).length;

  let coverageLine = 'Vision uploads include verification notes below.';
  if (mismatches === 0 && unverified === 0 && telemetryOnly === 0) {
    coverageLine = 'All uploaded cards align with the declared spread.';
  } else {
    const parts = [];
    if (mismatches > 0) {
      parts.push(`${mismatches} upload(s) did not match the selected cards—address gently if relevant.`);
    }
    if (unverified > 0) {
      parts.push(`${unverified} upload(s) could not be verified against the drawn spread; treat these as unverified evidence if you reference them.`);
    }
    if (telemetryOnly > 0) {
      parts.push(`${telemetryOnly} matched upload(s) were too weak to steer tone or emphasis and should remain telemetry-only evidence.`);
    }
    coverageLine = parts.join(' ');
  }

  const lines = ['\n**Vision Validation**:', coverageLine];

  safeEntries.forEach((entry) => {
    const safeLabel = formatVisionLabelForPrompt(entry.label);
    const confidenceText = typeof entry.confidence === 'number'
      ? `${(entry.confidence * 100).toFixed(1)}%`
      : 'confidence unavailable';
    const basisText = entry.basis ? ` via ${entry.basis}` : '';

    // IMPORTANT: For mismatched cards, omit the predicted card name entirely to avoid
    // priming the AI with off-spread card names that could trigger hallucinations.
    // The model should only see card names that are actually in the drawn spread.
    if (entry.matchesDrawnCard === false) {
      lines.push(`- ${safeLabel}: vision detected a card not in the drawn spread (${confidenceText}) [mismatch]`);
      // Skip symbol verification and secondary matches for mismatched cards -
      // this data relates to the wrong card and could prime hallucinations.
      // Do NOT include reasoning/visualDetails/visual profile for mismatches
      // to avoid off-spread card identity or tone priming.
      return; // Skip remaining details for mismatched entries
    }

    const isUnverified = entry.matchesDrawnCard === null || typeof entry.matchesDrawnCard === 'undefined';
    const eligibility = evaluateVisionInsightPromptEligibility(entry);
    const isTelemetryOnly = entry.matchesDrawnCard === true && eligibility.promptEligible !== true;
    const predictedCard = entry.predictedCard || entry.card || '';
    const allowCardName = !isUnverified || shouldAllowCardName(predictedCard);
    const suppressDetails = isUnverified && enforceDrawnCardFilter && !allowCardName;
    const validationNote = isUnverified ? ' [unverified upload]' : '';
    const telemetryOnlyNote = isTelemetryOnly ? ` [${describeTelemetryOnlyReason(eligibility.suppressionReason)}]` : '';

    if (allowCardName && predictedCard) {
      lines.push(`- ${safeLabel}: recognized as ${predictedCard}${basisText} (${confidenceText})${validationNote}${telemetryOnlyNote}`);
    } else if (isUnverified) {
      lines.push(`- ${safeLabel}: recognized as an unverified upload${basisText} (${confidenceText}) [card name withheld]`);
    } else {
      lines.push(`- ${safeLabel}: recognized as a card${basisText} (${confidenceText})${telemetryOnlyNote}`);
    }

    if (isTelemetryOnly) {
      lines.push('  · Evidence note: Matched the spread, but treat this as telemetry only. Do not let it steer tone, card emphasis, or emotional framing.');
      if (entry.symbolVerification && typeof entry.symbolVerification === 'object') {
        const sv = entry.symbolVerification;
        const matchRate = typeof sv.matchRate === 'number' ? `${(sv.matchRate * 100).toFixed(1)}% symbol alignment` : null;
        const missingList = Array.isArray(sv.missingSymbols) && sv.missingSymbols.length
          ? `missing: ${sv.missingSymbols.join(', ')}`
          : null;
        const symbolLine = [matchRate, missingList].filter(Boolean).join(' | ');
        if (symbolLine) {
          lines.push(`  · Symbol check: ${symbolLine}`);
        }
      }
      return;
    }

    if (entry.orientation) {
      lines.push(`  · Orientation: ${entry.orientation}`);
    }

    if (entry.reasoning && !suppressDetails) {
      const safeReasoning = sanitizeText(entry.reasoning, {
        maxLength: 240,
        stripMarkdown: true,
        stripControlChars: true,
        filterInstructions: true
      });
      if (safeReasoning) {
        lines.push(`  · Vision reasoning: ${safeReasoning}`);
      }
    }

    if (entry.visualDetails && !suppressDetails) {
      const details = Array.isArray(entry.visualDetails)
        ? entry.visualDetails
        : (typeof entry.visualDetails === 'string' ? entry.visualDetails.split(/[\n;]+/g) : []);
      const safeDetails = details
        .map((detail) => sanitizeText(detail, {
          maxLength: 80,
          stripMarkdown: true,
          stripControlChars: true,
          filterInstructions: true
        }))
        .filter(Boolean)
        .slice(0, 4);
      if (safeDetails.length) {
        lines.push(`  · Visual details: ${safeDetails.join('; ')}`);
      }
    }

    if (entry.mergeSource || entry.componentScores) {
      const mergeParts = [];
      if (entry.mergeSource) {
        mergeParts.push(`source: ${entry.mergeSource}`);
      }
      if (entry.componentScores && typeof entry.componentScores === 'object') {
        const scoreParts = [];
        if (Number.isFinite(entry.componentScores.clip)) {
          scoreParts.push(`clip ${(entry.componentScores.clip * 100).toFixed(1)}%`);
        }
        if (Number.isFinite(entry.componentScores.llama)) {
          scoreParts.push(`llama ${(entry.componentScores.llama * 100).toFixed(1)}%`);
        }
        if (scoreParts.length) {
          mergeParts.push(`scores: ${scoreParts.join(' / ')}`);
        }
      }
      if (mergeParts.length) {
        lines.push(`  · Merge: ${mergeParts.join(' | ')}`);
      }
    }

    if (entry.symbolVerification && typeof entry.symbolVerification === 'object' && !suppressDetails) {
      const sv = entry.symbolVerification;
      const matchRate = typeof sv.matchRate === 'number' ? `${(sv.matchRate * 100).toFixed(1)}% symbol alignment` : null;
      const missingList = Array.isArray(sv.missingSymbols) && sv.missingSymbols.length
        ? `missing: ${sv.missingSymbols.join(', ')}`
        : null;
      const symbolLine = [matchRate, missingList].filter(Boolean).join(' | ');
      if (symbolLine) {
        lines.push(`  · Symbol check: ${symbolLine}`);
      }
    }

    if (Array.isArray(entry.matches) && entry.matches.length) {
      const matches = isUnverified && enforceDrawnCardFilter
        ? entry.matches.filter((match) => shouldAllowCardName(match?.card))
        : entry.matches;
      const preview = matches
        .slice(0, 2)
        .map((match) => {
          if (!match?.card) return null;
          if (typeof match.score === 'number') {
            return `${match.card} ${(match.score * 100).toFixed(1)}%`;
          }
          return match.card;
        })
        .filter(Boolean)
        .join('; ');
      if (preview) {
        lines.push(`  · Secondary matches: ${preview}`);
      }
    }

    if (entry.visualProfile) {
      const tone = Array.isArray(entry.visualProfile.tone) ? entry.visualProfile.tone.slice(0, 2).join(', ') : '';
      const emotion = Array.isArray(entry.visualProfile.emotion) ? entry.visualProfile.emotion.slice(0, 2).join(', ') : '';
      const parts = [];
      if (tone) parts.push(`Tone: [${tone}]`);
      if (emotion) parts.push(`Emotion: [${emotion}]`);

      if (parts.length > 0) {
        lines.push(`  · Visual Profile: ${parts.join(' | ')}`);
      }
    }
  });

  lines.push('');
  return `${lines.join('\n')}\n`;
}
