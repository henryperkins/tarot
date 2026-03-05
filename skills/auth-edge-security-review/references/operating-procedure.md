# Operating Procedure

## 1) Scope and Search

Run:

```bash
rg -n "state|csrf|cookie|random|getRandomValues|randomUUID|rateLimit|oauth|callback|redirect" functions/api/auth/oauth-callback.js server/replit_integrations/auth/replitAuth.ts functions/api/media.js
```

## 2) OAuth Callback Checklist

- `state` must exist and decode safely.
- Cookie state must match decoded state ID.
- State timestamp must be checked against TTL.
- Redirect target must be sanitized before response.
- Session cookie must be set with secure options for request context.

## 3) Randomness and Identifier Checklist

- No `Math.random` for auth IDs, tokens, nonce-like values, or username collision suffixes in auth flows.
- Use `crypto.getRandomValues` or `crypto.randomUUID`.

## 4) Rate-Limiting Checklist

- Sensitive auth/session endpoints should have limiter coverage.
- Confirm limiter is attached to route handlers and not dead code.

## 5) Triage Checklist for Bot Findings

- Confirm whether attacker controls the exact value used in dangerous sink.
- Confirm parameterized binding is actually used in SQL path.
- Confirm object storage key source (trusted DB record vs untrusted direct input).
- Mark as `false positive likely` when exploit path is absent, but include hardening notes if useful.

## 6) Allowed Changes

- Add/adjust callback guards, secure randomness helpers, and route limiters.
- Add focused tests for security controls.

## 7) Avoid

- Broad auth rewrites for narrow review fixes.
- Cosmetic security changes without threat model justification.

## 8) Reporting Format

- Severity, file line, confirmed threat scenario, minimal patch, test command.