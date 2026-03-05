# Review Patterns

## Repeated Findings

1. Missing rate limiting on auth-adjacent route.
- Code scanning alert #73.
- Fix in `056b1d8` added `express-rate-limit` and attached limiter to `/api/auth/user`.

2. Insecure randomness in username generation path.
- Code scanning alert #74.
- Fix in `272e5f7` replaced `Math.random` with `crypto.getRandomValues` helper.

3. Callback state validation is a critical control point.
- Current callback checks: required `state`, cookie match, and max age.
- Regression risk: bypassing one check reopens CSRF-like callback abuse.

4. Edge API security comments may include false positives.
- PR #44 comments flagged SQL injection/path traversal patterns; not all are exploitable as reported.
- Required behavior: verify data origin and query binding path before escalating.

## Relevant Commits

- `056b1d8` - Added route rate limiting.
- `272e5f7` - Secure randomness in auth callback flow.
- `5f0fe2f` - Cleanup for code scanning alert hygiene.