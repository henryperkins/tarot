import { ChatCircle } from '@phosphor-icons/react';
import FollowUpModal from '../../FollowUpModal';

export function ContinueConversationSection({
    personalReading,
    isPersonalReadingError,
    narrativePhase,
    isHandset,
    followUpOpen,
    setFollowUpOpen,
    followUpAutoFocus
}) {
    const shouldRender = personalReading
        && !isPersonalReadingError
        && narrativePhase === 'complete'
        && !isHandset;

    if (!shouldRender) return null;

    return (
        <div className="w-full max-w-2xl mx-auto mt-6">
            <div className="panel-mystic rounded-2xl border border-[color:var(--border-warm-light)] p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <p className="text-sm font-semibold text-main">Continue the conversation</p>
                        <p className="text-xs text-muted">Open a private chat window to explore this reading.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setFollowUpOpen?.(true)}
                        className="inline-flex items-center gap-2 rounded-full bg-accent/15 border border-accent/40 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/25 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                    >
                        <ChatCircle className="w-4 h-4" weight="fill" aria-hidden="true" />
                        <span>Open chat</span>
                    </button>
                </div>
            </div>
            <FollowUpModal
                isOpen={Boolean(followUpOpen)}
                onClose={() => setFollowUpOpen?.(false)}
                autoFocusInput={followUpAutoFocus}
            />
        </div>
    );
}
