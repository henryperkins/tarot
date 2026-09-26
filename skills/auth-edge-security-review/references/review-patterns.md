# Review Patterns

## Current Review Patterns

1. **Worker route authentication is layered.**
- `src/worker/index.js` dispatches `/api/auth/*` and other edge routes.
- Handlers resolve credentials through shared helpers, then apply ownership, entitlement, or provider-specific checks.
- `src/worker/index.js` is the route authority; do not carry forward findings that assume a removed standalone auth server or adapter.
- Regression risk: accepting a valid service or API-key identity on a personal journal/media route.

2. **OAuth state is a CSRF and replay boundary.**
- `functions/api/auth/oauth-start.js` creates a random state ID and state cookie.
- `functions/api/auth/oauth-callback.js` requires a cookie/state match and a valid timestamp before exchanging the code. After exchange, profile/account processing, and session creation, it sanitizes the return URL, sets the session cookie, and clears the state cookie before responding.
- Regression risk: bypassing one check reopens callback replay or open-redirect behavior.

3. **Worker-native token handling is the expected pattern.**
- Password sessions use Web Crypto and D1; one-time email and reset tokens are hashed and marked used.
- API keys and service/owner bearer credentials must be compared or stored without exposing the raw secret.
- Regression risk: replacing Web Crypto or storing a reset token in plaintext.

4. **Service and owner credentials are not interchangeable.**
- `functions/lib/serviceAuth.js` provisions a dedicated synthetic service row and fails closed if it cannot prove that row is not a human account.
- `GPT_SERVICE_TOKEN` grants trusted integration access; `GPT_OWNER_TOKEN` is the separate owner capability.
- Regression risk: allowing a shared service token to unlock owner diagnostics or personal journal data.

5. **MCP has independent OAuth controls.**
- `functions/lib/mcp/oauthProvider.js` and its helpers enforce the pinned resource, dynamic-client redirect allowlist, PKCE, CSRF, scope, user allowlist, and D1-backed registration admission.
- Regression risk: accepting a broad redirect URI or treating a service token as a user identity.

6. **Edge API findings are often about provenance.**
- Verify D1 parameter binding, row ownership, and whether an object-storage key came from a trusted record.
- Mark scanner output `false positive likely` only after tracing the current Worker route and sink.

## Relevant Tests

- `tests/mcpOAuth.test.mjs` - OAuth discovery, linking, PKCE, redirect, scope, and registration controls
- `tests/serviceAuthHardening.test.mjs` - service-row isolation and fail-closed provisioning
- `tests/auth.apiKeyTierDerivation.test.mjs` - API-key identity and entitlement derivation
- `tests/journalBearerAuth.test.mjs` - personal-session ownership and service-account refusal
- `tests/securityGates.test.mjs` - broader safety and prompt-security gates
