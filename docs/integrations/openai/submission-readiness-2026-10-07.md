# Tableu submission readiness — October 7, 2026

The corrected 1.0.1 ZIP is now reproducible from tracked source. The Developer
Portal saved submission remains unverified: its exact URL presents a human
verification challenge, and the connected tool schemas still reject the
package's jobId-only polling contract before the request reaches Tableu.
No draft upload, rescan, review submission, publication, or legal attestation
was performed.

## Reproducible package

The [locked 1.0.1 source](submission/1.0.1/README.md) preserves all 17 members of
the corrected October 1 archive. It rebuilds to exactly 199,161 bytes with
SHA-256 `dd106da385864c52c46b5ea08ad927005dce14560cc39db3fc49eb354cb00c71`.
The original loose 1.0.0 and 1.0.1 ZIPs and review report were not changed.
The original ZIP's private-link redactions, manifest, MCP endpoint, icons,
listing, five positive and three negative cases, release notes, and maintained
0.28.2 instructions remain byte-for-byte intact.

Five package tests passed: identical rebuild and extracted JSON/YAML metadata,
changed input rejection, extra-file rejection, symlink rejection, and preserving
a different existing output. The packager checks every source and extracted
member checksum. The instructions still match the maintained
[skill](plugin/SKILL.md); the legacy references remain historical evidence.

The current [OpenAI submission guide](https://developers.openai.com/plugins/deploy/submission)
still documents the Codex `.codex-plugin/plugin.json` format. Preserving that
format does not require converting this archival package. These checks are
local validation, not the portal's validator or hosted MCP scans.

## Current checks

| Check | Result and limit |
| --- | --- |
| MCP and reading-job fixture suites | 131 passed, zero failed against source commit `b11fdd272291a7c2524bd20c708dd763cae267c8`. Covers OAuth, input/output schemas, principal isolation, job retention and cancellation, journal save/reflection mapping, and safety outcomes. External services are fixtures. |
| Source tools | All eight expected tools are present and have boolean `readOnlyHint`, `destructiveHint`, and `openWorldHint` annotations. Source accepts jobId-only polling and optional supplied-card meanings. |
| Dedicated reviewer connection | `get_profile` returned `openai_reviewer`. This is an existing OAuth link, not a fresh login, secure portal credential check, or a run against the exact saved package. The primary account and local-only `agent_reviewer` credentials were not used. |
| Connected polling contract | A read-only probe with an explicitly synthetic jobId and no token failed connector validation: `jobToken [required]: Missing required property`. No backend lookup occurred. |
| Connected supplied-card contract | The exposed `start_tarot_reading` schema still requires every card's meaning, whereas the package and source permit its omission. No live reading was created to work around the stale schema. |
| Public listing pages | Homepage, privacy, terms and support rendered actual public Tableu content in unauthenticated Chromium. Policy/support pages identify Lakefront Digital; support provides a public contact. Browser document status and screenshots are retained in private evidence. A separate Python HTTP fetch returned 403; that fetch does not invalidate the observed browser access or prove reviewer access. |
| Exact Developer Portal | `https://platform.openai.com/plugins/manage/plugin_asdk_app_6aba9d97f28c81918d45bb1b765f9cf0` returned 403 and displayed a human verification challenge. No saved draft information was visible. |
| Plugin metadata/discovery | The supplied portal backend ID returned `404 Plugin not found`; the package app name returned `400 Invalid plugin id`. Tableu discovery returned no match. These access results do not prove that the submission is absent or deleted. |

Evidence is preserved under the private recovery directory
`/home/ubuntu/git-recovery/tarot-local-release-20261007T233206Z/plugin/`:
the identical ZIP, package test log, source tool definitions, sanitized check
results, public-page snapshots/screenshots, and portal challenge screenshot.
No reviewer credentials or tokens are included in the tracked package or report.

## Saved-version review cases

The [packaged cases](submission/1.0.1/source/app-6aba9d97f28c81918d45bb1b765f9cf0/.codex-plugin/plugin.json)
remain unchanged. Their complete suite cannot be marked passed against an
uninspected saved submission.

| Case | Status against the exact saved submission |
| --- | --- |
| Positive 1: linked account identity | Not run against the saved package. The existing reviewer connection's profile probe passed separately. |
| Positive 2: draw and wait | Blocked: saved version unavailable and jobId-only polling rejected by the current connection. |
| Positive 3: supplied cards without meanings | Blocked: saved version unavailable and current supplied-card schema requires meaning. |
| Positive 4: status then cancellation | Blocked: saved version unavailable and jobId-only status rejected. No cancellation race was attempted. |
| Positive 5: save and attach exact reflection | Blocked by the reading setup and saved-version access. No journal entry or reflection was written. |
| Negative 1: reaction is not save consent | Not run: the required completed-reading setup is blocked. |
| Negative 2: unsupported journal-history request | Not run in the saved host conversation. Source has no journal-history read/search tool. |
| Negative 3: ambiguous cancellation | Not run in the saved host conversation. No job was invented or cancelled. |

## Remaining preparation and portal work

1. Obtain access to the existing portal draft, preserving both existing plugin
   identities and its audience. Inspect the uploaded version, current MCP
   attachment, live/held tool definitions and Issues before concluding what
   `Not live` means. The owner's October 1 Draft/Configured, Authorized,
   verified-domain snapshot is historical evidence, not a current scan result.
2. Refresh/rescan the existing MCP metadata through the portal where available.
   Refresh the developer connection, start a new conversation, and verify that
   supplied meanings can be omitted and polling accepts jobId alone. Then run
   the unchanged five positive and three negative cases against the saved
   version using the dedicated reviewer account.
3. Compare saved case lists with the ZIP before any authorized reupload. The
   ZIP includes both lists; reupload replaces them and resets attestations,
   while omitting scalar values preserves saved values. An upload does not
   rescan the MCP server. The [submission guide](https://developers.openai.com/plugins/deploy/submission)
   and [error reference](https://developers.openai.com/plugins/deploy/submission-errors)
   separate these checks from local archive validation.
4. Verify the saved demo recording URL and actual playback. No recording URL
   is available in the local package or supplied review materials; its absence
   here does not prove that the saved draft lacks one. Rehearse the draw/wait,
   supplied-card, cancellation, consented save/reflection, and unsupported
   history flows before recording in the intended host. A script or fixture
   run is not a demo.
5. Inspect secure reviewer credentials and login instructions, then exercise a
   fresh OAuth login with access suitable for every case. The reusable local
   Pro reviewer account is local-only and must not be substituted. Keep all
   reviewer credentials in the portal's secure fields.
6. Verify the selected developer identity, supported countries, commerce
   declarations, translations, required scans and owner attestations. Unknown
   demo, commerce, countries and translations stay omitted from the immutable
   package; no empty clearing values or invented declarations were added.
   Submission for review and publication remain separate authorized actions.
