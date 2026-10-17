# Presentation repair evidence

Local anonymous fixture views only, captured in headless Chromium with reduced motion. No authentication, account entitlement, physical-device, or production performance claim is implied.

The captured [Star](star-recorded-1280x1000.png) and [Two of Swords](deck-Two-of-Swords-1280x1000.png) show desktop static detail emphasis. The [five-card return](five-card-recorded-390x844.png) shows the reversed planted swords. Short-screen views show the [Emperor's scepter](deck-The-Emperor-375x568.png) and [Justice's scales](deck-Justice-375x568.png) within the unchanged 72px companion stage. These two details clipped in the original 375×568 layout; compact framing now fits their supported extents.

The [measurement record](presentation-measurements.json) records the five viewports, stage heights, artwork resource entries and zero running document animations after settling. Every captured view had `scrollWidth === innerWidth`. Identity phrases remain observed text spans; whole-card shelf inspection and supported detail keyboard controls remain available.

## Asset delivery

The vector source and motion overlays remain intact. Hash-verified 1086px WebP delivery images total **22,814,590 bytes for 78 faces**, compared with **271,597,936 source SVG bytes**. Pixel width accommodates the study's largest detail crop at approximately 3× pixel density; this is a raster delivery tradeoff, not infinite vector zoom.

The browser requested only the spread's images, reusing each URL across shelf, focus and illumination:

| Reading | Image requests | Encoded image bodies | Equivalent source SVG bytes |
| --- | ---: | ---: | ---: |
| Star three-card | 3 | 979,088 | 9,064,298 |
| Five-card clarity | 5 | 1,490,502 | 17,209,012 |

The development endpoint reported `transferSize: 0` even with the cache-disabling request. Encoded body sizes agree with the delivery manifest, and successful browser decoding was checked. These figures establish requested payload size, not cold-network timing, mobile memory, GPU compositing or real-device frame rate. Resource `duration` values are local development observations and must not be used as a production benchmark.

## Focused checks

- Artwork/asset unit tests: 5 passed; all 78 derivatives checked for source identity, attribution, hashes, dimensions, format and bounded size. Related Markdown/association unit checks also passed during implementation; root verification records the final integrated totals.
- Deck/refinement Playwright: 8 distinct tests passed across Chromium and WebKit. A trace visibility assertion was corrected to inspect the incoming layer rather than including the departing card's unrelated trace.
- Compact synthesis WebKit: the original immediate read reproduced a stale 106px measurement before the 320px breakpoint settled to 96px. Assertions now wait for the expected breakpoint height and tap a visible text line. The final repeat run completed 2 passes; its third run was deliberately interrupted during startup to release host resources. Earlier runs also exposed and led to a separate optional-reflection validation repair; host saturation caused additional protocol timeouts. This packet does not claim uninterrupted 3/3 repetition.
- Focused ESLint completed without warnings. Impeccable's mechanical detector reported only existing radius/color advisories in the surrounding study CSS; its stale design sidecar was left outside this repair.

The screenshot suite spot-checks the named details. It does not establish visual precision for all 151 authored regions, screen-reader behavior, or production rollout readiness.
