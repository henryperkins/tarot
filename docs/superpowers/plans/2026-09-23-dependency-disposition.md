# Dependency proposal disposition — 2026-09-23

Local source candidate: `ed4c633` (`chore/refresh-unmerged-dependencies`), based on
`3946e1a` (`origin/master`). None of the seven GitHub PRs was changed or closed.

| Proposal | Disposition and local replacement |
| --- | --- |
| [#62](https://github.com/henryperkins/tarot/pull/62), Node 25 types | Replace with exact `@types/node` 24.13.6 in `27e8a26`, matching Node 24 CI/runtime. |
| [#63](https://github.com/henryperkins/tarot/pull/63), React Router 7.14.2 | Superseded: master already resolves 7.18.2. Retain its later fixes. |
| [#64](https://github.com/henryperkins/tarot/pull/64), Vite 8.0.10 | Defer the major migration. Retain Vite 7.3.6; evaluate Rolldown/Oxc and plugin compatibility as a separate change. |
| [#65](https://github.com/henryperkins/tarot/pull/65), Playwright 1.59.1 | Superseded: master already resolves 1.62.1. No browser package change here. |
| [#66](https://github.com/henryperkins/tarot/pull/66), focus-trap-react 12.0.1 | Defer the 12.0.3 trial. Retain master's 11.0.6/focus-trap 7.8.0 in `ed4c633`. Trial `27e8a26` remains at `chore/defer-focus-trap-major`. |
| [#67](https://github.com/henryperkins/tarot/pull/67), grouped root updates | Superseded: master has jsPDF 4.2.1, PostCSS 8.5.25, Vite 7.3.6 and Wrangler 4.118.0, meeting or exceeding all proposed versions. |
| [#68](https://github.com/henryperkins/tarot/pull/68), MCP package locks | Split by architecture: adapter updates are superseded by its retirement in MCP `0e9ed34`; symbolism lock refresh is in `27e8a26`; ephemeris lock refresh is preserved separately at `f5506c2` and remains unverified. |

The two surviving plugin lock refreshes retain their SDK manifest range and update
only six transitive packages: `@hono/node-server` 1.19.17, `ajv` 8.20.0,
`express-rate-limit` 8.7.0, `hono` 4.13.8, `ip-address` 10.7.2 and
`path-to-regexp` 8.4.2. The ephemeris refresh is excluded from this branch:
`npm ci` cannot build the unchanged `sweph` native module without Visual Studio
C++ tools, and its test consequently cannot import that module. No system build
toolchain was installed.

## Migration review

The [Vite 8 migration guide](https://vite.dev/guide/migration) describes the
Rolldown/Oxc changes; they warrant separate integration. The
[focus-trap-react release notes](https://github.com/focus-trap/focus-trap-react/releases)
identify v12's `onPostActivate` timing change and subsequent visibility fixes.
The application has no `onPostActivate` callback. Review found the old planned
test skipped WebKit and lacked nested-focus assertions. A new real nested test
passed Chromium but failed WebKit when dismissing the restored parent. This has
not been attributed to the upgrade: further modal investigation is deferred to
keep this integration bounded. The major upgrade is excluded from the accepted
candidate, and its test/evidence is retained locally. The current
[React Router changelog](https://reactrouter.com/changelog) and
[Playwright release notes](https://playwright.dev/docs/release-notes) were reviewed
before deciding that the older proposals were superseded.

Plugin transitive updates were checked against their maintainers' release notes:
[Hono](https://github.com/honojs/hono/releases/tag/v4.13.8),
[Node adapter](https://github.com/honojs/node-server/releases/tag/v1.19.17),
[Ajv](https://github.com/ajv-validator/ajv/releases),
[express-rate-limit](https://github.com/express-rate-limit/express-rate-limit/releases),
[ip-address](https://github.com/beaugunderson/ip-address/releases), and
[path-to-regexp](https://github.com/pillarjs/path-to-regexp/releases/tag/v8.4.2).

## Verification

Root `npm ci`, 2,000 unit tests, 11 deploy tests, Cloudflare command lint, Vite
build, and Wrangler bundle dry run passed on the original trial package tree.
Symbolism `npm ci` and its server test passed. Fresh install, all **2,000 unit
tests**, and build also passed on the narrowed `ed4c633` candidate. Focus packages
now exactly match master, so this candidate introduces no modal/runtime-library
migration. QA limits are recorded in the overall integration checkpoint.

Publication, PR closure, and remote branch deletion remain pending.
