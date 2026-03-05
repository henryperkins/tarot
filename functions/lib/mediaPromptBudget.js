const DEFAULT_PROMPT_BUDGETS = Object.freeze({
  storyArt: 12000,
  cardVideo: 12000,
  keyframe: 12000
});

const DEFAULT_PROMPT_HARD_CAPS = Object.freeze({
  storyArt: 16000,
  cardVideo: 16000,
  keyframe: 16000
});

const MIN_PROMPT_BUDGET = 200;
const MAX_PROMPT_BUDGET = 50000;
const MAX_REFLECTION_LINE_CHARS = 220;
const MAX_NARRATIVE_CONTEXT_CHARS = 320;

const ALIGNMENT_SECTION_MARKERS = Object.freeze([
  '\n\nSCENE/BACKGROUND:',
  '\n\nVISUAL MEDIUM:',
  '\n\nCreate an artistic vignette',
  '\n\nStyle:',
  '\n\nCOMPOSITION:'
]);

const OPTIONAL_DESCRIPTOR_PATTERNS = [
  /^Question theme cues:/i,
  /^Visual metaphor:/i,
  /^Journey metaphor:/i,
  /^Colors should subtly shift across panels/i,
  /^- Include a connecting element flowing through all panels/i,
  /^- Recurring symbolic motifs that transform from panel to panel/i,
  /^- Consistent horizon line and perspective across all three/i,
  /^- Style remains unified; mood evolves left to right/i
];

function parseBudgetValue(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < MIN_PROMPT_BUDGET) return MIN_PROMPT_BUDGET;
  if (parsed > MAX_PROMPT_BUDGET) return MAX_PROMPT_BUDGET;
  return parsed;
}

function shortenInlineSection(text, maxLength) {
  if (typeof text !== 'string' || text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength).trim()}...`;
}

function trimNarrativeReflections(prompt) {
  let nextPrompt = prompt;
  nextPrompt = nextPrompt.replace(
    /(NARRATIVE CONTEXT:\s*)([^\n]+)/gi,
    (_match, prefix, value) => `${prefix}${shortenInlineSection(value.trim(), MAX_NARRATIVE_CONTEXT_CHARS)}`
  );
  nextPrompt = nextPrompt.replace(
    /(Reflections?:\s*)([^\n]+)/gi,
    (_match, prefix, value) => `${prefix}${shortenInlineSection(value.trim(), MAX_REFLECTION_LINE_CHARS)}`
  );
  return nextPrompt;
}

function compactAlignmentReferenceBlock(prompt) {
  const start = prompt.indexOf('READING MODEL ALIGNMENT');
  if (start === -1) return prompt;

  let end = -1;
  for (const marker of ALIGNMENT_SECTION_MARKERS) {
    const markerIndex = prompt.indexOf(marker, start);
    if (markerIndex !== -1 && (end === -1 || markerIndex < end)) {
      end = markerIndex;
    }
  }
  if (end === -1) return prompt;

  const compactBlock = [
    'READING MODEL ALIGNMENT:',
    '- Mirror the same tarot semantic arc and card evidence used in text readings.',
    '- Treat markdown/formatting text as structural context only; never render text in visuals.',
    '- Keep symbolism agency-forward and avoid deterministic fate claims.'
  ].join('\n');

  return `${prompt.slice(0, start)}${compactBlock}${prompt.slice(end)}`;
}

function trimOptionalDescriptors(prompt) {
  const lines = prompt.split('\n');
  const kept = [];
  let inBackgroundSound = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^Background Sound:/i.test(trimmed)) {
      inBackgroundSound = true;
      continue;
    }

    if (inBackgroundSound) {
      if (/^Constraints:/i.test(trimmed)) {
        inBackgroundSound = false;
        kept.push(line);
      }
      continue;
    }

    if (/^Environment cues:/i.test(trimmed) && !trimmed.includes('SCENE/BACKGROUND')) {
      continue;
    }

    if (OPTIONAL_DESCRIPTOR_PATTERNS.some((pattern) => pattern.test(trimmed))) {
      continue;
    }

    kept.push(line);
  }

  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function resolveMediaPromptBudgets(env = {}) {
  const storyArtBudget = parseBudgetValue(
    env.MEDIA_PROMPT_BUDGET_STORY_ART_CHARS,
    DEFAULT_PROMPT_BUDGETS.storyArt
  );
  const cardVideoBudget = parseBudgetValue(
    env.MEDIA_PROMPT_BUDGET_CARD_VIDEO_CHARS,
    DEFAULT_PROMPT_BUDGETS.cardVideo
  );
  const keyframeBudget = parseBudgetValue(
    env.MEDIA_PROMPT_BUDGET_KEYFRAME_CHARS,
    DEFAULT_PROMPT_BUDGETS.keyframe
  );

  const storyArtHardCap = parseBudgetValue(
    env.MEDIA_PROMPT_HARD_CAP_STORY_ART_CHARS,
    DEFAULT_PROMPT_HARD_CAPS.storyArt
  );
  const cardVideoHardCap = parseBudgetValue(
    env.MEDIA_PROMPT_HARD_CAP_CARD_VIDEO_CHARS,
    DEFAULT_PROMPT_HARD_CAPS.cardVideo
  );
  const keyframeHardCap = parseBudgetValue(
    env.MEDIA_PROMPT_HARD_CAP_KEYFRAME_CHARS,
    DEFAULT_PROMPT_HARD_CAPS.keyframe
  );

  return {
    storyArt: {
      budget: storyArtBudget,
      hardCap: Math.max(storyArtBudget, storyArtHardCap)
    },
    cardVideo: {
      budget: cardVideoBudget,
      hardCap: Math.max(cardVideoBudget, cardVideoHardCap)
    },
    keyframe: {
      budget: keyframeBudget,
      hardCap: Math.max(keyframeBudget, keyframeHardCap)
    }
  };
}

export function enforceMediaPromptBudget(prompt, config = {}) {
  const sourcePrompt = typeof prompt === 'string' ? prompt : String(prompt || '');
  const budget = parseBudgetValue(config.budget, DEFAULT_PROMPT_BUDGETS.storyArt);
  const hardCap = parseBudgetValue(config.hardCap, Math.max(budget, DEFAULT_PROMPT_HARD_CAPS.storyArt));
  const effectiveCap = Math.min(budget, hardCap);

  let slimmedPrompt = sourcePrompt;
  const trimmedSections = [];

  if (slimmedPrompt.length > effectiveCap) {
    const nextPrompt = trimNarrativeReflections(slimmedPrompt);
    if (nextPrompt !== slimmedPrompt) {
      slimmedPrompt = nextPrompt;
      trimmedSections.push('reflections');
    }
  }

  if (slimmedPrompt.length > effectiveCap) {
    const nextPrompt = compactAlignmentReferenceBlock(slimmedPrompt);
    if (nextPrompt !== slimmedPrompt) {
      slimmedPrompt = nextPrompt;
      trimmedSections.push('alignment-reference');
    }
  }

  if (slimmedPrompt.length > effectiveCap) {
    const nextPrompt = trimOptionalDescriptors(slimmedPrompt);
    if (nextPrompt !== slimmedPrompt) {
      slimmedPrompt = nextPrompt;
      trimmedSections.push('optional-descriptors');
    }
  }

  const finalLength = slimmedPrompt.length;
  const ok = finalLength <= effectiveCap;

  return {
    ok,
    prompt: slimmedPrompt,
    originalLength: sourcePrompt.length,
    finalLength,
    slimmed: trimmedSections.length > 0,
    trimmedSections,
    budget: effectiveCap,
    hardCap,
    errorCode: ok ? null : 'media_prompt_budget_exceeded',
    message: ok
      ? null
      : `Prompt exceeds configured cap (${effectiveCap} chars) after deterministic slimming.`
  };
}

