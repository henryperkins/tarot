# Tableu migration audit

> Historical snapshot for 0.27.3. The current plugin attaches the Tableu app, and eight tools were exposed in the 2026-09-28 audit. The findings below are preserved as recorded, not current operating instructions. See [capabilities-audit.md](capabilities-audit.md) for current evidence and [actions-contract.md](actions-contract.md) for live tool usage; tool presence alone does not prove every historical runtime gap is closed.

Audit date: 2026-09-23
Plugin revision: 0.27.3
Original GPT: [Tableu](https://chatgpt.com/g/g-696d29b8165081919461b61c366e334d-tableu)
Plugin: Tableu (private installation link omitted from this public upload copy on 2026-10-01; preserved in the original archive).

## Evidence and limits

This audit compares the installed plugin with three supplied files and the current default-branch repository files fetched on the audit date. The original GPT's editor was disabled after migration, so its hidden Action configuration and credentials were not inspected.

Preserved supplied sources:

- [INSTRUCTIONS.md](migration-source/INSTRUCTIONS.md): a backend implementation plan, labeled as verified against henryperkins/tarot commit f3485d0 on 2026-09-09. This is not the original GPT's full system instruction text.
- [journal-gpt-behavior.md](migration-source/journal-gpt-behavior.md): proposed instruction and knowledge layers for journal writes.
- [tarot-actions-complete.yaml](migration-source/tarot-actions-complete.yaml): intended OpenAPI 3.1 contract with four POST operations and bearer authentication.

The source files are included unchanged. An API schema or implementation plan does not demonstrate deployed behavior. Repository findings below are code observations, not production endpoint tests.

## Findings

| Area | Evidence | Plugin correction or remaining work |
|---|---|---|
| Reading craft and knowledge | Migrated skill, four reference files, icon, and prompts were present. | Preserved tarot guidance and reference material. |
| Connected tools | Plugin source has no app/MCP configuration; no matching Tableu tools were exposed in this conversation. | Continue capability checks and conversational interpretation of supplied cards. Importing OpenAPI as a reference does not connect it. |
| Intended Action coverage | Supplied schema defines createTarotReading, drawTarotReading, saveReadingToJournal, and addReflectionToJournalEntry. | Preserve the schema and add exact operational guidance. |
| Existing adapter | mcp/tableau-adapter/server.js registers start/status/wait/cancel tools against reading-job routes. start requires supplied cards. | Correct the earlier incomplete finding: an adapter exists, but draw and journal parity are absent from the inspected adapter. Add conditional job workflow guidance. |
| Journal authentication | journal.js GET and POST still use getSessionFromCookie and validateSession; journal/[id].js does likewise for GET and DELETE. | The supplied bearer-auth contract is not implemented by these handlers. Backend auth work remains. |
| Reflection endpoint | Fetching functions/api/journal/reflections.js returned 404; worker imports and journal route registry contain no reflection handler. | The supplied reflection Action is a planned contract, not a route verified in current code. Handler and route registration remain. |
| Save payload | Reading and journal fields differ, and the journal uses name rather than card. | Add exact mapping; preserve narrative and metadata; capitalize journal orientations and exclude meaning. |
| Deduplication | journal.js looks up user_id plus session_seed and returns 200/deduplicated for existing entries. requestId is tracing only. | Use only an actual returned draw seed. Prevent blind retries of unseeded saves and uncertain appends. |
| Reflection behavior | Supplied notes specify verbatim text, 2,000-character cap, append semantics, and index-keyed string storage. | Preserve wording, require the current saved id, disambiguate duplicate card names, and do not claim implemented behavior without a live tool. |
| Account isolation | Adapter callTableau always forwards TABLEAU_API_KEY; enabling its OAuth middleware does not change that downstream credential. | Do not equate adapter login with separate journal ownership. Public/shared writes require backend identity mapping; owner-only service credentials must remain owner-only. |
| Archetype tracking | journal.js does not call the tracking route; useJournal.js separately posts /api/archetype-journey/track. | Do not imply that an Action save updates card recurrence or archetype history. |
| Journal history | Supplied schema has no journal read operations. | No account-history, recurrence, or cross-session claims without a future read tool. |

## Changes in 0.27.3

- Preserved the supplied schema and both supporting documents as migration evidence.
- Added actions-contract.md and explicit reference routing in the skill and knowledge index.
- Added exact journal mappings, mandatory narrative preservation, canonical context values, response handling, seed-only deduplication, and uncertain-write handling.
- Required verbatim reflections with the length limit, exact saved-card targeting, and append semantics.
- Documented the existing async adapter as distinct from the original synchronous Action contract.
- Added account-isolation and archetype-tracking constraints grounded in inspected code.
- Marked old ActionsGPT examples as historical and corrected the knowledge base's unconditional seed echo/reproduction claims.
- Preserved plugin identity and private audience. No credentials, live connection, or backend code were added.

## Work required for live parity

1. Implement and route the reflection handler with the string-map storage model described in the supplied plan.
2. Update the journal auth path to support the intended bearer identity while retaining appropriate ownership and entitlement checks.
3. Extend or provide an MCP surface for draw, save, and reflection operations, plus the intended reading contract; the existing jobs adapter already covers supplied-card asynchronous readings.
4. For shared use, propagate verified per-user identity through to the backend rather than forwarding one account's key for all users.
5. Choose how API saves participate in archetype tracking, if parity with app saves is required.
6. Configure a real deployed MCP URL and authentication in the plugin, then test draw/read, save/deduplication, reflections, authorization boundaries, and app read-back rendering.

The supplied API base URL and the adapter README's placeholder host do not establish a deployed MCP endpoint. Do not invent a connection or assume this source audit completed those backend tasks.

## Repository snapshots inspected

URLs follow the default branch and may change; hashes below identify the file blobs returned during this audit, not commit SHAs.

| File | Returned blob SHA |
|---|---|
| [mcp/tableau-adapter/server.js](https://github.com/henryperkins/tarot/blob/master/mcp/tableau-adapter/server.js) | bc9d2fc4888e341162e711aa1ef6d5e3db0e642e |
| [mcp/tableau-adapter/README.md](https://github.com/henryperkins/tarot/blob/master/mcp/tableau-adapter/README.md) | 6a0207ed2b52a2f34efac8adde2026fbced8d20b |
| [functions/api/journal.js](https://github.com/henryperkins/tarot/blob/master/functions/api/journal.js) | 1ebc116ef518d62885b548e52ca8dbb9de2b74f1 |
| [functions/api/journal/[id].js](https://github.com/henryperkins/tarot/blob/master/functions/api/journal/%5Bid%5D.js) | 08d3487f1fc74b636629d8893d6c8320b5f18111 |
| [src/worker/index.js](https://github.com/henryperkins/tarot/blob/master/src/worker/index.js) | 920834036e416f8545b2afa593218dafa4866fa8 |
| [src/hooks/useJournal.js](https://github.com/henryperkins/tarot/blob/master/src/hooks/useJournal.js) | 88d0f9ca5108ec7235590c510d73fcd7f6560dba |

No live reading or journal write was made during this audit. Static release checks cover packaging, source preservation, internal references, contract fields, and schema constraints; they do not establish deployed Action parity or runtime behavior.
