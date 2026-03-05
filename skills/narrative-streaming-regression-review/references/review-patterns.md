# Review Patterns

## Repeated Regression Classes

1. Streaming reveal performance under long content.
- PR #44 flagged per-word JS animation cost in narrative stream.
- Follow-up commits moved toward CSS and chunked reveal behavior.

2. Mobile narrative stability tradeoffs.
- `8457941` adjusted thresholds and introduced suppression/opt-in behavior for mobile markdown or long text.
- Risk: users see inconsistent typing effect without clear notice.

3. Completion and callback timing races.
- Existing code relies on refs (`completionNotifiedRef`, `prevNarrativeTextRef`) to avoid stale callback firing.
- Regression risk when reset ordering changes.

4. Source usage telemetry drift.
- `8457941` added source-usage tracking in local composer path.
- Risk: inconsistent `graphRAG` or `sourceUsage` fields causing evaluation/reporting mismatch.

## Relevant Commits

- `8457941` - Timeout and narrative responsiveness improvements, source usage tracking.
- `47747cd` - CSS reveal switch for streaming narrative.
- `5ce65f6` - Review-fix bundle affecting cinematic narrative flow.