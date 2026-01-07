// Safety and crisis detection helpers
// Detects crisis language in user inputs to allow early safety gating.
//
// IMPORTANT: These patterns are designed to minimize false positives while
// catching genuine crisis signals. Common idioms and metaphorical uses are
// excluded via negative lookbehind patterns and explicit exclusion lists.

const SELF_HARM_PATTERNS = [
    /suicid(?:e|al|ality)/i,
    /kill myself/i,
    /end my life/i,
    /take my life/i,
    /harm myself/i,
    /self[-\s]?harm/i,
    /self[-\s]?injur(?:y|e)/i,
    /cutting myself/i
];

const CRISIS_PATTERNS = [
    /i can['’]?t go on/i,
    /no reason to live/i,
    /give up on life/i,
    /want to die/i,
    /overdose/i,
    /\bpanic[-\s]?attack(s)?\b/i,
    /\b(?:mental|nervous)\s+breakdown(s)?\b/i
];

// Medical patterns with context - using functions for complex matching
const MEDICAL_EMERGENCY_PATTERNS = [
    /(?<!change of\s)(?<!stroke of\s)heart attack/i,  // Exclude "change of heart attack"
    /(?<!stroke of\s)(?<!lucky\s)(?<!of\s)stroke(?!\s+of\s+(?:luck|genius|brilliance|good\s+fortune))/i,  // Exclude "stroke of luck/genius"
    /seizure/i,
    /fainting/i,
    /unconscious/i,
    /can['’]?t breathe/i,
    /chest pain/i,
    /(?<!bleeding\s)(?<!cutting\s)(?<!leading\s)bleeding(?!\s+(?:edge|heart|hearts)\b)/i,  // Exclude "bleeding edge/heart"
    /passed out/i
];

function collectMatches(text, patterns, label) {
    const hits = [];
    for (const pattern of patterns) {
        if (pattern.test(text)) {
            hits.push(label || pattern.toString());
        }
    }
    return hits;
}

/**
 * Detect crisis signals in user input for early safety gating.
 *
 * This function is designed to catch genuine crisis situations while
 * minimizing false positives from common idioms and metaphorical usage.
 *
 * Categories detected:
 * - 'self-harm': Suicidal ideation or self-injury language
 * - 'mental-health-crisis': Severe mental health distress
 * - 'medical-emergency': Physical health emergencies
 *
 * @param {string} inputText - User input to analyze
 * @returns {Object} { matched: boolean, categories: string[], matches: string[] }
 */
export function detectCrisisSignals(inputText = '') {
    if (!inputText || typeof inputText !== 'string') {
        return { matched: false, categories: [], matches: [] };
    }

    const text = inputText.toLowerCase();

    const matches = [];
    const categories = new Set();

    // Self-harm patterns are always checked (high confidence, few false positives)
    const selfHarmHits = collectMatches(text, SELF_HARM_PATTERNS, 'self-harm');
    if (selfHarmHits.length) {
        matches.push(...selfHarmHits);
        categories.add('self-harm');
    }

    // Crisis patterns are always checked (specific phrases)
    const crisisHits = collectMatches(text, CRISIS_PATTERNS, 'mental-health-crisis');
    if (crisisHits.length) {
        matches.push(...crisisHits);
        categories.add('mental-health-crisis');
    }

    // Medical patterns rely on per-pattern exclusions (lookbehinds/lookaheads)
    // to avoid common idioms (e.g. "stroke of luck", "bleeding edge").
    const medicalHits = collectMatches(text, MEDICAL_EMERGENCY_PATTERNS, 'medical-emergency');
    if (medicalHits.length) {
        matches.push(...medicalHits);
        categories.add('medical-emergency');
    }

    return {
        matched: categories.size > 0,
        categories: Array.from(categories),
        matches
    };
}
