# Table Ambience — measurements and browser checks

Type: evidence
Status: measured and browser-tested locally; listening pass and Safari checks pending
Updated: 2026-11-18 UTC

This records the checks behind the Table Ambience remediation plan (`docs/superpowers/plans/2026-11-18-table-ambience.md`, reviewed at `d4b79797`). The work is on `fix/table-ambience`, run on a Windows 11 host with Node 24.15, Playwright 1.62.1, Chromium 151.0.7922.34 and WebKit 26.5.

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

The same nine ambience cases pass on the development server in Chromium, where React mounts the provider twice.

### WebKit and Safari: pending

WebKit 26.5 as shipped by Playwright for Windows cannot play MP3 on this host, as the review found. A muted control clip (`/sounds/flip.mp3`) and the ambience loop both stay at `readyState` 0 and `networkState` 2 with `play()` unsettled after three seconds, although `canPlayType('audio/mpeg')` answers `probably`. The five cases that read the loop's clock detect this with the control clip and skip in the WebKit project here, so there is no WebKit playback result yet. Where an engine does not refuse autoplay itself, the cases apply the same rule from the page's activation state so the recovery path is still exercised.

The three cases that need no playback (the switch following another tab, nothing loaded before an interaction, and blocked storage) run and pass in WebKit here.

Still to run:

- The WebKit project on a host whose WebKit plays the control clip (`npm run test:e2e:production -- --project=webkit --grep ambience`).
- A physical iPhone in Safari: a fresh visit with saved On, playback starting on the first tap, audible looping, and mute. Record the device and iOS version with the result.

## Automated checks

- `tests/audio.test.mjs` covers the player's recovery with a corrected audio double (a refused start now leaves it paused): a blocked start followed by a click, tap or keypress on the same loop; an interaction the browser still refuses; Off before the interaction; a refusal delivered after Off; rapid Off and On; late results from an earlier start; `AbortError` and `NotSupportedError`, which are not retried; and cleanup followed by a remount. Each guard was removed in turn to confirm a test fails without it. `tests/preferencesAmbience.test.mjs` runs the real provider and checks that a local choice starts or stops the player inside the call, before the next render.
- For choices made in another tab, `tests/preferencesAmbience.test.mjs` sends the provider `storage` events: Off, On, a removed key, cleared storage, an event older than the saved value, and a change to an unrelated key. It checks that nothing is written back and that the local switch still works when storage refuses the write. `tests/audio.test.mjs` checks that an On which waits for an interaction creates no player and plays nothing until one arrives, that Off cancels the wait, and that a loop already playing is left alone. Eleven changes to the new code were each caught by a test.
- `tests/audio.test.mjs` decodes the asset and asserts the played level (−44 dBFS ± 3 dB at the volume the player sets), a subsonic share under 1% with no DC offset, and a loop that starts and ends at its own level. All three failed against the previous track (−66.5 dBFS played, 99.93% subsonic, and a first 20 ms at −67.4 dBFS against −52.6 dBFS for the loop); the third also failed against the new mix with its Info frame removed (first 20 ms at −82.6 dBFS).
- The production activation test now expects a versioned ambience request. It failed against the `d4b79797` build and passes against the new one. Sound files are still requested only after the switch is turned on.
- The narration specs that use this MP3 as fixture audio pass in Chromium with the new file (22 of 22, as before).
