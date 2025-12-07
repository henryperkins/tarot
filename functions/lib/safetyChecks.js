// Safety and crisis detection helpers
// Detects crisis language in user inputs to allow early safety gating.

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
    /panic attack/i,
    /mental breakdown/i
];

const MEDICAL_EMERGENCY_PATTERNS = [
    /heart attack/i,
    /stroke/i,
    /seizure/i,
    /fainting/i,
    /unconscious/i,
    /can['’]?t breathe/i,
    /chest pain/i,
    /bleeding/i,
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

export function detectCrisisSignals(inputText = '') {
    if (!inputText || typeof inputText !== 'string') {
        return { matched: false, categories: [], matches: [] };
    }

    const text = inputText.toLowerCase();
    const matches = [];
    const categories = new Set();

    const selfHarmHits = collectMatches(text, SELF_HARM_PATTERNS, 'self-harm');
    if (selfHarmHits.length) {
        matches.push(...selfHarmHits);
        categories.add('self-harm');
    }

    const crisisHits = collectMatches(text, CRISIS_PATTERNS, 'mental-health-crisis');
    if (crisisHits.length) {
        matches.push(...crisisHits);
        categories.add('mental-health-crisis');
    }

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
