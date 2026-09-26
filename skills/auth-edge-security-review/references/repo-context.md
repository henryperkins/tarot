# Repo Context

## Primary Files

- `src/worker/index.js` - Cloudflare Worker router and auth-adjacent route dispatch
- `functions/api/auth/oauth-start.js` - Auth0 authorization start and state cookie
- `functions/api/auth/oauth-callback.js` - Auth0 code exchange, account linking, and session creation
- `functions/lib/auth.js` - passwords, sessions, cookies, and bearer identity resolution
- `functions/lib/authTokens.js` - one-time email-verification and password-reset tokens
- `functions/lib/serviceAuth.js` - trusted GPT service and owner bearer credentials
- `functions/lib/apiKeys.js` - hashed per-user API-key validation
- `functions/lib/mcp/oauthProvider.js` - Worker OAuth and MCP authorization surfaces
- `functions/lib/mcp/redirectUris.js` - dynamic-client redirect allowlist
- `functions/lib/mcp/registrationLimit.js` - D1-backed OAuth registration admission
- `functions/api/media.js` - representative ownership- and entitlement-checked edge route

## Supporting Security Tests

- `tests/securityGates.test.mjs`
- `tests/auth.apiKeyTierDerivation.test.mjs`
- `tests/serviceAuth.test.mjs`
- `tests/serviceAuthHardening.test.mjs`
- `tests/mcpOAuth.test.mjs`
- `tests/journalBearerAuth.test.mjs`
- `tests/readingPrincipal.test.mjs`
- `tests/mediaLibraryApi.test.mjs`

## Runtime Notes

- Auth is handled by Cloudflare Worker routes in `src/worker/index.js`; this repository has no separate Node web-server auth runtime.
- Auth0 OAuth uses a state ID in an HTTP-only cookie, a timestamp/TTL check, and a sanitized return URL before creating a session.
- Password and one-time-token operations use Web Crypto and D1; session cookies use `HttpOnly`, `SameSite`, `Secure`-when-HTTPS, and `Path` controls.
- `getUserFromRequest()` resolves trusted service credentials, per-user API keys, and session bearer/cookie credentials; route ownership and entitlement checks remain separate responsibilities.
- MCP OAuth uses the `OAUTH_KV` namespace, a pinned resource, PKCE, CSRF protection, a user allowlist, and D1-backed registration limiting.
- Sensitive endpoint limiting uses Worker bindings such as `RATELIMIT` KV and the D1 registration counter; do not assume a framework middleware layer exists.

## Constraints

- Preserve working auth flows, owner checks, redirect safety, and fail-closed behavior.
- Keep fixes minimal and deterministic.
- Distinguish real exploit paths from noisy automated comments.
