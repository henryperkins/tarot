# Validation

## Core Security Validation

```bash
npm run lint
node --test tests/securityGates.test.mjs tests/accountApis.test.mjs tests/auth.apiKeyTierDerivation.test.mjs tests/mediaLibraryApi.test.mjs
```

## Build and Integration Safety

```bash
npm run build
node --test tests/checkoutSession.test.mjs tests/stripe.webhook.test.mjs
```

## Manual Spot Checks

- OAuth start with an HTTP-only state cookie, then a callback with valid and invalid `state`.
- Expired-state rejection, successful session-cookie creation and state-cookie clearing, and return-URL sanitization before the response.
- `POST /api/auth/login` limiter: after five 401 failures (unknown email or wrong password) in one 5-minute window, the next attempt returns 429 with `Retry-After` before the password check; successful and inactive-account logins do not count. Also probe the gaps in `examples.md`: a parallel burst of failures and a missing `RATELIMIT` binding.
- Confirm route reachability through `src/worker/index.js`; do not assume a removed standalone auth server.