---
applyTo: "tests/*.test.mjs"
---

# Testing Guidelines

## Framework
- Use Node.js native test runner (`node --test`)
- Root unit tests use the `.test.mjs` extension and live directly in `tests/`
- `npm test` expands `tests/*.test.mjs`; it does not include nested helper files, `functions/__tests__/`, Playwright specs, or accessibility scripts

## Test Structure
- Mirror source file names in test names
- Group related tests using `describe` blocks
- Keep tests fast and deterministic
- Cover edge cases and error paths, not just happy paths

## Running Tests
```bash
npm test
node --test functions/__tests__/*.test.mjs functions/__tests__/*.test.js
npm run test:e2e
npm run test:a11y
npm run test:a11y:all
npm run gate:vision
npm run gate:narrative
```

`npm run test:e2e` runs the Playwright suite. `npm run test:a11y` runs the static accessibility checks; `npm run test:a11y:all` adds the Playwright accessibility suite. The two gate commands are quality-gate checks, not substitutes for unit tests.

## Mocking
- Stub external services (Azure, Anthropic, and Workers AI APIs)
- Mock environment variables using test fixtures
- For hooks, use context/provider wrappers

## Key Test Files
- `tests/deck.test.mjs` — Deck shuffling, seeding, drawing logic
- `tests/api.validatePayload.test.mjs` — API payload validation
- `tests/narrativeSpine.test.mjs` — Narrative structure validation
- `functions/__tests__/knowledgeGraph.test.js` — Knowledge graph patterns in the separate library suite

## When Adding New Features
- Add corresponding tests before merging
- Run `npm test` before pushing
- Run the focused `functions/__tests__/`, Playwright, or accessibility command when the change affects that surface
- If touching vision/narrative code, also run the relevant `gate:*` command
