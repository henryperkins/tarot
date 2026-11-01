# Local qualification process supervision

These Linux-only helpers preserve an authorized attempt's local evidence and clean up its subprocesses. They do not authorize inference, clear a content halt, replace a qualification gate, or retry an attempt.

- `run-check.py EVIDENCE_ROOT LABEL CWD COMMAND [ARG ...]` reserves a unique label, runs the explicit command with a minimal environment that excludes provider credentials, archives its combined output, and writes an atomic terminal receipt. Use a fresh label for a separately authorized check; an existing reservation, log or receipt is refused.
- `capture-claude.py EVIDENCE_ROOT MODE KEY [CLAUDE ARGS ...]` archives exact prompt and transport bytes around the separately configured executable. A frozen `standard-transport.json`, prompt inventory/receipts, and (for semantic calls) generation plan are required. Model, effort, token limit, disabled tools, session-persistence setting, prompt hashes, credential exclusions and content halt checks stay enforced. Call-cap checking and exclusive attempt-directory creation share a per-lane file lock. An interrupted or failed reservation continues to consume its slot; there is no capture retry.
- `process_owner.py` uses Linux child-subreaper adoption and PID start-time checks to track the launched process family, including detached descendants. Cleanup never searches by executable name. Catchable interruptions are propagated through process inspection; missing-process read errors may be ignored.

SIGINT/SIGTERM handlers are installed before reservation, and reserved attempts stay covered by the receipt finalizer. Capture archives each chunk before forwarding it. A closed downstream consumer triggers cleanup and a failure receipt. The capture observes direct-child exit while draining output, cleans up descendants retaining stdout, and then drains the remaining pipe bytes. Nested capture cleanup has a shorter grace interval than the outer supervisor. Tests use local dummy processes only and verify an unrelated sibling stays alive.

SIGKILL, machine loss, or filesystem failure cannot guarantee a terminal receipt. Existing reservations still forbid an automatic retry. A successful transport exit or a structurally complete reading does not establish content quality.

The historical October 31 split harness and its failed/interrupted evidence remain immutable. Any future authorized generation must freeze a new harness that explicitly uses these source paths and the new evidence-root argument, then satisfy that lane's independent dispatch and content gates. Do not point these helpers at the halted historical root to resume it. The current diagnostic task authorizes no additional readings.

Offline regression command:

```sh
node --test tests/qualificationLauncher.test.mjs tests/narrativeSpineMultilingual.test.mjs
```

The full diagnosis and limits are in [the offline diagnostic record](../../../docs/knowledge-graph/GRAPHRAG_OFFLINE_DIAGNOSTICS_2026-10-31.md).
