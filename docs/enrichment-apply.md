# Applying reviewed enrichment

`npm run enrich:apply` updates the generated enrichment registry after human review. It reads the local CSV queue, validates every approved row, and preserves the hand-written canon. This command does not draft passages, call a model, or fetch sources.

The default `merge` mode updates approved card/context slots and revokes previously applied entries whose exact candidate IDs have an explicit `reject` or `rejected` verdict. Missing rows, blank verdicts, and `pending` verdicts preserve existing approvals. Rejecting another candidate for the same slot does not revoke its current approved occupant. `approve` and the legacy `approved` spelling are accepted.

```sh
npm run enrich:apply -- --dry-run
npm run enrich:apply
```

Dry runs perform the same queue, existing-output, desired-registry, and module import validation without writing files. The report distinguishes total applied entries, added and updated slots, preserved entries, explicit revocations, removed entries, and whether the registry would be cleared. `applied` is the final registry size, rather than the number of supplied approvals. Replacing a slot with a different approved candidate counts as an update and removal of its former candidate; it is not an explicit revocation.

Only canonical decimal Major Arcana IDs from `0` through `21` are valid. Surrounding CSV whitespace is trimmed; fractions, signs, leading zeroes, exponents, hexadecimal, and trailing characters are rejected. The card name must agree with the canonical catalog name after case and whitespace normalization. Deck aliases cannot reassign a canonical slot.

Invalid approved text, tags, context, identity, or conflicting approved slots abort the entire apply. They are reported separately from intentional reviewer rejection. Broken CSV, missing columns, repeated candidate IDs, and unknown verdicts also fail. Quoted CSV fields may contain newlines; metadata is serialized as data and cannot become executable JavaScript or an uncontrolled source comment.

Full-prose approval and meaning-only projection approval are independent. Applying a full passage does not approve its projection. An approved projection requires explicit projection approval, nonempty projection text, and a version. Unchanged applied entries retain their exact projection text, version, review status, provenance, and tags when a partial queue is merged. Clearing a full-prose verdict for redrafting does not revoke the previously applied passage; use an explicit rejection to remove it.

## Complete replacement

Replacing the entire registry requires both `--mode replace` and `--completeness-manifest <path>`. A partial queue cannot be promoted to a complete replacement by the mode alone.

```sh
npm run enrich:apply -- --mode replace --completeness-manifest data/enrichment/complete-queue.json --dry-run
npm run enrich:apply -- --mode replace --completeness-manifest data/enrichment/complete-queue.json
```

The manifest is JSON with this structure. Digest values below are placeholders, not usable approvals:

```json
{
  "version": 1,
  "complete": true,
  "queueSha256": "SHA256_OF_EXACT_QUEUE_FILE_BYTES",
  "previousOutputHash": "SHA256_OF_EXACT_CURRENT_MODULE_FILE_BYTES",
  "candidateIds": ["candidate-first", "candidate-second"],
  "slots": ["0#career", "17#transition"]
}
```

Use `sha256sum` on the exact queue and generated module to obtain the digests. If no module exists, `previousOutputHash` is JSON `null`. A dry-run report also gives the desired `outputHash`; this is the proposed next module's hash and must not be confused with the currently applied module's digest.

`candidateIds` must list every queue candidate exactly once. Every currently applied candidate must still appear in that complete queue, including candidates whose new verdict is blank, pending, or rejected. `slots` is the distinct union of card/context slots from that queue and the currently applied registry. Slot syntax is canonical card number, `#`, and context. All replacement rows need a canonical identity and a nonempty context, even when pending. The command verifies these inventories, the exact queue digest, and the current output identity before any replacement.

In a verified complete replacement, only approved rows survive. A complete all-pending or all-rejected inventory can therefore clear the registry. A default merge of that same pending queue preserves approvals. Revoking the final applied candidate explicitly also clears the registry in default merge mode. Both clear operations write an empty generated registry and matching empty applied provenance.

Changing queue bytes or applying another update invalidates the old manifest. Regenerate and review its inventory and hashes before attempting replacement again. The manifest attests to an operator-provided complete inventory; it cannot discover candidates outside the queue and currently applied registry.

## Publication, identity, and recovery

The generated module is the runtime authority. The provenance sidecar binds its complete applied inventory and per-passage text digests to the exact module SHA-256. Future applies, including dry runs, reject stale module/provenance hashes or inconsistent entry identities.

Run `npm run enrich:apply -- --check` before deployment to validate the existing generated module and provenance without a review queue, provider access, or filesystem writes. It fails on malformed external modules, missing required provenance, inconsistent entry identity, hash mismatch, or unfinished recovery. This command is an explicit release check; the deployment script does not invoke it automatically.

Existing generated files are read by a restricted data parser before any import. Arbitrary statements, imports, calls, computed properties, or extra exports fail. Both the old generator's object-literal format and the current JSON format are supported. A legacy nonempty module requires its complete matching legacy provenance. Its per-entry identity and independent projection approvals are checked before preserving the existing module data and writing the new hash-bound pair. A nonempty module with missing provenance is preserved and rejected for reconciliation; approval is never inferred from the queue's absence. The checked-in empty registry can bootstrap without a sidecar.

Publication uses an exclusive lock, same-directory staging files, safe parse/import validation, backups of the prior pair, and an on-disk recovery marker. The module and provenance are renamed separately. These two renames are **not a filesystem transaction**. A handled publication failure restores both prior files, including their prior absence. A subsequent successful run can then proceed normally. After a committed or restored pair is established, cleanup removes the recovery marker before deleting prior backups. Cleanup always releases the lock. A later backup-removal failure can report an error while leaving the committed pair valid; run `--check` and a dry run before retrying.

A process or machine interruption can leave:

- `<module>.apply.lock`;
- `<module>.apply-recovery.json`;
- uniquely named `.backup-*` and `.stage-*` files beside the destinations.

The next apply stops when a recovery marker exists. Preserve these files. Verify that no apply process owns the lock before doing recovery. The marker records the destination paths, both prior backup paths, prior digests, and proposed next digests. Restore the recorded prior module and provenance from the backups, using same-directory staging and renames. If a backup path is `null`, the corresponding destination did not exist before publication and should be restored to absence. Rehash both restored files and compare with the marker before removing that marker, its owned temporary files, and the stale lock. Then rerun `--dry-run` to verify the recovered pair.

An interruption after both renames but before cleanup may leave a consistent new pair plus a marker; the command still stops for explicit recovery. If only a stale lock remains, verify that no apply process is active and preserve any recovery files before removing the lock. Do not delete or regenerate provenance to bypass a mismatch. Failed restoration leaves the marker and backups available; the command reports the recovery path.

The hash proves output identity and the review flags preserve recorded human decisions. Neither establishes editorial accuracy, source reliability, or approval of a changed text. Those remain separate review obligations.
