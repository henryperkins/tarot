# Repo Context

## Primary Files

- `functions/api/auth/oauth-callback.js`
- `server/replit_integrations/auth/replitAuth.ts`
- `functions/api/media.js`

## Supporting Security Tests

- `tests/securityGates.test.mjs`
- `tests/accountApis.test.mjs`
- `tests/auth.apiKeyTierDerivation.test.mjs`
- `tests/mediaLibraryApi.test.mjs`

## Runtime Notes

- Worker auth callback validates OAuth state via cookie + TTL.
- Session creation uses secure cookie controls from shared auth helpers.
- Replit integration uses passport + express session in server runtime.
- Edge APIs rely on D1 and route-level auth checks.

## Constraints

- Preserve working auth flow and redirect safety.
- Keep fixes minimal and deterministic.
- Distinguish real exploit paths from noisy automated comments.