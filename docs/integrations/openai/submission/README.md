# Generated Submission Packages

Type: index
Status: active reference
Last reviewed: 2026-10-23

These folders are generated, not authored. `1.0.1` through `1.0.3` are built from their versioned `package-lock.json` by [`scripts/integrations/package_tableu_plugin.py`](../../../../scripts/integrations/package_tableu_plugin.py) and are consumed by `tests/tableuPluginPackaging.test.mjs`.

Do not edit files in these folders by hand. Rebuild a package instead:

```powershell
python scripts/integrations/package_tableu_plugin.py --version 1.0.3
```

Byte-for-byte rebuilds of the historical ZIPs require reference zlib. On native Windows, use CPython 3.13.17 with zlib 1.3.1. The packaging tests invoke `python3` from `PATH`. Run `python3 -c "import zlib; print(zlib.ZLIB_RUNTIME_VERSION)"` to check that interpreter's compressor.

The Markdown files inside a package are payload for the ChatGPT plugin. They may not follow this repository's documentation metadata or `H1` conventions, and they are intentionally excluded from documentation indexes.
