# Table Ambience remediation plan

Readers should hear a quiet table soundscape when they enable it. On a return visit, the first eligible interaction should start the loop if the browser blocked autoplay. Turning ambience off should silence every open Tableu tab in the same browser profile.

The November 18 review used revision `d4b79797`. The four tasks below have individual acceptance checks. The playback and tab changes share the same preference, so implement task 2 before task 3.

## 1. Make the loop audible at the existing playback volume

The current 30-second MP3 puts 99.92% of its energy below 20 Hz. Its 20 Hz–20 kHz content measures about −66 dBFS RMS after the player’s 0.2 base gain. [Current asset](../../../public/sounds/ambience.mp3) · [Player](../../../src/lib/audio.js)

- [ ] Mix an original room tone with occasional paper shuffles and candle crackles. Remove DC and subsonic energy, blend the loop boundary, and export a roughly 30-second MP3 at the existing file path. Add a version query to the player URL so a client that cached the old URL requests the revised mix. Update the player unit test’s exact URL expectation. [Service worker](../../../public/sw.js) · [Player tests](../../../tests/audio.test.mjs)
- [ ] Decode the exported MP3 and repeat the full-file measurements. Use roughly −44 dBFS RMS in the audible band after the 0.2 gain as a starting mix target. Listen on speakers and headphones at a fixed volume for two loops, then play a spoken passage over the loudest reading swell. The textures should be recognizable, the loop boundary unobtrusive, and every word easy to follow. Record the final measured level and subsonic energy share alongside the listening result. [Reading swell levels](../../../src/hooks/useAudioController.js)
- [ ] Add an audible-band level assertion against the decoded asset, using a tolerance derived from the listening-tested mix that would fail the original track. Preserve lazy loading while Off. Check that a browser with the previous asset cached gets the new bytes on its first activation after the update.

## 2. Recover a saved On preference after autoplay is blocked

Chrome restored the switch as On, rejected the initial `play()` with `NotAllowedError`, and played only the silent unlock clip on the next click. The ambience clock stayed at zero. [Audio lifecycle](../../../src/lib/audio.js) · [Preference provider](../../../src/contexts/PreferencesContext.jsx)

- [ ] Start an explicit local On action on the ambience element inside the switch interaction. On page load, attempt a saved On preference once. If autoplay is blocked, retain that intent and call `play()` on the same element during the next eligible click, tap, or keypress. The retry must also work after narration has already unlocked.
- [ ] Clear the pending retry and its listeners on success, Off, or cleanup. Guard against late promises from earlier attempts and duplicate listeners after a remount. Treat interrupted or unsupported media separately from autoplay denial so unrelated gestures do not keep retrying a broken file.
- [ ] Correct the unit-test audio double so a rejected start leaves it paused. Cover blocked restore followed by a gesture, Off before the gesture, rapid Off/On, a late rejection, and cleanup followed by remount. In the browser, restore On in a fresh tab under normal autoplay policy. After one ordinary interaction, verify the real player’s `currentTime` advances. Verify a keyboard toggle to Off pauses it and its clock stops. [Player tests](../../../tests/audio.test.mjs) · [Browser activation test](../../../e2e/initial-loading.spec.js)

## 3. Honor mute across tabs

The review reproduced two tabs sharing a stored value of `false` while the first tab still showed On and continued playing. [Preference provider](../../../src/contexts/PreferencesContext.jsx)

- [ ] Separate writing a local choice from applying one received through the browser’s `storage` event. Use the existing `tarot-ambience-enabled` key and safe storage access. On a matching event, read the latest value and update the receiving switch without writing the value back. Treat key removal or cleared storage as Off. Verify the local switch still works when the browser blocks storage.
- [ ] Apply a remote Off to both a playing loop and a pending gesture retry. A remote On updates the receiving switch and waits for a gesture in that tab. This lets a reader enable ambience in one tab without starting a second background loop.
- [ ] Use two pages in one Playwright browser context. Enable in A, mute in B, and verify both switches show Off, A’s clock stops, and a later gesture cannot restart it. Repeat with A waiting for autoplay permission. Re-enable in B and verify A stays silent until an interaction there. Exercise these transitions with real storage events. [Browser suite](../../../e2e/initial-loading.spec.js)

## 4. Correct the guest settings copy

- [ ] Change the guest banner to “Your theme and audio preferences stay on this device, even when you’re signed in.” Check it beside the Audio section’s “Device only” label on `/account`. Add the copy assertion to the existing guest account test and verify the account preference payload still contains only supported fields. [Account page](../../../src/pages/AccountPage.jsx) · [Guest account test](../../../e2e/account-plan-hardening.spec.js) · [Account payload tests](../../../tests/accountPreferencesClient.test.mjs)

## Verification

Run these from the repository root after implementation. Give the new production browser cases names containing `ambience` so the focused command picks them up.

```sh
node --test tests/audio.test.mjs tests/audioLifecycle.test.mjs tests/audioReliability.test.mjs tests/accountPreferencesClient.test.mjs
npm run build:frontend
npm run test:e2e:production -- --grep ambience
npm run test:e2e -- e2e/account-plan-hardening.spec.js --project=chromium --grep "guest section navigation"
npx playwright test --config playwright.narration.config.js e2e/narration-cancellation.spec.js e2e/narration-lifecycle.spec.js
npm test
```

The two narration specs reuse the ambience MP3 as fixture audio. The production Playwright configuration blocks service workers, so use a service-worker-enabled browser for the warm-cache upgrade check. [Narration cancellation](../../../e2e/narration-cancellation.spec.js) · [Narration lifecycle](../../../e2e/narration-lifecycle.spec.js) · [Production browser configuration](../../../playwright.production.config.js)

Record Chromium and WebKit playback results separately. The Windows WebKit runtime stalled on a standalone control MP3 during review. If that recurs, run the real-media check on a WebKit host that plays the control. For physical iPhone Safari coverage, record the device and iOS version, then check a fresh visit with saved On, first-tap playback, audible looping, and mute. Record that device check as pending until exercised.
