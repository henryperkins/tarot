# Validation

## Fast Checks

```bash
npm run lint
node --test tests/sceneOrchestrator.test.mjs tests/cinematicEnhancements.test.mjs
```

## Broader Regression Checks

```bash
node --test tests/sceneOrchestrator.test.mjs tests/cinematicEnhancements.test.mjs tests/streamingWrapper.test.mjs
npm run build
```

## Optional UI Flow Check

```bash
npm run test:e2e -- e2e/tarot-reading.spec.js
```

## Expected Output in Review

- Explicit pass/fail for each command run.
- If not run, state exactly why.
- Map each finding to at least one validating test command.