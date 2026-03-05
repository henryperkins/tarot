# Examples

## Example 1: Insecure Randomness in Auth Path

Bad pattern:

```js
const suffix = Math.random().toString(36).slice(2, 6);
```

Good pattern:

```js
function secureRandomBase36(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => (b % 36).toString(36)).join('');
}
```

## Example 2: Route-Level Rate Limiting

Good pattern:

```ts
const authUserLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.get('/api/auth/user', authUserLimiter, async (req, res) => { ... });
```

## Example 3: OAuth State Verification

Good pattern:

```js
if (!expectedState || expectedState !== decodedState.id) return jsonResponse({ error: 'Invalid OAuth state' }, { status: 400 });
if (!decodedState.ts || Date.now() - decodedState.ts > OAUTH_STATE_TTL_MS) return jsonResponse({ error: 'OAuth state expired' }, { status: 400 });
```

## Example 4: Finding Writeup

- `P1` - `functions/api/auth/oauth-callback.js:131`
- Auth fallback ID generation used non-crypto randomness, enabling predictable collision attempts.
- Replace with crypto-based generator; retain existing unique-check loop.
- Validate with auth and security test suite.