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

### WebKit and Safari: pending

WebKit 26.5 as shipped by Playwright for Windows cannot play MP3 on this host, as the review found. A muted control clip (`/sounds/flip.mp3`) and the ambience loop both stay at `readyState` 0 and `networkState` 2 with `play()` unsettled after three seconds, although `canPlayType('audio/mpeg')` answers `probably`. The three real-media cases detect this with the control clip and skip in the WebKit project here, so there is no WebKit playback result yet. Where an engine does not refuse autoplay itself, the cases apply the same rule from the page's activation state so the recovery path is still exercised.

Still to run:

- The WebKit project on a host whose WebKit plays the control clip (`npm run test:e2e:production -- --project=webkit --grep ambience`).
- A physical iPhone in Safari: a fresh visit with saved On, playback starting on the first tap, audible looping, and mute. Record the device and iOS version with the result.

## Automated checks

- `tests/audio.test.mjs` covers the player's recovery with a corrected audio double (a refused start now leaves it paused): a blocked start followed by a click, tap or keypress on the same loop; an interaction the browser still refuses; Off before the interaction; a refusal delivered after Off; rapid Off and On; late results from an earlier start; `AbortError` and `NotSupportedError`, which are not retried; and cleanup followed by a remount. Each guard was removed in turn to confirm a test fails without it. `tests/preferencesAmbience.test.mjs` runs the real provider and checks that a local choice starts or stops the player inside the call, before the next render.
- `tests/audio.test.mjs` decodes the asset and asserts the played level (−44 dBFS ± 3 dB at the volume the player sets), a subsonic share under 1% with no DC offset, and a loop that starts and ends at its own level. All three failed against the previous track (−66.5 dBFS played, 99.93% subsonic, and a first 20 ms at −67.4 dBFS against −52.6 dBFS for the loop); the third also failed against the new mix with its Info frame removed (first 20 ms at −82.6 dBFS).
- The production activation test now expects a versioned ambience request. It failed against the `d4b79797` build and passes against the new one. Sound files are still requested only after the switch is turned on.
- The narration specs that use this MP3 as fixture audio pass in Chromium with the new file (22 of 22, as before).
