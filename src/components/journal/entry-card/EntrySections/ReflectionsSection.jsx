/**
 * ReflectionsSection.jsx
 * Displays reflections labelled by card ("Past · The Hermit") or "Whole reading",
 * and, when the journal can save them, lets the reader add, edit or remove notes.
 */
import { memo, useEffect, useId, useRef, useState } from 'react';
import { CircleNotch, PencilSimple, Plus } from '@phosphor-icons/react';
import {
  buildReflectionItems,
  buildReflectionTargets,
  MAX_REFLECTION_LENGTH,
  READING_REFLECTION_KEY
} from '../../../../../shared/journal/reflectionLabels.js';
import { styles, cn } from '../EntryCard.primitives';

const TEXT_BUTTON_CLASS =
  'inline-flex min-h-touch items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ' +
  'text-(--text-accent) hover:text-(--text-main) focus-visible:outline-hidden focus-visible:ring-2 ' +
  'focus-visible:ring-(--focus-ring-color) disabled:cursor-not-allowed disabled:opacity-60 touch-manipulation';
const DANGER_BUTTON_CLASS =
  'inline-flex min-h-touch items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ' +
  'border-[color-mix(in_srgb,var(--status-error)_45%,transparent)] bg-[color-mix(in_srgb,var(--status-error)_12%,transparent)] ' +
  'text-(--status-error) focus-visible:outline-hidden focus-visible:ring-2 ' +
  'focus-visible:ring-[color-mix(in_srgb,var(--status-error)_45%,transparent)] disabled:cursor-not-allowed disabled:opacity-60 touch-manipulation';
const TEXTAREA_CLASS =
  'w-full min-h-28 rounded-xl border border-(--border-warm-light) bg-(--panel-dark-1) px-3 py-2 text-base sm:text-sm ' +
  'leading-relaxed text-(--text-main) focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-(--focus-ring-color)';

function ReflectionEditor({ id, label, initialText, saving, onSubmit, onCancel, onRemove, hint, children }) {
  const attemptId = useId();
  const [draft, setDraft] = useState(initialText);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const formRef = useRef(null);
  const confirmRef = useRef(null);
  const removeButtonRef = useRef(null);
  const wasConfirmingRef = useRef(false);
  const counterId = `${id}-count`;
  const hintId = `${id}-hint`;
  const tooLong = draft.length > MAX_REFLECTION_LENGTH;
  const canSave = Boolean(draft.trim()) && !tooLong && !saving;

  // Opening the editor moves focus to its first field, caret after the note.
  useEffect(() => {
    const field = formRef.current?.querySelector('select, textarea');
    field?.focus();
    if (field?.tagName === 'TEXTAREA') field.setSelectionRange(field.value.length, field.value.length);
  }, []);

  useEffect(() => {
    if (confirmingRemove) confirmRef.current?.focus();
    else if (wasConfirmingRef.current) removeButtonRef.current?.focus();
    wasConfirmingRef.current = confirmingRemove;
  }, [confirmingRemove]);

  return (
    <form
      ref={formRef}
      className="space-y-2"
      aria-busy={saving}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          if (!saving) onCancel();
        }
      }}
      onSubmit={(event) => {
        event.preventDefault();
        if (canSave) onSubmit(draft, attemptId);
      }}
    >
      {children}
      <label htmlFor={id} className="block text-sm font-semibold text-main wrap-anywhere">{label}</label>
      <textarea
        id={id}
        value={draft}
        readOnly={saving}
        onChange={(event) => setDraft(event.target.value)}
        rows={4}
        aria-describedby={[hint ? hintId : null, counterId].filter(Boolean).join(' ')}
        aria-invalid={tooLong || undefined}
        className={TEXTAREA_CLASS}
      />
      {hint && <p id={hintId} className="text-xs text-muted">{hint}</p>}
      <p id={counterId} className={cn('text-xs tabular-nums', tooLong ? 'text-(--status-error)' : 'text-muted')}>
        {draft.length.toLocaleString()} / {MAX_REFLECTION_LENGTH.toLocaleString()} characters
        {tooLong ? ' — shorten this note to save it' : ''}
      </p>

      {confirmingRemove ? (
        <div className="space-y-2" role="group" aria-label={`Remove the note on ${label}`}>
          <p className="text-xs text-muted-high">Remove this note? This can&apos;t be undone.</p>
          <div className="flex flex-wrap gap-2">
            <button ref={confirmRef} type="button" disabled={saving} onClick={onRemove} className={DANGER_BUTTON_CLASS}>
              {saving && <CircleNotch className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              Remove note
            </button>
            <button type="button" disabled={saving} onClick={() => setConfirmingRemove(false)} className={cn(styles.actionButton, styles.actionButtonEnabled)}>
              Keep note
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={!canSave}
            className={cn(styles.actionButton, canSave ? styles.actionButtonEnabled : styles.actionButtonDisabled)}
          >
            {saving && <CircleNotch className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            {saving ? 'Saving…' : 'Save reflection'}
          </button>
          <button type="button" disabled={saving} onClick={onCancel} className={cn(styles.actionButton, styles.actionButtonEnabled)}>
            Cancel
          </button>
          {onRemove && (
            <button ref={removeButtonRef} type="button" disabled={saving} onClick={() => setConfirmingRemove(true)} className={DANGER_BUTTON_CLASS}>
              Remove note
            </button>
          )}
        </div>
      )}
    </form>
  );
}

export const ReflectionsSection = memo(function ReflectionsSection({ reflections, cards = [], onSave = null }) {
  const formId = useId();
  const [editing, setEditing] = useState(null);
  const [addTarget, setAddTarget] = useState(READING_REFLECTION_KEY);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const buttonRefs = useRef(new Map());
  const pendingFocusRef = useRef(null);
  const items = buildReflectionItems(reflections, cards);
  const targets = buildReflectionTargets(cards);
  const canEdit = typeof onSave === 'function';

  useEffect(() => {
    const key = pendingFocusRef.current;
    if (!key || editing) return;
    pendingFocusRef.current = null;
    (buttonRefs.current.get(key) || buttonRefs.current.get('add'))?.focus();
  });

  if (items.length === 0 && !canEdit) return null;

  const close = (focusKey) => {
    pendingFocusRef.current = focusKey;
    setEditing(null);
  };

  const save = async (key, { text, mode, attemptId }) => {
    setSaving(true);
    setStatus(null);
    try {
      const result = await onSave({ key, text, mode, attemptId, expectedText: existingNote(key) });
      if (result?.success) {
        setStatus({ tone: 'success', message: mode === 'remove' ? 'Note removed.' : 'Reflection saved.' });
        return true;
      }
      setStatus({ tone: 'error', message: result?.error || 'Your reflection could not be saved. Try again.' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const existingNote = (key) => items.find((item) => item.key === key)?.note || '';
  const addTargetLabel = targets.find((target) => target.key === addTarget)?.label || '';

  return (
    <section className={cn(styles.section, 'mt-4')} aria-labelledby={`${formId}-heading`}>
      <header className={styles.sectionHeader}>
        <div id={`${formId}-heading`} className={styles.sectionLabel}>Reflections</div>
        <span className="text-xs text-muted">{items.length}</span>
      </header>

      <div className={cn(styles.sectionBody, 'space-y-3')}>
        {items.length === 0 && editing !== 'add' && (
          <p className="text-sm text-muted">No reflections yet. Note what stands out as you revisit this reading.</p>
        )}

        {items.length > 0 && (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.key} className="min-w-0 space-y-1 text-sm leading-relaxed">
                {editing === item.key ? (
                  <ReflectionEditor
                    id={`${formId}-edit-${item.key}`}
                    label={item.label}
                    initialText={item.note}
                    saving={saving}
                    onCancel={() => close(item.key)}
                    onSubmit={async (text) => {
                      if (await save(item.key, { text, mode: 'replace' })) close(item.key);
                    }}
                    onRemove={async () => {
                      if (await save(item.key, { mode: 'remove' })) close('add');
                    }}
                  />
                ) : (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-x-2">
                      <span className="block min-w-0 flex-[1_1_12rem] font-semibold text-main wrap-anywhere">
                        {item.label}
                      </span>
                      {canEdit && item.editable && (
                        <button
                          type="button"
                          ref={(node) => {
                            if (node) buttonRefs.current.set(item.key, node);
                            else buttonRefs.current.delete(item.key);
                          }}
                          disabled={Boolean(editing) || saving}
                          onClick={() => {
                            setStatus(null);
                            setEditing(item.key);
                          }}
                          className={cn(TEXT_BUTTON_CLASS, '-my-2')}
                        >
                          <PencilSimple className="h-3.5 w-3.5" aria-hidden="true" />
                          Edit
                          <span className="sr-only"> reflection: {item.label}</span>
                        </button>
                      )}
                    </div>
                    <span className="block whitespace-pre-wrap text-muted wrap-anywhere">{item.note}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        {canEdit && editing === 'add' && (
          <ReflectionEditor
            id={`${formId}-add`}
            label="Your reflection"
            initialText=""
            saving={saving}
            hint={existingNote(addTarget) ? `Adds to your existing note on ${addTargetLabel}.` : null}
            onCancel={() => close('add')}
            onSubmit={async (text, attemptId) => {
              if (await save(addTarget, { text, mode: 'append', attemptId })) close(addTarget);
            }}
          >
            {targets.length > 1 && (
              <div className="space-y-1">
                <label htmlFor={`${formId}-target`} className="block text-sm font-semibold text-main">Reflect on</label>
                <select
                  id={`${formId}-target`}
                  value={addTarget}
                  disabled={saving}
                  onChange={(event) => setAddTarget(event.target.value)}
                  className="w-full min-h-touch rounded-xl border border-(--border-warm-light) bg-(--panel-dark-1) px-3 py-2 text-base sm:text-sm text-(--text-main) focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-(--focus-ring-color)"
                >
                  {targets.map((target) => (
                    <option key={target.key} value={target.key}>{target.label}</option>
                  ))}
                </select>
              </div>
            )}
          </ReflectionEditor>
        )}

        {canEdit && editing !== 'add' && (
          <button
            type="button"
            ref={(node) => {
              if (node) buttonRefs.current.set('add', node);
              else buttonRefs.current.delete('add');
            }}
            disabled={Boolean(editing) || saving}
            onClick={() => {
              setStatus(null);
              setAddTarget(READING_REFLECTION_KEY);
              setEditing('add');
            }}
            className={cn(styles.actionButton, editing ? styles.actionButtonDisabled : styles.actionButtonEnabled)}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add a reflection
          </button>
        )}

        <p className="text-xs" aria-live="polite">
          {status && (
            <span className={status.tone === 'success' ? 'text-(--status-success)' : 'text-(--status-error)'}>
              {status.message}
            </span>
          )}
        </p>
      </div>
    </section>
  );
});
