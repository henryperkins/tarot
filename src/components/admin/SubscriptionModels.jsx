import { useEffect, useId, useRef, useState } from 'react';

export default function SubscriptionModels({ request, endpoint, onAccessChange }) {
  const headingId = useId();
  const pendingRequest = useRef(null);
  const [pending, setPending] = useState('');
  const [catalog, setCatalog] = useState(null);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const Heading = onAccessChange ? 'h4' : 'h3';
  const saved = catalog?.selection?.modelId ?? null;
  const dirty = catalog?.editable && draft !== saved;

  useEffect(() => () => pendingRequest.current?.abort(), []);

  async function readCatalog(signal) {
    const result = await request(endpoint, { signal });
    if (signal.aborted) return;
    if (result.provider !== 'codex-subscription' || !Array.isArray(result.models)) {
      throw new Error('The ChatGPT subscription returned an invalid model list.');
    }
    setCatalog(result);
    setDraft(result.selection?.modelId ?? null);
  }

  async function saveSelection(signal) {
    const { revision, baseToken } = catalog.selection;
    try {
      const { selection } = await request(endpoint, { method: 'PUT', signal,
        body: { modelId: draft, baseRevision: revision, baseToken } });
      if (signal.aborted) return;
      setCatalog(current => ({ ...current, selection }));
      setDraft(selection.modelId);
      setNotice(selection.modelId ? 'Personal Readings model saved.' : 'Personal Readings will use the subscription default.');
    } catch (err) {
      const retired = err.code === 'personal_model_unavailable';
      if (signal.aborted || (err.status !== 409 && !retired)) throw err;
      setCatalog(null);
      await readCatalog(signal);
      if (!signal.aborted) setError(retired ? 'That model is no longer available. Choose from the refreshed list.'
        : 'The subscription or saved model changed. Review the latest selection before saving again.');
    }
  }

  async function submit(action) {
    if (pendingRequest.current) return;
    const controller = new AbortController();
    const { signal } = controller;
    pendingRequest.current = controller;
    setPending(action);
    setError('');
    setNotice('');
    try {
      if (action === 'fetch') {
        setCatalog(null);
        await readCatalog(signal);
      } else {
        await saveSelection(signal);
      }
    } catch (err) {
      if (signal.aborted) return;
      if (onAccessChange && (err.status === 403 || err.status === 409)) onAccessChange(err);
      else setError(err.message);
    } finally {
      pendingRequest.current = null;
      if (!signal.aborted) setPending('');
    }
  }

  return <section className={onAccessChange ? 'ai-owner-sample' : 'ai-owner-subscription'} aria-labelledby={headingId}>
    <div className="ai-line">
      <Heading id={headingId}>ChatGPT subscription models</Heading>
      <button type="button" className="ai-button" disabled={Boolean(pending || dirty)} onClick={() => submit('fetch')}>
        {pending === 'fetch' ? 'Fetching models…' : catalog ? 'Refresh models' : 'Fetch models'}
      </button>
    </div>
    {error && <p role="alert" className="ai-error">{error}</p>}
    {catalog && <>
      {!catalog.models.length && <p className="ai-meta" role="status">The subscription returned no available models.</p>}
      {catalog.editable && catalog.selection ? <div className="ai-connection-form">
        <label>Personal Readings model
          <select value={draft ?? ''} disabled={Boolean(pending)} onChange={event => {
            setDraft(event.target.value || null); setNotice(''); setError('');
          }}>
            <option value="">Subscription default</option>
            {saved && !catalog.models.some(model => model.id === saved) &&
              <option value={saved} disabled>{saved} (saved, unavailable)</option>}
            {catalog.models.map(({ id, label }) =>
              <option key={id} value={id}>{label && label !== id ? label + ' · ' + id : id}</option>)}
          </select>
        </label>
        <div className="ai-connection-actions">
          <button type="button" className="ai-button ai-primary" disabled={!dirty || Boolean(pending)} onClick={() => submit('save')}>
            {pending === 'save' ? 'Saving…' : 'Save personal model'}
          </button>
          {dirty && <button type="button" className="ai-button" disabled={Boolean(pending)}
            onClick={() => { setDraft(saved); setError(''); }}>Discard</button>}
        </div>
      </div> : <>
        {catalog.selection && <p>Personal Readings model · {saved || 'Subscription default'}</p>}
        {catalog.readOnlyReason && <p className="ai-meta">{catalog.readOnlyReason}</p>}
        {catalog.models.length > 0 && <ul aria-label="Available subscription models">
          {catalog.models.map(({ id, label }) => <li key={id}>{label || id}{label && label !== id && <> · <code>{id}</code></>}</li>)}
        </ul>}
      </>}
    </>}
    <span role="status" className="ai-meta">{notice}</span>
  </section>;
}
