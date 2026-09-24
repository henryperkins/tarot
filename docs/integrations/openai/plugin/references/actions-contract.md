# Tableu tools contract

Reviewed 2026-09-23 for plugin 0.28.0. Source of truth: the live tool schemas.
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
| `draw_tarot_reading` | `spreadInfo { name, key }`; optional `userQuestion`, `reflectionsText`, `deckStyle` (rws-1909, thoth-a1, marseille-classic), `allowReversals`, `seed`, `personalization` | `jobId`, `jobToken`, `status: running`, `spreadInfo`, `cardsInfo`, `seed`, `deckStyle` |
| `start_tarot_reading` | `spreadInfo { name, key }`, `cardsInfo[] { position, card, orientation, meaning }`, and the optional reading fields above | `jobId`, `jobToken`, `status: running` |
| `wait_for_tarot_reading` | `jobId`, `jobToken`, optional `timeoutSeconds` (1–45, default 40) | status (below), plus `timedOut` when still running |
| `get_tarot_reading_status` | `jobId`, `jobToken` | status (below) |
| `cancel_tarot_reading` | `jobId`, `jobToken` | `status`: `cancelled`, or `complete` / `error` when already finished |

- **Spread keys** are exactly `single`, `threeCard`, `fiveCard`, `decision`,
  `relationship` and `celtic`.
- **Cards** have the shape
  `{ position, card, orientation (Upright or Reversed), meaning, number, suit, rank, rankValue }`.
  `card` is the name in the chosen deck, for example Thoth "Prince of Wands".
  The metadata comes from the card catalog. The returned cards are the ground
  truth.
- **Status** is `{ jobId, status (running, complete or error), spreadInfo, cardsInfo, seed? }`.
  When complete it adds `reading`, `provider`, `requestId`, `themes` and, when
  present, `gateBlocked`/`gateReason`. When it failed it adds `error`.
- **Tokens.** `jobId` and `jobToken` are private handles; never show them to
  the user.
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

- **Preferred:** `{ jobId, jobToken, context? }`. The server copies the
  narrative, cards, spread, question, deck, personalization and seed exactly.
  `context` is one of love, career, self, spiritual, wellbeing, decision or
  general, and is sent only when clearly supported.
- **After the job expires (24 h):** the reading fields `spread`, `spreadKey`,
  `cards`, `personalReading` and `requestId`, plus optional `question`,
  `themes`, `context`, `provider`, `sessionSeed`, `deckId` and
  `userPreferences`.
  - Each card is `{ position, name, orientation }`, where `name` is the card's
    name as the reading returned it (`cardsInfo[].card`). It also carries its
    identity: `number` for a Major Arcana card, or `suit` and `rankValue` for a
    Minor Arcana card, exactly as returned.
  - `personalReading` is the complete narrative, verbatim.
- **Never both:** don't send a job reference and reading fields together.
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
