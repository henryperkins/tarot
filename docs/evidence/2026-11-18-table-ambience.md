# Table Ambience — measurements and browser checks

Type: evidence
Status: Playback verified in Chromium and Linux WebKit. Listening on physical speakers, headphones and iPhone Safari is pending.
Updated: 2026-11-19 UTC

The November 18 checks for the Table Ambience remediation plan (`docs/superpowers/plans/2026-11-18-table-ambience.md`, reviewed at `d4b79797`) ran on `fix/table-ambience` on a Windows 11 host with Node 24.15, Playwright 1.62.1, Chromium 151.0.7922.34 and WebKit 26.5.

## November 19 follow-up

Table Ambience now controls the room loop, card sounds, scene transitions and reading chimes. Reader Voice controls speech independently. Settings keeps the saved On choice and displays a playback error beside the switch when the loop fails. A reconnect retries the loop. An On choice received from another tab waits for input in the receiving tab. [Offline Settings screenshot](2026-11-19-table-ambience-retry.png)

The cue file contains eight sounds in 11.2 seconds of decoded audio and weighs 180,139 bytes. The browser requests it on the first enabled cue. At the scene's 0.08 gain, the sustained reading tone measures −47.0 dBFS RMS alongside the room loop at −44.0 dBFS. Regeneration reproduced both files byte for byte. [Cue generator](../../scripts/audio/generateCinematicSprite.mjs) · [Cue player](../../src/lib/SoundManager.js)

All 35 production browser cases passed in Windows Chromium and all 35 passed in Linux WebKit using the iPhone 13 profile. The checks included actual MP3 playback, cue offsets in the decoded sprite, a failed download followed by reconnection, muting across tabs during a reading, and completion after text streamed in. Windows Playwright WebKit left a standalone MP3 at zero elapsed time and exposed no Web Audio context. [Production cases](../../e2e/initial-loading.spec.js)

All 101 focused audio, preference and account checks passed. The full Windows Node suite passed 6,412 tests and skipped 32. Its 67 failures matched the pre-change run by test name and source location. Returning guests loaded 1,049,626 decoded JavaScript bytes in Chromium, and new guests loaded 1,112,870. Both passed the 1,180,000-byte startup budget. [Startup budget test](../../e2e/initial-loading.spec.js)

All 35 Chromium narration checks passed on rerun. Windows WebKit had 10 narration failures per profile on desktop and emulated iPhone. Its particle-canvas check also failed on both the pre-change and current builds. [Narration suite](../../playwright.narration.config.js)

### PR review verification

Three production tests failed on `7d430b72`. Replay Tutorial stayed closed after its loading dialog was dismissed, a Celtic Cross reveal played the remaining deals after another tab muted and unmuted the table, and pending cues started in Settings after the reader left the table. The tests hold the tutorial or audio download open, or advance the deal timers, to exercise each sequence. With the fixes, all 38 production cases passed in Windows Chromium and all 38 passed in Linux WebKit with the iPhone 13 profile. [Production regressions](../../e2e/initial-loading.spec.js)

The room loop and the cue player now handle a reconnect arriving on either side of a media failure. The loop retries automatically, and the cue file retries when the next enabled cue requests it. All 115 focused tests passed. All 24 onboarding exit tests passed across Chromium, desktop WebKit and the iPhone WebKit profile, including focus returning to the button that opened a canceled confirmation. [Room loop tests](../../tests/audio.test.mjs) · [Cue tests](../../tests/soundManager.test.mjs) · [Onboarding exit tests](../../e2e/onboarding-exit-focus.spec.js)

Chromium loaded 1,112,764 decoded JavaScript bytes for a new guest and 1,049,423 for a returning guest. Both paths enforce the same limit of less than 1,180,000 bytes. Adding 150,000 bytes to the onboarding chunk in a test build passed the old check. The corrected check rejected the final padded build at 1,262,764 bytes. [Startup budget tests](../../e2e/initial-loading.spec.js)

The full Windows Node suite passed 6,417 tests, skipped 32 and failed 67. Running the affected files on the original PR commit with the same fixture bytes reproduced all 67 failures by test name and source location.

## The loop

`public/sounds/ambience.mp3` is now rendered by `node scripts/audio/generateAmbience.mjs`. The script synthesizes a low-mid room tone, three card-handling sounds (a riffle and bridge at 6.6 s, an overhand shuffle at 16.9 s, two cards dealt at 24.6 s) and about eleven small clusters of candle crackle, with a short room reverb on the table sounds. It is seeded, and a rerun reproduced the committed file byte for byte. The format matches the track it replaces: MPEG-1 Layer III, mono, 44.1 kHz, 128 kbps.

Both files were decoded with mpg123 and measured over their whole length. Band levels are sums of a Welch spectrum (Hann windows of 65,536 samples, half overlapping), which keeps the old file's subsonic content from leaking into its audible band.

| Decoded file | Previous track | New mix |
|---|---|---|
| Length | 30.041 s | 30.000 s |
| 20 Hz–20 kHz RMS | −52.55 dBFS | −30.00 dBFS |
| at the player's 0.2 base volume | −66.53 dBFS | −43.98 dBFS |
| at the loudest reading swell (0.36) | −61.42 dBFS | −38.88 dBFS |
| Energy below 20 Hz | 99.93% | 0.0011% |
| DC offset | 0.074 | 0.000006 |
| Peak | −17.45 dBFS | −7.61 dBFS |
| A-weighted RMS | −59.75 dBFS | −33.30 dBFS |
| 300 Hz–4 kHz RMS | −59.03 dBFS | −32.81 dBFS |
| SHA-256 (first 16 hex digits) | `583ea4cd244f7c4a` | `4cff0af0c835dc29` |

The previous-track figures reproduce the review's 99.92% and −66 dBFS.

The loudest 400 ms of the new mix in the speech band (the riffle) is −27.4 dBFS in the file, or −36.3 dBFS at the loudest swell; the median is −42.4 dBFS there. Narration level was not measured. If it sits near −20 dBFS RMS, that leaves about 16 dB at the worst moment and 22 dB typically.

## Listening result: pending

Nobody has listened to this mix. It was built from measurements and spectrograms, which can confirm level, balance and structure but not whether the textures are recognizable or pleasant. The plan's listening pass still has to be done by a person:

1. Play two full loops at a fixed volume on speakers, then on headphones. The room tone, card sounds and crackle should each be recognizable, and the repeat every 30 seconds should not draw attention.
2. Play a spoken passage over the loudest reading swell (0.36). Every word should be easy to follow.
3. On an iPhone, check the level in particular. iOS Safari treats an audio element's `volume` as read-only ([WebKit bug 241657](https://bugs.webkit.org/show_bug.cgi?id=241657); reported again on iOS 17.4.1 in [media-chrome discussion 913](https://github.com/muxinc/media-chrome/discussions/913)). If that still holds, the player's 0.2 base volume and the reading swells do nothing there, and the loop plays at the file's own level: −30 dBFS RMS, 14 dB above what a desktop browser plays, with crackle peaks at −7.6 dBFS. The previous track was close to silent on a phone either way. This was not measured on a device.

The −44 dBFS target is the plan's starting value, and the unit test's ±3 dB tolerance is derived from that target rather than from a listening-tested mix. If the listening pass changes the mix, adjust the constants at the top of the generator, rerun it, bump the `v=` query in `src/lib/audio.js`, and update `AMBIENCE_PLAYED_DBFS` in `tests/audio.test.mjs` to the new measured level.

## Loop point

A looping `<audio>` element was recorded through Web Audio in headless Chromium.

- A 1 kHz test tone encoded the same way, without gapless information, repeats with 39–42 ms of silence: the encoder's delay and padding. With a leading Info frame that declares them, Chromium reports the exact duration and the silence falls to about 10 ms.
- The new asset carries that Info frame. Chromium reports 30.000 s, and the repeat shows one dip of at most 18 ms (2 ms frames more than 20 dB under the median) with no step larger than the mix's own transients.
- The previous asset reports 30.041 s and puts a step of 0.053 full scale through its repeat, where its DC offset meets the gap.

The room tone is crossfaded into its own continuation over two seconds, every slow movement completes whole cycles per loop, and no table sound falls within 0.75 s of the loop point (the script fails if one does). Firefox and Safari loop behavior was not measured.

## Cached copies

A persistent Chromium profile with service workers enabled visited the build from `d4b79797`, served with `Cache-Control: public, max-age=31536000, immutable` on `/sounds/`, and turned ambience on. The old bytes were then present in both the HTTP cache and the `tableu-shell-v7` cache. The same origin was switched to the new build and the page reopened:

- The first activation requested `/sounds/ambience.mp3?v=2` and received the new bytes (`4cff0af0…`); the player reported 30.000 s.
- A request for the unversioned `/sounds/ambience.mp3` in that profile still returned the old bytes (`583ea4cd…`), which is the case the version query exists for.

Production cache headers were not inspected; the check models the worst case of a long-lived cached copy.

## A saved On preference after autoplay is refused

The recovery was checked under each browser's own autoplay policy, in a fresh tab with `tarot-ambience-enabled` saved as `true`. Nothing was evaluated in the page before the app's first start attempt, because Playwright's `evaluate()` runs with an emulated user gesture and would lift the policy. Every `play()` call and its outcome were logged.

| Browser | Build | On load | After one click on the page heading | After Space on the switch |
|---|---|---|---|---|
| Chromium 151.0.7922.34 (Playwright headless shell) | `d4b79797` | ambience refused, `NotAllowedError` | only the silent unlock clip starts; clock stays at 0 | — |
| Google Chrome 157.0.8103.79 | `d4b79797` | refused | unlock clip only; clock at 0 | — |
| Microsoft Edge 158.0.4370.26 | `d4b79797` | refused | unlock clip only; clock at 0 | — |
| Chromium 151.0.7922.34 | new | refused; switch On, loop paused at 0 | the same loop starts; clock at 0.85 s | paused at 0.86 s, unchanged 0.6 s later |
| Google Chrome 157.0.8103.79 | new | refused; paused at 0 | starts; 0.85 s | paused at 0.85 s, unchanged |
| Microsoft Edge 158.0.4370.26 | new | refused; paused at 0 | starts; 0.84 s | paused at 0.85 s, unchanged |

The old-build rows reproduce the review. The browsers ran headless and muted.

The production browser suite now holds three cases for this (`a saved ambience preference starts playing on the first interaction`, `a keyboard toggle to Off pauses ambience and stops its clock`, `turning ambience on with the switch starts playing inside that interaction`). In Chromium they run under the browser's own policy; the first two fail against the `d4b79797` build with the clock at 0 and pass against the new build, including on the development server, where React mounts twice and the first loop is released without playing. The third also passes on the old build, where Chromium ran the start inside the keypress.

## Mute across tabs

Tabs of one browser profile share `tarot-ambience-enabled`. A tab now applies a choice made in another when the browser's `storage` event arrives: it reads the saved value, moves its own switch, and stops or arms its own player. It does not write the value back. A removed key or cleared storage reads as Off.

- Off stops a playing loop and cancels a start that was waiting for an interaction.
- On moves the switch but starts nothing. The receiving tab creates and plays its loop on the reader's next click, tap or keypress there, so enabling ambience in one tab does not start a second loop behind it. Until then that tab does not request the file.

The production browser suite checks this with two pages in one Playwright context. The second page's own switch does the writing, so the first page receives real `storage` events, and each page's real `Audio` elements are read directly.

| Case | `d4b79797` build, Chromium | New build, Chromium | New build, WebKit |
|---|---|---|---|
| `an ambience choice made in another tab moves the switch here without saving it again` | fails: the first tab's switch stays Off | passes | passes |
| `ambience turned on in another tab is not loaded here until an interaction` | fails: the switch stays Off | passes | passes |
| `ambience muted in another tab stops here, and turned back on there it waits for an interaction here` | fails: the first tab stays On after the second mutes | passes | skipped, no MP3 playback |
| `ambience muted in another tab cancels a start that was waiting for an interaction here` | fails: the first tab stays On | passes | skipped, no MP3 playback |
| `the ambience switch still works when the browser blocks storage` | passes | passes | passes |

The third case is the review's reproduction: enable in one tab, mute in the other, and the first still shows On. On the new build both switches show Off, the first tab's clock stops and stays stopped through a later click, and after the second tab turns ambience back on the first shows On with its loop still paused until it is clicked. The fourth case repeats this with the first tab's saved preference refused on load and still waiting: the mute cancels that wait, and the click it was waiting for leaves the loop at 0.

The first case also removes the key and clears storage from the second tab (both turn the first tab's switch Off) and confirms the first tab never wrote the setting itself. The last case makes `window.localStorage` throw, as a browser with site data blocked does, and passed on the old build too: it guards the new code rather than reproducing a fault.

Each guard was removed in turn, the app rebuilt, and the five cases rerun in Chromium:

| Change to the new code | Case that fails |
|---|---|
| Off no longer cancels a waiting start | the fourth: the loop starts on the next click |
| A received On starts playing at once | the second, third and fourth |
| A received On creates the loop before an interaction | the second |
| A received choice is written back | the first |
| Cleared storage is ignored | the first |
| A received Off moves the switch but leaves the player alone | the third and fourth |
| The switch gives up when storage refuses the write | the fifth |

An eighth change, taking the value from the event instead of reading the store, passes all five: in a browser the two agree. The unit test that delivers an event older than the saved value catches it.

The same nine ambience cases pass on the development server in Chromium, where React mounts the provider twice. They also pass in installed Google Chrome 157.0.8103.79 and Microsoft Edge 158.0.4370.26, run headless against the production build with a copy of the production configuration that selects the browser channel.

## WebKit and Safari: pending

WebKit 26.5 as shipped by Playwright for Windows cannot play MP3 on this host, as the review found. A muted control clip (`/sounds/flip.mp3`) and the ambience loop both stay at `readyState` 0 and `networkState` 2 with `play()` unsettled after three seconds, although `canPlayType('audio/mpeg')` answers `probably`. The five cases that read the loop's clock detect this with the control clip and skip in the WebKit project here, so there is no WebKit playback result yet. Where an engine does not refuse autoplay itself, the cases apply the same rule from the page's activation state so the recovery path is still exercised.

The three cases that need no playback (the switch following another tab, nothing loaded before an interaction, and blocked storage) run and pass in WebKit here.

Still to run:

- The WebKit project on a host whose WebKit plays the control clip (`npm run test:e2e:production -- --project=webkit --grep ambience`).
- A physical iPhone in Safari: a fresh visit with saved On, playback starting on the first tap, audible looping, and mute. Record the device and iOS version with the result.

## Guest settings copy

The guest banner on `/account` now reads “Your theme and audio preferences stay on this device, even when you’re signed in.” The line it replaces ended “until you sign in”, which promised a sync that does not exist and contradicted the “Device only” label on the Audio section below it.

- The account payload carries six personalization fields: `displayName`, `readingTone`, `spiritualFrame`, `tarotExperience`, `preferredSpreadDepth` and `focusAreas`. `tests/accountPreferencesClient.test.mjs` now also hands the payload builder theme and audio settings and checks that none is sent. Adding `ambienceOn` to the supported fields makes that test fail.
- The guest account test (`guest section navigation only offers existing settings targets`) asserts the new sentence and the Audio section’s “Device only” label. It failed against the old copy and passes now, in Chromium on the development server.
- In a production build at 390 px in both themes, and at 320 px with 200% text, the sentence wraps inside the banner with no horizontal overflow, and the Audio section shows “Device only” beside its heading.

## Automated checks

- `tests/audio.test.mjs` covers the player's recovery with a corrected audio double (a refused start now leaves it paused): a blocked start followed by a click, tap or keypress on the same loop; an interaction the browser still refuses; Off before the interaction; a refusal delivered after Off; rapid Off and On; late results from an earlier start; `AbortError` and `NotSupportedError`, which are not retried; and cleanup followed by a remount. Each guard was removed in turn to confirm a test fails without it. `tests/preferencesAmbience.test.mjs` runs the real provider and checks that a local choice starts or stops the player inside the call, before the next render.
- For choices made in another tab, `tests/preferencesAmbience.test.mjs` sends the provider `storage` events: Off, On, a removed key, cleared storage, an event older than the saved value, and a change to an unrelated key. It checks that nothing is written back and that the local switch still works when storage refuses the write. `tests/audio.test.mjs` checks that an On which waits for an interaction creates no player and plays nothing until one arrives, that Off cancels the wait, and that a loop already playing is left alone. Eleven changes to the new code were each caught by a test.
- `tests/audio.test.mjs` decodes the asset and asserts the played level (−44 dBFS ± 3 dB at the volume the player sets), a subsonic share under 1% with no DC offset, and a loop that starts and ends at its own level. All three failed against the previous track (−66.5 dBFS played, 99.93% subsonic, and a first 20 ms at −67.4 dBFS against −52.6 dBFS for the loop); the third also failed against the new mix with its Info frame removed (first 20 ms at −82.6 dBFS).
- The production activation test now expects a versioned ambience request. It failed against the `d4b79797` build and passes against the new one. Sound files are still requested only after the switch is turned on.
- The narration specs that use this MP3 as fixture audio pass in Chromium with the new file (22 of 22, as before).

## Verification run

The plan's six commands, run from the repository root at `82c40d30`. Other jobs were using the machine during the last two, with the processor near 90%.

| Command | Result |
|---|---|
| `node --test tests/audio.test.mjs tests/audioLifecycle.test.mjs tests/audioReliability.test.mjs tests/accountPreferencesClient.test.mjs` | 66 of 66 pass |
| `npm run build:frontend` | builds |
| `npm run test:e2e:production -- --grep ambience` | Chromium: 9 of 9 pass. WebKit: 3 pass, 5 skipped, 1 fails |
| `npm run test:e2e -- e2e/account-plan-hardening.spec.js --project=chromium --grep "guest section navigation"` | 1 of 1 passes |
| `npx playwright test --config playwright.narration.config.js e2e/narration-cancellation.spec.js e2e/narration-lifecycle.spec.js` | Chromium: 22 of 22 pass. WebKit desktop: 12 pass, 10 fail. WebKit iPhone: 12 pass, 10 fail |
| `npm test` | 6,476 tests: 6,321 pass, 131 fail, 24 skipped |

Every failure above also fails at `d4b79797` on this host:

- The WebKit failure in the production suite is `ambience is fetched on activation and the setting can be switched off again`. This host's WebKit never requests the MP3. The five skipped cases are the ones that read the loop's clock.
- The 20 narration failures are the same 20 WebKit tests as before the change.
- The 131 unit failures are the same 131 as before the change, in 23 files, none of them audio, preference or account tests.

The first `npm test` run of this set had one more failure: the Chromium half of `tests/particleLifecycleBrowser.test.mjs` timed out after 10 seconds loading its page. That test starts its own Vite server and loads none of the files changed here. Run alone straight afterwards it timed out the same way once, then passed, and it passed in the rerun reported above.

## Scope limits of the November 18 checks

- How the mix sounds. Nobody has listened to it.
- Playback in WebKit or Safari on any device, and the level on an iPhone.
- Firefox, in any respect.
- The cache headers production sends for `/sounds/`.
- Narration level against the loop at its loudest swell. The 16 dB figure assumes narration near −20 dBFS RMS.
- A page restored from the browser's back/forward cache. It receives no `storage` event for a change made while it was frozen, so its switch can be stale until the setting changes again or the page reloads. Playwright runs Chromium with that cache disabled.
- Two tabs that have both been interacted with while ambience is on. Each plays its own loop, as before this work; turning ambience off in either now stops both.
