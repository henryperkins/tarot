# ChatGPT MCP endpoint (owner-only)

Type: runbook
Status: active
Last reviewed: 2026-09-23

The Tableu ChatGPT plugin reaches the backend through an MCP endpoint on the
main Worker, `https://tarot.lakefrontdev.com/mcp`, protected by OAuth 2.1 that
Tableu issues itself. This version is private: only accounts listed in the
`MCP_ALLOWED_USER_IDS` secret can link, and every write lands in the linked
account's own journal.

Design: `docs/superpowers/specs/2026-09-22-chatgpt-mcp-journal-design.md`.

## How it fits together

- **Routing.** `src/worker/index.js` hands `/mcp`, `/oauth/*` and the
  `/.well-known/oauth-*` documents to `functions/lib/mcp/oauthProvider.js`,
  which wraps `@cloudflare/workers-oauth-provider`. Every other path is
  unchanged.
- **Consent.** `/oauth/authorize` is the consent page (`consent.js`). It uses
  the normal Tableu session cookie and only lets allowlisted accounts approve.
- **`/mcp`.** `mcpHandler.js` checks the token's `tableu` scope, the
  allowlist, and that the account is active. Then it serves the tools
  statelessly.
- **Service layer.** The tools call service functions with that user:
  `readingJobs.js`, `journalEntries.js` and `journalReflections.js`.
  Reflection policy is selected internally: HTTP keeps append/replace and
  repeated appends; MCP is append-only and deduplicates exact retries. Both
  preserve whitespace and line endings. MCP limits a target to 20,000 characters;
  HTTP has no new cumulative cap. Both use bounded compare-and-swap writes.
  Journal cards keep canonical identity for images and deck-specific display
  labels, including Thoth court cards.
- **Reading jobs.** Readings run as jobs in the `ReadingJob` Durable Object,
  under an in-Worker principal. Jobs started from ChatGPT are readable only
  through `/mcp` and are kept for 24 hours.

## Tools

| Tool | What it does |
|---|---|
| `get_profile` | Shows which Tableu account the connection acts as |
| `draw_tarot_reading` | Server draws the cards for one of the six spreads; returns them at once with a job reference |
| `start_tarot_reading` | Starts a reading from cards the user supplies |
| `wait_for_tarot_reading` | Waits up to 45 s for the reading, then returns its status and narrative |
| `get_tarot_reading_status` | Checks a reading once |
| `cancel_tarot_reading` | Cancels a running reading |
| `save_reading_to_journal` | Saves a finished reading from its job, verbatim and idempotently; accepts the audited payload after the job expires |
| `add_reflection_to_journal_entry` | Appends the user's exact words to the whole reading or one card; idempotent |

## Configuration

| Name | Kind | Value |
|---|---|---|
| `OAUTH_KV` | KV binding | OAuth clients, grants and tokens. Id in `wrangler.jsonc`. |
| `MCP_RESOURCE_URL` | var | `https://tarot.lakefrontdev.com/mcp`. Tokens are bound to exactly this resource. |
| `MCP_ALLOWED_USER_IDS` | secret | Comma-separated Tableu user ids allowed to link. Unset means nobody can link. |
| Migration `0030` | D1 | `journal_entries.idempotency_key` plus its partial unique index. Applied by the deploy script. |
| Migration `0031` | D1 | `oauth_registration_counters` for atomic per-address hourly DCR admission on `DB`. Applied by the deploy script; missing storage makes registration return 503. |

## First deployment

### Before merge

Resource creation and GitHub publication each require the owner's separate yes
under Task 18 of the implementation plan. Local checks do not authorize either.

1. Create the KV namespace:
   `npx wrangler kv namespace create OAUTH_KV`. Replace the zeros in the
   `OAUTH_KV` entry of `wrangler.jsonc` with the printed id, and commit.
2. Open the PR. CI runs the unit tests and Playwright.

### Merge

CI deploys with `scripts/deploy.js`, which applies migrations `0030` and `0031`
before the new Worker. OAuth grants and clients use `OAUTH_KV`; registration
admission uses D1. Counters retain the current and previous hourly buckets,
with older buckets removed on the next registration attempt. While
`MCP_ALLOWED_USER_IDS` is unset, the endpoint is live but nobody can link.
Never deploy from a working tree with uncommitted `wrangler.jsonc` changes.

### After deploy

1. **Find your user id.** Sign in to Tableu in your browser. Run
   `npx @modelcontextprotocol/inspector`, choose **Streamable HTTP**, and enter
   `https://tarot.lakefrontdev.com/mcp`, then start the OAuth flow. The consent
   page refuses you, because the allowlist is empty, and shows your
   **Account ID**. Run `npx wrangler secret put MCP_ALLOWED_USER_IDS` and paste
   the ID.
2. **Link.** Link again from MCP Inspector, then choose **Allow**. List the
   tools (there are eight) and call `get_profile`; it returns your id.
3. **Connect ChatGPT.**
   - Turn on **Developer mode** under Settings → Security and login.
   - Go to [ChatGPT Plugins](https://chatgpt.com/plugins), press **+**, and
     create an app with the MCP server URL
     `https://tarot.lakefrontdev.com/mcp` and OAuth authentication.
   - Link it: sign in to Tableu if asked, then choose **Allow**.
   - Copy the app's id from the browser URL; it starts with `plugin_asdk_app_`.
4. **Update the plugin** to 0.28.0 with the files in
   [plugin/](plugin/README.md).

## Verify the account

1. `get_profile` in ChatGPT, the id on the consent page, and the allowlist
   entry must match.
2. After the first save, run
   `npx wrangler d1 execute mystic-tarot-db --remote --command "SELECT user_id FROM journal_entries WHERE id = '<entry id>'"`.
   It must print the same id.

## End-to-end check from ChatGPT

1. Ask for a three-card reading. The cards appear; then the narrative.
2. Say "save this". The reply names an entry id.
3. Add a note about one card, and one about the whole reading.
4. Repeat one of the notes. The reply says it was already attached.
5. Open the entry in the Tableu app. The narrative should match word for word,
   with the cards and orientations as drawn. The reflections should be
   labelled like "Past · The Hermit" and "Whole reading", each in its own
   paragraph.

## Kill switch and rollback

- `npx wrangler secret delete MCP_ALLOWED_USER_IDS` stops all linking and
  rejects existing tokens on the next request.
- To roll back the code, revert the PR. Migrations 0030 and 0031 are additive;
  leave them in place.

## Local development

Use Node 24. Root `npm test` covers the Worker MCP implementation, and
`npm run test:e2e:journal` exercises real tool dispatch into the same local
database rendered by the app at 1440, 390, and 320 pixels. The old standalone
adapter is retired and must not be installed for either suite.

1. `npm run build`, so the assets directory exists.
2. Create a config copy without the remote-only `ai` binding and with a local
   OAuth resource. Keep the `assets.run_worker_first` routes from Task 14.
   The command refuses to overwrite an existing local config:

   ```bash
   node --input-type=module <<'NODE'
   import { readFileSync, writeFileSync } from 'node:fs';

   let config = readFileSync('wrangler.jsonc', 'utf8');
   const edits = [
     [/\r?\n\s*"ai": \{\s*"binding": "AI"\s*\},?/, ''],
     [/("MCP_RESOURCE_URL":\s*)"[^"]*"/, '$1"http://localhost:8787/mcp"']
   ];
   for (const [pattern, replacement] of edits) {
     if (!pattern.test(config)) throw new Error(`Expected config field missing: ${pattern}`);
     config = config.replace(pattern, replacement);
   }
   writeFileSync('wrangler.dev-local.jsonc', config, { flag: 'wx' });
   console.log('Local OAuth resource: http://localhost:8787/mcp');
   NODE
   ```

   If a local config already exists, inspect and update those two fields in
   that file instead. If `.dev.vars` or the shell already overrides
   `MCP_RESOURCE_URL`, set that override to the same localhost URL as well.
3. Apply the migrations locally:
   `npx wrangler d1 migrations apply mystic-tarot-db --local --config wrangler.dev-local.jsonc`.
4. Start the server: `npx wrangler dev --config wrangler.dev-local.jsonc --port 8787`.
   Register or sign in at `http://localhost:8787`.
5. Run MCP Inspector against `http://localhost:8787/mcp` and start OAuth.
   Confirm discovery advertises `resource: http://localhost:8787/mcp` and
   localhost authorization/token endpoints. The browser's consent navigation
   must show the Tableu consent or account-refusal page, not the React app shell.
   Find your local account id on the refusal page. Add or update only
   `MCP_ALLOWED_USER_IDS=<id>` in `.dev.vars`, preserving other local values,
   and restart Wrangler.
6. Give this test account an active Plus subscription **in local D1 only**.
   Registration defaults to Free, which cannot save to the cloud journal.
   Substitute the account id from the local consent page:

   ```bash
   npx wrangler d1 execute mystic-tarot-db --local --config wrangler.dev-local.jsonc --command "UPDATE users SET subscription_tier = 'plus', subscription_status = 'active' WHERE id = '<LOCAL_USER_ID>' RETURNING id, subscription_tier, subscription_status;"
   ```

   Expected: exactly that account id, `plus`, and `active`. Never change this
   fixture command to `--remote`. Refresh the app's session view by signing out
   and in again before checking journal rendering.
7. Reconnect Inspector, approve consent, and call `get_profile`; the id must
   match the local account. Exercise draw, wait, save and reflection against
   localhost. Local tokens and account ids must not be used against production.

When you're done, delete `wrangler.dev-local.jsonc`, and never commit it or
`.dev.vars`.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| The consent page asks you to sign in | No Tableu session in that browser | Sign in, then **Continue** |
| 403 "This account can't connect to ChatGPT" | The account isn't allowlisted | Add its id to `MCP_ALLOWED_USER_IDS` |
| ChatGPT keeps asking to link again | Allowlist changed, account deactivated, or token lacks `tableu` | Check the allowlist and account, then link again |
| `invalid_redirect_uri` on registration | Redirect URI isn't a ChatGPT callback or loopback | Register from ChatGPT or a local tool |
| 429 on `/oauth/register` | More than 10 registrations an hour from one address | Wait for the next hour |
| 503 on `/oauth/register` | D1 admission unavailable, including a missing migration 0031 | Check the DB binding and migration status; restore admission storage before retrying |
| "Reading job not found." | Wrong jobId/jobToken, or another account's job | Start a new reading |
| "…job has expired…" when saving | MCP jobs are kept for 24 h | Save with the reading fields, as the tool describes |
| Journal routes answer 403 `service_account_journal_forbidden` | Called with the shared GPT service token | Use a personal credential |
