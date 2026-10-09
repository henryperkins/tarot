# Tableu 1.0.2 submission package

The public-release upload: instructions 0.29.0 for the Tableu app in ChatGPT.
It keeps the 1.0.1 identity, listing, icons, MCP endpoint and review cases,
and changes:

- the instructions and tool contract for public use: each person connects
  their own account, no job tokens or request ids, and no plans, prices or
  upgrades in replies;
- a bundled knowledge base without plan details or the retired GPT Actions;
- no legacy migration references;
- `commerce: false`, with a description, `countries: []` (no country restriction), and new release notes.

Build from the repository root:

```sh
python3 scripts/integrations/package_tableu_plugin.py --version 1.0.2
```

The packager checks the source inventory and every checksum in
`package-lock.json`, and requires the locked archive bytes. The output is
`dist/plugins/app-6aba9d97f28c81918d45bb1b765f9cf0-1.0.2.zip`. Once
committed, this version is immutable: further edits need a new version
directory and lock (`--write-lock NAME --timestamp YYYY-MM-DD`).

See [the public listing runbook](../../public-listing.md) for the upload,
review and publication steps.
