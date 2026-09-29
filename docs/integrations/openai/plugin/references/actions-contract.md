# Tableu tools contract

Reviewed 2026-09-29 for plugin 0.28.2. Source of truth: the live tool schemas.
The backend is described in `docs/integrations/openai/chatgpt-mcp.md` in
henryperkins/tarot.

These tools come from the Tableu app (`https://tarot.lakefrontdev.com/mcp`,
OAuth). Use a tool only when it is actually exposed. The four historical GPT
Actions (createTarotReading, drawTarotReading, saveReadingToJournal,
addReflectionToJournalEntry) are superseded; `migration-source/` keeps them as
history.

## Account

`get_profile` returns `{ id, name?, nickname? }` for the Tableu account the
connection acts as. The connection is private to that one account.

## Readings

| Tool | Input | Returns |
|---|---|---|
| `draw_tarot_reading` | `spreadInfo { name, key }`; optional `userQuestion`, `reflectionsText`, `deckStyle` (rws-1909, thoth-a1, marseille-classic), `reversalFrameworkOverride` (blocked, delayed, internalized, contextual, shadow, mirror, potentialBlocked; any other value is refused), `allowReversals`, `seed`, `personalization` | `jobId`, `status: running`, `spreadInfo`, `cardsInfo`, `seed`, `deckStyle` |
| `start_tarot_reading` | `spreadInfo { name, key }`, `cardsInfo[] { position, card, orientation, meaning? }`, and the optional reading fields above | `jobId`, `status: running` |
| `wait_for_tarot_reading` | `jobId`, optional `timeoutSeconds` (1–45, default 40) | status (below), plus `timedOut` when still running |
| `get_tarot_reading_status` | `jobId` | status (below) |
| `cancel_tarot_reading` | `jobId` | `status`: `cancelled`, or `complete` / `error` when already finished |

- **Spread keys** are exactly `single`, `threeCard`, `fiveCard`, `decision`,
  `relationship` and `celtic`.
- **Cards** have the shape
  `{ position, card, orientation (Upright or Reversed), meaning, number, suit, rank, rankValue }`.
  `card` is the name in the chosen deck, for example Thoth "Prince of Wands".
  The metadata comes from the card catalog. The returned cards are the ground
  truth. For supplied cards, send `meaning` only when the user gave one;
  without it Tableu uses the card's standard upright or reversed meaning.
- **Status** is `{ jobId, status (running, complete or error), spreadInfo, cardsInfo, seed? }`.
  When it failed it adds `error`. A complete status adds `requestId` and one
  of three outcomes:
  - `reading` (plus a `themes` summary): the narrative to present;
  - `supportMessage` with `gateBlocked` and `gateReason: crisis_gate`: the
    question suggested a crisis, so there is no reading. Set the cards aside
    and share the support information;
  - `gateBlocked` and `gateReason` alone: Tableu held the reading back. Say it
    isn't available and don't write one in its place.

  A job that finished without any text is reported as `error`.
- **Job reference.** `jobId` is a private handle; never show it to the user.
  Tableu serves a job only to the account that started it. `jobToken` is
  deprecated: it may still appear in results and is accepted, but it is
  ignored.
- **Waiting.** Wait again if a reading is still running, and never start a
  second reading for the same request.
- **Replay.** Reuse the returned decimal `seed` unchanged with the same spread,
  deck and reversal setting to reproduce the draw. MCP treats decimal seed
  strings as unsigned 32-bit values; nonnumeric words or phrases are hashed.
  The existing HTTP draw API retains its original string-hashing behavior.
- **Timing.** Every tool returns within about 45 seconds.

## Saving: `save_reading_to_journal`

Consent is required: an explicit request, or an unambiguous yes right after an
offer.

- **Input:** `{ jobId, context? }`. The server copies the narrative, cards,
  spread, question, deck, personalization and seed from the account's own
  job, exactly. `context` is one of love, career, self, spiritual, wellbeing,
  decision or general, and is sent only when clearly supported.
- **Window:** a reading can be saved for 24 hours after it is written. After
  that the tool answers "Not saved: this reading can no longer be saved".
- **Not saveable:** a support message, a reading Tableu held back, or a job
  that failed.
- **Canonical names:** cards are stored under their canonical names, which is
  how the app stores them; Thoth "Prince of Wands" is stored as "Knight of
  Wands". The app shows canonical names.
- **Outcomes:**
  - `saved`: a new entry, returned as `entry.id`;
  - `already_saved`: this reading was already stored, nothing changed, and
    `entry.id` is its id;
  - `seedShared`: another reading already uses the seed, so this one was
    stored without it.
- **Errors:** "Not saved: …" names the reason. "Could not confirm …" means the
  outcome is unknown, so suggest checking the app.

## Reflections: `add_reflection_to_journal_entry`

Consent is required: an explicit request, or an unambiguous yes right after an
offer.

- **Input:** `{ entryId, text, scope (reading or card), card?, position? }`.
  `entryId` must come from a save in this conversation.
- **Text:** the user's exact words, 1–2,000 characters. Never summarize or
  split them.
- **Card scope:** send `card` as the reading showed it, plus `position` when
  that card appears twice. A card that isn't in the entry is rejected, and the
  error lists the entry's cards.
- **Returned target:** `target.card` is also the entry deck's label, so it can
  be reused with `target.position` for another note. Stored journal cards keep
  their canonical names; a Thoth Prince target remains "Prince of Wands" in
  reflection results even though its stored canonical name is "Knight of Wands".
- **Appending:** notes are appended, never replaced. The same note on the same
  target is never added twice; the outcome is then `already_present`.
- **Other errors:** "Not added: no saved entry with that id…" means the entry
  is missing or belongs to another account. Don't guess another id.

## Retries and errors

- **Retries:** a save or a reflection may be retried once after an unclear
  failure. Both are idempotent.
- **Explicit rejections** ("Not saved", "Not added", "Not started"): fix only
  the stated problem, once.
- **Tier or quota errors:** explain them and stop.
- **Honesty:** never report success without a successful tool result.

## Not available

- There are no journal read, list, search or delete tools.
- There is no cross-session history, and archetype tracking is not updated by
  saves.
- Point to the Tableu app for history.
