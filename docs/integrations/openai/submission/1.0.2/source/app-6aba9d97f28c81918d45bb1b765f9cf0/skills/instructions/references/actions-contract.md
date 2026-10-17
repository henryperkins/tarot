# Tableu tools contract

Updated 2026-10-09 for instructions 0.29.0 (upload package 1.0.2), the public release of the Tableu app in ChatGPT. Live tool schemas and responses take precedence. Source inspection and unit tests do not establish successful live OAuth or ChatGPT behavior.

The attached Tableu app supplies these tools. Only invoke a tool actually exposed in the current conversation. Each person connects their own Tableu account.

## Account and capability boundaries

`get_profile({})` is read-only and returns an opaque, stable `id` for the connected account (not its internal account number), plus optional `name` and `nickname`. Prefer the nickname or name when identifying the account; do not invent a display name when absent, and don't show the id. Saves target the connected account. A profile response confirms access to that account, not a full ownership or authorization-isolation test.

There are no journal read, list, search, edit, delete, export, sharing, voice, image-upload, or archetype-tracking tools in this inventory. Interpreting visible user-supplied cards is conversational assistance; the backend start tool receives structured cards, not an image. The manifest's Read/Write labels do not promise general journal access. Point to the app for history and account details. Don't mention plans, prices, or upgrades.

## Reading inputs

| Tool | Required input | Optional input |
|---|---|---|
| `draw_tarot_reading` | `spreadInfo { name, key }` | `userQuestion`, `reflectionsText`, `deckStyle`, `allowReversals`, `seed`, `personalization`, `reversalFrameworkOverride` |
| `start_tarot_reading` | `spreadInfo { name, key }`, `cardsInfo[] { position, card, orientation }` | `userQuestion`, `reflectionsText`, `deckStyle`, `personalization`, `reversalFrameworkOverride`; each card can include `meaning`, `number`, `suit`, `rank`, `rankValue` |

- Spread keys: `single`, `threeCard`, `fiveCard`, `decision`, `relationship`, `celtic`.
- Deck keys: `rws-1909`, `thoth-a1`, `marseille-classic`.
- `personalization` supports `displayName`, `focusAreas[]` (at most 12 nonempty strings, each at most 40 characters), `preferredSpreadDepth` (short/standard/deep), `readingTone` (gentle/balanced/blunt), `spiritualFrame` (psychological/spiritual/mixed/playful), and `tarotExperience` (newbie/intermediate/experienced). Unknown properties are rejected. Use known preferences.
- `start_tarot_reading` has no `seed` or `allowReversals` input. Preserve supplied orientations (upright/reversed or Upright/Reversed), positions, and card names. Clarify missing or ambiguous cards, positions, and orientations before calling. Send meaning only when supplied by the user; otherwise omit it and the server resolves the standard meaning.
- Draw only when the user has not supplied cards. Both creation tools consume reading quota. No automatic redraw or restart after an uncertain failure.
- A returned decimal seed can replay a draw with the same spread, deck, and reversal setting. Preserve that string exactly; do not promise the same generated narrative. Seed parsing internals and HTTP API behavior are outside this contract.

## Jobs and results

Both creation tools return `jobId` and `status: running`. Draw also returns `cardsInfo`, `spreadInfo`, `seed`, and `deckStyle`; start does not return cards at creation. Status, wait, cancellation, and save calls take only `jobId`; the connected account that started the job is what authorizes access to it. Retain original inputs and returned metadata in this conversation. Keep job handles private.

| Tool | Input | Result |
|---|---|---|
| `wait_for_tarot_reading` | `jobId`, optional `timeoutSeconds` (integer 1–45, default 40) | Job status and available result fields |
| `get_tarot_reading_status` | `jobId` | One status check; use wait when waiting for completion |
| `cancel_tarot_reading` | `jobId` | `jobId`, `status: cancelled / complete / error` |

Status results contain `jobId`, `status` (running/complete/error), `cardsInfo`, and nullable `spreadInfo`. Optional fields are `reading`, `supportMessage`, `error`, `seed`, `timedOut`, `gateBlocked`, `gateReason` (`crisis_gate` or `withheld`), and `themes`. themes is limited to dominantSuit, dominantElement, majorCount, reversalCount, and reversalFramework. Returned card fields are position, card, orientation (Upright/Reversed), meaning, number, suit, rank, and rankValue; meaning and identity metadata can be null. Preserve actual values and do not fill absent result fields by invention.

- Running, including `timedOut: true`: wait again on the same job. A wait timeout is not job failure and never authorizes a second reading.
- Complete with a nonempty reading: present the returned narrative. A reading that Tableu vetted after a failed first draft comes back as an ordinary reading.
- supportMessage with gateReason crisis_gate: no tarot reading was produced. Set the cards aside, respond with care, and share the support information. Do not interpret or offer to save it.
- gateBlocked with gateReason withheld: explain that Tableu held the reading back. Do not present or save it, invent a replacement, or restart without a new user request.
- Complete without reading or supportMessage: report that the reading could not be confirmed; do not invent a narrative or start another job. The current server reports an empty finished result as error.
- Error: explain that generation failed, using the returned error text. Cards already returned by the draw remain valid evidence of a draw; distinguish them from a failed narrative. When the error says the account has used its readings for the month, or that a spread or option isn't included with the account, relay it plainly and stop: don't retry, suggest upgrading, or name plans or prices.
- Cancel only on the user's request. Report cancelled only when returned. Complete/error means the job had already finished.
- The wait limit is not an end-to-end latency guarantee for every tool or the whole reading.

## Saving: `save_reading_to_journal`

Require the user's explicit save request or an unambiguous yes immediately after an offer. A reading request alone is not save consent.

Required input: `{ jobId, context? }`. The server copies the completed reading from the connected account's own job; the model never supplies the narrative, cards, or personalization. Context is love/career/self/spiritual/wellbeing/decision/general; include it only when clearly supported.

A ChatGPT job is retained for 24 hours after finishing. After expiry, report the returned rejection and stop: there is no payload-mode or expired-job fallback. Empty input, reading-text payloads, another account's job, unfinished jobs, failed or empty results, support messages, and withheld readings cannot be saved. Never manufacture an identifier or recreate a reading to bypass these checks. A successful quality_gate_streaming replacement is an ordinary saveable reading.

Successful responses contain `entry { id }`, `deduplicated`, `outcome: saved / already_saved`, and optional boolean `seedShared`. When saving isn't included with the account, the result says so; relay it without naming plans or suggesting an upgrade.
- Saved: a new entry was created.
- Already_saved: use the existing entry id; do not claim another entry was created.
- seedShared is a separate flag, not a third outcome or a failed save.

Keep the returned entry id for authorized reflections in this conversation. The server stores canonical card identities while returning deck labels in reflection targets; preserve the reading's label when attaching a card note. A save result does not prove archetype tracking changed.

## Reflections: `add_reflection_to_journal_entry`

Require an explicit request to save/attach/note the user's words, or an unambiguous yes immediately after an offer.

Input: `{ entryId, text, scope, card?, position? }`.
- Use only an entryId returned by a successful save in this conversation.
- Send the user's exact words, 1–2,000 characters. Never summarize or split a longer passage; ask them to choose a shorter passage.
- For the whole spread, use scope `reading`.
- For scope `card`, send the card's label as the reading showed it. Include its position to disambiguate repeated names. Clarify ambiguity instead of choosing a card.
- Notes append rather than replace. The same note on the same target returns `already_present`; otherwise `added`.
- Results contain entryId, outcome, text, and target (scope, with optional card, cardIndex, position). When present, `target.card` uses the deck label and can be reused with a non-null target.position. Returned target.card and target.position may be null; omit null values from new requests because the input fields accept strings, not null. An unclear-write retry keeps the original request payload rather than rebuilding it from result fields.

## Retries and errors

The live descriptions permit one retry after an unclear failure for either write. Repeat the identical payload, including reading/entry identity, target, text, and context. A changed payload is a new write, not a retry.

After the retry remains unclear, say the save or note could not be confirmed and suggest checking the app. Do not claim failure as certain when the result is unknown. For explicit validation rejections, fix only the stated problem once; do not bypass permission, ownership, tier, quota, or authentication errors. For draw/start, a corrective retry requires an explicit validation rejection indicating the reading did not start. Never create a replacement job after a network error.

Report saved/added only from a successful tool result. Explain explicit Not saved/Not added rejections. Plan or limit messages stop the operation; relay them without inventing numbers, suggesting an upgrade, naming plans, or quoting prices.
