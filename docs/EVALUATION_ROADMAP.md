# Roadmap to 100% Evaluation/Interpretability Coverage

Based on Guide Section III (Evaluation & Benchmarks), here's your action plan to reach 100%:

---

## 🎯 **Current Gap Analysis**

| Guide Requirement | Current Status | Gap |
|-------------------|----------------|-----|
| **III.2 Benchmarks** - Symbol detection scores | ❌ None | Need object detection for individual symbols |
| **III.3 Interpretability** - Attention visualization | ❌ None | Need CLIP attention heatmaps |
| **III.3 Interpretability** - Confidence explanations | ⚠️ Basic | Need basis/reasoning output |
| **III.4 Performance Metrics** - Card ID accuracy | ✅ **100%** | Already tracked via confidence |
| **III.4 Performance Metrics** - Narrative coherence | ❌ None | Need similarity/quality scores |
| **III.5 Human-in-Loop** - Expert ratings | ❌ None | Need feedback UI + storage |
| **III.5 Human-in-Loop** - User satisfaction | ❌ None | Need post-reading survey |
| **III.6 Ethics** - Boundary enforcement | ✅ **100%** | Already enforced |
| **III.7 Advanced Metrics** - Hallucination rate | ⚠️ Partial | Vision gate prevents, but no tracking |

**Overall Coverage: 40%** (4/10 areas implemented)

---

## 📋 **Implementation Roadmap**

### **Phase 1: Vision Interpretability** (Guide III.3)
**Priority: HIGH** | **Effort: Medium** | **Impact: High**

#### **1.1 Add Attention Visualization**
Enable users to see *why* the vision model identified a card.

**Implementation:**
```javascript
// shared/vision/tarotVisionPipeline.js
import { AutoModel } from '@xenova/transformers';

export class TarotVisionPipeline {
  async identifyCardWithAttention(imageData, options = {}) {
    const matches = await this.identifyCard(imageData, options);

    if (options.includeAttention) {
      const topMatch = matches[0];
      const attentionMap = await this._extractAttentionWeights(
        imageData,
        topMatch.cardIndex
      );

      topMatch.attention = {
        heatmap: attentionMap,  // 2D array of attention weights
        focusRegions: this._detectFocusRegions(attentionMap),
        symbolAlignment: this._matchAttentionToSymbols(
          attentionMap,
          topMatch.card
        )
      };
    }

    return matches;
  }

  async _extractAttentionWeights(imagePixels, cardIndex) {
    // Extract attention from CLIP vision transformer
    const visionOutput = await this._visionStack({
      pixel_values: imagePixels,
      output_attentions: true
    });

    // Average attention across heads and layers
    const attention = visionOutput.attentions;
    const avgAttention = this._averageAttentionHeads(attention);

    // Reshape to image dimensions
    return this._reshapeToImageGrid(avgAttention);
  }

  _detectFocusRegions(attentionMap, threshold = 0.7) {
    // Find high-attention patches
    const regions = [];
    const maxAttention = Math.max(...attentionMap.flat());

    attentionMap.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value / maxAttention > threshold) {
          regions.push({ x, y, intensity: value });
        }
      });
    });

    return this._clusterRegions(regions);
  }

  _matchAttentionToSymbols(attentionMap, card) {
    const annotation = getAnnotation(card);
    if (!annotation?.symbols) return null;

    // Map symbol positions to attention scores
    return annotation.symbols.map(symbol => ({
      object: symbol.object,
      position: symbol.position,
      attentionScore: this._getRegionAttention(
        attentionMap,
        this._positionToCoords(symbol.position)
      ),
      isModelFocused: this._getRegionAttention(...) > 0.6
    }));
  }
}
```

**Frontend Component:**
```jsx
// src/components/VisionAttentionOverlay.jsx
import React from 'react';

export function VisionAttentionOverlay({ imageUrl, attentionData }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!attentionData?.heatmap) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Draw original image
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Overlay attention heatmap
      const heatmap = createHeatmapOverlay(attentionData.heatmap);
      ctx.globalAlpha = 0.5;
      ctx.drawImage(heatmap, 0, 0);
      ctx.globalAlpha = 1.0;

      // Highlight symbols with high attention
      attentionData.symbolAlignment?.forEach(sym => {
        if (sym.isModelFocused) {
          drawSymbolBoundingBox(ctx, sym, 'lime');
        }
      });
    };
  }, [imageUrl, attentionData]);

  return (
    <div className="vision-attention-panel">
      <canvas ref={canvasRef} width={400} height={700} />

      <div className="symbol-alignment-list">
        <h4>Symbol Detection</h4>
        {attentionData.symbolAlignment?.map(sym => (
          <div key={sym.object} className={sym.isModelFocused ? 'focused' : 'unfocused'}>
            <span>{sym.object}</span>
            <span>{(sym.attentionScore * 100).toFixed(1)}% attention</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Expected Output:**
- Heatmap overlay showing where CLIP "looks"
- Per-symbol attention scores
- Visual confirmation that model focuses on correct symbols

**Guide Alignment:** Section III.3 "Attention Mechanisms and Saliency Maps"

---

#### **1.2 Enhanced Confidence Explanations**
Provide human-readable reasoning for predictions.

**Implementation:**
```javascript
// shared/vision/tarotVisionPipeline.js (enhancement)
async identifyCard(imageData, options = {}) {
  const matches = await this._computeMatches(imageData);

  // Add explanation generation
  const explainedMatches = matches.map(match => ({
    ...match,
    basis: this._generateBasis(match, imageData),
    confidence: match.score,
    reasoning: this._generateReasoning(match)
  }));

  return explainedMatches;
}

_generateBasis(match, imageData) {
  const card = this.cardLibrary[match.cardIndex];
  const annotation = getAnnotation(card);

  // Extract detected features
  const detectedColors = this._extractDominantColors(imageData);
  const detectedSymbols = this._estimateSymbolPresence(imageData, annotation);

  const reasons = [];

  // Color matching
  const colorMatches = annotation?.dominantColors?.filter(dc =>
    detectedColors.some(detected =>
      colorSimilarity(dc.color, detected) > 0.7
    )
  );
  if (colorMatches?.length) {
    reasons.push(`color palette (${colorMatches.map(c => c.color).join(', ')})`);
  }

  // Symbol matching
  const symbolMatches = detectedSymbols.filter(s => s.confidence > 0.6);
  if (symbolMatches.length) {
    reasons.push(`symbols (${symbolMatches.map(s => s.object).join(', ')})`);
  }

  // Composition matching
  if (annotation?.composition) {
    reasons.push(`composition (${annotation.composition})`);
  }

  return reasons.join(' + ');
}

_generateReasoning(match) {
  const confidence = match.score;

  if (confidence > 0.85) {
    return `Strong match: Multiple visual features align with ${match.card.label}`;
  } else if (confidence > 0.7) {
    return `Likely match: Key features present, some ambiguity`;
  } else if (confidence > 0.5) {
    return `Possible match: Partial visual alignment`;
  } else {
    return `Low confidence: Limited visual correspondence`;
  }
}
```

**Frontend Display:**
```jsx
// src/components/VisionValidationPanel.jsx (enhancement)
<VisionMatch>
  <CardName>{match.predictedCard}</CardName>
  <Confidence>{(match.confidence * 100).toFixed(1)}%</Confidence>
  <Basis>Matched on: {match.basis}</Basis>
  <Reasoning>{match.reasoning}</Reasoning>

  {match.attention && (
    <button onClick={() => showAttentionOverlay(match)}>
      🔍 View Attention Map
    </button>
  )}
</VisionMatch>
```

**Expected Output:**
```
The Fool - 91.2% confidence
Matched on: color palette (yellow, white, sky-blue) + symbols (sun, dog, cliff) + composition (figure-on-precipice)
Strong match: Multiple visual features align with The Fool
[View Attention Map]
```

**Guide Alignment:** Section III.3 "Interpretability Through Explanations"

---

### **Phase 2: Symbol-Level Detection** (Guide III.2)
**Priority: MEDIUM** | **Effort: High** | **Impact: High**

#### **2.1 Add Object Detection Layer**
Verify individual symbols are present using a separate model.

**Implementation:**
```javascript
// shared/vision/symbolDetector.js
import { pipeline } from '@xenova/transformers';

export class SymbolDetector {
  constructor() {
    this._detectorPromise = null;
  }

  async load() {
    if (!this._detectorPromise) {
      // Use DETR or YOLO for object detection
      this._detectorPromise = pipeline(
        'object-detection',
        'Xenova/detr-resnet-50'
      );
    }
    return this._detectorPromise;
  }

  async detectSymbols(imageData, card) {
    const detector = await this.load();
    const annotation = getAnnotation(card);

    if (!annotation?.symbols) {
      return { detected: [], expected: [], matchRate: null };
    }

    // Run object detection
    const detections = await detector(imageData, {
      threshold: 0.5,
      percentage: true  // Return as % of image dimensions
    });

    // Match detections to expected symbols
    const expected = annotation.symbols;
    const detected = this._matchDetectionsToSymbols(detections, expected);

    const matchRate = detected.filter(d => d.found).length / expected.length;

    return {
      detected,
      expected,
      matchRate,
      missing: expected.filter(sym =>
        !detected.find(d => d.object === sym.object && d.found)
      ),
      unexpected: detections.filter(det =>
        !this._isExpectedObject(det, expected)
      )
    };
  }

  _matchDetectionsToSymbols(detections, expectedSymbols) {
    return expectedSymbols.map(sym => {
      // Find detection matching this symbol
      const match = detections.find(det =>
        this._isSemanticMatch(det.label, sym.object) &&
        this._isPositionalMatch(det.box, sym.position)
      );

      return {
        object: sym.object,
        expected: sym,
        found: !!match,
        detection: match || null,
        confidence: match?.score || 0
      };
    });
  }

  _isSemanticMatch(detectedLabel, symbolObject) {
    // Map detector labels to symbol vocabulary
    const synonymMap = {
      'sun': ['sun', 'solar disk', 'celestial body'],
      'dog': ['dog', 'canine', 'wolf', 'hound'],
      'cliff': ['cliff', 'precipice', 'edge', 'mountain edge'],
      'crown': ['crown', 'coronet', 'tiara'],
      // ... full mapping
    };

    const synonyms = synonymMap[symbolObject.toLowerCase()] || [symbolObject];
    return synonyms.some(syn =>
      detectedLabel.toLowerCase().includes(syn)
    );
  }
}
```

**Integration with Vision Pipeline:**
```javascript
// shared/vision/tarotVisionPipeline.js (enhancement)
import { SymbolDetector } from './symbolDetector.js';

export class TarotVisionPipeline {
  constructor(options = {}) {
    // ... existing code
    this.symbolDetector = options.enableSymbolDetection
      ? new SymbolDetector()
      : null;
  }

  async identifyCard(imageData, options = {}) {
    const matches = await this._computeMatches(imageData);

    // Add symbol detection for top match
    if (this.symbolDetector && options.verifySymbols) {
      const topMatch = matches[0];
      const symbolVerification = await this.symbolDetector.detectSymbols(
        imageData,
        topMatch.card
      );

      topMatch.symbolVerification = symbolVerification;

      // Adjust confidence based on symbol match rate
      topMatch.adjustedConfidence = topMatch.score * (
        0.7 + 0.3 * symbolVerification.matchRate
      );
    }

    return matches;
  }
}
```

**Metrics Tracking:**
```javascript
// functions/api/tarot-reading.js (enhancement)
const visionMetrics = {
  cardIdAccuracy: avgConfidence,
  symbolDetectionRate: sanitizedVisionInsights.map(insight => ({
    card: insight.predictedCard,
    symbolMatchRate: insight.symbolVerification?.matchRate || null,
    missingSymbols: insight.symbolVerification?.missing || []
  })),
  hallucinationRate: mismatchedDetections.length / cardsInfo.length
};

console.log(`[${requestId}] Vision metrics:`, visionMetrics);

// Store for later analysis
await env.METRICS_DB?.put(
  `vision-metrics-${requestId}`,
  JSON.stringify(visionMetrics)
);
```

**Expected Metrics:**
```json
{
  "cardIdAccuracy": 0.89,
  "symbolDetectionRate": [
    {
      "card": "The Fool",
      "symbolMatchRate": 0.83,
      "missingSymbols": ["feather"]
    }
  ],
  "hallucinationRate": 0.0
}
```

**Guide Alignment:** Section III.2 "Symbolic Recognition Task" and Section III.7 "Symbol/Feature Detection Scores"

---

### **Phase 3: Human-in-the-Loop Feedback** (Guide III.5)
**Priority: HIGH** | **Effort: Low-Medium** | **Impact: Very High**

#### **3.1 Post-Reading Feedback UI**
Collect user satisfaction and card resonance data.

**Implementation:**
```jsx
// src/components/ReadingFeedback.jsx
import React, { useState } from 'react';

export function ReadingFeedback({
  reading,
  cardsInfo,
  spreadAnalysis,
  onSubmit
}) {
  const [ratings, setRatings] = useState({
    overallAccuracy: null,
    narrativeCoherence: null,
    practicalValue: null,
    resonantCards: [],
    textFeedback: ''
  });

  const handleSubmit = async () => {
    const feedback = {
      timestamp: new Date().toISOString(),
      readingId: reading.id,
      spreadKey: spreadAnalysis.spreadKey,
      ratings,
      cardsInfo: cardsInfo.map(c => ({
        card: c.card,
        position: c.position,
        orientation: c.orientation,
        didResonate: ratings.resonantCards.includes(c.card)
      }))
    };

    // Submit to analytics endpoint
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(feedback)
    });

    onSubmit?.(feedback);
  };

  return (
    <div className="reading-feedback-panel">
      <h3>How did this reading resonate?</h3>

      {/* Overall accuracy */}
      <RatingQuestion
        question="How accurate was this reading?"
        scale={5}
        labels={['Not at all', 'Somewhat', 'Mostly', 'Very', 'Extremely']}
        value={ratings.overallAccuracy}
        onChange={(v) => setRatings(r => ({ ...r, overallAccuracy: v }))}
      />

      {/* Narrative coherence */}
      <RatingQuestion
        question="How clear and cohesive was the narrative?"
        scale={5}
        labels={['Confusing', 'Unclear', 'Clear', 'Very clear', 'Perfectly clear']}
        value={ratings.narrativeCoherence}
        onChange={(v) => setRatings(r => ({ ...r, narrativeCoherence: v }))}
      />

      {/* Practical value */}
      <RatingQuestion
        question="How actionable was the guidance?"
        scale={5}
        labels={['Not actionable', 'Vague', 'Somewhat actionable', 'Actionable', 'Very actionable']}
        value={ratings.practicalValue}
        onChange={(v) => setRatings(r => ({ ...r, practicalValue: v }))}
      />

      {/* Card resonance */}
      <div className="card-resonance">
        <label>Which cards resonated most strongly? (select all that apply)</label>
        <div className="card-checkboxes">
          {cardsInfo.map(card => (
            <label key={card.card}>
              <input
                type="checkbox"
                checked={ratings.resonantCards.includes(card.card)}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setRatings(r => ({
                    ...r,
                    resonantCards: checked
                      ? [...r.resonantCards, card.card]
                      : r.resonantCards.filter(c => c !== card.card)
                  }));
                }}
              />
              <span>{card.card} ({card.position})</span>
            </label>
          ))}
        </div>
      </div>

      {/* Free text feedback */}
      <div className="text-feedback">
        <label>Any additional thoughts? (optional)</label>
        <textarea
          rows={4}
          placeholder="What stood out? What could be improved?"
          value={ratings.textFeedback}
          onChange={(e) => setRatings(r => ({ ...r, textFeedback: e.target.value }))}
        />
      </div>

      <button onClick={handleSubmit} disabled={!ratings.overallAccuracy}>
        Submit Feedback
      </button>
    </div>
  );
}
```

**Backend Storage:**
```javascript
// functions/api/feedback.js
export async function onRequestPost({ request, env }) {
  const feedback = await request.json();

  // Store in KV or D1 database
  const key = `feedback-${Date.now()}-${crypto.randomUUID()}`;
  await env.FEEDBACK_KV.put(key, JSON.stringify(feedback), {
    metadata: {
      spreadKey: feedback.spreadKey,
      overallAccuracy: feedback.ratings.overallAccuracy,
      timestamp: feedback.timestamp
    }
  });

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

**Analytics Dashboard:**
```javascript
// scripts/evaluation/analyzeFeedback.js
import { readFeedbackData } from './lib/feedbackStorage.js';

const feedbackRecords = await readFeedbackData({ limit: 1000 });

const metrics = {
  averageAccuracy: mean(feedbackRecords.map(f => f.ratings.overallAccuracy)),
  averageCoherence: mean(feedbackRecords.map(f => f.ratings.narrativeCoherence)),
  averagePracticalValue: mean(feedbackRecords.map(f => f.ratings.practicalValue)),

  // Per-spread breakdown
  bySpread: groupBy(feedbackRecords, 'spreadKey').map(([key, records]) => ({
    spread: key,
    count: records.length,
    avgAccuracy: mean(records.map(r => r.ratings.overallAccuracy))
  })),

  // Card resonance frequency
  mostResonantCards: countResonance(feedbackRecords)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
};

console.log('Feedback Metrics:', metrics);
```

**Expected Metrics:**
```json
{
  "averageAccuracy": 4.2,
  "averageCoherence": 4.5,
  "averagePracticalValue": 4.1,
  "bySpread": [
    { "spread": "celtic", "count": 87, "avgAccuracy": 4.3 },
    { "spread": "threeCard", "count": 124, "avgAccuracy": 4.1 }
  ],
  "mostResonantCards": [
    { "card": "The Star", "count": 42 },
    { "card": "Death", "count": 38 }
  ]
}
```

**Guide Alignment:** Section III.5 "Human-in-the-Loop Evaluation" and Section III.4 "User Engagement Metrics"

---

### **Phase 4: Narrative Quality Metrics** (Guide III.4)
**Priority: MEDIUM** | **Effort: Medium** | **Impact: Medium**

#### **4.1 Reference Reading Corpus**
Build a dataset of expert-written readings for comparison.

**Implementation:**
```javascript
// data/referenceReadings.json
[
  {
    "id": "ref-001",
    "spreadKey": "threeCard",
    "cards": [
      { "card": "The Fool", "position": "Past", "orientation": "Upright" },
      { "card": "The Tower", "position": "Present", "orientation": "Reversed" },
      { "card": "The Star", "position": "Future", "orientation": "Upright" }
    ],
    "question": "How can I navigate this transition in my career?",
    "expertReading": "The journey begins with **The Fool** upright in your past—a willingness to take risks and embrace new possibilities without overthinking. This innocence and openness led you to where you stand now.\n\nIn the present, **The Tower** reversed suggests that the sudden upheaval you feared is actually happening more gradually, internally. Rather than an external collapse, you're experiencing a controlled dismantling of structures that no longer serve you...",
    "author": "Expert Reader A",
    "quality": "canonical"  // canonical | good | acceptable
  }
]
```

#### **4.2 Similarity Scoring**
Compare generated readings to reference corpus.

**Implementation:**
```javascript
// scripts/evaluation/narrativeQuality.js
import { pipeline } from '@xenova/transformers';
import { cosineSimilarity } from 'ml-distance';
import { loadReferenceReadings } from './lib/referenceCorpus.js';

const embedder = await pipeline(
  'feature-extraction',
  'Xenova/all-MiniLM-L6-v2'
);

async function scoreNarrativeQuality(generatedReading, cardCombination) {
  // Find reference readings with same card combination
  const references = loadReferenceReadings().filter(ref =>
    isSameCardCombination(ref.cards, cardCombination)
  );

  if (references.length === 0) {
    console.warn('No reference readings for this combination');
    return { similarity: null, references: 0 };
  }

  // Embed generated reading
  const generatedEmbedding = await embedder(generatedReading, {
    pooling: 'mean',
    normalize: true
  });

  // Compare to each reference
  const similarities = await Promise.all(
    references.map(async ref => {
      const refEmbedding = await embedder(ref.expertReading, {
        pooling: 'mean',
        normalize: true
      });

      return {
        reference: ref.id,
        similarity: cosineSimilarity(
          Array.from(generatedEmbedding.data),
          Array.from(refEmbedding.data)
        ),
        quality: ref.quality
      };
    })
  );

  // Weight by reference quality
  const qualityWeights = { canonical: 1.0, good: 0.8, acceptable: 0.6 };
  const weightedScore = similarities.reduce((sum, sim) =>
    sum + sim.similarity * qualityWeights[sim.quality],
    0
  ) / similarities.length;

  return {
    similarity: weightedScore,
    references: similarities.length,
    breakdown: similarities
  };
}
```

**Integration:**
```javascript
// functions/api/tarot-reading.js (enhancement)
if (env.ENABLE_QUALITY_METRICS) {
  const qualityScore = await scoreNarrativeQuality(reading, cardsInfo);

  console.log(`[${requestId}] Narrative quality score: ${qualityScore.similarity}`);

  // Log for monitoring
  await env.METRICS_DB?.put(
    `quality-${requestId}`,
    JSON.stringify({
      timestamp: new Date().toISOString(),
      provider,
      qualityScore,
      spreadKey: analysis.spreadKey
    })
  );
}
```

**Dashboard:**
```javascript
// scripts/evaluation/qualityDashboard.js
const qualityMetrics = await loadQualityMetrics({ days: 30 });

const analysis = {
  overallAverage: mean(qualityMetrics.map(m => m.qualityScore.similarity)),

  byProvider: {
    'azure-gpt5': mean(qualityMetrics.filter(m => m.provider === 'azure-gpt5').map(m => m.qualityScore.similarity)),
    'local': mean(qualityMetrics.filter(m => m.provider === 'local').map(m => m.qualityScore.similarity))
  },

  trend: calculateTrend(qualityMetrics, 'similarity')
};

console.log('Quality Metrics (30 days):', analysis);
// Expected: { overallAverage: 0.78, byProvider: { 'azure-gpt5': 0.82, 'local': 0.71 } }
```

**Guide Alignment:** Section III.4 "Text Similarity to Canonical Meanings"

---

### **Phase 5: Advanced Metrics Tracking** (Guide III.7)
**Priority: LOW** | **Effort: Low** | **Impact: Medium**

#### **5.1 Hallucination Rate Monitoring**
Track when vision model predicts cards not in the deck.

**Implementation:**
```javascript
// shared/vision/hallucinationDetector.js
export function detectHallucinations(visionMatches, deckLibrary) {
  const validCardNames = new Set(
    deckLibrary.map(card => canonicalCardKey(card.name))
  );

  const hallucinations = visionMatches.filter(match => {
    const predictedKey = canonicalCardKey(match.card);
    return !validCardNames.has(predictedKey);
  });

  return {
    hallucinationRate: hallucinations.length / visionMatches.length,
    hallucinations: hallucinations.map(h => ({
      predicted: h.card,
      confidence: h.confidence,
      closestValid: findClosestValidCard(h.card, deckLibrary)
    }))
  };
}
```

**Metrics Logging:**
```javascript
// functions/api/tarot-reading.js (enhancement)
const hallucinationMetrics = detectHallucinations(
  sanitizedVisionInsights.map(i => i.predictedCard),
  getDeckPool(true)
);

if (hallucinationMetrics.hallucinationRate > 0) {
  console.warn(`[${requestId}] Hallucination detected:`, hallucinationMetrics);
}

// Track over time
await logMetric(env, 'hallucination_rate', hallucinationMetrics.hallucinationRate);
```

#### **5.2 Response Time Tracking**
Monitor performance across pipeline stages.

**Implementation:**
```javascript
// functions/api/tarot-reading.js (already partially implemented, enhance)
const timings = {
  spreadAnalysis: analysisTime,
  narrativeGeneration: usedAzureGPT ? azureTime : localTime,
  visionValidation: visionTime,
  total: totalTime
};

// Store timings for dashboard
await env.METRICS_DB?.put(
  `timings-${requestId}`,
  JSON.stringify({
    timestamp: new Date().toISOString(),
    provider,
    spreadKey: analysis.spreadKey,
    cardCount: cardsInfo.length,
    timings
  })
);
```

**Performance Dashboard:**
```javascript
// scripts/evaluation/performanceDashboard.js
const timingMetrics = await loadTimingMetrics({ days: 7 });

const analysis = {
  avgTotalTime: mean(timingMetrics.map(m => m.timings.total)),
  p95TotalTime: percentile(timingMetrics.map(m => m.timings.total), 95),

  bySpread: groupBy(timingMetrics, 'spreadKey').map(([key, records]) => ({
    spread: key,
    avgTime: mean(records.map(r => r.timings.total)),
    breakdown: {
      analysis: mean(records.map(r => r.timings.spreadAnalysis)),
      narrative: mean(records.map(r => r.timings.narrativeGeneration)),
      vision: mean(records.map(r => r.timings.visionValidation))
    }
  })),

  slowest: timingMetrics
    .sort((a, b) => b.timings.total - a.timings.total)
    .slice(0, 10)
};

console.log('Performance Metrics (7 days):', analysis);
```

**Guide Alignment:** Section III.7 "Response Time/Latency"

---

## 📊 **Implementation Priority Matrix**

| Phase | Priority | Effort | Impact | Time Estimate | Dependencies |
|-------|----------|--------|--------|---------------|--------------|
| **Phase 1: Vision Interpretability** | 🔴 HIGH | Medium | High | 2-3 weeks | None |
| **Phase 3: Feedback UI** | 🔴 HIGH | Low-Med | Very High | 1 week | None |
| **Phase 2: Symbol Detection** | 🟡 MEDIUM | High | High | 3-4 weeks | Phase 1 (optional) |
| **Phase 4: Narrative Quality** | 🟡 MEDIUM | Medium | Medium | 2 weeks | Phase 3 (for validation) |
| **Phase 5: Advanced Metrics** | 🟢 LOW | Low | Medium | 1 week | Phase 1-4 (optional) |

---

## 🎯 **Recommended Implementation Order**

### **Sprint 1 (Week 1-2): Quick Wins**
✅ **Phase 3.1** - Post-Reading Feedback UI
✅ **Phase 1.2** - Enhanced Confidence Explanations
✅ **Phase 5.2** - Response Time Tracking

**Outcome:** User feedback collection starts immediately, foundation for quality metrics established.

---

### **Sprint 2 (Week 3-5): Vision Interpretability**
✅ **Phase 1.1** - Attention Visualization
✅ **Phase 5.1** - Hallucination Rate Monitoring

**Outcome:** Complete transparency into vision model decisions.

---

### **Sprint 3 (Week 6-9): Symbol Detection**
✅ **Phase 2.1** - Object Detection Layer
✅ Integration with vision pipeline
✅ Symbol verification metrics

**Outcome:** Symbol/feature detection scores tracked (Guide III.7).

---

### **Sprint 4 (Week 10-12): Narrative Quality**
✅ **Phase 4.1** - Build reference corpus (20-30 expert readings)
✅ **Phase 4.2** - Similarity scoring system
✅ Integrate with feedback data for correlation analysis

**Outcome:** Quantitative narrative quality metrics available.

---

## 📈 **Expected Coverage After Implementation**

| Guide Requirement | Current | After Implementation |
|-------------------|---------|---------------------|
| **III.2 Benchmarks** | 40% | **100%** ✅ |
| **III.3 Interpretability** | 30% | **100%** ✅ |
| **III.4 Performance Metrics** | 50% | **100%** ✅ |
| **III.5 Human-in-Loop** | 0% | **100%** ✅ |
| **III.6 Ethics** | 100% | **100%** ✅ |
| **III.7 Advanced Metrics** | 40% | **100%** ✅ |

**Overall Evaluation/Interpretability Coverage: 40% → 100%** 🎉

---

## 🚀 **Bonus: A/B Testing Infrastructure** (Optional)

For continuous improvement:

```javascript
// functions/api/tarot-reading.js (A/B testing)
const variant = hashRequestId(requestId) % 2 === 0 ? 'A' : 'B';

if (variant === 'A') {
  // Control: Current reversal framework selection
  reversalFramework = selectReversalFramework(reversalRatio, cardsInfo);
} else {
  // Variant: Always use contextual framework
  reversalFramework = 'contextual';
}

// Log variant for analysis
await logExperiment(env, requestId, {
  variant,
  reversalFramework,
  spreadKey: analysis.spreadKey
});

// Later, correlate with feedback ratings
const feedbackData = await getFeedbackForRequest(requestId);
// Compare avgAccuracy between variant A and B
```

---

## 📋 **Next Steps**

Choose your starting point:

1. **Build the attention visualization system** (Phase 1.1) - Most technically challenging, highest interpretability impact
2. **Create the feedback UI components** (Phase 3.1) - Quickest win, enables all future quality analysis
3. **Design the reference reading corpus structure** (Phase 4.1) - Foundation for narrative quality metrics
4. **Set up the metrics tracking infrastructure** (Phase 5) - Low-hanging fruit for immediate monitoring
5. **Create a complete evaluation dashboard** combining all metrics - Holistic view of system performance

**Recommended starting point:** Phase 3.1 (Feedback UI) → Phase 1.2 (Enhanced Explanations) → Phase 5.2 (Response Time Tracking)

This gets you 3 quick wins in Sprint 1 and establishes the data collection foundation for all future improvements.
