# Local reviewer account

A reusable account is provisioned in this workspace's local Wrangler D1 database
for agents performing authenticated UI review and coding tasks.

| Setting | Value |
| --- | --- |
| Scope | Local development in `/home/ubuntu/tarot` |
| App | `http://localhost:8787` |
| Email | `agent-reviewer@local.tableu.invalid` |
| Username | `agent_reviewer` |
| Subscription | Pro, active, manually provisioned |
| Database | `mystic-tarot-db`, local state under `.wrangler/state` |
| Credentials | `/home/ubuntu/.config/tableu/agent-reviewer.local.json` |

The credential file contains `baseUrl`, `email`, `username`, `password`, and
`userId`, plus provisioning metadata. It lives outside Git with mode `0600` in
a directory with mode `0700`. Load it inside a script; do not print it into tool
output, logs, chat, screenshots, traces, or committed files.

This is a regular password account using the application's password hash and
session authentication. Pro entitlements and email verification were set in
local D1. The `.invalid` address has no mailbox, so email delivery and password
recovery cannot be tested with it. It has no Stripe customer or paid billing
subscription and grants no administrator access.

## Start and sign in

Run `npm run dev` from the primary checkout. The dev runner applies local
migrations and starts the frontend and Worker. Open `http://localhost:8787/account`,
choose **Sign in**, and fill the form from the private credential file.

Use the Worker origin for authenticated review. A Vite-only preview does not
provide the auth and D1 backend by itself. The account persists across dev-server
restarts in this checkout's `.wrangler/state`.

For an existing Playwright browser, this example creates a fresh browser context
and signs in through the real API. Run it from the repository with ESM imports:

```js
import { readFile } from 'node:fs/promises';

const credentials = JSON.parse(await readFile(
  '/home/ubuntu/.config/tableu/agent-reviewer.local.json',
  'utf8'
));
const origin = new URL(credentials.baseUrl);
if (origin.origin !== 'http://localhost:8787' ||
    credentials.scope !== 'local-development-only') {
  throw new Error('Reviewer credentials are restricted to the local Worker');
}

const context = await browser.newContext();
const response = await context.request.post(`${origin.origin}/api/auth/login`, {
  data: { email: credentials.email, password: credentials.password },
  maxRedirects: 0
});
if (response.status() !== 200) {
  throw new Error(`Reviewer login failed: HTTP ${response.status()}`);
}

// The API request shares cookies with pages in this context.
const page = await context.newPage();
await page.goto(`${origin.origin}/account`);
// Perform the authorized review, then end this session.
await context.request.post(`${origin.origin}/api/auth/logout`);
await context.close();
```

For login-form reviews, fill `#auth-email` and `#auth-password` and submit the
dialog instead. Do not intercept `/api/auth/me` or inject a session cookie when
claiming real authentication coverage. Keep tracing and request-body recording
off while entering credentials. Prefer a fresh login to persistent storage state.

## Impeccable review workflows

Use this account for browser review during `audit`, `critique`, `polish`,
`harden`, and `adapt` when the affected surface depends on authentication or
subscription entitlements. Static `impeccable detect` runs do not require login.

1. Identify the relevant guest and signed-in states for the target routes. Keep
   the guest browser context separate from the reviewer context.
2. Start the local Worker and sign in using the setup above. Before capturing
   authenticated evidence, verify that `/api/auth/me` returns the reviewer
   account with tier `pro` and status `active`. Use the visible sign-in form
   when the login interaction itself is under review.
3. Review each relevant state using the workflow's requested viewports, themes,
   and input methods. Record the route, authentication method, subscription
   tier/status, browser, and viewport with the findings. Label mocked cases
   explicitly; report real-session coverage only after exercising real login.
4. Log out and close the browser context created for the review. Clean up only
   test data created for that task, preserving data from other agent sessions.

The Pro account does not establish coverage for signed-in Free, Plus, or
inactive/expired subscriptions. Use separate local accounts or scoped test
fixtures for those states when the task affects their behavior, and record
whether that evidence uses real authentication or mocks. Preserve the shared
reviewer account's Pro entitlement.

Keep passwords, session cookies, tokens, and browser storage state out of review
artifacts and Git. If the local account is unavailable, continue the checks that
are possible and explicitly mark authenticated coverage as unavailable. Follow
the maintenance guidance below before changing the account or database.

## Reuse and maintenance

- Use synthetic review data. Clean up records created only to verify a task, and
  preserve data from other agent sessions.
- Continue checking signed-out states with a separate browser context.
- Pro access makes gated UI available; model calls and other external services
  still depend on the local environment and may use configured remote services.
- Keep this account separate from production and submission-reviewer accounts.
  Never use these credentials against a live site.
- A new checkout, worktree, machine, or deleted `.wrangler/state` may have a
  different database. This document does not provision an account automatically.
  If login fails, verify the local database and credential file before resetting
  anything; do not fall back to a production account.
- Password changes must also update the private credential file. Do not rotate
  the shared password as part of an unrelated test.
