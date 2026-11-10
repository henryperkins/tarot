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

export const READING_PROMPT_VERSION = '1.6.14';

/**
 * Version history for documentation and debugging.
 * Add entry when incrementing version.
 */
export const VERSION_HISTORY = [
  {
    version: '1.6.14',
    date: '2026-11-05',
    notes: 'End embedded card meanings and elemental descriptions as sentences in spread-analysis prose.',
    changes: [
      'Relationship and single-card summaries end each card meaning and elemental description as a sentence instead of running it into the next; Decision axis summaries gain their closing period.',
      'When two cards share an element, one Relationship bridge sentence covers both instead of repeating it; "all three" replaces "Both" when every card shares it.',
      'Card meanings, elemental descriptions and the system prompt are unchanged.'
    ]
  },
  {
    version: '1.6.13',
    date: '2026-11-01',
    notes: 'Keep closings and topic exclusions from asserting unsupplied status.',
    changes: [
      'The closing names choices and next steps, no longer asks for supplied facts, and treats card-implied habits and events as neither done nor missing.',
      'Asking if X is true, or not asking about X, establishes nothing about X.',
      'System prompt length is unchanged (ASCII quotes offset the new clause); the live quality gate is unchanged and content qualification remains pending.'
    ]
  },
  {
    version: '1.6.12',
    date: '2026-11-01',
    notes: 'Label card-symbol glosses as possibilities at their source.',
    changes: [
      'Separate literal symbol objects and reviewed positions from possible interpretations, including the Seven of Swords incomplete-plan gloss.',
      'Retain canonical annotations, supplied context, scene facts and qualification criteria unchanged; content qualification remains pending.'
    ]
  },
  {
    version: '1.6.11',
    date: '2026-10-31',
    notes: 'Retain conditional scope for proposed activity and support through synthesis and closing.',
    changes: [
      'Keep Present and Support role projections symbolic without asserting ongoing practice or available people/resources.',
      'Require each reused activity or support premise to retain its own condition; a possible outcome does not qualify an assumed cause.',
      'Preserve supplied facts and explicit absence, and keep the premise instruction protected during budget fitting.'
    ]
  },
  {
    version: '1.6.10',
    date: '2026-10-31',
    notes: 'Keep relationship Them cards conditional, document complete scene references and supply drawn-card tallies.',
    changes: [
      'Read the Them card as a possibility to test, not as the querent’s experience or the other person’s stance, through synthesis and closing.',
      'Show the complete fact and interpretation reference shapes, with id and language, in the scene contract; validation stays strict.',
      'Name the reversed cards and each element’s cards, Major associations included, so aggregate claims use supplied counts.'
    ]
  },
  {
    version: '1.6.9',
    date: '2026-10-31',
    notes: 'Correct supplied literal imagery and preserve accepted Unicode through instruction filtering.',
    changes: [
      'Replace unsupported scene precision in the bounded qualification inventory with primary-image observations.',
      'Keep instruction matching on a normalized search copy while retaining original safe question and role text.',
      'Preserve retrieval scores, passage selection, scene contracts and qualification criteria.'
    ]
  },
  {
    version: '1.6.8',
    date: '2026-10-31',
    notes: 'Keep image attributes with their card evidence and distinguish symbolic interpretation.',
    changes: [
      'Add reviewed RWS Eight of Cups and Hermit observations without inventing a hood or an illumination range.',
      'Render validated interpretation references with a fixed card caption and a localized symbolic lead-in.',
      'Separate supplied imagery from sensory interpretation and suppress competing covered-card hooks, including Minors.'
    ]
  },
  {
    version: '1.6.7',
    date: '2026-10-28',
    notes: 'Keep role projections symbolic without supplying goals, external facts or likely outcomes.',
    changes: [
      'Align Conscious and External notes and the paired consciousness axis with supplied facts and conditional possibilities.',
      'Preserve Path A/B labels while framing their meanings and position notes as symbolic comparisons, not forecasts.',
      'Remove residual trajectory framing from Celtic position notes without changing reader inputs, card evidence or budgets.'
    ]
  },
  {
    version: '1.6.6',
    date: '2026-10-28',
    notes: 'Preserve reviewed card-scene relations and render validated literal fact references.',
    changes: [
      'Carry the approved RWS Hierophant and Thoth Art relations through every role and protect their prompt contract during fitting.',
      'Validate deck/drawn-card/final-prompt fact references before rendering localized captions; retain raw provider transport separately.',
      'Treat Future and Outcome as prospective symbolic lenses without inventing a current personal course.'
    ]
  },
  {
    version: '1.6.5',
    date: '2026-10-27',
    notes: 'Honor explicit non-temporal positions in three-card analysis, prompts and local readings.',
    changes: ['Keep the temporal path for Past/Present/Future spreads; treat custom labels as supplied roles rather than a timeline.']
  },
  {
    version: '1.6.4',
    date: '2026-10-27',
    notes: 'Preserve the conditions of illustrative premises and exact accepted card names throughout the reading.',
    changes: [
      'Distinguish supplied reader facts from card-derived possibilities, including habits, missing preparation, unresolved burdens and avoided conversations.',
      'Keep unsupplied premises conditional in questions, next steps, synthesis and closing, while allowing useful optional new actions.',
      'Reserve an atomic accepted-name checklist and premise check through prompt fitting; retain the failed 1.6.3 standard outputs and the Japanese prose-quality waiver.'
    ]
  },
  {
    version: '1.6.3',
    date: '2026-10-27',
    notes: 'Separate symbolic Past card notes and card-story arcs from supplied personal history.',
    changes: [
      'Remove live-event framing and assumed causal history from Past meanings, templates and connectors while preserving card meanings and supplied reader facts.',
      'Keep opening arcs and rhetorical questions conditional instead of turning symbolic contrasts into unsupplied past events.',
      'Keep shared card notes readable in the local composer, preserve Future roles when a quoted question contains past, and describe the Celtic timeline as card relationships rather than lived causes.',
      'Retain the failed semantic-reading pilot and Japanese language-quality waiver; paired qualification remains required.'
    ]
  },
  {
    version: '1.6.2',
    date: '2026-10-24',
    notes: 'Reject presupposed events in questions, metaphors and closing sentences.',
    changes: [
      'Keep conditions local to each reference to an unsupplied event; card-story metaphors cannot establish completed personal history.',
      'Ground closing encouragement in supplied facts or next actions, and keep recovery reflection separate from treatment or monitoring schedules.',
      'Preserve the failed 1.6.1 qualification; keep F3b unresolved.'
    ]
  },
  {
    version: '1.6.1',
    date: '2026-10-24',
    notes: 'Keep personal history conditional and card pacing symbolic throughout generated readings.',
    changes: [
      'Distinguish Past positions and archetypal patterns from supplied personal facts through synthesis, recap and closing.',
      'Remove predictive timing cues and forbid deriving recovery durations or prognoses from symbolic card pacing; preserve the querent\'s literal timing and optional action schedules.',
      'Retain the supplemental-Major lexical-support correction and evaluator false-positive fixes; F3b remains unresolved.'
    ]
  },
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
