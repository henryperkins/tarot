/**
 * Reading Prompt Versioning
 *
 * Tracks versions of the reading prompt system for quality correlation.
 * Increment version when making significant changes to:
 * - System prompt instructions (buildSystemPrompt)
 * - User prompt structure (buildUserPrompt)
 * - Position templates (POSITION_LANGUAGE)
 * - Spread-specific builders
 *
 * Version format: MAJOR.MINOR.PATCH
 * - MAJOR: Breaking changes to prompt structure
 * - MINOR: Significant additions/modifications
 * - PATCH: Bug fixes, minor tweaks
 */

export const READING_PROMPT_VERSION = '1.6.0';

/**
 * Version history for documentation and debugging.
 * Add entry when incrementing version.
 */
export const VERSION_HISTORY = [
  {
    version: '1.6.0',
    date: '2026-10-24',
    notes: 'Complete offline GraphRAG preservation and final-prompt provenance remediation.',
    changes: [
      'Enumerate every drawn Major (a per-card Major added by a multi-Major spread counts as relevant only when it shares question terms), scope context variants to matching questions, and use conservative lexical normalization. Restore legacy weighted relevance after the proposed semantic-primary policy failed qualification; F3b remains unresolved.',
      'Cover all eight registry-backed pattern families in summaries and preserve graph envelopes and conditional guardrails atomically through truncation.',
      'Enforce final reference integrity before token accounting, source usage, memory retention and provider handoff; expose bounded omission diagnostics without reference text.',
      'Qualify final full, summary, omitted and rejected references across provider request serialization; live embeddings and generated-reading qualification remain separate.'
    ]
  },
  {
    version: '1.5.2',
    date: '2026-10-24',
    notes: 'Address source defects discovered in subscription narrative qualification.',
    changes: [
      'Keep Marseille numerical themes symbolic instead of asserting generic rank layouts as observed artwork; remove unsupported Chariot reins from the sensory cue.',
      'Preserve nonpresent age wording through interpretation and next-step guidance without deriving a current age.',
      'Reserve every drawn card identity, position, orientation and canonical meaning during final budget fitting.'
    ]
  },
  {
    version: '1.5.1',
    date: '2026-10-24',
    notes: 'Resolve the completed agent editorial review findings.',
    changes: [
      'Project retrieved Minor and court references from actual drawn membership, including final payload rebuilding.',
      'Make identified canon claims conditional and preserve reader agency in consequential contexts.',
      'Align two partial Major themes with their pair references and adapt articles with selected-deck card names.'
    ]
  },
  {
    version: '1.5.0',
    date: '2026-10-24',
    notes: 'Preserve drawn-member themes, scoped current context and temporally compatible memory through calibrated prompt construction.',
    changes: [
      'Use canonical distinct membership and render only actual Minor stage members, with non-predictive complete-group relationships.',
      'Scope excluded actions separately from whole-topic exclusions; retain relevant supplementary saved interests without redirecting current-led retrieval.',
      'Require same-person, same-time agreement for age memories; preserve explicitly dated compatible non-present wording.',
      'Use one immutable request-local estimator throughout construction, truncation and final retained-source accounting.',
      'Keep projected/reconstructed preview provenance separate from accepted generation inclusion.'
    ]
  },
  {
    version: '1.4.0',
    date: '2026-10-23',
    notes: 'Preserve authoritative current context and accepted-attempt source inclusion.',
    changes: [
      'Classified independently bounded current sources once and projected eligible mixed-topic spans into a separate bounded retrieval query.',
      'Kept orientation-aware catalog meanings authoritative and tracked caller interpretations separately from factual context.',
      'Used matched-only deck-safe registered references, verified enrichment provenance and full eligible relevance-first ranking with comparable whole-set fallback.',
      'Replaced unsupported skipped-integration wording in the Death and Star partial highlight with a matched-card theme.',
      'Selected compatible memories once from a bounded pool, honored per-reading opt-out and tracked only complete blocks retained by the accepted backend attempt.',
      'Recorded initial-reading access timestamps after successful server acceptance, with best-effort direct persistence and private durable-job receipt replay.'
    ]
  },
  {
    version: '1.3.0',
    date: '2026-10-22',
    notes: 'Ground graph references and personal context in the current reading.',
    changes: [
      'Corrected partial patterns and canonical direct highlights without treating missing cards as drawn.',
      'Separated current question, notes, card reflections and decision paths before bounded retrieval projection.',
      'Projected authored canon by selected deck and scored all eligible candidate variants before final passage limits.',
      'Selected safe relevant memories and recorded successful use only for complete blocks retained in the final reading prompt.'
    ]
  },
  {
    version: '1.2.0',
    date: '2026-09-05',
    notes: 'Honor current intent and resolve consistent personalization guidance.',
    changes: [
      'Prioritized current question and reflections over saved focus in context selection and retrieval.',
      'Unified depth, length, and action-count instructions while preserving agency across tone and spiritual-frame preferences.',
      'Preserved bounded reading conclusions, relevant passages, reflections, and conversation pairs for follow-ups.'
    ]
  },
  {
    version: '1.1.1',
    date: '2026-04-24',
    notes: 'Harden prompt assembly and telemetry under truncation and injected reference text.',
    changes: [
      'Preserved critical user prompt footer instructions under hard-cap truncation.',
      'Neutralized GraphRAG reference delimiters and required complete summary blocks before reporting inclusion.',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-01-07',
    notes: 'Tighten prompt specificity to reduce generic readings.',
    changes: [
      'Added specificity guardrails in system prompt guidance.',
      'Reinforced user prompt instructions to anchor advice in question and card details.',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-01-06',
    notes: 'Initial versioning - establishes baseline for quality tracking',
    changes: [
      'Added version tracking infrastructure',
      'Baseline for all existing prompt patterns',
    ],
  },
];

/**
 * Get combined version info for metrics.
 *
 * @param {string} evalPromptVersion - From evaluation.js EVAL_PROMPT_VERSION
 * @returns {Object} Version information
 */
export function getVersionInfo(evalPromptVersion = null) {
  return {
    reading: READING_PROMPT_VERSION,
    eval: evalPromptVersion,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get the current version string.
 * Use this in promptMeta and metrics.
 */
export function getReadingPromptVersion() {
  return READING_PROMPT_VERSION;
}

/**
 * Check if a version is newer than another.
 *
 * @param {string} version1
 * @param {string} version2
 * @returns {number} 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
export function compareVersions(version1, version2) {
  const v1Parts = version1.split('.').map(Number);
  const v2Parts = version2.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const v1 = v1Parts[i] || 0;
    const v2 = v2Parts[i] || 0;
    if (v1 > v2) return 1;
    if (v1 < v2) return -1;
  }

  return 0;
}

/**
 * Get version history entry for a specific version.
 *
 * @param {string} version
 * @returns {Object|null}
 */
export function getVersionHistoryEntry(version) {
  return VERSION_HISTORY.find((entry) => entry.version === version) || null;
}
