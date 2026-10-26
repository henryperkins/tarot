# Follow-up conversation review captures

Captured on 2026-10-25 using Chromium against the local Worker. The reviewer
signed in through real local Pro authentication and logged out afterward.
Readings, replies, and journal records were fixtures. No model calls were made.

| Capture | Viewport and state |
| --- | --- |
| [Desktop completion](desktop-completion.png) | 1440 x 900, dark, Pro; Save and Ask visible without initial scrolling |
| [Enlarged chat](desktop-light-200.png) | 1440 x 900, light, Pro, 200 percent root text; subtitle and composer visible |
| [Phone chat](phone-light.png) | 390 x 844, light, Pro; answered conversation and composer |
| [Journal replay](pro-journal-light.png) | 1440 x 900, light, Pro; 16px answer text and theme-aware quotation |

These are browser renders. Physical-device, native-keyboard, and screen-reader
behavior were not qualified by these captures. Automated browser regressions
also exercise keyboard focus clearance, a 320px viewport with 200 percent text,
and the journal upgrade target. See the PR description for final test results.
