import { useState, useCallback, useRef } from 'react';
import { Brain, Trash, Plus, Warning, X, SpinnerGap } from '@phosphor-icons/react';
import { useMemories } from '../hooks/useMemories';
import { useAuth } from '../contexts/AuthContext';
import { FOCUS_RING_DEFAULT } from '../styles/focusClasses';

/**
 * MemoryManager - User memory management interface
 *
 * Allows users to view, add, and delete memories that personalize
 * their follow-up conversations with the tarot reader.
 */
export function MemoryManager({ className = '' }) {
  const { isAuthenticated } = useAuth();
  const {
    memories,
    loading,
    error,
    mutating,
    categories,
    categoryLabels,
    createMemory,
    deleteMemory,
    clearAll,
    refresh
  } = useMemories();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newMemoryText, setNewMemoryText] = useState('');
  const [newMemoryCategory, setNewMemoryCategory] = useState('general');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [notice, setNotice] = useState('');
  const panelRef = useRef(null);
  const addButtonRef = useRef(null);
  const isSubmitting = mutating === 'create';
  const isClearing = mutating === 'clear';
  const busy = Boolean(mutating);
  const focusAddButton = useCallback(() => {
    requestAnimationFrame(() => {
      if (document.activeElement === document.body || panelRef.current?.contains(document.activeElement)) {
        addButtonRef.current?.focus();
      }
    });
  }, []);

  const controlShellClass =
    'rounded-[1.75rem] border border-secondary/40 bg-surface/75 p-3 xs:p-4 shadow-lg shadow-secondary/20 backdrop-blur-xl';

  const handleAddMemory = useCallback(async (e) => {
    e.preventDefault();
    if (newMemoryText.trim().length < 3 || busy) return;

    setDeleteError(null);
    setNotice('');

    const result = await createMemory({
      text: newMemoryText.trim(),
      category: newMemoryCategory,
      keywords: []
    });

    if (result.success) {
      setNewMemoryText('');
      setShowAddForm(false);
      setNotice(result.deduplicated ? 'This memory is already saved.' : 'Memory saved.');
      focusAddButton();
    } else if (!result.cancelled && !result.busy) {
      setDeleteError(result.error);
    }
  }, [newMemoryText, newMemoryCategory, createMemory, busy, focusAddButton]);

  const handleDeleteMemory = useCallback(async (memoryId) => {
    setDeleteError(null);
    setNotice('');
    const result = await deleteMemory(memoryId);
    if (result.success) {
      setNotice('Memory deleted.');
      focusAddButton();
    } else if (!result.cancelled && !result.busy) {
      setDeleteError(result.error);
    }
  }, [deleteMemory, focusAddButton]);

  const handleClearAll = useCallback(async () => {
    setDeleteError(null);
    setNotice('');
    const result = await clearAll();
    if (result.success) {
      setShowClearConfirm(false);
      setNotice('Memories deleted.');
      focusAddButton();
    } else if (!result.cancelled && !result.busy) {
      setDeleteError(result.error);
    }
  }, [clearAll, focusAddButton]);

  // Group memories by category
  const memoriesByCategory = memories.reduce((acc, memory) => {
    const cat = categories.includes(memory.category) ? memory.category : 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(memory);
    return acc;
  }, {});

  if (!isAuthenticated) {
    return (
      <div className={`${controlShellClass} ${className}`}>
        <div className="text-center py-4">
          <Brain className="w-8 h-8 mx-auto mb-2 text-muted/60" />
          <p className="text-sm text-muted">Sign in to manage your reading memories</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={panelRef} className={`${controlShellClass} ${className}`}>
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs sm:text-sm font-serif text-accent uppercase tracking-[0.12em] flex items-center gap-2">
          <Brain className="w-4 h-4" aria-hidden="true" />
          Reader Memory
        </h3>
        <div className="flex items-center gap-2">
          {memories.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              disabled={busy}
              className={`min-h-touch min-w-touch rounded-lg px-2 text-xs text-muted hover:text-error transition-colors ${FOCUS_RING_DEFAULT}`}
              aria-label="Clear all memories"
            >
              Clear all
            </button>
          )}
          <button
            ref={addButtonRef}
            onClick={() => setShowAddForm(!showAddForm)}
            disabled={busy}
            className="p-1.5 min-h-touch min-w-touch flex items-center justify-center rounded-lg border border-secondary/30 hover:border-secondary/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)]"
            aria-label={showAddForm ? 'Cancel adding memory' : 'Add new memory'}
            aria-expanded={showAddForm}
          >
            {showAddForm ? (
              <X className="w-4 h-4 text-muted" />
            ) : (
              <Plus className="w-4 h-4 text-secondary" />
            )}
          </button>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-muted mb-3">
        These insights help the reader personalize your follow-up conversations.
        The reader learns from your interactions automatically.
      </p>

      {/* Error display */}
      {(error || deleteError) && (
        <div className="mb-3 p-3 rounded-lg bg-error/10 border border-error/30">
          <p role="alert" className="flex items-start gap-2 text-sm text-main break-words">
            <Warning className="mt-0.5 w-4 h-4 text-error flex-shrink-0" aria-hidden="true" />
            <span>{deleteError || error}</span>
          </p>
          {error && (
            <button
              type="button"
              onClick={() => { setDeleteError(null); void refresh(); }}
              disabled={loading || busy}
              className={`mt-2 min-h-touch rounded-lg px-2 text-xs font-semibold text-main underline underline-offset-4 ${FOCUS_RING_DEFAULT}`}
            >
              Retry loading memories
            </button>
          )}
        </div>
      )}
      {notice && <p role="status" className="mb-3 text-sm text-main">{notice}</p>}

      {/* Clear confirmation */}
      {showClearConfirm && (
        <div className="mb-3 p-3 rounded-lg bg-error/10 border border-error/30">
          <p className="text-sm text-main mb-2">
            Delete all {memories.length} {memories.length === 1 ? 'memory' : 'memories'}? This cannot be undone.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleClearAll}
              disabled={busy}
              className="min-h-touch min-w-touch px-3 py-1.5 text-xs bg-error/20 hover:bg-error/30 text-main rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)]"
            >
              {isClearing ? 'Deleting memories…' : 'Yes, delete all'}
            </button>
            <button
              onClick={() => setShowClearConfirm(false)}
              disabled={busy}
              className="min-h-touch min-w-touch px-3 py-1.5 text-xs bg-surface/50 hover:bg-surface/70 text-muted rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add memory form */}
      {showAddForm && (
        <form onSubmit={handleAddMemory} className="mb-4 p-3 rounded-xl bg-surface/50 border border-secondary/20">
          <div className="mb-2">
            <label htmlFor="memory-text" className="text-xs text-muted block mb-1">
              Memory note
            </label>
            <textarea
              id="memory-text"
              dir="auto"
              disabled={busy}
              required
              minLength={3}
              aria-describedby="memory-text-hint"
              value={newMemoryText}
              onChange={(e) => setNewMemoryText(e.target.value)}
              placeholder="e.g., User prefers concrete action steps over abstract symbolism"
              className="w-full min-h-touch px-3 py-2 text-base sm:text-sm bg-surface/70 border border-secondary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
              rows={2}
              maxLength={200}
            />
            <div id="memory-text-hint" className="text-xs text-muted text-right mt-1">
              {newMemoryText.length}/200 · at least 3 characters
            </div>
          </div>
          <div className="mb-3">
            <label htmlFor="memory-category" className="text-xs text-muted block mb-1">
              Category
            </label>
            <select
              id="memory-category"
              disabled={busy}
              value={newMemoryCategory}
              onChange={(e) => setNewMemoryCategory(e.target.value)}
              className="w-full min-h-touch px-3 py-2 text-base sm:text-sm bg-surface/70 border border-secondary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{categoryLabels[cat]}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={newMemoryText.trim().length < 3 || busy}
            className="w-full min-h-touch py-2 text-sm bg-secondary/20 hover:bg-secondary/30 disabled:opacity-50 disabled:cursor-not-allowed text-main rounded-lg transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)]"
          >
            {isSubmitting ? (
              <><SpinnerGap className="w-4 h-4 animate-spin" aria-hidden="true" /> Saving memory…</>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Add Memory
              </>
            )}
          </button>
        </form>
      )}

      {/* Loading state */}
      {loading && !memories.length && (
        <div role="status" className="py-6 text-center">
          <SpinnerGap className="w-6 h-6 mx-auto animate-spin text-secondary" />
          <p className="text-xs text-muted mt-2">Loading memories...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && memories.length === 0 && (
        <div className="py-6 text-center">
          <Brain className="w-8 h-8 mx-auto mb-2 text-muted/40" />
          <p className="text-sm text-muted">No memories yet</p>
          <p className="text-xs text-muted mt-1">
            {'As you chat with the reader, they\'ll remember what\'s important to you.'}
          </p>
        </div>
      )}

      {/* Memories list grouped by category */}
      {memories.length > 0 && (
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
          {categories.map(cat => {
            const catMemories = memoriesByCategory[cat];
            if (!catMemories?.length) return null;

            return (
              <div key={cat}>
                <h4 className="text-xs text-secondary uppercase tracking-wider mb-1.5">
                  {categoryLabels[cat]}
                </h4>
                <div className="space-y-1.5">
                  {catMemories.map(memory => (
                    <MemoryItem
                      key={memory.id}
                      memory={memory}
                      onDelete={handleDeleteMemory}
                      disabled={busy}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer with count */}
      {(memories.length > 0 || deleteError) && (
        <div className="mt-3 pt-2 border-t border-secondary/10 flex items-center justify-between">
          <span className="text-xs text-muted">
            {memories.length} {memories.length === 1 ? 'memory' : 'memories'}
          </span>
          <button
            onClick={() => { setDeleteError(null); setNotice(''); void refresh(); }}
            disabled={loading || busy}
            className={`min-h-touch min-w-touch px-2 text-xs text-muted hover:text-secondary transition-colors rounded-lg ${FOCUS_RING_DEFAULT}`}
          >
            Refresh
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Individual memory item
 */
function MemoryItem({ memory, onDelete, disabled }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (isDeleting || disabled) return;
    setIsDeleting(true);
    await onDelete(memory.id);
    setIsDeleting(false);
  };

  const createdAt = memory.createdAt == null ? null : new Date(memory.createdAt);
  const validDate = createdAt && Number.isFinite(createdAt.getTime());

  const sourceLabel = {
    ai: 'AI',
    user: 'You',
    system: 'System'
  };

  return (
    <div className="group flex items-start gap-2 p-2 rounded-lg bg-surface/40 hover:bg-surface/60 transition-colors">
      <div className="flex-1 min-w-0">
        <p dir="auto" className="text-sm text-main leading-snug break-words">{memory.text}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-2xs text-muted">
            {Object.hasOwn(sourceLabel, memory.source) ? sourceLabel[memory.source] : 'Memory'}
          </span>
          {validDate && (
            <time dateTime={createdAt.toISOString()} className="text-2xs text-muted">
              {createdAt.toLocaleDateString()}
            </time>
          )}
        </div>
      </div>
      <button
        onClick={handleDelete}
        disabled={isDeleting || disabled}
        className="p-1.5 min-h-touch min-w-touch shrink-0 flex items-center justify-center rounded-lg hover:bg-error/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)]"
        aria-label="Delete memory"
      >
        {isDeleting ? (
          <SpinnerGap className="w-4 h-4 animate-spin text-muted" />
        ) : (
          <Trash className="w-4 h-4 text-muted hover:text-error" />
        )}
      </button>
    </div>
  );
}

export default MemoryManager;
