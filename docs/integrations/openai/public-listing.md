# Public listing for the Tableu app in ChatGPT

Type: runbook
Status: active
Last reviewed: 2026-10-09

This is the path from the owner-only connection to a public directory
listing. It follows OpenAI's [submission guide](https://developers.openai.com/plugins/deploy/submission)
and [plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines).
The endpoint itself is described in [chatgpt-mcp.md](chatgpt-mcp.md).

## What changed for the public release

| Guideline | Change |
| --- | --- |
| The app must work for anyone who installs it | `MCP_ACCESS_MODE=public` lets any active personal account link. `off` is the kill switch. |
| Sign-in must be transparent and reliable on desktop and mobile | The connection page has its own email and password form, sharing the website's login rate limit, so linking works inside ChatGPT's sign-in window. Accounts that use another sign-in method can still sign in on Tableu and continue. The page links the privacy policy and terms and says how to disconnect. |
| No upgrades, plan displays or purchases | Limit and plan-gated errors reach ChatGPT as neutral text ("…isn't included with this Tableu account"). The instructions forbid mentioning plans, prices or upgrades, and the bundled knowledge no longer lists plans. The manifest declares `commerce: false`. |
| Tool results carry only what the request needs | Removed request ids, the legacy job token, entry timestamps, reflection storage keys and internal safety-check reasons. `get_profile` returns an opaque id derived from the account instead of the internal user id; OpenAI's profile convention requires a stable id. |
| Clear, current package | Upload package 1.0.2 (instructions 0.29.0) drops the retired GPT Actions material. |

## Steps

### 1. Release the server changes

Merge the branch and deploy with `npm run deploy` (fresh release QA, then the
Worker). No migration is needed. Then check:

- `GET https://tarot.lakefrontdev.com/.well-known/oauth-protected-resource/mcp` returns 200.
- An unauthenticated `POST /mcp` returns 401 with a `resource_metadata` challenge.
- The active Worker version's vars show `MCP_ACCESS_MODE: public`.

### 2. Refresh the connection and rescan

In the Developer Portal, open the Tableu plugin, then **MCPs → the existing
server → Issues → Rescan**. In ChatGPT, reconnect the developer app (the
profile id changed, so ChatGPT may treat it as a new account) and start a new
conversation. Confirm:

- `get_tarot_reading_status` accepts `jobId` alone (no `jobToken` field);
- `start_tarot_reading` accepts cards without meanings;
- tool results contain no `requestId`, `jobToken` or entry timestamp.

### 3. Upload package 1.0.2

```sh
python3 scripts/integrations/package_tableu_plugin.py --version 1.0.2
```

The ZIP lands in `dist/plugins/`. Before uploading, compare the draft's saved
test cases with the ZIP's: an upload replaces them and resets attestations.
The package sets `countries: []`, so the listing has no country restriction.

### 4. Review details

- **Reviewer credentials.** Enter the `openai_reviewer` email and password in
  the portal's secure fields, with this sign-in note: "When ChatGPT opens the
  Tableu page, sign in with this email and password, then choose Allow." The
  account is Pro, email-verified, has no MFA, and has sample journal entries.
  Its existing ChatGPT links expire on 2026-10-28; a fresh sign-in creates a
  new one.
- **Test cases.** Run the five positive and three negative cases from the
  package with the reviewer account, in fresh conversations, and keep notes.
- **Demo video.** Record those same cases on desktop, plus linking and one
  reading on mobile, and paste an accessible URL into the portal.
- **Declarations.** Commerce: none (`commerce: false` is in the package).
  Confirm countries, then complete the owner attestations.

### 5. Submit, then publish

Submitting for review and publishing after approval are owner actions. After
publication, OpenAI rescans the server daily; tool changes can be held for
review.

## Open owner decisions

- **Ages 13–17.** The guidelines require apps to suit users aged 13–17, while
  the Terms and Privacy Policy say Tableu is for adults 18 and older.
- **Countries** for the listing.

## Kill switch

Set `MCP_ACCESS_MODE` to `off` (in `wrangler.jsonc`, or on the Worker in the
Cloudflare dashboard). Linking stops and every existing token is refused on
its next request.
