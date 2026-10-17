# Spacefast integration status

Preserved on 2026-10-17 as an unfinished development branch. The 46-file prototype is commit `5ef57c1316756d31de68551803f2cc44d961ed3e`, based on `b5ba16fa9915a77752297e1a3f283b8af9cf7eba`. It has not been merged into master or deployed.

Independent source review against master `c6d043fe27cf06b29b1b6dd6f0f237bd3d9dfa08` found these integration blockers:

1. **Schema and SQL drift.** Master adds migrations 0036–0038 after the prototype's fingerprint inventory. An offline compiler audit against current-master source found 319 SQL statements, 14 compiler failures and 6 unresolved expressions. Port the visual results, retry and initial-admission schemas and review their SQL semantics before updating fingerprints or allowlists. The audit does not establish MySQL execution correctness.
2. **Scheduler conflict.** Master retired video maintenance. Reconcile the structured scheduler outcome without restoring the removed video import or obsolete 10-minute schedule.
3. **Job contracts.** The prototype lacks `READING_VISUAL_JOBS` and drops newer reading-result, visual-binding and token fields from its persisted job state. Update restart/replay contracts and the MCP error-code field, or explicitly define and test a reduced feature profile.

Reading jobs remain disabled by default. A functioning release still needs real background-lifetime, database and provider verification described in [the runtime README](README.md). Do not bypass existing schema or SQL guards to make a rebase build.

Local checks on the preserved prototype:

- `npm test`: 3,043 passed, 7 skipped, 0 failed.
- `node --test tests/spacefast*.test.mjs`: 50 passed, 7 skipped, 0 failed.
- `git diff --check`: passed.

No remote database execution, provider request, deployment, browser acceptance or physical-device verification was performed for this preservation review.
