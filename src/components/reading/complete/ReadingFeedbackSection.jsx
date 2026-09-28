import { FeedbackPanel } from '../../FeedbackPanel';
import { READING_PANEL_COLUMN_CLASS } from '../../../styles/panelClasses';

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
    if (!personalReading || personalReading.isError || personalReading.isStreaming) return null;

    return (
        <div className={`${READING_PANEL_COLUMN_CLASS} mt-6 sm:mt-8`}>
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
