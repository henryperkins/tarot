/**
 * Semantic Prompt Injection Detection
 * 
 * Multi-layer defense against prompt injection attacks combining:
 * 1. Pattern-based filtering (existing in utils.js)
 * 2. Semantic analysis for novel attack patterns
 * 3. Structural anomaly detection
 * 4. Entropy analysis for obfuscation attempts
 */

import { filterInstructionPatterns } from './utils.js';

/**
 * Detection result
 * @typedef {Object} InjectionDetectionResult
 * @property {boolean} isInjection - Whether injection was detected
 * @property {number} confidence - Confidence score (0-1)
 * @property {string[]} reasons - Detection reasons
 * @property {string} sanitizedText - Sanitized text
 * @property {string} severity - 'low', 'medium', 'high', 'critical'
 */

/**
 * Semantic patterns that indicate prompt injection attempts
 * These are more sophisticated than simple regex patterns
 */
const SEMANTIC_INJECTION_PATTERNS = [
  {
    name: 'instruction_override',
    patterns: [
      /(?:from now on|going forward|effective immediately)\s+(?:you will|you must|you should)/i,
      /(?:change|switch|transform)\s+(?:your|the)\s+(?:role|personality|behavior)/i,
      /(?:new instructions|updated rules|revised guidelines)/i,
      /(?:disregard|ignore)\s+(?:everything|all)\s+(?:I|we)\s+(?:said|mentioned)/i
    ],
    weight: 0.8
  },
  {
    name: 'role_manipulation',
    patterns: [
      /(?:you are|you're|you are now)\s+(?:actually|secretly|really)\s+(?:a|an)\s+(?:different|evil|unrestricted|hacker|attacker)/i,
      /(?:enter|activate|enable)\s+(?:developer|admin|root|god|superuser)\s+(?:mode|access)/i,
      /(?:bypass|ignore|disable)\s+(?:safety|security|content|ethical)\s+(?:filters|guidelines|restrictions)/i,
      /(?:do not|don't)\s+(?:mention|refer to|acknowledge)\s+(?:your|the)\s+(?:instructions|rules|guidelines)/i
    ],
    weight: 0.9
  },
  {
    name: 'context_manipulation',
    patterns: [
      /(?:this is|here's)\s+(?:a|an)\s+(?:test|example|hypothetical)\s+(?:scenario|situation)/i,
      /(?:pretend|imagine|suppose)\s+(?:that|this is|we are)/i,
      /(?:in this|for this)\s+(?:fictional|imaginary|made-up)\s+(?:world|scenario|context)/i,
      /(?:forget|ignore)\s+(?:the|your)\s+(?:previous|prior|above)\s+(?:context|conversation)/i
    ],
    weight: 0.6
  },
  {
    name: 'boundary_confusion',
    patterns: [
      /```\s*(?:system|developer|assistant|ai)\s*\n/i,
      /\[\s*(?:system|developer|assistant|ai)\s*\]/i,
      /<\s*(?:system|developer|assistant|ai)\s*>/i,
      /(?:---|###)\s*(?:system|developer|assistant|ai)\s*(?:---|###)/i
    ],
    weight: 0.85
  },
  {
    name: 'output_manipulation',
    patterns: [
      /(?:output|print|display|show)\s+(?:only|just)\s+(?:the|your)\s+(?:code|json|raw)/i,
      /(?:respond|reply|answer)\s+(?:only|just|with)\s+(?:yes|no|true|false|\d+)/i,
      /(?:do not|don't)\s+(?:include|add|provide)\s+(?:any|the)\s+(?:explanation|reasoning|context)/i,
      /(?:start|begin)\s+(?:your|the)\s+(?:response|answer)\s+(?:with|by saying)/i
    ],
    weight: 0.7
  },
  {
    name: 'encoding_obfuscation',
    patterns: [
      /(?:base64|hex|binary|rot13|caesar|cipher)\s+(?:encoded|encrypted|obfuscated)/i,
      /(?:decode|decrypt|unscramble|reverse)\s+(?:this|the following)/i,
      /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]{3,}/, // eslint-disable-line no-control-regex -- Intentional: detect control char injection
      /(?:\u200B|\u200C|\u200D|\uFEFF|\u2060|\u180E|\u2028|\u2029){2,}/ // Multiple zero-width chars
    ],
    weight: 0.95
  }
];

/**
 * Suspicious structural patterns
 */
const STRUCTURAL_ANOMALIES = [
  {
    name: 'excessive_repetition',
    check: (text) => {
      const words = text.toLowerCase().split(/\s+/);
      const wordCounts = {};
      words.forEach(w => { wordCounts[w] = (wordCounts[w] || 0) + 1; });
      const maxRepetition = Math.max(...Object.values(wordCounts));
      return maxRepetition > words.length * 0.3; // Same word > 30% of text
    },
    weight: 0.5
  },
  {
    name: 'unusual_formatting',
    check: (text) => {
      const specialCharRatio = (text.match(/[^\w\s]/g) || []).length / text.length;
      return specialCharRatio > 0.3; // > 30% special characters
    },
    weight: 0.4
  },
  {
    name: 'excessive_length',
    check: (text) => {
      return text.length > 5000; // Unusually long input
    },
    weight: 0.3
  },
  {
    name: 'nested_quotes',
    check: (text) => {
      const quoteMatches = text.match(/["'`]/g) || [];
      return quoteMatches.length > 10; // Excessive quote usage
    },
    weight: 0.6
  },
  {
    name: 'mixed_scripts',
    check: (text) => {
      const scripts = new Set();
      for (const char of text) {
        if (/[\u0400-\u04FF]/.test(char)) scripts.add('cyrillic');
        if (/[\u0370-\u03FF]/.test(char)) scripts.add('greek');
        if (/[\u0600-\u06FF]/.test(char)) scripts.add('arabic');
        if (/[\u3040-\u309F]/.test(char)) scripts.add('hiragana');
        if (/[\u4E00-\u9FFF]/.test(char)) scripts.add('han');
        if (/[a-zA-Z]/.test(char)) scripts.add('latin');
      }
      return scripts.size > 2; // More than 2 scripts mixed
    },
    weight: 0.7
  }
];

/**
 * Calculate Shannon entropy of text (detects obfuscation)
 * @param {string} text - Input text
 * @returns {number} Entropy value (0-8, higher = more random/encoded)
 */
function calculateEntropy(text) {
  const len = text.length;
  if (len === 0) return 0;
  
  const charCounts = {};
  for (const char of text) {
    charCounts[char] = (charCounts[char] || 0) + 1;
  }
  
  let entropy = 0;
  for (const count of Object.values(charCounts)) {
    const probability = count / len;
    entropy -= probability * Math.log2(probability);
  }
  
  return entropy;
}

/**
 * Detect semantic injection patterns
 * @param {string} text - Input text
 * @returns {Object} Detection results
 */
function detectSemanticPatterns(text) {
  const matches = [];
  let totalWeight = 0;
  
  for (const category of SEMANTIC_INJECTION_PATTERNS) {
    let categoryMatches = 0;
    
    for (const pattern of category.patterns) {
      if (pattern.test(text)) {
        categoryMatches++;
        matches.push({
          category: category.name,
          pattern: pattern.source.slice(0, 50) + '...',
          weight: category.weight
        });
      }
      // Reset regex lastIndex for global patterns
      pattern.lastIndex = 0;
    }
    
    if (categoryMatches > 0) {
      // Increase weight for multiple matches in same category
      totalWeight += category.weight * (1 + (categoryMatches - 1) * 0.2);
    }
  }
  
  return { matches, totalWeight };
}

/**
 * Detect structural anomalies
 * @param {string} text - Input text
 * @returns {Object} Detection results
 */
function detectStructuralAnomalies(text) {
  const anomalies = [];
  let totalWeight = 0;
  
  for (const check of STRUCTURAL_ANOMALIES) {
    if (check.check(text)) {
      anomalies.push(check.name);
      totalWeight += check.weight;
    }
  }
  
  return { anomalies, totalWeight };
}

/**
 * Analyze text entropy for obfuscation detection
 * @param {string} text - Input text
 * @returns {Object} Entropy analysis
 */
function analyzeEntropy(text) {
  const entropy = calculateEntropy(text);
  
  // Normal English text typically has entropy 3.5-5.0
  // Encoded/obfuscated text often has entropy > 6.0
  const isSuspicious = entropy > 6.0;
  const isHighlySuspicious = entropy > 7.0;
  
  return {
    entropy,
    isSuspicious,
    isHighlySuspicious,
    weight: isHighlySuspicious ? 0.8 : (isSuspicious ? 0.5 : 0)
  };
}

/**
 * Determine severity based on detection results
 * @param {number} confidence - Confidence score (0-1)
 * @param {string[]} reasons - Detection reasons
 * @returns {string} Severity level
 */
function determineSeverity(confidence, reasons) {
  if (confidence >= 0.9 || reasons.some(r => r.includes('encoding_obfuscation') || r.includes('role_manipulation'))) {
    return 'critical';
  }
  if (confidence >= 0.7) {
    return 'high';
  }
  if (confidence >= 0.4) {
    return 'medium';
  }
  return 'low';
}

/**
 * Sanitize text based on detection results
 * @param {string} text - Original text
 * @param {Object} detection - Detection results
 * @returns {string} Sanitized text
 */
function sanitizeDetectedInjection(text, detection) {
  let sanitized = text;
  
  // Apply pattern-based filtering first
  sanitized = filterInstructionPatterns(sanitized);
  
  // If high confidence injection, apply additional sanitization
  if (detection.confidence > 0.7) {
    // Remove or neutralize suspicious patterns
    for (const category of SEMANTIC_INJECTION_PATTERNS) {
      for (const pattern of category.patterns) {
        sanitized = sanitized.replace(pattern, '[filtered-content]');
        pattern.lastIndex = 0;
      }
    }
    
    // Remove control characters
    // eslint-disable-next-line no-control-regex -- Intentional: strip control chars for sanitization
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
    
    // Normalize excessive whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
  }
  
  return sanitized;
}

/**
 * Detect prompt injection with semantic analysis
 * 
 * Combines multiple detection methods:
 * 1. Pattern-based filtering (existing)
 * 2. Semantic pattern matching
 * 3. Structural anomaly detection
 * 4. Entropy analysis
 * 
 * @param {string} text - Input text to analyze
 * @param {Object} options - Detection options
 * @param {number} options.confidenceThreshold - Minimum confidence to flag (default: 0.5)
 * @param {boolean} options.sanitize - Whether to return sanitized text (default: true)
 * @returns {InjectionDetectionResult} Detection result
 */
export function detectPromptInjection(text, options = {}) {
  const { confidenceThreshold = 0.5, sanitize = true } = options;
  
  if (!text || typeof text !== 'string') {
    return {
      isInjection: false,
      confidence: 0,
      reasons: [],
      sanitizedText: text || '',
      severity: 'low'
    };
  }
  
  const reasons = [];
  let totalWeight = 0;
  let maxPossibleWeight = 0;
  
  // Layer 1: Pattern-based filtering
  const patternFiltered = filterInstructionPatterns(text);
  if (patternFiltered !== text) {
    reasons.push('pattern_filter_triggered');
    totalWeight += 0.6;
  }
  maxPossibleWeight += 0.6;
  
  // Layer 2: Semantic pattern detection
  const semanticResults = detectSemanticPatterns(text);
  if (semanticResults.matches.length > 0) {
    reasons.push(...semanticResults.matches.map(m => `${m.category}:${m.pattern}`));
    totalWeight += semanticResults.totalWeight;
  }
  maxPossibleWeight += SEMANTIC_INJECTION_PATTERNS.reduce((sum, cat) => sum + cat.weight, 0);
  
  // Layer 3: Structural anomaly detection
  const structuralResults = detectStructuralAnomalies(text);
  if (structuralResults.anomalies.length > 0) {
    reasons.push(...structuralResults.anomalies.map(a => `anomaly:${a}`));
    totalWeight += structuralResults.totalWeight;
  }
  maxPossibleWeight += STRUCTURAL_ANOMALIES.reduce((sum, check) => sum + check.weight, 0);
  
  // Layer 4: Entropy analysis
  const entropyResults = analyzeEntropy(text);
  if (entropyResults.isSuspicious) {
    reasons.push(`high_entropy:${entropyResults.entropy.toFixed(2)}`);
    totalWeight += entropyResults.weight;
  }
  maxPossibleWeight += 0.8;
  
  // Calculate confidence (normalized)
  const confidence = maxPossibleWeight > 0 ? totalWeight / maxPossibleWeight : 0;
  const isInjection = confidence >= confidenceThreshold;
  const severity = determineSeverity(confidence, reasons);
  
  // Sanitize if requested and injection detected
  const sanitizedText = sanitize && isInjection 
    ? sanitizeDetectedInjection(text, { confidence, reasons })
    : text;
  
  return {
    isInjection,
    confidence: Math.min(1, confidence),
    reasons: reasons.slice(0, 10), // Limit reasons
    sanitizedText,
    severity
  };
}

/**
 * Quick check for prompt injection (lower overhead)
 * @param {string} text - Input text
 * @returns {boolean} True if injection detected
 */
export function isPromptInjectionQuick(text) {
  if (!text || typeof text !== 'string') return false;
  
  // Quick pattern check
  const patternFiltered = filterInstructionPatterns(text);
  if (patternFiltered !== text) return true;
  
  // Quick semantic check (first 3 categories only)
  const quickPatterns = SEMANTIC_INJECTION_PATTERNS.slice(0, 3);
  for (const category of quickPatterns) {
    for (const pattern of category.patterns) {
      if (pattern.test(text)) return true;
      pattern.lastIndex = 0;
    }
  }
  
  // Quick entropy check
  const entropy = calculateEntropy(text);
  if (entropy > 7.0) return true;
  
  return false;
}

/**
 * Get detection statistics for monitoring
 * @returns {Object} Statistics
 */
export function getDetectionStats() {
  // This would be implemented with a proper metrics system
  // For now, return placeholder
  return {
    totalChecks: 0,
    injectionsDetected: 0,
    averageConfidence: 0,
    topPatterns: []
  };
}
