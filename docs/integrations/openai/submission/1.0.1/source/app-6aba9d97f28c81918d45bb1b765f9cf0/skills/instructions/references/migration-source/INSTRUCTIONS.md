# Journal write Actions — implementation instructions

Verified against `henryperkins/tarot` at `f3485d0` (master, 2026-09-09).

---

## 1. Add the reflections route handler

Copy `reflections.js` to `functions/api/journal/reflections.js`.

It follows the sibling `functions/api/journal/followups.js`, which serves
`/api/journal/:id/followups` from a flat file rather than an `[id]/` directory.

The one deliberate divergence: it authenticates with `getUserFromRequest` instead of
`getSessionFromCookie` + `validateSession`. See step 3.

## 2. Register the route

`src/worker/index.js` uses an explicit route table. A new file is not routed until it
is listed there, and the `functions/` layout is not what dispatches requests.

Add the import beside the other journal imports (after line 28):

```js
import * as journalReflections from '../../functions/api/journal/reflections.js';
```

Add the pattern beside the `followups` entry (after line 231):

```js
  { pattern: /^\/api\/journal\/([^/]+)\/reflections$/, handlers: journalReflections, params: ['id'] },
```

Order is not load-bearing here — `([^/]+)$` on line 232 cannot match a path with a
slash in it — but keeping it next to `followups` matches the file's existing grouping.

## 3. Switch journal auth to `getUserFromRequest`

This is the change that makes any of this reachable from a GPT. Four call sites all do
cookie-only auth, so a bearer token gets a 401 today:

| File | Lines |
|---|---|
| `functions/api/journal.js` | 40–42 (GET), 330–332 (POST) |
| `functions/api/journal/[id].js` | 29–31 (GET), 210–212 (DELETE) |

At each site, replace:

```js
    const cookieHeader = request.headers.get('Cookie');
    const token = getSessionFromCookie(cookieHeader);
    const user = await validateSession(env.DB, token);
```

with:

```js
    const user = await getUserFromRequest(request, env);
```

Then fix the imports. In `functions/api/journal.js` lines 7–10:

```js
import { getUserFromRequest } from '../lib/auth.js';
```

In `functions/api/journal/[id].js` lines 7–10:

```js
import { getUserFromRequest } from '../../lib/auth.js';
```

`getUserFromRequest` still falls back to the session cookie, so the app's own save path
is unaffected. It adds three callers: service token, `sk_` API key, and bearer session
token.

`functions/lib/serviceAuth.js` already provisions a real `users` row for the service
account (`ensureServiceUserRow`), and its header comment names journal writes as the
reason. The service user is minted at Plus tier, so it clears the `isEntitled(user, 'plus')`
gate on every journal route. The backend side of this was built for exactly this change.

Optionally apply the same edit to `functions/api/journal/search.js`,
`functions/api/journal-summary.js` and `functions/api/journal-export/index.js` if you
want read-back Actions later. Not required for these two writes.

## 4. Install the Action schema

`tarot-journal-actions.yaml` is a second GPT Action, alongside the existing reading
schema. Two Actions because each one carries a single auth configuration; see
"Multi-tenancy" below for when that matters.

If you are running owner-only under `GPT_SERVICE_TOKEN`, you can instead paste its
`paths` and `components.schemas` into `tarot-reading-openapi.yaml` and delete the
duplicated `ErrorResponse` and `bearerAuth`.

## 5. Fix the spread key examples in the reading schema

`src/data/spreads.js` defines exactly six keys: `single`, `threeCard`, `fiveCard`,
`decision`, `relationship`, `celtic`.

`tarot-reading-openapi.yaml` gives `SpreadInfo.key` the examples `three-card` and
`celtic-cross`. Neither exists. The `drawCelticCross` example sends `celtic`, which is
correct, so the schema currently contradicts itself.

This was cosmetic while nothing persisted. Once `spreadKey` is written to
`journal_entries`, a wrong key becomes a permanent history row that groups with nothing.
Replace both examples with real keys, and consider promoting `SpreadInfo.key` to an enum.

## 6. Verify

```bash
npx wrangler dev
```

```bash
# save
curl -sS -X POST http://localhost:8788/api/journal \
  -H "Authorization: Bearer $GPT_SERVICE_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"spread":"Three-Card Story (Past · Present · Future)","spreadKey":"threeCard",
       "cards":[{"position":"Past","name":"The Hermit","orientation":"Upright","number":9}],
       "personalReading":"...","sessionSeed":"test-seed-1"}'

# reflect (use the returned entry.id)
curl -sS -X POST http://localhost:8788/api/journal/ENTRY_ID/reflections \
  -H "Authorization: Bearer $GPT_SERVICE_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"text":"six months alone","scope":"card","card":"The Hermit","position":"Past"}'
```

Repeat the save with the same `sessionSeed`: expect `200` with `deduplicated: true`.
Then open the entry in the journal UI and confirm the reflection renders — that is the
check that catches the shape problem described next.

---

## What the source changed about the plan

### `reflections_json` is a string map, not an array

`src/hooks/useSaveReading.js:97` sends `reflections: reflections || {}`, where
`reflections` is `{ [cardIndex]: string }` (`src/contexts/ReadingContext.jsx:107`).

`src/components/journal/entry-card/hooks/useEntryMetadata.js:140–145` reads it back as:

```js
Object.entries(entry.reflections).filter(([, note]) => typeof note === 'string' && note.trim())
```

A `{ entries: [ { id, text, scope, card, position, createdAt } ] }` array — the shape
proposed in the transcript — writes successfully, returns 200, and is then dropped by
that filter. Saved, invisible, no error anywhere. `functions/api/journal-export/index.js:281`
iterates the same `[key, value]` pairs and would print `[object Object]`.

The handler therefore writes strings into the existing map.

### Card-scoped reflections key on index, not position name

`functions/lib/followUpContext.js:135` looks up `reading.reflections?.[cardIndex]` when
assembling follow-up context. Keying on `"Past"` would leave follow-ups blind to
reflections added through the GPT. The handler takes `card` and `position` from the
model — which is what the model actually knows — and resolves them to the index
server-side, which also gives you the card verification for free.

Reading-scoped reflections use the reserved key `Overall`. `ReflectionsSection.jsx`
renders whatever key it finds as the label.

### Cards are `name`, not `card`

The journal's card shape is `{position, name, number, suit, rank, rankValue, orientation}`
(`src/hooks/useSaveReading.js:85–93`). The reading API's `CardInfo` uses `card` and
`meaning`, with lowercase orientation.

`functions/api/archetype-journey.js:460` does `const cardName = card.name;` with no
fallback. `functions/lib/journalSearch.js:175` does have `card.name || card.card`. So
forwarding `cardsInfo` verbatim gives you entries that are searchable but invisible to
archetype tracking. The schema requires `name` and says so in the description.

### Archetype tracking is a separate call the GPT will never make

`POST /api/journal` does not touch `card_appearances`. The app tracks separately from
the client: `src/hooks/useJournal.js:518` posts to `/api/archetype-journey/track` after
saving.

So "The Hermit has appeared in 4 of your last 11 readings" will not include anything
saved through the GPT. Three ways out, in increasing order of effort:

1. Run `POST /api/archetype-journey-backfill` periodically; it rebuilds from journal entries.
2. Call `/api/archetype-journey/track` from inside `onRequestPost` in `functions/api/journal.js`
   after the insert, gated on the caller being a service account, so the app's existing
   client-side call does not double-count.
3. Move tracking into the journal save for all callers and delete the client call.

Option 1 is the smallest thing that makes the recurrence feature true. Worth deciding
before you build any pattern-query Action on top of it, since that Action would otherwise
report confidently on partial data.

### `context` is an enum

`functions/lib/journalContext.js` accepts `love`, `career`, `self`, `spiritual`,
`wellbeing`, `decision`, `general`, plus `relationship`/`relationships` as aliases for
`love`. Anything else is silently stored as `null`. It is the reading taxonomy, not a
free-text note.

### Multi-tenancy

`functions/lib/serviceAuth.js` is explicit that `GPT_SERVICE_TOKEN` is shared and may be
embedded in a published GPT: it proves "a trusted integration", never "the owner". Every
journal write through it lands in one synthetic account (`service:gpt` by default).

Fine for owner-only use. For a published GPT it means all users share one journal, which
is a data-exposure problem, not just a UX one — `GET /api/journal` would return other
people's entries. If the GPT is published, journal writes need per-user OAuth before
these Actions ship, and that is a separate Action with its own auth config.

`GPT_OWNER_TOKEN` already exists for owner-only capabilities (`is_owner`, currently
gating `promptDebug`). Gating journal writes on `is_owner` instead of mere service auth
is a one-line option if you want the private version safely today.

---

## Minor

- `functions/api/journal.js:324–380`: the `requestId` destructured from the body shadows
  the `crypto.randomUUID()` declared at line 326 for the whole `try` block. The `catch`
  logs the generated one, so log correlation breaks the moment a caller sends a
  `requestId`. Rename one of them.
- The journal's location consent flag is `persistLocationConsent`; the reading schema's
  is `persistLocationToJournal`. Both omitted from the Action schema, but worth aligning
  if you ever wire location through.
- `mcp/tableau-adapter/server.js` already exposes four job-based tools against
  `/api/tarot-reading/jobs`, not the synchronous endpoints in the reading schema. If the
  MCP migration proceeds, these two journal operations port over as-is; the schemas here
  become the MCP `inputSchema` almost verbatim.
