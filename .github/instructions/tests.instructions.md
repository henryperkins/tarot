---
applyTo: "tests/**/*.mjs"
---

# Testing Guidelines

## Framework
- Use Node.js native test runner (`node --test`)
- Test files use `.test.mjs` extension
- Tests are located in `tests/` directory

## Test Structure
- Mirror source file names in test names
- Group related tests using `describe` blocks
- Keep tests fast and deterministic
- Cover edge cases and error paths, not just happy paths

## Running Tests
```bash
npm test                    # Run all tests
npm run gate:vision        # Vision quality gates
npm run gate:narrative     # Narrative quality gates
```

## Mocking
- Stub external services (Azure, Anthropic APIs)
- Mock environment variables using test fixtures
- For hooks, use context/provider wrappers

## Key Test Files
- `deck.test.mjs` — Deck shuffling, seeding, drawing logic
- `api.validatePayload.test.mjs` — API payload validation
- `narrativeSpine.test.mjs` — Narrative structure validation
- `knowledgeGraph.test.js` — Knowledge graph patterns (in `functions/lib/__tests__/`)

## When Adding New Features
- Add corresponding tests before merging
- Run `npm test` before pushing
- If touching vision/narrative code, also run the relevant `gate:*` command
