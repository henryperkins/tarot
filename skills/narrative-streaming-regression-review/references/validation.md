# Validation

## Core Regression Suite

```bash
npm run lint
node --test tests/narrativeBackends.test.mjs tests/sourceUsageSummary.test.mjs tests/narrativeBuilder.promptCompliance.test.mjs tests/reasoning.test.mjs tests/sceneOrchestrator.test.mjs
```

## Streaming and UI Checks

```bash
node --test tests/streamingWrapper.test.mjs tests/narrationStream.test.mjs tests/mobileStableMode.test.mjs
npm run test:e2e -- e2e/tarot-reading.spec.js
```

## Build Check

```bash
npm run build
```

## Expected Reviewer Output

- Mention which suites were run.
- Tie each finding to failing/passing command evidence.
- If E2E not run, state limitation clearly.