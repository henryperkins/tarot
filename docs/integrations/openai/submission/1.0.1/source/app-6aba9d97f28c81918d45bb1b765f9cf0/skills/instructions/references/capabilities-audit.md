# Tableu actions and capabilities audit

Audit date: 2026-09-28. Baseline: 0.28.0, release `pluginrel_6ab5b24f2e4481919d59d09586d876e5`. Instruction update: 0.28.1.

## Evidence and limits

The current plugin files were retrieved through Plugin Creator and compared with the eight Tableu tool definitions exposed in this conversation. A read-only `get_profile` call succeeded and returned an account id; the audit retained only success and field-presence evidence, not account details. The baseline release was checked again before preparing publication.

This establishes the attached app, exposed action surface, and one successful authenticated read. It does not establish end-to-end reading generation, quota behavior, cancellation effects, journal persistence, retry deduplication, expired-job recovery, account isolation, or app rendering. No reading was started, cancelled, or saved, and no reflection was added. No backend code, authentication configuration, or app attachment was changed.

## Exposed actions

| Action | Capability | Side effect / boundary | Audit evidence |
|---|---|---|---|
| `get_profile` | Identify the linked account | Read-only; not journal history | Schema reviewed; live call succeeded |
| `draw_tarot_reading` | Draw backend cards and start a reading | Consumes reading quota; returns job handles and cards | Schema and description reviewed |
| `start_tarot_reading` | Interpret user-supplied structured cards | Consumes reading quota; preserves supplied orientations | Schema and description reviewed |
| `wait_for_tarot_reading` | Wait for the existing reading job | Read-only; reuse the same handles while running | Schema and description reviewed |
| `get_tarot_reading_status` | Check one job once | Read-only; no journal lookup | Schema and description reviewed |
| `cancel_tarot_reading` | Request cancellation | User-requested mutation; completed jobs remain finished | Schema and description reviewed |
| `save_reading_to_journal` | Save a finished reading | Explicit consent; job reference preferred | Schema and description reviewed |
| `add_reflection_to_journal_entry` | Append the user's exact words | Explicit consent; current-conversation saved entry; 2,000-character cap | Schema and description reviewed |

Six spread keys are exposed: single, threeCard, fiveCard, decision, relationship, and celtic. Three deck keys are exposed: rws-1909, thoth-a1, and marseille-classic. The schema exposes personalization and reversal-framework settings for both reading tools; only draw accepts seed and allowReversals.

Conversational capabilities include explaining spreads and symbolism, interpreting supplied cards, and drafting reflections. These do not demonstrate backend activity or persistence. No current tool reads/searches/deletes journal entries, retrieves cross-session history, updates archetype tracking, shares/exports a reading, generates voice, or uploads a photo. General app features and plan claims in older references require separate current evidence.

## Findings addressed in 0.28.1

1. The knowledge base still said no app or MCP connection existed. Current routing now reflects the attached app and prioritizes exposed tool definitions.
2. Historical Action schemas and synchronous examples could override current asynchronous guidance. Opening notices and operational-section notices now identify them as history; supplied migration source files remain intact.
3. The supplied-card contract inherited draw-only seed and reversal settings, while omitting reversalFrameworkOverride. Each reading tool now has an exact input list.
4. Result guidance assumed optional fields existed, guaranteed all tools returned within 45 seconds, and asserted a fixed expiry period. It now preserves optional/null distinctions, limits the timing statement to wait, and requires an explicit expired-job response.
5. Expired-save fallback lacked a missing-data rule. It now maps actual returned fields, omits unsupported null card metadata, preserves requestId, and stops if required source data is unavailable.
6. Complete-but-blocked or empty readings, partial draw success, and completed cancellation responses lacked clear handling. The guide now distinguishes these states without inventing results or restarting a job.
7. Save outcome and seedShared were blurred. The guide now distinguishes the saved/already_saved outcome from the separate optional boolean.
8. Uncertain-write retry guidance did not require identical input. The permitted single retry now preserves the exact payload; changes are a separate write.
9. A blanket claim that all migration gaps were closed exceeded available evidence. The guide now separates exposed operations, live checks, historical observations, and untested runtime behavior.

## Preservation

The package identity, Tableu display metadata, all three starter prompts and their order, author metadata, Read/Write labels, attached app id, private audience, icon references, reading-craft material, and supplied migration-source files are preserved. Both manifests advance to 0.28.1. The update adds this audit and changes instruction/routing text; it does not add new backend capabilities.

## Future audits

Recheck the current attached tools and their schemas first. Record a capability as exposed, documented, or tested live according to its actual evidence. A request to audit capabilities does not itself authorize quota-consuming readings or journal mutations. Use explicit test authorization before those live operations, keep user data out of reports, and report each verified result separately from static review.

## Verification of the instruction update

All eight simulated scenarios passed: supplied cards with draw-only options; blocked completion; narrative failure after a successful draw; expired save without requestId; uncertain save with a requested context change; cancellation after completion; journal-history search; and an incomplete card photo. These were instruction-application checks against the exposed schemas, not calls to the backend. A final schema review also clarified omission of null optional save strings and null reflection target fields.

Static checks confirmed matching manifest metadata apart from the version bump, unchanged prompt arrays and order, valid JSON, matching skill name and directory, a complete eight-tool inventory, and resolving knowledge-index references. App attachment and supplied migration source content were compared with the fetched baseline. Runtime tests beyond the read-only profile check remain outstanding.
