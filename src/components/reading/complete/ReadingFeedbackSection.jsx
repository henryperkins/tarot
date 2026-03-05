import { FeedbackPanel } from '../../FeedbackPanel';

export function ReadingFeedbackSection({
    personalReading,
    readingMeta,
    selectedSpread,
    spreadName,
    deckStyleId,
    userQuestion,
    lastCardsForFeedback,
    feedbackVisionSummary
}) {
    if (!personalReading) return null;

    return (
        <div className="w-full max-w-2xl mx-auto mt-6 sm:mt-8">
            <FeedbackPanel
                requestId={readingMeta?.requestId}
                spreadKey={readingMeta?.spreadKey || selectedSpread}
                spreadName={readingMeta?.spreadName || spreadName}
                deckStyle={readingMeta?.deckStyle || deckStyleId}
                provider={readingMeta?.provider}
                userQuestion={readingMeta?.userQuestion || userQuestion}
                cards={lastCardsForFeedback}
                visionSummary={feedbackVisionSummary}
            />
        </div>
    );
}
