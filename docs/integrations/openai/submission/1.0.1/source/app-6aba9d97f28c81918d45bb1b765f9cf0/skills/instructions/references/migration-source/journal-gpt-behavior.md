# Journal behavior — Instructions and Knowledge layers

The two journal descriptions were carrying ~850 characters of routing and
field-mapping rules. GPT Actions caps operation `description` at 300, so that
detail has to live where `gpt-instructions.md` already says it belongs: rules that
prevent live failures go in Instructions, the field-by-field mapping goes in the
Knowledge base.

Both journal descriptions are now under 300 and keep the activation trigger, the
consent gate, and the one rule that fails silently (`card` → `name`).

---

## 1. Instructions block

`docs/integrations/openai/gpt-instructions.md` — insert after the **ACTIONS**
section's "Never send invented fields..." paragraph, before **ERRORS & LIMITS**.

```text
JOURNAL

Two write Actions, both consent-gated. Never call either because a reading seemed important, because the user reacted strongly, or because they kept talking about a card.

saveReadingToJournal when they ask to save, journal, keep, archive, or remember the reading — or when you offered and they said yes. Carry the completed reading over unchanged: spreadInfo.name -> spread, spreadInfo.key -> spreadKey, userQuestion -> question, reading -> personalReading, themes, provider, requestId, seed -> sessionSeed, deckStyle -> deckId, personalization -> userPreferences. Cards are reshaped, not copied: each card's card -> name, drop meaning, orientation capitalized (Upright/Reversed). Draw cards come from the response; create cards come from what you sent, since that response does not echo them. Keep the returned entry.id for the rest of the session.

addReflectionToJournalEntry when they ask to save, attach, or note something they just said — or when you offered and they said yes. Preserve their wording; do not summarize it. scope reading for the whole spread, scope card plus the exact card name (and position, when that card appears twice) for one card. Requires an entry.id already returned this session; if nothing is saved yet, offer to save the reading first. A card not in that reading is rejected.

Offer rather than assume: "Want me to keep this one?" is better than saving silently. Never say something was saved unless the Action returned success. You can read back only what an Action returned this session — for history, recurrence, and archetype patterns across time, point them to the app.
```

**1,485 characters.** The block currently measures 7,770 against GPT Builder's
8,000 cap, so this does not fit as-is. Two ways to make room:

- Trim **THE TABLEU APP** (currently ~900 chars). Its plan/pricing sentence and
  the feature list overlap what the new block says about the app being where
  long-range patterns live.
- Or cut the second paragraph of **ERRORS & LIMITS** (promptDebug, ~370 chars) and
  rely on the schema, which already says promptDebug is owner-gated and silently
  ignored for other callers.

Verify after editing:

```bash
python3 -c "
t=open('docs/integrations/openai/gpt-instructions.md',encoding='utf-8').read()
print(len(t.split('\`\`\`text')[1].split('\`\`\`')[0]), 'chars')"
```

## 2. Knowledge base section

`docs/integrations/openai/gpt-knowledge-base.md` — append as its own section. This
is the retrieved layer, so it can hold the full detail the Instructions compress.

```markdown
## Journal write Actions

### saveReadingToJournal → POST /api/journal

| Reading field | Journal field | Notes |
|---|---|---|
| `spreadInfo.name` | `spread` | Required |
| `spreadInfo.key` | `spreadKey` | Required. single, threeCard, fiveCard, decision, relationship, celtic |
| `userQuestion` | `question` | |
| `cardsInfo` | `cards` | Required. Reshaped — see below |
| `reading` | `personalReading` | Send always; omitting it skips coach extraction |
| `themes` | `themes` | |
| `provider` | `provider` | |
| `requestId` | `requestId` | Tracing only |
| `seed` | `sessionSeed` | The only dedup key; absent on unseeded and user-supplied draws |
| `deckStyle` | `deckId` | |
| `personalization` | `userPreferences` | |

`context` is not carried from the reading. It is the reading taxonomy — love,
career, self, spiritual, wellbeing, decision, general — and anything else is
stored as null. Send it only when the question clearly belongs to one.

Card reshaping, per card:

| Reading API | Journal |
|---|---|
| `card` | `name` |
| `position` | `position` |
| `orientation` (`upright`) | `orientation` (`Upright`) |
| `meaning` | dropped |
| `number`, `suit`, `rank`, `rankValue` | same |

The name field matters: archetype tracking reads `name` and nothing else, so a
card sent as `card` is recorded with no name.

Responses: 201 with `entry.id` on success; 200 with `deduplicated: true` when a
reading with that `sessionSeed` was already saved — treat both as saved, and use
the returned id either way. 403 means the account is not on Plus or Pro; say so
plainly and mention the plan rather than retrying.

### addReflectionToJournalEntry → POST /api/journal/{id}/reflections

Body: `text` (their words, 2000 chars max), `scope` (`reading` or `card`), plus
`card` and `position` when scope is `card`.

The server verifies the card against the saved spread. A card that is not in that
reading returns 400. A card that appears twice with no `position` also returns
400 — supply the position. A second reflection on the same target is appended to
the first, not substituted.

Reading-level example:

    { "text": "This whole reading is about accepting the move.", "scope": "reading" }

Card-level example:

    { "text": "The Hermit is the six months I spent working alone.",
      "scope": "card", "card": "The Hermit", "position": "Past" }
```

## 3. What the GPT still cannot do

Worth keeping straight in both layers, because it is the easiest thing to
overclaim once writes exist: there are no read-back Actions. The GPT can save a
reading and attach reflections, and it can recall what happened in the current
conversation. It cannot list past entries, search the journal, or report
recurrence across sessions. "The Hermit has appeared in four of your last eleven
readings" is a sentence the app can say and the GPT cannot, until a read Action
exists — and, per the archetype-tracking gap in `INSTRUCTIONS.md`, not accurately
even then until GPT-saved readings are tracked.
