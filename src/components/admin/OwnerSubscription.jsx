import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import AuthModal from '../AuthModal.jsx';

const endpoint = '/owner-subscription';

// Remember only the run ID so that returning to this tab retrieves the receipt
// from the authenticated endpoint. The excerpt and model never enter storage.
function readRun(key) {
  try { return sessionStorage.getItem(key); } catch { return null; }
}

function Sample({ request, reader, link, provider, fixture, disabled, onAccessChange }) {
  const storageKey = ['owner-sample', reader.id, link.revision, provider.id].join('/');
  const [runId, setRunId] = useState(() => readRun(storageKey));
  const [pollVersion, setPollVersion] = useState(0);
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [retryId, setRetryId] = useState(null);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!runId) return;
    const controller = new AbortController();
    let timer;
    async function poll() {
      try {
        const result = await request(endpoint + '/samples/' + encodeURIComponent(runId), { signal: controller.signal });
        if (controller.signal.aborted) return;
        setReceipt(result);
        if (result.status === 'running') timer = setTimeout(poll, 1200);
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err.status === 403 || err.status === 409) return onAccessChange(err);
        if (err.status === 404) {
          setRunId(null);
          setReceipt(null);
          try { sessionStorage.removeItem(storageKey); } catch { /* optional persistence */ }
        }
        setError(err.message);
      }
    }
    poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [runId, pollVersion, request, onAccessChange, storageKey]);

  async function start() {
    if (starting) return;
    const id = retryId || crypto.randomUUID();
    setRetryId(id);
    setStarting(true);
    setError('');
    setRunId(null);
    setReceipt(null);
    // The browser can leave after acceptance but before receiving the POST
    // response. Returning to the tab then checks this ID without generating again.
    try { sessionStorage.setItem(storageKey, id); } catch { /* optional persistence */ }
    try {
      const accepted = await request(endpoint + '/samples', {
        method: 'POST', body: { baseRevision: link.revision, runId: id }
      });
      if (!mounted.current) return;
      setRetryId(null);
      setRunId(accepted.runId);
    } catch (err) {
      if (!mounted.current) return;
      if (err.status && err.status < 500) {
        setRetryId(null);
        try { sessionStorage.removeItem(storageKey); } catch { /* optional persistence */ }
      }
      if (err.status === 403 || err.status === 409) return onAccessChange(err);
      setError(err.message);
    } finally {
      if (mounted.current) setStarting(false);
    }
  }

  const running = starting || (runId && !error && (!receipt || receipt.status === 'running'));
  return <div className="ai-owner-sample">
    <h4>Owner-only sample reading</h4>
    {fixture && <p className="ai-meta">{fixture.question}<br />{fixture.cards.join(' · ')}</p>}
    <div className="ai-connection-actions">
      {error && runId ? <button type="button" className="ai-button" onClick={() => {
        setError(''); setPollVersion(value => value + 1);
      }}>Check sample result</button> : <button type="button" className="ai-button" onClick={start}
        disabled={Boolean(disabled || running || !provider.configured)}>
        {running ? 'Running owner sample…' : retryId ? 'Retry owner sample' : 'Run owner sample'}
      </button>}
    </div>
    {error && <p role="alert" className="ai-error">{error}</p>}
    <div aria-live="polite">
      {running && <p className="ai-meta">Waiting for {provider.label}…</p>}
      {receipt?.status === 'failed' && <p className="ai-error">Sample failed. {receipt.reason}</p>}
      {receipt?.status === 'completed' && <div className="ai-result">
        <strong>{provider.label} answered</strong>
        {receipt.modelSource === 'reported' && receipt.model
          ? <p>Reported model · {receipt.model}</p>
          : <p>The provider did not report the answering model.{receipt.model && receipt.modelSource === 'configured' && <> Configured model · {receipt.model}</>}</p>}
        <p className="ai-excerpt">{receipt.excerpt}</p>
      </div>}
    </div>
  </div>;
}

function Settings({ status, request, fixture, onChange, onAccessChange, onRefresh }) {
  const { reader, link, providers } = status;
  const [selection, setSelection] = useState(link.providerId || '');
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const selected = providers.find(item => item.id === selection);
  const saved = providers.find(item => item.id === link.providerId);
  const dirty = selection !== (link.providerId || '');

  async function save(providerId) {
    setSaving(true);
    setError('');
    try {
      const updated = await request(endpoint, { method: 'PUT', body: { baseRevision: link.revision, providerId } });
      onChange(updated, providerId ? 'Owner subscription saved.' : 'Reader account unlinked.');
    } catch (err) {
      if (err.status === 403 || err.status === 409 || !err.status || err.status >= 500) onAccessChange(err);
      else setError(err.message);
    } finally { setSaving(false); }
  }

  return <>
    <fieldset disabled={saving} className="ai-owner-options">
      <legend>Subscription provider</legend>
      {providers.map(item => <label key={item.id}>
        <input type="radio" name="owner-subscription" value={item.id} checked={selection === item.id}
          onChange={() => { setSelection(item.id); setConfirmUnlink(false); setError(''); }} />
        <span><strong>{item.label}</strong><small>{item.configured ? 'Ready for a sample' : item.reason || 'Unavailable on this computer'}</small></span>
      </label>)}
    </fieldset>
    <div className="ai-connection-actions">
      {(!saved || dirty) && <button type="button" className="ai-button ai-primary" disabled={!selected || saving}
        onClick={() => save(selection)}>{saving ? 'Saving…' : saved ? 'Save provider' : 'Link reader account'}</button>}
      {saved && !confirmUnlink && <button type="button" className="ai-button" disabled={saving} onClick={() => setConfirmUnlink(true)}>Unlink account</button>}
      <button type="button" className="ai-button" disabled={saving} onClick={onRefresh}>Refresh subscription status</button>
    </div>
    {confirmUnlink && <div className="ai-result">
      <p>Remove the owner subscription link for {reader.label}?</p>
      <div className="ai-connection-actions"><button type="button" className="ai-button" disabled={saving} onClick={() => save(null)}>Confirm unlink</button>
        <button type="button" className="ai-button" disabled={saving} onClick={() => setConfirmUnlink(false)}>Cancel</button></div>
    </div>}
    {error && <p role="alert" className="ai-error">{error}</p>}
    {saved && <Sample reader={reader} link={link} provider={saved} fixture={fixture} request={request}
      disabled={dirty || saving || confirmUnlink} onAccessChange={onAccessChange} />}
    {saved && dirty && <p className="ai-meta">Save the provider choice to test it.</p>}
  </>;
}

function OwnerConnection({ request, fixture, openAuth, headingRef }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => {
    setStatus(null);
    setError(null);
    setVersion(value => value + 1);
  }, []);
  const accessChanged = useCallback(err => {
    setNotice(err.message);
    reload();
  }, [reload]);
  useEffect(() => {
    // Reader cookies can change in another tab without a React auth update.
    const recheck = () => { if (document.visibilityState === 'visible') reload(); };
    document.addEventListener('visibilitychange', recheck);
    return () => document.removeEventListener('visibilitychange', recheck);
  }, [reload]);
  useEffect(() => {
    const controller = new AbortController();
    request(endpoint, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setStatus(result); })
      .catch(err => { if (!controller.signal.aborted) setError(err); });
    return () => controller.abort();
  }, [request, version]);
  const guest = error?.code === 'reader_sign_in_required';
  return <>
    <h3 id="owner-heading" ref={headingRef} tabIndex={-1}>Owner subscription</h3>
    <p className="ai-meta">Link a subscription on this computer to use it for your signed-in readings, follow-ups and journal summaries.</p>
    {!status && !error && <p role="status">Checking owner access…</p>}
    {guest && <div className="ai-connection-actions">
      <button type="button" className="ai-button ai-primary" onClick={() => openAuth('login')}>Sign in as reader</button>
      <button type="button" className="ai-button" onClick={() => openAuth('register')}>Create reader account</button>
    </div>}
    {error && !guest && <div role="alert" className="ai-error">{error.message}
      <button type="button" className="ai-button" onClick={reload}>Retry owner access</button></div>}
    {status && <>
      <p className="ai-reader-identity"><strong>{status.link.ownedByReader ? 'Linked reader' : 'Signed-in reader'}</strong> · {status.reader.label}</p>
      {status.editable ? <Settings key={status.reader.id + '/' + status.link.revision} request={request} status={status} fixture={fixture}
        onChange={(updated, message) => { setStatus(updated); setNotice(message); }} onAccessChange={accessChanged}
        onRefresh={() => { setNotice(''); reload(); }} />
        : <><p>{status.readOnlyReason || 'Only the linked reader can manage this subscription.'}</p>
          <button type="button" className="ai-button" onClick={() => openAuth('login')}>Sign in with another reader account</button></>}
    </>}
    {notice && <p role="status" className="ai-meta">{notice}</p>}
  </>;
}

export default function OwnerSubscription({ request, fixture }) {
  const { user } = useAuth();
  const [authMode, setAuthMode] = useState(null);
  const [authVersion, setAuthVersion] = useState(0);
  const heading = useRef(null);
  return <section className="ai-owner-subscription" aria-labelledby="owner-heading">
    <OwnerConnection key={(user?.id || 'guest') + '/' + authVersion} request={request} fixture={fixture} openAuth={setAuthMode} headingRef={heading} />
    {authMode && <AuthModal isOpen initialMode={authMode} onClose={() => { setAuthMode(null); setAuthVersion(value => value + 1); }}
      returnFocusRef={heading} localOAuthReturnPath="/admin/ai-configuration?tab=connections" />}
  </section>;
}
