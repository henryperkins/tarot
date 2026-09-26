# Operating Procedure

## 1) Scope and Search

Run from the repository root:

```bash
rg -n "state|csrf|cookie|random|getRandomValues|randomUUID|rateLimit|oauth|callback|redirect|owner|allowlist" functions/api/auth functions/lib/auth.js functions/lib/authTokens.js functions/lib/serviceAuth.js functions/lib/apiKeys.js functions/lib/mcp src/worker/index.js functions/api/media.js
```

## 2) Worker OAuth Checklist

- Auth0 `state` must exist, decode safely, and match the HTTP-only state cookie.
- The state timestamp must be checked against the short TTL before code exchange.
- The provider profile must be linked by the normalized provider subject; an email match must not cross-link a different provider without the existing verification checks.
- After profile/account processing and session creation, sanitize the return URL against the app/request allowlist before returning the callback response. The authorization-code exchange itself does not consume the return URL, but review the exchange and redirect paths independently.
- The session cookie must use the request's HTTPS context; the state cookie must be cleared on the successful callback response.

## 3) Randomness and Token Checklist

- No `Math.random` for auth IDs, state values, nonce-like values, one-time tokens, service credentials, or username collision suffixes.
- Use `crypto.getRandomValues` or `crypto.randomUUID` through the Worker Web Crypto API.
- Store only hashes of API keys and one-time tokens; compare bearer secrets in constant time.
- Confirm token expiry and one-time use before applying verification or password-reset effects.

## 4) Rate-Limiting Checklist

- Identify the actual Worker binding or D1 table behind each limiter; do not prescribe framework-specific middleware.
- Confirm the limiter is called from the routed handler before expensive work and that its key cannot be bypassed by an untrusted identifier.
- Check failure behavior when `RATELIMIT`, `OAUTH_KV`, or D1 is unavailable.
- Check whether the counter updates atomically. A KV `get` followed by a `put`, as in the login limiter, undercounts concurrent attempts; an exact limit needs a serialized update such as the D1 conditional upsert.
- For OAuth registration, verify the D1 admission transaction and the returned `Retry-After` response.

## 5) Authorization and Data-Origin Checklist

- Confirm attacker control over the exact value used in a dangerous sink.
- Confirm D1 queries use bound parameters and that ownership is enforced in the query or immediately after it.
- Confirm object-storage keys come from a trusted database record rather than an unchecked request value.
- Keep `GPT_SERVICE_TOKEN` and `GPT_OWNER_TOKEN` capabilities distinct; service identity must not reach a human account.
- For MCP, verify the resource, redirect URI, PKCE verifier, CSRF token, scope, and user allowlist.

## 6) Triage Checklist for Bot Findings

- Mark a finding `false positive likely` when the reported path is not reachable from a Worker route or the dangerous sink is bound to a trusted value.
- Include hardening notes separately when a diagnostic is useful but no exploit path is demonstrated.
- Re-check Worker routing and current bindings before relying on historical commit descriptions.

## 7) Allowed Changes

- Add or adjust callback guards, secure randomness helpers, token handling, ownership checks, and Worker-native limiters.
- Add focused tests for security controls.

## 8) Avoid

- Broad auth rewrites for narrow review fixes.
- Cosmetic security changes without a threat-model justification.
- Do not assume or reintroduce a removed standalone auth server, Replit adapter, or other non-Worker auth runtime.

## 9) Reporting Format

- Severity, file line, confirmed threat scenario, minimal patch, and test command.
