import { useState, useCallback } from 'react';
import { Brain, Trash, Plus, Warning, X, SpinnerGap } from '@phosphor-icons/react';
import { useMemories } from '../hooks/useMemories';
import { useAuth } from '../contexts/AuthContext';

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const controlShellClass =
    'rounded-[1.75rem] border border-secondary/40 bg-surface/75 p-3 xs:p-4 shadow-lg shadow-secondary/20 backdrop-blur-xl';

  const handleAddMemory = useCallback(async (e) => {
    e.preventDefault();
    if (!newMemoryText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setDeleteError(null);

    const result = await createMemory({
      text: newMemoryText.trim(),
      category: newMemoryCategory,
      keywords: []
    });

    setIsSubmitting(false);

    if (result.success) {
      setNewMemoryText('');
      setShowAddForm(false);
    } else {
      setDeleteError(result.error);
    }
  }, [newMemoryText, newMemoryCategory, createMemory, isSubmitting]);

  const handleDeleteMemory = useCallback(async (memoryId) => {
    setDeleteError(null);
    const result = await deleteMemory(memoryId);
    if (!result.success) {
      setDeleteError(result.error);
    }
  }, [deleteMemory]);

  const handleClearAll = useCallback(async () => {
    setDeleteError(null);
    const result = await clearAll();
    setShowClearConfirm(false);
    if (!result.success) {
      setDeleteError(result.error);
    }
  }, [clearAll]);

  // Group memories by category
  const memoriesByCategory = memories.reduce((acc, memory) => {
    const cat = memory.category || 'general';
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
    <div className={`${controlShellClass} ${className}`}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs sm:text-sm font-serif text-accent uppercase tracking-[0.12em] flex items-center gap-2">
          <Brain className="w-4 h-4" aria-hidden="true" />
          Reader Memory
        </h3>
        <div className="flex items-center gap-2">
          {memories.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="text-xs text-muted hover:text-red-400 transition-colors"
              aria-label="Clear all memories"
            >
              Clear all
            </button>
          )}
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="p-1.5 rounded-lg border border-secondary/30 hover:border-secondary/60 transition-colors"
            aria-label={showAddForm ? 'Cancel adding memory' : 'Add new memory'}
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
      <p className="text-xs text-muted/80 mb-3">
        These insights help the reader personalize your follow-up conversations.
        The reader learns from your interactions automatically.
      </p>

      {/* Error display */}
      {(error || deleteError) && (
        <div className="mb-3 p-2 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2">
          <Warning className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-xs text-red-400">{error || deleteError}</span>
        </div>
      )}

      {/* Clear confirmation */}
      {showClearConfirm && (
        <div className="mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
          <p className="text-sm text-red-400 mb-2">
            Delete all {memories.length} memories? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleClearAll}
              className="px-3 py-1.5 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
            >
              Yes, delete all
            </button>
            <button
              onClick={() => setShowClearConfirm(false)}
              className="px-3 py-1.5 text-xs bg-surface/50 hover:bg-surface/70 text-muted rounded-lg transition-colors"
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
              value={newMemoryText}
              onChange={(e) => setNewMemoryText(e.target.value)}
              placeholder="e.g., User prefers concrete action steps over abstract symbolism"
              className="w-full px-3 py-2 text-sm bg-surface/70 border border-secondary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
              rows={2}
              maxLength={200}
            />
            <div className="text-xs text-muted/60 text-right mt-1">
              {newMemoryText.length}/200
            </div>
          </div>
          <div className="mb-3">
            <label htmlFor="memory-category" className="text-xs text-muted block mb-1">
              Category
            </label>
            <select
              id="memory-category"
              value={newMemoryCategory}
              onChange={(e) => setNewMemoryCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-surface/70 border border-secondary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{categoryLabels[cat]}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={!newMemoryText.trim() || isSubmitting}
            className="w-full py-2 text-sm bg-secondary/20 hover:bg-secondary/30 disabled:opacity-50 disabled:cursor-not-allowed text-secondary rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <SpinnerGap className="w-4 h-4 animate-spin" />
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
        <div className="py-6 text-center">
          <SpinnerGap className="w-6 h-6 mx-auto animate-spin text-secondary" />
          <p className="text-xs text-muted mt-2">Loading memories...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && memories.length === 0 && (
        <div className="py-6 text-center">
          <Brain className="w-8 h-8 mx-auto mb-2 text-muted/40" />
          <p className="text-sm text-muted">No memories yet</p>
          <p className="text-xs text-muted/60 mt-1">
            As you chat with the reader, they'll remember what's important to you.
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
                <h4 className="text-xs text-secondary/80 uppercase tracking-wider mb-1.5">
                  {categoryLabels[cat]}
                </h4>
                <div className="space-y-1.5">
                  {catMemories.map(memory => (
                    <MemoryItem
                      key={memory.id}
                      memory={memory}
                      onDelete={handleDeleteMemory}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer with count */}
      {memories.length > 0 && (
        <div className="mt-3 pt-2 border-t border-secondary/10 flex items-center justify-between">
          <span className="text-xs text-muted/60">
            {memories.length} {memories.length === 1 ? 'memory' : 'memories'}
          </span>
          <button
            onClick={refresh}
            disabled={loading}
            className="text-xs text-muted hover:text-secondary transition-colors"
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
function MemoryItem({ memory, onDelete }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    await onDelete(memory.id);
    setIsDeleting(false);
  };

  const sourceLabel = {
    ai: 'AI',
    user: 'You',
    system: 'System'
  };

  return (
    <div className="group flex items-start gap-2 p-2 rounded-lg bg-surface/40 hover:bg-surface/60 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-main leading-snug">{memory.text}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-muted/50">
            {sourceLabel[memory.source] || 'AI'}
          </span>
          {memory.createdAt && (
            <span className="text-[10px] text-muted/50">
              {new Date(memory.createdAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={handleDelete}
        disabled={isDeleting}
        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/20 transition-all"
        aria-label="Delete memory"
      >
        {isDeleting ? (
          <SpinnerGap className="w-4 h-4 animate-spin text-muted" />
        ) : (
          <Trash className="w-4 h-4 text-muted hover:text-red-400" />
        )}
      </button>
    </div>
  );
}

export default MemoryManager;
