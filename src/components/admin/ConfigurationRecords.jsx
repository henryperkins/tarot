import { useEffect, useState } from 'react';
import { displayValue, modelLabel, providerLabel } from '../../lib/adminAiConfiguration.js';

function RecordList({ path, request, render }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    request(path, { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [path, request, retry]);
  if (error) return <div role="alert" className="ai-error">{error} <button className="ai-button" onClick={() => {
    setError(''); setRetry(retry + 1);
  }}>Try again</button></div>;
  return data ? render(data) : <p role="status" className="ai-meta">Loading…</p>;
}

const fields = { providerId: 'Provider', modelId: 'Model', reasoningEffort: 'Reasoning effort', order: 'Fallback order' };

function historyField(feature, path) {
  const parts = path.split('.');
  const name = fields[parts.at(-1)] || displayValue(path);
  return parts.length === 3 && feature ? providerLabel(feature, parts[1]) + ' · ' + name : name;
}

function historyValue(feature, value, field) {
  if (Array.isArray(value)) return value.map(step => historyValue(feature, step, field)).join(' → ');
  if (value?.providerId && feature) {
    return [providerLabel(feature, value.providerId), modelLabel(feature, value), value.reasoningEffort].filter(Boolean).join(' / ');
  }
  if (value == null || value === '') return 'Task default';
  if (typeof value === 'object') return JSON.stringify(value);
  if (feature && (field.endsWith('providerId') || field.endsWith('.order'))) return providerLabel(feature, value);
  if (field.endsWith('reasoningEffort')) return displayValue(value);
  return String(value);
}

function HistoryChange({ feature, change }) {
  const field = historyField(feature, change.field);
  if (change.field === 'fallbacks.order') {
    return <li>{field}
      <div className="ai-history-orders">{['Before', 'After'].map(label => (
        <div key={label}>
          <strong>{label}</strong>
          <ol aria-label={label}>{change[label.toLowerCase()].map(id =>
            <li key={id}>{historyValue(feature, id, change.field)}</li>)}</ol>
        </div>
      ))}</div>
    </li>;
  }
  return <li>{field} · {historyValue(feature, change.before, change.field)} → {historyValue(feature, change.after, change.field)}</li>;
}

function HistoryPages({ request, features, filter, cursor = '' }) {
  const [next, setNext] = useState(null);
  const query = new URLSearchParams();
  if (filter) query.set('feature', filter);
  if (cursor) query.set('cursor', cursor);
  return <RecordList path={'/history?' + query} request={request} render={({ entries, nextCursor }) => <>
    {!entries.length && !cursor && <p className="ai-meta">No saved changes yet.</p>}
    <ol className="ai-record-list">{entries.map(entry => {
      const feature = features.find(item => item.id === entry.featureId);
      return <li key={entry.featureId + '-' + entry.revision}>
        <div className="ai-line"><strong>{feature?.label || entry.featureId}</strong><span className="ai-chip">Revision {entry.revision}</span></div>
        <p>{displayValue(entry.environment)} · <time dateTime={entry.createdAt}>{new Date(entry.createdAt).toISOString().slice(0, 19).replace('T', ' ')} UTC</time> · {entry.actor}</p>
        <ul>{entry.diff.map(change => <HistoryChange key={change.field} change={change} feature={feature} />)}</ul>
      </li>;
    })}</ol>
    {next ? <HistoryPages request={request} features={features} filter={filter} cursor={next} />
      : nextCursor && <button type="button" className="ai-button" onClick={() => setNext(nextCursor)}>Load more changes</button>}
  </>} />;
}

export function ChangeHistory({ request, features }) {
  const [filter, setFilter] = useState('');
  return <section className="ai-records">
    <div className="ai-line"><h2>Change history</h2>
      <label>Feature <select value={filter} onChange={event => setFilter(event.target.value)}>
        <option value="">All features</option>{features.map(feature => <option key={feature.id} value={feature.id}>{feature.label}</option>)}
      </select></label></div>
    <HistoryPages key={filter} request={request} features={features} filter={filter} />
  </section>;
}
