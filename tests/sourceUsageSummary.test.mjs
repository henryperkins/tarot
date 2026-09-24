import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { buildUserContextSourceUsage } from '../functions/lib/narrative/sourceUsage.js';
import { formatUsageSummary } from '../src/components/reading/complete/sourceUsageSummary.js';

describe('formatUsageSummary', () => {
  test('returns an empty summary for missing source usage', () => {
    const result = formatUsageSummary(null);

    assert.deepEqual(result, {
      rows: [],
      summary: {
        used: 0,
        requestedNotUsed: 0
      }
    });
  });

  test('captures source usage states and aggregate counts', () => {
    const result = formatUsageSummary({
      spreadCards: { requested: true, used: true },
      vision: { requested: true, used: false },
      userContext: {
        requested: true,
        used: true,
        questionProvided: true,
        questionUsed: true,
        reflectionsProvided: true,
        reflectionsUsed: false,
        displayNameProvided: true,
        displayNameUsed: true,
        focusAreasProvided: false,
        usedInputs: ['question', 'displayName'],
        skippedInputs: {
          reflections: 'deduped_against_card_reflection'
        }
      },
      graphRAG: {
        requested: true,
        used: true,
        mode: 'semantic_scoring',
        passagesProvided: 9,
        passagesUsedInPrompt: 4
      },
      ephemeris: { requested: true, skippedReason: 'token_budget' },
      forecast: { requested: false, used: false }
    });

    const byLabel = Object.fromEntries(result.rows.map((row) => [row.label, row]));

    assert.equal(byLabel['Spread & cards'].state, 'used');
    assert.equal(byLabel['Vision uploads'].state, 'requestedNotUsed');
    assert.equal(byLabel['User context'].detail, 'Used: question, display name | Skipped: reflections (deduped against card reflection)');
    assert.equal(byLabel['Traditional wisdom'].detail, 'semantic_scoring mode, 4/9 passages');
    assert.equal(byLabel.Ephemeris.state, 'skipped');
    assert.equal(byLabel.Ephemeris.detail, 'Reason: token budget');
    assert.equal(byLabel.Forecast.state, 'notRequested');
    assert.deepEqual(result.summary, {
      used: 3,
      requestedNotUsed: 2
    });
  });

  test('formats uploaded vision evidence usage distinctly from telemetry-only uploads', () => {
    const usage = formatUsageSummary({
      vision: {
        requested: true,
        used: true,
        eligibleUploads: 1,
        telemetryOnlyUploads: 2,
        evidencePacketsUsed: 1,
        evidenceMode: 'uploaded_image'
      }
    });
    const row = usage.rows.find((entry) => entry.label === 'Vision uploads');
    assert.ok(row, 'expected Vision uploads row');
    assert.ok(row.detail.includes('1 uploaded evidence packet used'), `detail was: ${row.detail}`);
    assert.ok(row.detail.includes('2 telemetry-only'), `detail was: ${row.detail}`);
  });

  test('renders missing user context as not requested instead of skipped', () => {
    const result = formatUsageSummary({
      spreadCards: { requested: true, used: true },
      vision: { requested: false, used: false },
      userContext: buildUserContextSourceUsage({}),
      graphRAG: { requested: false, used: false },
      ephemeris: { requested: false, used: false },
      forecast: { requested: false, used: false }
    });

    const byLabel = Object.fromEntries(result.rows.map((row) => [row.label, row]));
    assert.equal(byLabel['User context'].state, 'notRequested');
    assert.equal(byLabel['User context'].badgeText, 'Not requested');
    assert.equal(byLabel['User context'].detail, '');
  });

  test('keeps reference source labels and aggregate counts tied to supplied metadata', () => {
    const result = formatUsageSummary({
      spreadCards: { requested: true, used: true },
      vision: { requested: false, used: false },
      userContext: {
        requested: true,
        used: true,
        usedInputs: ['question', 'tone']
      },
      graphRAG: {
        requested: true,
        used: true,
        mode: 'semantic',
        passagesProvided: 3,
        passagesUsedInPrompt: 2
      },
      ephemeris: { requested: true, used: false },
      forecast: { requested: true, used: false, skippedReason: 'budget_limit' }
    });

    assert.deepEqual(result.summary, { used: 3, requestedNotUsed: 2 });
    assert.deepEqual(result.rows, [
      { label: 'Spread & cards', state: 'used', badgeText: 'Used', detail: '' },
      { label: 'Vision uploads', state: 'notRequested', badgeText: 'Not requested', detail: '' },
      { label: 'User context', state: 'used', badgeText: 'Used', detail: 'Used: question, tone' },
      { label: 'Traditional wisdom', state: 'used', badgeText: 'Used', detail: 'semantic mode, 2/3 passages' },
      { label: 'Ephemeris', state: 'requestedNotUsed', badgeText: 'Requested not used', detail: '' },
      { label: 'Forecast', state: 'skipped', badgeText: 'Skipped', detail: 'Reason: budget limit' }
    ]);
  });

  test('changes summary and details for a second source model without inventing context', () => {
    const result = formatUsageSummary({
      spreadCards: { requested: true, used: true },
      vision: { requested: true, used: true, evidencePacketsUsed: 2 },
      userContext: { requested: false, used: false },
      graphRAG: { requested: false, used: false, skippedReason: 'not_requested' },
      ephemeris: { requested: true, used: false, skippedReason: 'unavailable' },
      forecast: { requested: false, used: false }
    });

    assert.deepEqual(result.summary, { used: 2, requestedNotUsed: 1 });
    assert.deepEqual(result.rows, [
      { label: 'Spread & cards', state: 'used', badgeText: 'Used', detail: '' },
      { label: 'Vision uploads', state: 'used', badgeText: 'Used', detail: '2 uploaded evidence packets used' },
      { label: 'User context', state: 'notRequested', badgeText: 'Not requested', detail: '' },
      { label: 'Traditional wisdom', state: 'notRequested', badgeText: 'Not requested', detail: '' },
      { label: 'Ephemeris', state: 'skipped', badgeText: 'Skipped', detail: 'Reason: unavailable' },
      { label: 'Forecast', state: 'notRequested', badgeText: 'Not requested', detail: '' }
    ]);
  });
});
