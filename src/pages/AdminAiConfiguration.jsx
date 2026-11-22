import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminAuthGate from '../components/admin/AdminAuthGate.jsx';
import AdminShell from '../components/admin/AdminShell.jsx';
import { FeatureList, FallbackOrder, PrimaryFields } from '../components/admin/FeatureAssignment.jsx';
import FeatureSample from '../components/admin/FeatureSample.jsx';
import { ChangeHistory } from '../components/admin/ConfigurationRecords.jsx';
import ProviderConnections from '../components/admin/ProviderConnections.jsx';
import { ConfirmModal } from '../components/ConfirmModal.jsx';
import { leaveAfterGuardedBack, useAndroidBackGuard } from '../hooks/useAndroidBackGuard.js';
import { displayValue, hasRetiredModel, policyChanges, policyKey, reapplyPolicyEdits, requestAiConfig } from '../lib/adminAiConfiguration.js';

const tabs = ['Feature models', 'Provider connections', 'Change history'];

function TabBar({ active, onChange }) {
  function handleKey(event, index) {
    const next = { ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index + tabs.length - 1) % tabs.length,
      Home: 0, End: tabs.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    onChange(next);
    event.currentTarget.parentElement.children[next].focus();
  }
  return <div role="tablist" aria-label="AI configuration" className="ai-tabs">
    {tabs.map((tab, index) => <button type="button" role="tab" key={tab} id={'ai-tab-' + index}
      aria-selected={active === index} aria-controls={'ai-panel-' + index} tabIndex={active === index ? 0 : -1}
      onClick={() => onChange(index)} onKeyDown={event => handleKey(event, index)}>{tab}</button>)}
  </div>;
}

function EditorSession({ catalog, feature, request, onSelect, onSaved, onLogout, onRefresh, refreshReadiness, headingRef, tab, setTab }) {
  const navigate = useNavigate();
  const [draftOverride, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [unconfirmedSave, setUnconfirmedSave] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(null);
  const [exit, setExit] = useState(null);
  const saveRequest = useRef(null);
  const confirmedExit = useRef(false);
  const exitOpener = useRef(null);
  const draft = draftOverride || feature.policy;
  const dirty = policyKey(draft) !== policyKey(feature.policy);
  const protectedDraft = dirty || saving || Boolean(unconfirmedSave);
  const migrationRequired = feature.policyStatus === 'migration_required';
  const needsReplacement = hasRetiredModel(feature, draft);
  const readOnly = !catalog.writable || !feature.writable;
  const canSave = !readOnly && !saving && !conflict && (Boolean(unconfirmedSave) || (dirty && !needsReplacement));
  const changes = policyChanges(feature, feature.policy, draft);
  const environment = displayValue(catalog.environment);

  function leave(action, opener = document.activeElement) {
    if (saveRequest.current) return;
    if (dirty || unconfirmedSave) {
      exitOpener.current = opener;
      setExit({ action });
    } else action();
  }
  useAndroidBackGuard(protectedDraft, {
    enabled: true, guardId: 'admin-ai-draft',
    onBack: () => {
      if (confirmedExit.current) return;
      if (exit) setExit(null);
      else leave(leaveAfterGuardedBack);
    }
  });
  useEffect(() => {
    if (!protectedDraft) return;
    function beforeUnload(event) {
      if (confirmedExit.current) return;
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [protectedDraft]);

  function confirmExit() {
    if (!exit || saveRequest.current) return;
    confirmedExit.current = true;
    // The guard entry still identifies the Back destination in this callback.
    // A confirmed document departure must also pass the native unload listener.
    exit.action();
    setDraft(null);
    setUnconfirmedSave(null);
  }

  function edit(policy) {
    confirmedExit.current = false;
    setDraft(policy);
    setError('');
    setNotice('');
  }

  async function save() {
    if (!canSave || saveRequest.current) return;
    const submission = unconfirmedSave || {
      baseRevision: feature.revision, baseToken: feature.baseToken, mutationId: crypto.randomUUID(), policy: draft
    };
    const submittedKey = policyKey(submission.policy);
    saveRequest.current = submission;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const receipt = await request('/features/' + encodeURIComponent(feature.id), {
        method: 'PUT', body: submission
      });
      onSaved(feature.id, receipt);
      setDraft(current => current && policyKey(current) !== submittedKey ? current : null);
      setNotice(feature.label + ' changes saved.');
      setUnconfirmedSave(null);
    } catch (err) {
      setError(err.message);
      // A lost receipt can follow a successful commit. Replay that exact
      // request before treating any newer local edit as the next revision.
      setUnconfirmedSave(!err.status || err.status >= 500 ? submission : null);
      if (err.status === 409) {
        try {
          const latest = await request('');
          setConflict(latest);
        } catch (refreshError) { setError(err.message + ' ' + refreshError.message); }
      }
    } finally {
      saveRequest.current = null;
      setSaving(false);
    }
  }

  function resolveConflict(keepDraft) {
    const current = conflict.features.find(item => item.id === feature.id);
    setDraft(keepDraft ? reapplyPolicyEdits(feature.policy, draft, current.policy, current) : null);
    onRefresh(conflict);
    setConflict(null);
    setError('');
    setNotice(keepDraft ? 'Review the draft against the latest saved settings before saving.' : 'Latest saved settings loaded.');
  }
  const newer = conflict?.features.find(item => item.id === feature.id);
  const comparable = newer && newer.policyStatus !== 'migration_required';
  const changedElsewhere = comparable && policyChanges(feature, feature.policy, newer.policy);

  function saveSummary() {
    if (unconfirmedSave) return 'The submitted save has not been confirmed.';
    if (dirty) return feature.label + ' · ' + changes.join(' · ');
    if (readOnly) return feature.readOnlyReason || 'View-only configuration';
    if (needsReplacement) return 'Replace retired models to repair this assignment.';
    return saving ? 'Save in progress' : 'All changes saved';
  }

  return <AdminShell onLogout={event => leave(onLogout, event.currentTarget)} onNavigate={(event, path) => {
    if (protectedDraft && path !== '/admin/ai-configuration') {
      event.preventDefault();
      leave(() => navigate(path), event.currentTarget);
    }
  }}>
    <main id="main-content" tabIndex={-1} className="ai-main">
      <header className="ai-header">
        <p className="ai-breadcrumb">Admin <span aria-hidden="true">/</span> AI configuration</p>
        <div className="ai-line"><h1>AI models</h1><span className="ai-environment">Environment · {environment}</span></div>
        <p>Choose the provider and model for each feature.</p>
      </header>
      <TabBar active={tab} onChange={setTab} />
      {saving && <p className="ai-pending" role="status">Saving changes to {feature.label}…</p>}
      <div role="tabpanel" aria-labelledby="ai-tab-0" id="ai-panel-0" hidden={tab !== 0}>
        <div className="ai-workbench">
          <FeatureList features={catalog.features} inventory={catalog.specialistInventory || []} selected={feature.id} dirty={dirty}
            onSelect={id => { if (id !== feature.id) leave(() => onSelect(id)); }} />
          <article className="ai-editor" aria-label={feature.label + ' settings'}>
            <div className="ai-editor-body">
              <header className="ai-feature-heading"><h2 ref={headingRef} tabIndex={-1}>{feature.label}</h2><p>{feature.description}</p></header>
              {!migrationRequired && <>
                <PrimaryFields feature={feature} policy={draft} readOnly={readOnly} onChange={edit} />
                <FallbackOrder feature={feature} policy={draft} readOnly={readOnly} onChange={edit} />
                <FeatureSample feature={feature} policy={draft} request={request} catalogVersion={catalog.catalogVersion} environment={catalog.environment}
                  disabledReason={needsReplacement ? 'Replace retired models before running a sample.' : undefined} />
              </>}
            </div>
            <footer className="ai-savebar">
              <div className="ai-save-message">
                <strong>{saveSummary()}</strong>
                {!migrationRequired && <small>{dirty ? 'Applies to new requests only.' : notice || 'Saved settings apply to new requests.'}</small>}
              </div>
              <div className="ai-save-actions"><span className="ai-meta">Environment · {environment}</span>
                <button type="button" className="ai-button" disabled={!dirty || saving || Boolean(unconfirmedSave)} onClick={() => {
                  if (conflict) resolveConflict(false);
                  else { setDraft(null); setError(''); setNotice('Draft discarded.'); }
                }}>Discard</button>
                <button type="button" className="ai-button ai-primary" disabled={!canSave}
                  onClick={save}>{saving ? 'Saving…' : unconfirmedSave ? 'Retry submitted save' : 'Save changes to ' + feature.label}</button>
              </div>
              {error && <p className="ai-error" role="alert">{error}</p>}
              {newer && <div className="ai-conflict">
                <p>Saved settings changed elsewhere. {comparable ? changedElsewhere.join(' · ') || 'The feature catalog has changed.' : newer.readOnlyReason}</p>
                <button type="button" className="ai-button" onClick={() => resolveConflict(false)}>Reload saved</button>
                {comparable && newer.writable && <button type="button" className="ai-button" onClick={() => resolveConflict(true)}>Review my draft</button>}
              </div>}
            </footer>
          </article>
        </div>
      </div>
      <div role="tabpanel" aria-labelledby="ai-tab-1" id="ai-panel-1" hidden={tab !== 1}>
        <ProviderConnections active={tab === 1} local={catalog.environment === 'local'} request={request} features={catalog.features} refreshReadiness={refreshReadiness} />
      </div>
      <div role="tabpanel" aria-labelledby="ai-tab-2" id="ai-panel-2" hidden={tab !== 2}>
        {tab === 2 && <ChangeHistory key={feature.revision} request={request} features={catalog.features} />}
      </div>
      <span className="sr-only" role="status">{notice}</span>
    </main>
    <ConfirmModal isOpen={Boolean(exit)} title={unconfirmedSave ? 'Leave without confirming the save?' : 'Discard changes to ' + feature.label + '?'}
      message={unconfirmedSave ? 'The submitted settings may already be saved. Leaving discards any later edits.' : 'Your draft has unsaved changes.'}
      cancelText="Keep editing" confirmText={unconfirmedSave ? 'Leave editor' : 'Discard changes'}
      renderInPortal closeOnBack={false} returnFocusRef={exitOpener} onClose={() => setExit(null)} onConfirm={confirmExit} />
  </AdminShell>;
}

function Workspace({ apiKey, onLogout }) {
  const [catalog, setCatalog] = useState(null);
  const [active, setActive] = useState('readings');
  const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get('tab') === 'connections' ? 1 : 0);
  const heading = useRef(null);
  const previousFeature = useRef(active);
  useLayoutEffect(() => {
    if (active !== previousFeature.current) heading.current?.focus();
    previousFeature.current = active;
  }, [active]);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const availabilityRead = useRef(0);
  const request = useCallback(async (path, options) => {
    try { return await requestAiConfig(apiKey, path, options); }
    catch (err) { if (err.status === 401) onLogout(); throw err; }
  }, [apiKey, onLogout]);

  const refreshReadiness = useCallback(async () => {
    const version = ++availabilityRead.current;
    const latest = await request('');
    if (version !== availabilityRead.current) return;
    // Only adopt connection status. The revision and baseline a draft was
    // edited against must still reach the server if a different admin saved it.
    setCatalog(current => ({ ...current, specialistInventory: latest.specialistInventory,
      features: current.features.map(feature => {
        const fresh = latest.features.find(item => item.id === feature.id);
        if (!fresh) return feature;
        return { ...feature, providers: feature.providers.map(provider => {
          const status = fresh.providers.find(item => item.id === provider.id);
          return status ? { ...provider, configured: status.configured, missing: status.missing } : provider;
        }) };
      })
    }));
  }, [request]);

  useEffect(() => {
    const controller = new AbortController();
    request('', { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setCatalog(data); })
      .catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [request, retry]);

  if (!catalog) return <AdminShell onLogout={onLogout}><main id="main-content" tabIndex={-1} className="ai-main">
    <h1>AI models</h1>
    {error ? <div role="alert" className="ai-error">{error} <button className="ai-button" type="button" onClick={() => {
      setError(''); setRetry(retry + 1);
    }}>Try again</button></div> : <p role="status">Loading configuration…</p>}
  </main></AdminShell>;
  const feature = catalog.features.find(item => item.id === active) || catalog.features[0];
  if (!feature) return <AdminShell onLogout={onLogout}><main id="main-content" tabIndex={-1} className="ai-main"><h1>AI models</h1><p>No features configured.</p></main></AdminShell>;
  function onSaved(id, receipt) {
    setCatalog(current => ({ ...current, features: current.features.map(item =>
      item.id === id && item.revision <= receipt.revision ? { ...item, ...receipt } : item) }));
  }
  return <EditorSession key={catalog.environment + '/' + feature.id} catalog={catalog} feature={feature} headingRef={heading}
    tab={tab} setTab={setTab}
    onSelect={setActive} onSaved={onSaved} onRefresh={setCatalog} refreshReadiness={refreshReadiness} request={request} onLogout={onLogout} />;
}

export default function AdminAiConfiguration() {
  return <AdminAuthGate description="AI configuration" verificationPath="/api/admin/ai-configuration/connections">
    {auth => <Workspace {...auth} />}
  </AdminAuthGate>;
}
