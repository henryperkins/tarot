import { wilsonInterval } from '../../scripts/evaluation/lib/readingCueQualification.mjs';

export function buildIndependentReadingSchedule(raw) {
  const words = [...raw.matchAll(/\S+/g)];
  return { wordsPerMinute: 180, durationMs: words.length * 60000 / 180,
    steps: words.map((match, index) => ({ start: match.index, end: match.index + match[0].length, atMs: index * 60000 / 180 })) };
}
const targetKey = targets => JSON.stringify(targets.flatMap(t => (t.detailIds.length ? t.detailIds : ['@identity'])
  .map(id => `${t.spreadIndex}:${id}`)).sort());

// Task 6 supplies the frozen independent semantic scorer's one-to-one matches.
// The offline structural fallback is explicitly for collector negative controls;
// it is never an adjudication or a live quality verdict.
export function scoreCueBrowserReport({ report, opportunities, cues = [], matches, offline = false }) {
  if (!matches && !offline) throw new Error('Independent adjudicated matches required for live timing score');
  const used = new Set();
  matches ??= opportunities.flatMap(o => {
    const cue = cues.find(c => !used.has(c.id) && c.kind === o.kind && targetKey(c.targets) === targetKey(o.targets)
      && o.anchors.some(a => c.passage.start >= a.start && c.passage.end <= a.end));
    if (!cue) return [];
    used.add(cue.id); return [{ opportunityId: o.id, cueId: cue.id }];
  });
  const firstIntervals = new Map();
  for (const interval of report.passageIntervals) {
    if (!firstIntervals.has(interval.opportunityId)) firstIntervals.set(interval.opportunityId, interval);
  }
  const eligible = report.lane === 'automatic' ? opportunities.filter(o => o.required) : [];
  const receipt = id => report.cueReceipts.find(c => c.cueId === id);
  const rows = eligible.map(o => {
    const match = matches.find(m => m.opportunityId === o.id);
    const interval = firstIntervals.get(o.id);
    const received = receipt(match?.cueId);
    const passage = report.passageEvents?.find(p => p.opportunityId === o.id);
    const available = Boolean(interval && interval.start < report.window.end && received && received.at <= interval.end && received.at <= report.window.end);
    return { opportunityId: o.id, cueId: match?.cueId ?? null, available,
      reason: !interval ? passage?.projection === 'unprojectable-source' ? 'unprojectable-source' : 'never-visible-or-not-rendered' : !received ? 'missing-cue' : !available ? 'late-static-revisit' : 'timely-receipt',
      lagMs: received && passage?.receivedAt != null ? received.at - passage.receivedAt : null };
  });
  const lags = rows.filter(r => r.lagMs !== null).map(r => r.lagMs).sort((a, b) => a - b);
  const numerator = rows.filter(r => r.available).length;
  const denominator = eligible.length;
  const qualifiedExposures = report.detailExposures.filter(e => {
    const row = rows.find(r => r.cueId === e.cueId && r.available);
    const o = opportunities.find(o => o.id === row?.opportunityId);
    const interval = firstIntervals.get(o?.id);
    const adopted = report.cueAdoptions.some(a => a.cueId === e.cueId && a.at <= e.start);
    return report.lane === 'automatic' && adopted && e.origin === 'automatic' && e.passageVisible && o
      && targetKey(e.targets) === targetKey(o.targets)
      && Math.min(e.end, interval.end, report.window.end) - Math.max(e.start, interval.start, report.window.start) >= 600;
  });
  const exposed = opportunities.filter(o => qualifiedExposures.some(e => matches.some(m => m.cueId === e.cueId && m.opportunityId === o.id)));
  const star = report.caseId === 'star-2347-excerpt';
  const literalDetails = new Set(exposed.filter(o => o.kind === 'literal').flatMap(o => o.targets.flatMap(t => t.detailIds)));
  const introduced = new Set(exposed.filter(o => ['identity', 'literal'].includes(o.kind)).flatMap(o => o.targets.map(t => t.spreadIndex)));
  const passed = star ? ['pool-pour', 'land-pour'].every(id => literalDetails.has(id))
    && exposed.some(o => o.kind === 'interpretation') && exposed.some(o => o.kind === 'balance')
    : introduced.size >= 3 && exposed.some(o => o.kind === 'relationship' && o.targets.some(t => t.spreadIndex === 0)
      && o.targets.some(t => t.spreadIndex === 2)) && exposed.some(o => o.kind === 'interpretation');
  const p95Ms = lags.length ? lags[Math.ceil(lags.length * .95) - 1] : null;
  return { offlineStructuralControl: offline, excludedLifecycleOpportunities: report.lane === 'automatic' ? 0 : opportunities.length, rows,
    availability: { numerator, denominator, value: denominator ? numerator / denominator : null,
      wilson95: wilsonInterval(numerator, denominator), p95Ms,
      passed: report.measurementValid !== false && !report.truncated && report.lane === 'automatic' && denominator > 0 && numerator / denominator >= .8 && p95Ms !== null && p95Ms <= 10000 },
    accompaniment: { passed: report.measurementValid !== false && !report.truncated && Boolean(passed), qualifiedExposures, minimumExposureMs: 600 } };
}
