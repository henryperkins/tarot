import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { CheckCircle, WarningCircle } from '@phosphor-icons/react';
import OwnerSubscription from './OwnerSubscription.jsx';

const sources = {
  deployment: 'Deployment settings', portal: 'Portal settings', disconnected: 'Disconnected in portal',
  binding: 'Deployment binding', builtin: 'Built in'
};
const success = { replace: 'credentials saved', disconnect: 'disconnected', reset: 'restored to deployment settings' };

function ConnectionEditor({ connection, pending, onSave, onClose }) {
  const [action, setAction] = useState('replace');
  const [mode, setMode] = useState('pair');
  const modal = connection.id === 'modal-qwen';
  const replacing = action === 'replace' && !connection.recoveryOnly;
  const visibleFields = connection.fields.filter(field => !modal || field.name === 'endpointUrl'
    || (mode === 'pair' ? ['tokenId', 'tokenSecret'].includes(field.name) : field.name === 'token'));

  function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    let values;
    if (replacing) {
      const data = new FormData(form);
      values = Object.fromEntries(visibleFields.map(field => [field.name, data.get(field.name)]));
      // Remove typed credentials immediately. The server never returns a saved value.
      for (const field of visibleFields) form.elements.namedItem(field.name).value = '';
    }
    onSave(action, values);
  }

  return <form className="ai-connection-form" aria-label={connection.label + ' connection settings'} onSubmit={submit}>
    <fieldset disabled={pending}>
      <legend className="sr-only">{connection.label} connection settings</legend>
      {replacing && <>
        <p>{modal ? 'Use a *.modal.run HTTPS endpoint or your deployment’s existing custom origin. Enter fresh credentials for that endpoint.' : 'Enter a new API key to use for new requests.'}</p>
        {modal && <label>Authentication method
          <select value={mode} onChange={event => setMode(event.target.value)}>
            <option value="pair">Token ID and secret</option><option value="single">Single token</option>
          </select>
        </label>}
        {visibleFields.map(field => <label key={field.name}>{field.label}
          <input type={field.type} name={field.name} autoComplete="off" spellCheck={false} required />
        </label>)}
      </>}
      {action === 'disconnect' && <p>Disconnect {connection.label} for new requests in this environment? Deployment credentials will stay inactive until you restore them.</p>}
      {action === 'reset' && <p>Use deployment settings for {connection.label}? This clears the portal override for new requests.</p>}
      <div className="ai-connection-actions">
        {(replacing || action !== 'replace') && <button type="submit" className="ai-button ai-primary">
          {pending ? 'Saving…' : { replace: 'Save credentials', disconnect: 'Confirm disconnect', reset: 'Restore deployment settings' }[action]}
        </button>}
        {action === 'replace' && connection.source !== 'disconnected' &&
          <button type="button" className="ai-button" onClick={() => setAction('disconnect')}>Disconnect</button>}
        {action === 'replace' && connection.source !== 'deployment' &&
          <button type="button" className="ai-button" onClick={() => setAction('reset')}>Use deployment settings</button>}
        <button type="button" className="ai-button" onClick={onClose}>Cancel</button>
      </div>
    </fieldset>
  </form>;
}

function ProviderRow({ connection, featureLabels, editor, pending, onEdit, onSave, notice }) {
  const panelId = useId();
  const opener = useRef(null);
  const features = connection.id === 'elevenlabs' ? ['Narration']
    : connection.features.map(id => featureLabels.get(id) || id);
  const actionLabel = connection.configured || connection.recoveryOnly ? 'Manage connection' : 'Connect provider';
  function close() {
    onEdit(null);
    opener.current?.focus();
  }
  return <li>
    <div className="ai-line">
      <div className="ai-connection-title"><h3>{connection.label}</h3>
        <span className="ai-chip">{connection.configured ? <CheckCircle size={16} aria-hidden="true" /> : <WarningCircle size={16} aria-hidden="true" />}
          {connection.configured ? 'Configured' : 'Unconfigured'}</span></div>
      {connection.editable && <button type="button" ref={opener} className="ai-button" disabled={pending}
        aria-label={actionLabel + ' for ' + connection.label}
        aria-expanded={editor} aria-controls={panelId} onClick={() => onEdit(editor ? null : connection.id)}>
        {actionLabel}
      </button>}
    </div>
    <p>{[sources[connection.source], ...features].filter(Boolean).join(' · ')}</p>
    {connection.readOnlyReason && !['builtin', 'binding'].includes(connection.source) && <p>{connection.readOnlyReason}</p>}
    {connection.source === 'binding' && !connection.configured && <p>{connection.readOnlyReason}</p>}
    {connection.managementWarning && <p role="alert">{connection.managementWarning}</p>}
    <div id={panelId}>
      {editor && <ConnectionEditor key={connection.revision} connection={connection} pending={pending} onClose={close}
        onSave={async (action, values) => {
          const saved = await onSave(connection, action, values);
          if (saved && document.activeElement === document.body) requestAnimationFrame(() => opener.current?.focus());
        }} />}
    </div>
    {notice && <div role={notice.error ? 'alert' : 'status'} className={notice.error ? 'ai-error' : 'ai-meta'}>{notice.message}</div>}
  </li>;
}

export default function ProviderConnections({ active, local, request, features, refreshReadiness }) {
  const [connections, setConnections] = useState(null);
  const [editor, setEditor] = useState(null);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null);
  const latestRead = useRef(0);
  const inFlight = useRef(false);
  const featureLabels = new Map(features.map(item => [item.id, item.label]));

  const load = useCallback(async () => {
    const readId = ++latestRead.current;
    const data = await request('/connections');
    if (readId === latestRead.current) {
      setConnections(data.connections);
      setError('');
    }
  }, [request]);

  useEffect(() => {
    if (active) {
      let current = true;
      load().catch(err => { if (current) setError(err.message); });
      return () => { current = false; };
    }
  }, [active, load]);

  async function refresh() {
    setError('');
    const results = await Promise.allSettled([load(), refreshReadiness()]);
    const failure = results.find(result => result.status === 'rejected');
    if (failure) setError('Could not refresh connection status. ' + failure.reason.message);
  }

  async function save(connection, action, values) {
    if (inFlight.current) return false;
    inFlight.current = true;
    setPending(connection.id);
    setError('');
    setNotice(null);
    try {
      const { connection: updated } = await request('/connections/' + encodeURIComponent(connection.id), {
        method: 'PUT', body: { baseRevision: connection.revision, action, ...(values && { values }) }
      });
      ++latestRead.current;
      setConnections(items => items.map(item => item.id === updated.id ? updated : item));
      setEditor(null);
      setNotice({ id: updated.id, message: updated.label + ' ' + success[action] + '.' });
      await refreshReadiness().catch(() => setError('Connection saved. Refresh to update feature availability.'));
      return true;
    } catch (err) {
      // A dropped acknowledgement may follow a successful write. Re-read the
      // revision and require fresh input instead of replaying a secret.
      const uncertain = !err.status || err.status >= 500;
      if (err.status === 409 || uncertain) {
        setEditor(null);
        await refresh();
      }
      const message = err.status === 409 ? 'This connection changed elsewhere. Review its current settings before trying again.'
        : uncertain ? 'The save could not be confirmed. Review the current connection before trying again.' : err.message;
      setNotice({ id: connection.id, error: true, message });
      return false;
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }

  if (!active) return null;
  return <section className="ai-records" aria-label="Provider connections">
    <h2>Provider connections</h2>
    {local && <OwnerSubscription request={request} fixture={features.find(item => item.id === 'readings')?.fixture} />}
    {local && <h3>Feature providers</h3>}
    <p className="ai-meta">Status shows whether the connection has the settings it needs. Feature samples can test a model response.</p>
    {error && <div className="ai-error" role="alert">{error} <button className="ai-button" type="button" onClick={refresh}>Refresh status</button></div>}
    {!connections && !error && <p role="status" className="ai-meta">Loading…</p>}
    {connections && <ul className="ai-record-list">{connections.map(connection => <ProviderRow key={connection.id}
      connection={connection} featureLabels={featureLabels} editor={editor === connection.id} pending={pending !== null}
      onSave={save} onEdit={id => { setEditor(id); setNotice(null); }}
      notice={notice?.id === connection.id ? notice : null} />)}</ul>}
  </section>;
}
