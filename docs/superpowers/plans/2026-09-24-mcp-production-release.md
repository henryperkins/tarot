# MCP production release — 2026-09-24

The owner authorized provisioning OAuth KV, applying production migrations,
merging and deploying MCP with #78, then merging the guidance branch. Account
allowlisting and the authenticated ChatGPT handshake remain the owner's next step.

## Released source and infrastructure

- MCP PR: [#79](https://github.com/henryperkins/tarot/pull/79).
- Tested source: `425d8e11f75c88b733fe211d64e4f8bd38e3f80f`.
- Merge: `3f109cc47abf582df22947d3434b22be2fdf018e`; its tree matches the tested
  source and includes #78 (`d68d35a66b3ce770a9929937aa886342c0dd22a9`).
- Workers Build: `53ecae80-212c-4882-ba3b-dbc937f22b61`, succeeded.
- Active Worker version: `abeb41fb-032d-4070-bd91-e35b61e0e871`, 100% traffic.
  Cloudflare's build-by-version lookup maps it to the merge above.
- Dedicated `tableau-oauth` KV: `c891ef93fcdc4d3da49397adcfbf4aee`, committed as
  the `OAUTH_KV` binding. Other OAuth namespaces were not reused.
- Production D1 migrations 0030 and 0031 applied through `scripts/deploy.js`.
  Verified both `_migrations` records, the journal partial unique index, the
  registration-counter table and its hourly index. No pending migrations remain.
- `MCP_ALLOWED_USER_IDS` was absent. No production account was allowlisted,
  entitlement changed, reading generated or journal write performed.

Workers Builds runs plain `npx wrangler deploy` on every `master` push, so the
migrations were applied before merge. The older #77 version had overwritten the
#78 deployment when their builds completed out of order. This rollout verifies
the active version before proceeding to the subsequent documentation merge.

## Verification

| Check | Result |
| --- | --- |
| Root `npm test` | 2,231 passed, no failures or skips. Repeated after guidance integration with the same result. |
| Journal browser suite | Four passed: 1440/390/320px RWS and 390px Thoth; real MCP dispatch and SQLite journal fixtures, exact save/reflection retries. |
| #78 narrative browser suite | 17 Chromium desktop and 14 mobile WebKit tests passed. |
| Local Worker OAuth browser test | Discovery, registration, consent navigation, API 404 and app routing passed with disposable local D1/KV. |
| Build and Wrangler deployment dry run | Passed; existing large-chunk advisory remains. |
| Cloudflare command lint, changed-JS ESLint, diff whitespace | Passed. |
| Independent integration review | No Critical or Important finding; populated pre-0030 SQLite upgrade preserved legacy content and ordinary HTTP saves. |
| Production HTTP checks at 03:42 UTC | Home, reading health and TTS health returned 200; OAuth metadata returned JSON; unauthenticated MCP returned 401 with the discovery challenge. |
| Production discovery | Resource `https://tarot.lakefrontdev.com/mcp`, matching issuer, S256-only PKCE, issuer identification advertised. |
| Production frontend bytes | All four assets referenced by the homepage matched local SHA-256 hashes. |

Browser plugin was unavailable; the repository's Playwright suites provided
browser verification. The Node 24 runtime and package lock were used throughout.
Save/reflection permission instructions now fit in the first 512 characters;
plugin packaging documentation names the inline OpenAI interface fields and
overlay replacement rule. Token lifetimes and SDK auth declarations are unchanged.

## Explicit limits

- GitHub Actions jobs could not start because the account is locked for billing.
  Workers Builds succeeded independently. GitHub CI is not reported as passing.
- `ci:narrative-check` with `NARRATIVE_EVAL_BACKEND=local-composer` stops on the
  unsupported Spanish sample. The current pre-MCP `master` reproduced the same
  error. No live model provider or lower quality threshold was substituted.
- Strict migration checksum checking finds 18 historical differences: 15 match
  CRLF variants, one matches a historical date-comment change, and two remain
  older unexplained checksums. All of those source files match pre-MCP `master`.
  The existing migration runner skipped them and applied only 0030/0031;
  historical source and tracking rows were not rewritten or reapplied.
- Full app-wide E2E, full ESLint, vision quality, physical-device keyboard and
  spoken screen-reader checks were not repeated for this rollout.
- Authenticated production tools and ChatGPT account linking remain untested
  until the owner configures the allowlist. Follow the
  [MCP runbook](../../integrations/openai/chatgpt-mcp.md#after-deploy).

The 2026-09-23 integration reports remain historical evidence; this record
supersedes their MCP publication and production-migration status.
