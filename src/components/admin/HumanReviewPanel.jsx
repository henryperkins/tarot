import { memo, useState } from 'react';
import {
  ClipboardText,
  Check,
  WarningCircle,
  CheckCircle
} from '@phosphor-icons/react';

const NARRATIVE_COMMANDS = [
  {
    key: 'eval-narrative',
    label: 'Generate narrative review queue',
    value: 'npm run eval:narrative'
  },
  {
    key: 'review-queue',
    label: 'Review queue file',
    value: 'data/evaluations/narrative-review-queue.csv',
    isPath: true
  },
  {
    key: 'process-narrative',
    label: 'Process narrative reviews',
    value: 'npm run review:narrative'
  },
  {
    key: 'gate-narrative',
    label: 'Run narrative gate',
    value: 'npm run gate:narrative'
  }
];

const VISION_COMMANDS = [
  {
    key: 'eval-vision',
    label: 'Generate vision review queues',
    value: 'npm run eval:vision:metrics'
  },
  {
    key: 'process-vision',
    label: 'Process vision reviews',
    value: 'npm run review:vision'
  }
];

const REASON_STYLES = {
  'safety-flag': 'bg-error/10 text-error',
  'low-safety': 'bg-warning/10 text-warning',
  'low-tone': 'bg-warning/10 text-warning',
  'hallucinated-cards': 'bg-secondary/20 text-muted'
};

const REASON_LABELS = {
  'safety-flag': 'Safety flag',
  'low-safety': 'Low safety',
  'low-tone': 'Low tone',
  'hallucinated-cards': 'Hallucinated cards'
};

function formatTimestamp(value) {
  if (!value) return 'Unknown time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function formatScore(value) {
  if (value === null || value === undefined) return '--';
  const num = Number(value);
  if (!Number.isFinite(num)) return '--';
  return num.toFixed(2);
}

function formatCoverage(value) {
  if (value === null || value === undefined) return '--';
  const num = Number(value);
  if (!Number.isFinite(num)) return '--';
  return `${(num * 100).toFixed(0)}%`;
}

function CommandList({ title, commands, onCopy, copiedKey }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted uppercase tracking-wide">{title}</p>
      {commands.map((command) => (
        <div
          key={command.key}
          className="flex items-center justify-between gap-3 rounded-lg border border-secondary/20 bg-secondary/10 px-3 py-2"
        >
          <div className="min-w-0">
            <p className="text-xs text-muted">{command.label}</p>
            <code className="block truncate font-mono text-xs text-main">
              {command.value}
            </code>
          </div>
          <button
            type="button"
            onClick={() => onCopy(command.value, command.key)}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-secondary/30 text-muted hover:text-main hover:border-secondary/60 transition-colors"
            aria-label={`Copy ${command.label}`}
          >
            {copiedKey === command.key ? (
              <Check className="h-4 w-4 text-success" weight="bold" />
            ) : (
              <ClipboardText className="h-4 w-4" weight="duotone" />
            )}
          </button>
        </div>
      ))}
    </div>
  );
}

export const HumanReviewPanel = memo(function HumanReviewPanel({ reviewQueue }) {
  const [copiedKey, setCopiedKey] = useState(null);
  const items = reviewQueue?.items || [];
  const counts = reviewQueue?.counts || {};
  const windowDays = reviewQueue?.query?.days || null;

  const handleCopy = async (value, key) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      setCopiedKey(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Offline Review Checklist */}
      <div className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-main">Offline Review Checklist</p>
          <p className="text-xs text-muted mt-1">
            Use this loop when narrative or vision logic changes. Fill in human_verdict and human_notes in the CSV queue.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <CommandList
            title="Narrative review loop"
            commands={NARRATIVE_COMMANDS}
            onCopy={handleCopy}
            copiedKey={copiedKey}
          />
          <CommandList
            title="Vision review loop (optional)"
            commands={VISION_COMMANDS}
            onCopy={handleCopy}
            copiedKey={copiedKey}
          />
        </div>
      </div>

      {/* Runtime Review Queue */}
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <p className="text-sm font-semibold text-main">Runtime Review Queue</p>
            <p className="text-xs text-muted mt-1">
              Flagged readings over the last {windowDays || 'recent'} days.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs">
            <span className="rounded-full bg-secondary/20 px-2 py-0.5 text-muted">{counts.total || 0} total</span>
            {(counts.safetyFlag || 0) > 0 && (
              <span className="rounded-full bg-error/10 px-2 py-0.5 text-error">{counts.safetyFlag} flags</span>
            )}
            {(counts.lowSafety || 0) > 0 && (
              <span className="rounded-full bg-warning/10 px-2 py-0.5 text-warning">{counts.lowSafety} low safety</span>
            )}
            {(counts.lowTone || 0) > 0 && (
              <span className="rounded-full bg-warning/10 px-2 py-0.5 text-warning">{counts.lowTone} low tone</span>
            )}
            {(counts.hallucinations || 0) > 0 && (
              <span className="rounded-full bg-secondary/20 px-2 py-0.5 text-muted">{counts.hallucinations} halluc</span>
            )}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted">
            <CheckCircle className="h-8 w-8 mb-2 text-success" weight="duotone" />
            <p className="text-sm font-medium text-main">No flagged readings</p>
            <p className="text-xs text-muted mt-1">Nothing queued for manual review.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.requestId || `${item.timestamp}-${item.provider}`}
                className="rounded-lg border border-secondary/20 bg-secondary/10 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-main">
                      {item.spreadKey || 'unknown spread'} &middot; {item.provider || 'unknown provider'}
                    </p>
                    <p className="text-xs text-muted mt-1 flex flex-wrap items-center gap-x-1">
                      <span>{formatTimestamp(item.timestamp)}</span>
                      <span>&middot;</span>
                      <span className="font-mono truncate max-w-[100px] sm:max-w-[140px]">{item.requestId || 'unknown'}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(item.reasons || []).map((reason) => (
                      <span
                        key={reason}
                        className={`rounded-full px-2 py-0.5 text-2xs ${REASON_STYLES[reason] || 'bg-secondary/20 text-muted'}`}
                      >
                        {REASON_LABELS[reason] || reason}
                      </span>
                    ))}
                  </div>
                </div>

                {item.questionExcerpt && (
                  <p className="text-xs text-muted mt-2">
                    <span className="text-main font-medium">Q:</span> {item.questionExcerpt}
                  </p>
                )}
                {item.readingExcerpt && (
                  <p className="text-xs text-muted mt-2">
                    <span className="text-main font-medium">Excerpt:</span> {item.readingExcerpt}
                  </p>
                )}
                {item.hallucinatedCards && item.hallucinatedCards.length > 0 && (
                  <p className="text-xs text-warning mt-2">
                    Hallucinated cards: {item.hallucinatedCards.join(', ')}
                  </p>
                )}
                {item.notes && (
                  <p className="text-xs text-muted mt-2">
                    <span className="text-main font-medium">Eval notes:</span> {item.notes}
                  </p>
                )}

                <div className="mt-2 flex flex-wrap gap-4 text-2xs text-muted">
                  <span>Overall: {formatScore(item.overall)}</span>
                  <span>Safety: {formatScore(item.safety)}</span>
                  <span>Tone: {formatScore(item.tone)}</span>
                  <span>Coverage: {formatCoverage(item.cardCoverage)}</span>
                </div>

                {(item.readingPromptVersion || item.variantId) && (
                  <div className="mt-2 flex flex-wrap gap-2 text-2xs text-muted">
                    {item.readingPromptVersion && (
                      <span>Reading v{item.readingPromptVersion}</span>
                    )}
                    {item.variantId && (
                      <span>Variant {item.variantId}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {reviewQueue?.error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-error/20 bg-error/10 px-3 py-2 text-xs text-error">
            <WarningCircle className="h-4 w-4" weight="duotone" />
            <span>Unable to load review queue: {reviewQueue.error}</span>
          </div>
        )}
      </div>
    </div>
  );
});

export default HumanReviewPanel;
