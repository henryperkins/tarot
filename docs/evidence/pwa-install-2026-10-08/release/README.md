# PR #102 release review

This follow-up reviews `04403a3` and remediates confirmed regressions before
merging and deploying. The earlier [PR evidence](../fixes/README.md) remains
historical evidence; the results below are from the release review.

## Confirmed regressions

| Trigger | Original behavior | Remediation |
| --- | --- | --- |
| A reading dock's bottom safe-area padding grows after rendering | Content-box observation misses the extra padding; the reserved height stays stale and the install footer overlaps the dock. | Observe the dock's border box. |
| Pricing's upgrade dock gains bottom safe-area padding | Its measured height and page clearance stay stale. | Observe the upgrade dock's border box. |
| Journal receives a deep link that changes the active search filter | The requested entry is highlighted while the banner still says it is unavailable. | Derive the found state from the currently filtered entries. |
| Another tab hides an open iOS guide, then its snooze expires or its saved choice is cleared | The old guide opens again without a new activation and makes the page inert. | Clear the open-guide state when the control becomes hidden. |
| WebKit unlocks a fixed-body guide at the end of an enlarged landscape reading | The captured scroll position is not consistently restored, leaving the focused install action behind the dock. | Restore the captured position with an explicit instant scroll; preserve the existing opener focus behavior. |

The first four regressions were reproduced against the unchanged PR build before
their fixes. Reading and Pricing reflow cases failed in Chromium and WebKit at
100% and 200% text; Journal and cross-tab guidance cases failed in both engines.

The review comment alleging an omitted landscape dock offset does not match
the runtime: the dock's inline `bottom: 0` overrides that stylesheet offset.
Padding changes, rather than the alleged offset, caused the confirmed overlap.
The [dock review](dock-clearance.md) records the measured original geometry.

## Reproducing browser validation

`npm run test:e2e:install` runs the installation, cross-tab lifecycle, and page
state regressions with one worker, no retries, desktop Chromium, and touch
WebKit with the full iPhone profile. Without an origin override it starts Vite.
For a built HTTP preview:

```sh
INSTALL_BASE_URL=http://127.0.0.1:5196 npm run test:e2e:install
```

These tests mock application APIs and synthesize browser install offers. They
verify rendered frontend behavior, not real subscription authentication,
provider inference, or an operating system's installation dialog.
The reading fixture forwards streams to a local HTTP server. Direct HTTPS-origin
runs need a compatible fixture transport; production smoke must also intercept
application APIs so it does not create real reading jobs or user data.

## Verification

The final candidate build is `app-C37IMYFp.js`.

- Root Node suite: 2,942 passed, zero failures or skips.
- Final built-preview installation/state suite: 103 passed in 6.5 minutes
  (52 Chromium, 51 full-profile iPhone WebKit), with zero failures, skips,
  flaky results, or retries.
- Unchanged enlarged-landscape WebKit reading regression: eight consecutive
  passes against the actual final assets, without runtime overrides or retries.
- Real local-session guidance checks: six passed across Chromium/WebKit, guest
  Pricing, Pro Pricing, and Pro Journal. Escape restored focus and the captured
  scroll position; all five footer hit points stayed active without another
  scroll. Both Pro sessions logged out successfully, followed by unauthenticated
  `401` responses. [Sanitized results](authenticated-guide-checks.json),
  [guest Pricing focus](webkit-guest-pricing-focus.png), and
  [Pro Journal focus](webkit-pro-journal-focus.png) contain no account identity.
- Build, scoped ESLint for the PR's JavaScript and install configuration, and
  maintained documentation links passed. Full repository ESLint reproduces the
  identical unchanged-head report: 117 errors and 36 warnings, including legacy
  audit output and unrelated source errors.

The existing Journal expiry test now pauses its clock while the route and fonts
load, then advances the actual 50ms scroll and 3.2s expiry callbacks. It preserves
the viewport, highlight, history-consumption, and retained-batch assertions.
Cross-tab guidance tests settle the page and focus before their native pointer
activation; they use no forced clicks or retries.

Existing shared-modal checks passed for Pricing in both engines and Saved
Intentions in Chromium. The WebKit Saved Intentions opener-focus assertion
failed identically on pre-PR master `211c138` in desktop and iPhone profiles.
That pre-existing limitation is outside this PR's installation changes.

The initial unchanged-head run used desktop WebKit with an iPhone user agent
and produced 86 passes and one landscape focus-position failure. After
correcting the project to full iPhone emulation, that unchanged test passed
three consecutive baseline repetitions. The raw diagnostic run remains
separate from final qualification.

Physical mobile installation, VoiceOver/TalkBack, and touch keyboard behavior
remain unverified. Deployment must use the repository's normal subscription
release gate; GitHub Actions billing failures are not a release prerequisite.
