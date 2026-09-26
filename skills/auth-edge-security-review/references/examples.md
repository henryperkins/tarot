# Examples

## Example 1: Insecure Randomness in Auth Path

Bad pattern:

```js
const suffix = Math.random().toString(36).slice(2, 6);
```

Worker-safe pattern:

```js
const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 8);
```

## Example 2: Worker-Native Rate Limiting

`POST /api/auth/login` (`functions/api/auth/login.js`) counts failed attempts in the `RATELIMIT` KV binding under a key built from the client IP and a 5-minute window. It is the live brute-force control, but it is not an exact limit:

```js
// checkLoginRateLimit(), before the password check
if (!store) return { limited: false };
const currentCount = Number(await store.get(rateLimitKey)) || 0;
if (currentCount >= LOGIN_RATE_LIMIT_MAX) return { limited: true, retryAfter, rateLimitKey };
return { limited: false, currentCount, rateLimitKey };

// incrementLoginFailure(), after a failed login attempt
await store.put(rateLimitKey, String(currentCount + 1), {
  expirationTtl: LOGIN_RATE_LIMIT_WINDOW_SECONDS
});
```

Treat this as a pattern with known gaps, not one to copy:

- The read and the write are separate calls. Concurrent failed attempts read the same count and write the same next value, so a parallel burst gets more than five guesses per window. KV reads are eventually consistent and rapid writes to one key are rejected; the helper logs that error and continues, so a burst can go uncounted.
- A missing `RATELIMIT` binding admits the request, and both helpers catch KV errors and continue (fail-open).
- The key is per client IP, so attempts spread across addresses are not limited per account.

For a limit that must hold under concurrency, use the D1 conditional upsert in `functions/lib/mcp/registrationLimit.js`: it checks and increments in one statement inside a D1 batch and fails closed with a 503 when D1 is unavailable. Whether a limiter fails open or closed is a deployment and security decision; state it in the finding rather than assuming a framework-middleware default.

## Example 3: OAuth State Verification

Auth callback pattern:

```js
if (!expectedState || expectedState !== decodedState.id) {
  return jsonResponse({ error: 'Invalid OAuth state' }, { status: 400 });
}
if (!decodedState.ts || Date.now() - decodedState.ts > OAUTH_STATE_TTL_MS) {
  return jsonResponse({ error: 'OAuth state expired' }, { status: 400 });
}
```

The state value must be created server-side, stored in an HTTP-only cookie, and paired with a sanitized return URL.

## Example 4: Finding Writeup

- `P1` - `functions/api/auth/oauth-callback.js:115`
- A scanner flags predictable randomness in a username collision suffix or auth identifier.
- Replace it with Worker Web Crypto randomness while retaining the bounded uniqueness check.
- Validate the callback, auth-token, and service-account tests before release.
