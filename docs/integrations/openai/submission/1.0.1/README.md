# Preserved Tableu 1.0.1 submission package

This directory tracks every input to the corrected October 1 upload ZIP. The
17 source files are byte-for-byte copies of that archive, including its Codex
manifest, MCP endpoint, icons, five positive and three negative review cases,
and redactions of the two private historical links. The original loose ZIPs
and review report remain untouched. The scoped `.gitattributes` preserves member
line endings on checkout and the imported Markdown's two-space hard line breaks.

Build from the repository root with Python 3 and its standard library:

```sh
python3 scripts/integrations/package_tableu_plugin.py
```

The output is `dist/plugins/app-6aba9d97f28c81918d45bb1b765f9cf0-1.0.1.zip`.
Use `--output /absolute/path/package.zip` to select another destination. The
script checks the closed source inventory and every SHA-256, uses sorted
members, fixed October 1 timestamps, Unix `0644` file permissions, and Deflate
level 6. It then verifies ZIP integrity, extracts each member in memory, and
requires the original archive checksum:

```text
dd106da385864c52c46b5ea08ad927005dce14560cc39db3fc49eb354cb00c71
```

The expected archive is 199,161 bytes. Changing filesystem timestamps does not
change the ZIP. Changed or extra files, symlinks, changed archive bytes, and
overwriting a different existing destination all fail. Python/zlib versions
that produce different compressed bytes also fail instead of claiming an
identical rebuild. Source edits for a future release require a new versioned
source and reviewed lock; this package remains an immutable historical upload.

Run `node --test tests/tableuPluginPackaging.test.mjs` for reconstruction,
round-trip metadata checks, YAML parsing, and rejection of changed inputs.
The instructions version (0.28.2) and upload version (1.0.1) are separate.
Neither is changed by packaging.

The preserved Codex format is intentional. A future portable-manifest migration
is a package change that needs its own comparison with the saved submission;
it is not performed by this archival build.

## Submission status

The local package can be reproduced. This does not establish that the Developer
Portal saved version, MCP scan, secure reviewer setup, or hosted demo is ready.
See the [current readiness report](../../submission-readiness-2026-10-07.md).
Unknown demo, commerce, countries, and translations remain absent, preserving
the original package's values and avoiding clearing fields in an existing draft.
Packaged review cases replace saved lists on reupload: compare them before any
authorized update. Reviewer credentials belong only in secure dashboard fields.

The relevant current guidance is [submission preparation](https://developers.openai.com/plugins/deploy/submission)
and the [submission error reference](https://developers.openai.com/plugins/deploy/submission-errors).
