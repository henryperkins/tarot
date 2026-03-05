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

- OAuth callback with valid and invalid `state`.
- Expired state rejection path.
- Auth user route rate-limit behavior under repeated calls.