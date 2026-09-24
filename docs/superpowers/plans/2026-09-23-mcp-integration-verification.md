# MCP integration verification — 2026-09-23

Local candidate: `d3dd76723c7856fcef6c9d26440b2571eb9f0654`, integrating
`origin/master` at `3946e1ada5fda13d93d82c34719ce267881f9825`.
This record supersedes historical branch test counts. Publication and release
remain pending; it does not establish production OAuth/MCP availability.

## Integrated behavior

The Worker OAuth/MCP implementation replaces the standalone adapter and its CI
consumers. Personal HTTP journal clients retain append/replace, repeated append,
raw whitespace and line endings, `entry.id`, ownership, atomic seed admission and
409 conflict behavior. MCP selects a trusted internal append-only policy, deduplicates
exact retries, enforces its cumulative target limit, and preserves canonical card
identity alongside reusable Thoth display labels. Both interfaces use bounded
compare-and-swap writes. Synthetic service accounts cannot use personal journals.

## Candidate checks

| Check | Result |
| --- | --- |
| Root `npm test` on `d3dd767` | 2,164 passed, zero failures/skips. |
| Compatibility suite during integration | 136 passed; includes whitespace, replacement, retry, concurrency and seed admission regressions. |
| Final `npm run test:e2e:journal` | Four passed: 1440/390/320px RWS and 390px Thoth, actual Worker MCP tools against local fixture storage. |
| `npm run test:deploy` | 11 passed on `0e9ed34`. |
| `npm run lint:cloudflare`, `npm run build` | Passed on `0e9ed34`; existing large-chunk advisory remains. |
| Wrangler `deploy --dry-run --config wrangler.jsonc` | Passed with Wrangler 4.118.0 on `0e9ed34`; no resources created or deployment performed. |
| Full ESLint on `d3dd767` | 146 errors / 37 warnings. Exact file/rule/severity/message comparison against clean master has zero differences. Full lint remains failing. |
| Local narrative QA | Fails on the Spanish sample because local-composer supports English only. Clean master reproduces the same failure. No provider or threshold change was used. |

`d3dd767` differs from `0e9ed34` only in a service comment, unused test bindings,
and the Playwright workflow's Node 24 pin. Runtime dependencies and executable
service behavior are unchanged. Unit and journal browser checks were repeated on
the final source candidate.

## Real local Worker proof

The built Worker at `0e9ed34` ran independently at
`http://localhost:8787/mcp`. Local migrations through 0031 were applied to disposable
storage. The config omitted the remote-only AI binding and retained Worker-first
asset routing. Fresh synthetic owner/session/entitlement fixtures were local only.

The browser and SDK exercised real discovery, authorization navigation, consent,
PKCE S256 and token exchange; all eight authenticated tools; app/MCP owner identity
parity; a local-composer draw/wait; save plus exact retry; card and whole-reading
reflections plus retries; and signed-in journal rendering. The narrative was
unchanged, orientations and Thoth labels survived, and retries added no duplicate
entry or reflection. Removing the allowlist then rejected the existing token
with HTTP 401. OAuth routing's browser test also passed.

Temporary credentials, callback listener, OAuth/PKCE files and local D1/KV state
were removed. Proof artifacts contain check names and synthetic reading content,
not tokens or user identifiers. Production entitlements were not touched.

## Evidence and remaining gates

Local command logs and structured records are in
`C:/Users/htper/AppData/Local/Temp/tarot-integration-b3d08059115b417aa797f86583e7d874`:
`commands.jsonl`, `mcp-unit-final.txt`, `mcp-journal-final.txt`,
`mcp-local-proof-final.txt`, `mcp-local-proof.json`,
`mcp-lint-comparison.json`, and `mcp-narrative-gate-final.txt`.

Fresh code review found no Critical MCP issue. One Minor remains deferred: after
an expired-job lookup clears state, a subsequent save lookup gets 404 without the
410 response's payload-save instructions. Explicit payload saving still works;
this is recovery guidance, not an ownership or write-safety failure.

Vision QA has no completed result in this pass. Full-lint debt and the unsupported
local narrative sample remain explicit gates. Before publication,
obtain the plan's separate owner decisions for OAuth KV and GitHub publication,
refresh the candidate against the chosen integration base, and follow the MCP
runbook. Production migrations 0030/0031, deployment, and rendered live proof are
separate pending steps. Local emulation is not a ChatGPT or production handshake.
