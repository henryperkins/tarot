import { useEffect, useId, useRef, useState } from 'react';
import { CheckCircle, ClockCounterClockwise, Play, WarningCircle } from '@phosphor-icons/react';
import { displayValue, modelLabel, policyKey, providerLabel } from '../../lib/adminAiConfiguration.js';

const fallbackOrdinals = ['Primary model', 'First fallback', 'Second fallback', 'Third fallback'];
const sampleDescriptions = {
  'guided-questions': 'A creative project needs a first step · Three-Card Story',
  'reading-followups': 'What small step could I take this week? · Sample Hermit reading',
  'journal-summaries': 'Two sample journal entries about creative practice',
  'coach-action-extraction': 'Extract next steps from the sample Hermit reading',
  'reading-evaluation': 'Grade the sample Hermit reading',
  'quality-gate': 'Assess the sample Hermit reading for delivery'
};

function SampleResult({ result, testedPolicy, current, feature, previous, matches }) {
  const attempts = result.attempts || [];
  const accepted = attempts.findLast(attempt => attempt.outcome === 'accepted');
  const repair = attempts.find(attempt => attempt.phase === 'repair');
  const repaired = accepted?.phase === 'repair';
  const legacyFollowUp = feature.id === 'reading-followups' && accepted && !accepted.phase;
  const deliveredLocally = accepted?.providerId?.startsWith('local-');
  const failure = result.status === 'failed';
  const replaced = result.outcome === 'safety_replaced';
  let title = 'Sample complete';
  if (failure) title = 'Sample failed';
  else if (replaced) title = 'Safety response delivered';
  else if (deliveredLocally) title = providerLabel(feature, accepted.providerId) + ' answered';
  else if (accepted && !legacyFollowUp) title = (fallbackOrdinals[accepted.slot] || 'Fallback') + ' answered';
  const primaryIssue = attempts.find(attempt => attempt.slot === 0 && attempt.phase !== 'repair' && attempt.reason);
  const className = failure || replaced ? 'ai-result-icon is-warning' : 'ai-result-icon';
  const StatusIcon = failure || replaced ? WarningCircle : CheckCircle;
  const effortSent = accepted?.effortSent;
  const differentEffort = testedPolicy.primary.reasoningEffort !== current.primary.reasoningEffort;
  return (
    <div className="ai-result" aria-label={previous ? 'Previous sample result' : 'Sample result'}>
      <div className="ai-result-title">
        <StatusIcon size={22} className={className} weight="fill" aria-hidden="true" />
        <strong>{title}</strong>
        <span className={'ai-chip ' + (matches ? '' : 'is-stale')}>
          {!matches && <ClockCounterClockwise size={14} aria-hidden="true" />}
          {previous ? 'Previous run' : matches ? 'Current draft' : 'From an earlier draft'}
        </span>
      </div>
      {accepted && !replaced && !failure && <p>{legacyFollowUp ? 'Recorded generation' : repaired ? 'Repaired by' : 'Answered by'} {providerLabel(feature, accepted.providerId)}
        {accepted.modelId && <> / {modelLabel(feature, accepted)}</>}
        {accepted.modelSource === 'configured' && <small> (configured model)</small>}</p>}
      {!failure && !replaced && effortSent && <p className="ai-meta">{legacyFollowUp ? 'Recorded generation used ' : repaired ? 'Repair used ' : accepted.effectiveEffort ? 'Requested ' : accepted.slot ? 'Fallback used ' : 'Tested with '}{displayValue(effortSent)} reasoning
        {accepted.effectiveEffort && <> · Effective {displayValue(accepted.effectiveEffort)}</>}
        {!accepted.slot && !repaired && differentEffort && <> · Current draft uses {displayValue(current.primary.reasoningEffort)}</>}
      </p>}
      {legacyFollowUp && !replaced && !failure && <p className="ai-meta">Delivery details are unavailable for this earlier run.</p>}
      {(repaired || accepted?.slot > 0 && differentEffort) && <p className="ai-meta">
        Primary draft requested {displayValue(testedPolicy.primary.reasoningEffort)}
        {differentEffort && <> · Current draft uses {displayValue(current.primary.reasoningEffort)}</>}
      </p>}
      {repair && !repaired && !failure && !replaced && <p className="ai-meta">The original response was retained after the repair attempt.</p>}
      {primaryIssue && <p className="ai-meta">{providerLabel(feature, primaryIssue.providerId)} primary attempt · {primaryIssue.reason.replaceAll('_', ' ')}</p>}
      {(result.reason || result.error) && <p>{result.reason || result.error}</p>}
      {result.excerpt && <p className="ai-excerpt">{result.excerpt}</p>}
    </div>
  );
}

export default function FeatureSample({ feature, environment, catalogVersion, policy, request, disabledReason }) {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(null);
  const lastSubmission = useRef(null);
  const isReading = feature.id === 'readings';
  const unavailableId = useId();
  const unavailable = disabledReason || feature.sampleUnavailableReason ||
    (!feature.writable && (feature.readOnlyReason || 'Sampling is disabled for this feature in this environment.')) ||
    (feature.sampleAvailable === false && 'Configure admin sample storage to run a sample.');
  useEffect(() => () => {
    pending.current?.abort();
  }, []);

  async function run() {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setError('');
    setBusy(true);
    const signature = JSON.stringify([environment, feature.id, catalogVersion, feature.fixtureVersion, policyKey(policy)]);
    const retry = lastSubmission.current;
    const runId = retry?.signature === signature ? retry.runId : crypto.randomUUID();
    lastSubmission.current = { signature, runId };
    const base = '/features/' + encodeURIComponent(feature.id) + '/samples';
    try {
      const start = await request(base, { method: 'POST', signal: controller.signal, body: { catalogVersion, runId, policy } });
      // Build the poll path from the feature and run ID. An admin bearer belongs only to this origin.
      const path = base + '/' + encodeURIComponent(start.runId || runId);
      while (!controller.signal.aborted) {
        const receipt = await request(path, { signal: controller.signal });
        if (receipt.status === 'completed' || receipt.status === 'failed') {
          if (receipt.featureId !== feature.id || receipt.environment !== environment || receipt.runId !== runId) {
            throw new Error('The sample receipt belongs to a different request.');
          }
          setResult({ receipt, policy, signature });
          lastSubmission.current = null;
          return;
        }
        await new Promise(resolve => {
          setTimeout(resolve, 1000);
        });
      }
    } catch (err) {
      if (!controller.signal.aborted) setError(err.message);
      if (err.status && err.status < 500) lastSubmission.current = null;
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      pending.current = null;
    }
  }

  const matches = result && result.receipt.fixtureVersion === feature.fixtureVersion
    && result.signature === JSON.stringify([environment, feature.id, catalogVersion, feature.fixtureVersion, policyKey(policy)]);
  return (
    <section className="ai-section ai-sample" aria-label={isReading ? 'Sample reading' : 'Feature sample'}>
      <div className="ai-line ai-sample-heading">
        <div><div className="ai-sample-title"><h3>{isReading ? 'Sample reading' : 'Sample'}</h3><span className="ai-chip">Fixed sample</span></div>
          <p className="ai-meta">{isReading ? 'Same question, spread and cards for every run.' : 'The same fixture is used for every run.'}</p>
        </div>
        <button type="button" className="ai-button" disabled={busy || Boolean(unavailable)} aria-describedby={unavailable ? unavailableId : undefined} onClick={run}>
          <Play size={14} aria-hidden="true" />{busy ? 'Running sample…' : result || error ? 'Run again' : isReading ? 'Run sample reading' : 'Run sample'}
        </button>
      </div>
      {unavailable && <p id={unavailableId} className="ai-meta">{unavailable}</p>}
      {isReading && feature.fixture && <div className="ai-fixture">
        <h4>{feature.fixture.question}</h4>
        <p className="ai-meta">{feature.fixture.spread}</p>
        <ul className="ai-cards" aria-label="Sample cards">{feature.fixture.cards.map(card => <li key={card}>{card}</li>)}</ul>
      </div>}
      {!isReading && <p className="ai-fixture">{sampleDescriptions[feature.id]}</p>}
      <div aria-live="polite" aria-atomic="true">
        {busy && <p className="ai-meta" role="status">Testing the submitted draft…</p>}
        {error && <p role="alert" className="ai-error">{error}</p>}
        {result && <SampleResult result={result.receipt} testedPolicy={result.policy} current={policy}
          feature={feature} previous={busy || Boolean(error)} matches={matches} />}
      </div>
    </section>
  );
}
