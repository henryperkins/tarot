# Unit test guidance

Key files: `deck.test.mjs`, `narrativeBuilder.*.test.mjs`, `narrativeSpine.test.mjs`, `evaluation.test.mjs`. Journal and MCP tests run against real SQLite via `tests/helpers/d1Sqlite.mjs` (`sql.js`, every migration applied); OAuth tests stub `cloudflare:workers` with `tests/helpers/cloudflareWorkersHooks.mjs`.
