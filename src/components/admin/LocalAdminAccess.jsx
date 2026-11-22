import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalA11y } from '../../hooks/useModalA11y.js';
import { localAdminAction } from '../../lib/localAdminAccess.js';

const passwordField = 'mt-1 w-full rounded-xl border border-secondary/30 bg-main px-3 py-2 text-sm text-main';

export function LocalPasswordForm({ mode, credential, setupToken, onSignedIn, onCancel, onBusy }) {
  const [password, setPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const changing = mode === 'change';
  const signingIn = mode === 'login';
  const title = signingIn ? 'Local admin sign-in' : changing ? 'Change local admin password' : 'Create local admin password';
  async function submit(event) {
    event.preventDefault();
    if (!signingIn && password !== confirmation) { setError('The new passwords must match.'); return; }
    setBusy(true);
    onBusy?.(true);
    setError('');
    try {
      const result = await localAdminAction({ action: mode, password, ...(currentPassword && { currentPassword }), ...(setupToken && { setupToken }) }, credential);
      onSignedIn(result.token);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); onBusy?.(false); }
  }
  return <form className="space-y-4" onSubmit={submit}>
    <h2 className="font-serif text-xl text-main" id="local-access-heading">{title}</h2>
    {changing && credential?.startsWith('local_admin_') && <label className="block text-sm text-main">
      Current password<input className={passwordField} type="password" required autoComplete="current-password"
        value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} maxLength={256} />
    </label>}
    <label className="block text-sm text-main">{signingIn ? 'Local admin password' : 'New password'}
      <input className={passwordField} type="password" required minLength={signingIn ? undefined : 12} maxLength={256}
        autoComplete={signingIn ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} />
    </label>
    {!signingIn && <>
      <p className="text-xs text-muted">Use at least 12 characters.{changing && ' Saving signs out your other local password sessions.'}</p>
      <label className="block text-sm text-main">Confirm new password
        <input className={passwordField} type="password" required maxLength={256} autoComplete="new-password"
          value={confirmation} onChange={event => setConfirmation(event.target.value)} />
      </label>
    </>}
    {error && <p role="alert" className="text-sm text-error">{error}</p>}
    <div className="flex flex-wrap gap-3">
      <button type="submit" disabled={busy} className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-main disabled:opacity-60">
        {busy ? 'Please wait…' : signingIn ? 'Sign in' : changing ? 'Save password' : 'Create password'}
      </button>
      {onCancel && <button type="button" className="text-sm text-muted" disabled={busy} onClick={onCancel}>Cancel</button>}
    </div>
  </form>;
}

export function LocalPasswordDialog({ onCancel, ...props }) {
  const containerRef = useRef(null);
  const busy = useRef(false);
  const close = () => { if (!busy.current) onCancel(); };
  useModalA11y(true, { containerRef, onClose: close, isolateBackground: true, initialFocusSelector: 'input', backGuardId: 'local-admin-password' });
  return createPortal(<div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-black/60 p-4">
    <div role="dialog" aria-modal="true" aria-labelledby="local-access-heading" ref={containerRef} tabIndex={-1}
      className="my-auto w-full max-w-sm rounded-2xl border border-secondary/30 bg-surface p-6 shadow-xl">
      <LocalPasswordForm {...props} onCancel={close} onBusy={value => { busy.current = value; }} />
    </div>
  </div>, document.body);
}
