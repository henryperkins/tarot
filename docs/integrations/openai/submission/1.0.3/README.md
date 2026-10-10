# Tableu 1.0.3 submission package

The public-release package, 1.0.2, with review fixes. Test case 4 now
starts, checks and cancels a Celtic Cross reading in a single message. As two
messages, the reading, which takes about a minute, usually finished before the
follow-up arrived, so the cancellation could not be observed. The reading
guide no longer tells ChatGPT to write its own reading after a backend reading
fails or is withheld, labels app-only features as the app's, and no longer
suggests claiming a card's history. The tool contract's header names both
packages. Everything else is unchanged, including instructions 0.29.0,
`commerce: false` and `countries: []`.

The package does not set `review.demo_recording_url`, so the portal keeps its
saved demo link. Set it in a new version once the recording is hosted.

Build from the repository root:

```sh
python3 scripts/integrations/package_tableu_plugin.py --version 1.0.3
```

The packager checks the source inventory and every checksum in
`package-lock.json`, and requires the locked archive bytes. The output is
`dist/plugins/app-6aba9d97f28c81918d45bb1b765f9cf0-1.0.3.zip`.

See [the public listing runbook](../../public-listing.md) for the upload,
review and publication steps.
