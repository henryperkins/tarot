# Interrupted page transitions — local integration

Candidate `329340f48d32a559720a278201108ab7ac5413c8` is based on master
`3946e1ada5fda13d93d82c34719ce267881f9825`.

Master already renders routes independently of animation completion and uses a
transform-only page entrance. The older fix is only partially superseded:
Journal and Card Gallery still had duplicate full-page opacity fades. Pausing
them reproduced an invisible destination. This candidate removes those two
classes and imports/adapts the historical regression. No routing, scene layout,
tokens or broader reading-room design were imported.

The final regression fails on unchanged master in both Chromium and WebKit
(paused page opacity stays zero), and passes on the candidate: **13 passes and
one intentional WebKit skip** for Chromium CDP suspension. Coverage includes
normal/reduced motion, cancellation, pause, reduced-motion switching, history,
keyboard navigation and actual Chromium lifecycle suspension.

WebKit can complete a short gallery animation before delivering animationstart.
The interruption cases therefore hold real CSS entrances at their initial frame
before pausing/cancelling; ordinary motion cases retain real timing. Assertions
check effective ancestor opacity, navigation and visible destination content.

Root unit tests passed **2,000/2,000**, deploy tests **11/11**, and build and
Cloudflare command lint passed on the exact commit. The browser pass preceded
the commit with the identical three-file tree. Shared QA and combined-candidate
verification remain separate release gates, recorded in the integration status.

The original Midnight branch and critique remain preserved at `7d0220c`. Its
broader redesign is **deferred**. Future integration needs a separate product
decision covering deal/turn sequencing, ritual skip, handset focus, reading stages
and the five known conflict files. This local fix has not been pushed or deployed.

Logs and screenshots are retained in
`C:/Users/htper/AppData/Local/Temp/tarot-integration-b3d08059115b417aa797f86583e7d874`:
`transition-final-baseline-red.txt`, `transition-deterministic-green.txt`,
`transition-final-artifacts`, `transition-unit.txt`, `transition-build.txt`,
`transition-deploy-tests.txt`, and `transition-cloudflare-lint.txt`.
