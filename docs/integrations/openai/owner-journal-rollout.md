# Private Tableu journal rollout

This PR contains source and local verification. It does not prove a deployed
connection or the owner's actual account identity. Tableu v0.27.3 supplies the
consent/mapping instructions but has no connected MCP server.

## Changes and requirements

The default branch already contains bearer journal handlers and the registered
`/api/journal/:id/reflections` route. This PR completes the audited behavior:
2,000-character verbatim reflections, conflict-safe appends, atomic seeded saves,
bearer identity from `/api/auth/me`, and three new adapter tools.

No database migration or production account mutation is introduced. The Worker
needs its existing DB binding and existing journal/auth migrations. Inspect
migration status separately before deploying; do not apply unreviewed migrations
incidentally. There is no new entitlement grant or synthetic-to-human mapping.

The adapter deploys separately as a Node service; its Dockerfile is optional.
Configure:

- One human app owner with cloud-journal entitlement and a personal backend
  credential. Existing API-key issuance restrictions still apply.
- `TABLEAU_OWNER_USER_ID` from that signed-in app, with independent cookie/bearer
  proof from `npm run verify:identity`. Retain real identifiers privately.
- For ChatGPT linking: compatible OAuth issuer, pinned `OAUTH_OWNER_SUBJECT`,
  resource/audience/scopes, and the exact ChatGPT callback registered at the issuer.
- A real HTTPS MCP URL ending `/mcp` on the chosen host, or a private development
  Secure MCP Tunnel where supported. The backend API origin is not an MCP URL
  unless it actually routes to this adapter.
- Host-header allowlist, TLS, secret-store injection and SSE/Authorization/MCP
  header forwarding. Use one replica or sticky sessions.

Startup refuses missing owner authentication, a synthetic backend identity, or a
mismatched user id. OAuth restricts access to one owner; it does not provide
per-user backend authorization. Keep the plugin audience private.

## Local verification

Install both lockfiles, then run:

```sh
npm ci
npm ci --prefix mcp/tableau-adapter
npm test
npm run test:mcp
npx playwright install chromium
npm run test:e2e:journal
npm run build
```

D1 tests execute real local SQL with two users and the production handlers. They
cover bearer/cookie identity, narrative/cards/metadata preservation, concurrent
seed deduplication and appends, reflection targeting, and wrong-user rejection.
MCP tests cover schemas, canonical deck identity, numeric seeds, explicit errors,
uncertain outcomes without retries, private HTTP/OAuth access, and all four job
tools.

Browser tests at 1440, 390 and 320 CSS pixels dispatch MCP tools into production
handlers backed by local D1 and read entries through the app's GET handler.
The narrative provider and unrelated app endpoints use fixtures. Checks cover
narrative rendering, card labels, verbatim append text/line breaks and wrapping.
The fourth case checks the Thoth Knight of Cups display name against its canonical
King of Cups image. Screenshots use synthetic data only.
These are controlled local tests, not production, provider or ChatGPT evidence.

Verified on 2026-09-23 with Node 24.15.0: 1,905 repository tests, 9 adapter tests
and 4 Chromium browser cases passed. The production build, Wrangler deployment
dry run, ESLint on changed JavaScript/JSX and Cloudflare command lint passed.
The build retains its existing large-chunk warning. Docker execution, the full
unrelated E2E suite and live provider/ChatGPT acceptance were not run.

Reviewed synthetic screenshots: [desktop 1440px](evidence/owner-journal/desktop-1440.png),
[mobile 320px](evidence/owner-journal/mobile-320.png), and
[Thoth cards at 390px](evidence/owner-journal/thoth-390.png).

## Deployment and acceptance sequence

1. Review/merge the PR. Record approved and deployed backend/adapter revisions.
   Do not deploy unrelated local commits.
2. Deploy the Worker through the repository workflow. Use the skip-migrations
   path only after confirming existing required migrations are applied. Verify
   the reflection route and bearer `/api/auth/me` on that version.
3. Inspect `/api/auth/me` in the signed-in Tableu app locally. Pin its exact id
   and configure its personal credential on the adapter. Run the read-only
   identity check with the independent cookie session. Record parity publicly,
   and retain actual identifiers/credentials privately.
4. Deploy/restart the adapter with owner-only OAuth and the actual HTTPS host.
   Verify startup identity validation, auth discovery and seven tools. Confirm
   anonymous callers and another valid OAuth subject are rejected, including
   attempts to use an existing transport session.
5. Configure the actual MCP URL/authentication in Tableu's private connection.
   Use secure connection settings for secrets; never plugin instructions or
   references. Refresh tool metadata and open a new ChatGPT conversation.
   Follow [OpenAI's connection guide](https://developers.openai.com/plugins/deploy/connect-chatgpt).
6. Ask for one reading. Confirm the completed cards/narrative or poll the existing
   supplied-card job. Explicitly ask to save; use the draw's `savePayload`
   unchanged. Confirm returned entry id and compare the narrative, ordered cards,
   positions, orientations, question and deck in the same owner's app.
7. Explicitly attach a verbatim card reflection using that returned id, then a
   second note to the same target. Verify both in the app, plus an overall note.
   Repeated seeded save must return the original without overwriting it.
8. Test an invalid target and auth failure. On timeout, malformed response or
   server error, report unconfirmed persistence and inspect the app; never
   repeat an unseeded save or reflection append. Only a success means “saved.”

Record live identity parity, deployed revisions, actual MCP URL, private audience,
auth method, tool discovery and ChatGPT/app read-back results before declaring
the connection complete. Identity/credentials, adapter hosting and issuer settings
must be configured privately by the owner when unavailable in the workspace.

## Compatibility and rollback

The actual draw API returns numeric seeds and nullable card metadata. The adapter
accepts those values, stringifies only journal seeds and omits null card fields.
Its prepared save payload stores the canonical card as `name`, as app saves do,
and keeps a differing deck label such as Thoth's Prince of Cups as `displayName`,
with canonicalName/canonicalKey preserved. Journal cards and reflection labels
show the deck label; statistics, shared views and thumbnails use the canonical
card. The dedupe key pairs the draw seed with its requestId, so a later draw with
the same caller seed is never merged into an earlier entry. A crisis-gated draw
returns only support resources, with no cards or save payload. These are additive
compatibility extensions to the earlier audited save schema; live tool schemas
govern. App thumbnails continue to use the existing canonical RWS artwork.

Disable the private connection or stop the adapter to stop new writes. Revoke
its dedicated access secret/OAuth grant and personal key when needed. Roll back
Worker and adapter versions separately; there is no new schema to undo. Preserve
existing journal data and check the app before repeating uncertain operations.

Shared distribution/per-user backend authorization and archetype tracking remain
separate follow-ups.
