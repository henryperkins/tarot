import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAllCards } from '../src/lib/cardLookup.js';
import { getVectorGestureDetails, getVectorGestureFrame, getVectorGestureFrames } from '../src/data/cardGestureArtwork.js';
import { measureGestureFocusLayer, settleGestureFocusLayer } from './helpers/artworkGeometry.mjs';

// Artwork presentation matrix (Task 12). Every registered detail is held
// explicitly in the deck study and captured in the selected project's actual
// viewport and motion preference. Captures run only in the owned remediation
// fixture lane: unique run directory, exclusive writes, runtime identity.
// Deck prose is authored literal probe copy; relationship rows reuse recorded
// fixture prose. Neither is natural-reading model evidence. Automated checks
// never replace the independent pictured-region review (always PENDING here).
const evidenceDirectory = process.env.CUE_VALIDATION_EVIDENCE_DIR;
const manifestPath = process.env.CUE_VALIDATION_MANIFEST;
const ownedLane = Boolean(evidenceDirectory && manifestPath && process.env.CUE_VALIDATION_LANE === 'fixture');
const EDITION = 'rws-immanuelle-vector';
const repository = fileURLToPath(new URL('..', import.meta.url));
const IDENTITY_FILES = ['src/data/cardGestureArtwork.js', 'src/data/cardGestureDetails/majors.js', 'src/data/cardGestureDetails/cupsPentacles.js',
  'src/data/cardGestureDetails/wandsSwords.js', 'src/components/reading/narrative/CardTouchArt.jsx', 'src/components/reading/narrative/SpreadCompanion.jsx',
  'src/components/reading/narrative/useCardGestureMotion.js', 'src/styles/narrative-card-touch.css', 'src/components/ReadingGesturesFixture.jsx'];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const treatmentOf = detail => detail?.motionRecipe?.kind === 'water' ? 'water' : detail?.motionRecipe?.kind === 'finite' ? 'finite' : 'static';
const near = (left, right, tolerance = 1e-3) => Math.abs(Number(left) - Number(right)) <= tolerance;

let identityPromise;
function runtimeIdentity() {
  identityPromise ||= (async () => {
    const bytes = await readFile(manifestPath);
    const manifest = JSON.parse(bytes);
    const build = manifest.buildIdentity;
    const served = new Map(build.sourceFiles.map(file => [file.path, file.sha256]));
    const local = {};
    for (const file of IDENTITY_FILES) local[file] = sha256(await readFile(path.join(repository, file)));
    const mismatched = IDENTITY_FILES.filter(file => served.get(file) !== local[file]);
    return { runId: build.runId, snapshotDigest: build.snapshotDigest, outputDigest: build.outputDigest, expectedHead: build.expectedHead,
      sourceAllowlistVersion: build.sourceAllowlistVersion, sourceAllowlistSha256: build.sourceAllowlistSha256,
      dirtyPathCount: build.dirtyPaths?.length ?? null, frontendOrigin: manifest.origins.frontend, toolVersions: build.toolVersions ?? null,
      manifestSha256: sha256(bytes), evidenceRunDirectory: path.basename(evidenceDirectory), checkerFiles: local, checkerMatchesServedSnapshot: mismatched.length === 0, mismatched };
  })();
  return identityPromise;
}

function lane(testInfo) {
  const [engine, form, motion] = testInfo.project.name.split('-');
  return { engine, viewportClass: form === 'phone' ? 'compact-phone' : 'desktop', motion: motion === 'reduced' ? 'reduced' : 'normal' };
}

async function writeExclusive(file, contents) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await writeFile(file, contents, { flag: 'wx', mode: 0o600 });
}

async function openStudy(page, query) {
  await page.goto(`/__e2e/reading-gestures?${query}`);
  await expect(page.getByTestId('reading-gestures-fixture')).toBeVisible();
  const diagnostics = page.getByTestId('gesture-source-diagnostics');
  await expect(diagnostics).toHaveAttribute('data-source-status', 'complete');
  await expect(page.locator('[data-gesture-window]')).toBeVisible();
}

async function hold(page, gestureId) {
  const phrase = page.locator(`[data-gesture-id="${gestureId}"]`).first();
  await phrase.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await phrase.press('Enter');
  const stage = page.locator('[data-gesture-window]');
  await expect(stage).toHaveAttribute('data-held', 'true');
  await expect(stage).toHaveAttribute('data-association', gestureId);
  return (await phrase.textContent())?.trim() ?? '';
}

// Expected checks are computed from the served overlay, actual layout and the
// registry; the registry is accepted only if its bytes match the snapshot.
function evaluateArt({ art, cardName, orientation, detailIds, reduced, viewportClass, paired }) {
  const reversed = orientation === 'reversed';
  const registry = getVectorGestureDetails(cardName).filter(detail => detailIds.includes(detail.id));
  const expectedSpots = registry.flatMap(detail => detail.maskSpots);
  const frame = detailIds.length ? getVectorGestureFrame(cardName, detailIds, reversed) : { x: .5, y: .5, zoom: .39, shortZoom: .39 };
  const failures = [];
  const check = (name, value, detail) => { if (!value) failures.push(detail ? `${name}: ${detail}` : name); return Boolean(value); };
  const checks = {
    artDecoded: check('artDecoded', art.image.complete && art.image.naturalWidth === 1086 && art.image.naturalHeight === 1810),
    servedMaskMatchesRegistry: check('servedMaskMatchesRegistry', art.spots.length === expectedSpots.length && expectedSpots.every((spot, index) =>
      near(art.spots[index].upright.x, spot.x, .006) && near(art.spots[index].upright.y, spot.y, .006) && near(art.spots[index].upright.rx, spot.rx, .006) && near(art.spots[index].upright.ry, spot.ry, .006)),
    `${art.spots.length}/${expectedSpots.length}`),
    requestedPointsInside: check('requestedPointsInside', art.spots.every(spot => spot.centerInside),
      art.spots.filter(spot => !spot.centerInside).map(spot => `(${spot.upright.x},${spot.upright.y}) margin ${spot.centerMarginPx}px`).join('; ')),
    reversalOnce: check('reversalOnce', art.orientation.halfTurns.length === (reversed ? 1 : 0) && art.orientation.reversed === reversed
      && art.orientation.unexpected.length === 0 && art.reversedAttribute === reversed, JSON.stringify(art.orientation)),
    overlayAligned: check('overlayAligned', art.overlay.sharedPlane && art.overlay.lightAligned !== false && art.overlay.waterAligned !== false
      && art.overlay.overlayTransforms.every(value => value === 'none') && (expectedSpots.length === 0 || art.overlay.lightAligned === true)),
    presence: check('presence', art.presence === 1 && art.visibility === 'visible', `${art.presence}/${art.visibility}`),
    cropProjection: check('cropProjection', !art.crop ? false : viewportClass === 'desktop' ? art.planeTransform === 'none'
      : near(Number.parseFloat(art.cropVariables['--crop-x']), (0.5 - frame.x) * 100, 1e-6) && near(Number.parseFloat(art.cropVariables['--crop-y']), (0.5 - frame.y) * 100, 1e-6)
        && near(Number(art.cropVariables['--crop-zoom']), frame.zoom, 1e-9) && art.planeTransform !== 'none', JSON.stringify({ variables: art.cropVariables, plane: art.planeTransform })),
    calmMatchesPreference: check('calmMatchesPreference', art.calm === reduced)
  };
  const treatments = registry.map(treatmentOf);
  const expectedTraces = registry.reduce((total, detail) => total + detail.traces.length, 0);
  checks.treatmentLayers = check('treatmentLayers', art.overlay.traces === expectedTraces
    && JSON.stringify(art.overlay.waterDetails) === JSON.stringify(registry.filter(detail => treatmentOf(detail) === 'water').map(detail => detail.id)));
  return { checks, failures, treatments, frame, paired, registry: registry.map(detail => ({ id: detail.id, frame: detail.frame, maskSpots: detail.maskSpots, traces: detail.traces.length, treatment: treatmentOf(detail) })) };
}

function evaluateLayer({ measured, lanes, expectedCards, reduced }) {
  const failures = [];
  const check = (name, value, detail) => { if (!value) failures.push(detail ? `${name}: ${detail}` : name); return Boolean(value); };
  const running = measured.runningAnimations;
  const checks = {
    layerPresent: check('layerPresent', measured.layer && measured.departingLayers === 0),
    held: check('held', measured.window.held && measured.cards.every(card => card.ariaPressed === 'true')),
    labels: check('labels', expectedCards.every((expected, index) => {
      const label = measured.cards[index]?.ariaLabel || '';
      return label.endsWith(`: ${expected.cardName}, ${expected.orientation}`) && label.length > `: ${expected.cardName}, ${expected.orientation}`.length
        && (!expected.exact || label === expected.exact)
        && measured.shelf.some(item => item.ariaLabel === label && item.reversedAttribute === (expected.orientation === 'reversed'));
    }), JSON.stringify({ expected: expectedCards, focus: measured.cards.map(card => card.ariaLabel) })),
    noHorizontalOverflow: check('noHorizontalOverflow', measured.overflow.page <= measured.overflow.viewport + 1, JSON.stringify(measured.overflow)),
    reducedMotionStill: check('reducedMotionStill', !reduced || running.length === 0, JSON.stringify(running)),
    laneMatchesProject: check('laneMatchesProject', measured.environment.reducedMotion === (lanes.motion === 'reduced')
      && (measured.environment.viewport.width >= 1024) === (lanes.viewportClass === 'desktop'), JSON.stringify(measured.environment))
  };
  return { checks, failures };
}

async function capture({ page, testInfo, kind, name, requiredCellKey, context, expectedCards, artExpectations, extra = {} }) {
  const lanes = lane(testInfo);
  const settled = await settleGestureFocusLayer(page);
  const measured = await page.evaluate(measureGestureFocusLayer);
  const image = await page.locator('.gesture-companion').screenshot();
  const identity = await runtimeIdentity();
  const reduced = lanes.motion === 'reduced';
  const layer = evaluateLayer({ measured, lanes, expectedCards, reduced });
  const arts = [];
  for (const [cardIndex, expectation] of artExpectations.entries()) {
    const card = measured.cards[cardIndex];
    const frames = expectation.frames;
    if (!card || card.arts.length !== frames.length) { layer.failures.push(`composition: card ${cardIndex} has ${card?.arts.length ?? 0} arts, expected ${frames.length}`); continue; }
    if (JSON.stringify(card.details) !== JSON.stringify(expectation.detailIds)) layer.failures.push(`requestedDetailSet: ${card.details.join(' ')} != ${expectation.detailIds.join(' ')}`);
    for (const [frameIndex, ids] of frames.entries()) {
      const result = evaluateArt({ art: card.arts[frameIndex], cardName: expectation.cardName, orientation: expectation.orientation, detailIds: ids, reduced, viewportClass: lanes.viewportClass, paired: expectedCards.length > 1 });
      arts.push({ cardIndex, frameIndex, cardName: expectation.cardName, orientation: expectation.orientation, detailIds: ids, ...result, measured: card.arts[frameIndex] });
    }
  }
  const treatments = [...new Set(arts.flatMap(art => art.treatments))];
  const running = measured.runningAnimations;
  // Treatment ownership while held after arrival work: static stays still,
  // finite traces have finished, water flows only with motion enabled.
  const motionFailures = [];
  if (!reduced) {
    if (treatments.includes('water') && !running.some(animation => /gesture-art__(flow|ripple|rivulet)/.test(animation.target))) motionFailures.push('water not running while held');
    if (!treatments.includes('water') && running.length) motionFailures.push(`unexpected running motion: ${JSON.stringify(running)}`);
  }
  const failures = [...layer.failures, ...arts.flatMap(art => art.failures.map(failure => `${art.cardName}/${art.detailIds.join('+') || 'identity'}#${art.frameIndex}: ${failure}`)), ...motionFailures];
  if (!settled.decoded.every(Boolean)) failures.push('image decode rejected');
  if (!identity.checkerMatchesServedSnapshot) failures.push(`checker registry differs from served snapshot: ${identity.mismatched.join(', ')}`);
  const directory = path.join(evidenceDirectory, 'artwork-matrix', kind, testInfo.project.name);
  const imageFile = path.join(directory, `${name}.png`);
  const record = {
    schema: 'task12-artwork-presentation/v1', kind, cellId: `${testInfo.project.name}|${requiredCellKey}`, requiredCellKey,
    project: testInfo.project.name, engine: lanes.engine, viewportClass: lanes.viewportClass, motion: lanes.motion,
    browserName: testInfo.project.use.browserName, browserVersion: page.context().browser()?.version() ?? null, edition: EDITION, context,
    requestedTargets: artExpectations.map(item => ({ cardName: item.cardName, orientation: item.orientation, detailIds: item.detailIds, frames: item.frames })),
    treatments, environment: measured.environment, window: measured.window, companionRect: measured.companionRect, overflow: measured.overflow,
    animations: measured.animations, runningAnimations: running, settled,
    layerChecks: layer.checks, arts: arts.map(({ measured: rendered, ...rest }) => ({ ...rest, rendered })),
    runtime: identity, screenshot: { file: path.relative(evidenceDirectory, imageFile), sha256: sha256(image), bytes: image.length },
    automatedPass: failures.length === 0, failures, independentReview: 'PENDING', capturedAt: new Date().toISOString(), ...extra
  };
  await writeExclusive(imageFile, image);
  await writeExclusive(path.join(directory, `${name}.json`), `${JSON.stringify(record, null, 2)}\n`);
  expect.soft(failures, record.cellId).toEqual([]);
  return record;
}

async function recordMissing({ testInfo, kind, name, requiredCellKey, reason, extra = {} }) {
  const lanes = lane(testInfo);
  const directory = path.join(evidenceDirectory, 'artwork-matrix', kind, testInfo.project.name);
  const record = { schema: 'task12-artwork-presentation/v1', kind, cellId: `${testInfo.project.name}|${requiredCellKey}`, requiredCellKey,
    project: testInfo.project.name, engine: lanes.engine, viewportClass: lanes.viewportClass, motion: lanes.motion,
    captureStatus: 'NOT_CAPTURED', reason, automatedPass: false, failures: [reason], independentReview: 'PENDING', runtime: await runtimeIdentity(), ...extra };
  await writeExclusive(path.join(directory, `${name}.json`), `${JSON.stringify(record, null, 2)}\n`);
  expect.soft(reason, record.cellId).toBe('captured');
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tarot-onboarding-complete', 'true'));
});

if (!ownedLane) {
  test('artwork matrix requires the owned remediation fixture lane', () => {
    test.skip(true, 'Run through output/reading-motion/reading-cue-remediation.playwright.config.mjs with CUE_VALIDATION_LANE=fixture.');
  });
} else {
  test.describe('artwork matrix', () => {
    for (const card of getAllCards()) {
      test(`artwork matrix · ${card.name}`, async ({ page }, testInfo) => {
        test.setTimeout(300000);
        const details = getVectorGestureDetails(card.name);
        for (const orientation of ['upright', 'reversed']) {
          await openStudy(page, `study=deck&card=${encodeURIComponent(card.name)}&orientation=${orientation}&arrival=complete`);
          await expect(page.getByTestId('gesture-source-diagnostics')).toHaveAttribute('data-association-mode', 'dynamic');
          await expect(page.getByRole('combobox', { name: 'Card', exact: true })).toHaveValue(card.name);
          await expect(page.getByRole('combobox', { name: 'Orientation', exact: true })).toHaveValue(orientation);
          await expect(page.getByText('Synthetic descriptions of painted details; this is not a recorded or personalized reading.', { exact: true })).toBeVisible();
          const ids = await page.locator('.reading-gesture-association').evaluateAll(elements => [...new Set(elements.map(element => element.dataset.gestureId))]);
          const pending = new Set(details.map(detail => detail.id));
          const seenMulti = new Set();
          const label = `Artwork: ${card.name}, ${orientation}`;
          for (const gestureId of ids) {
            if (!pending.size) break;
            const phraseText = await hold(page, gestureId);
            const detailIds = ((await page.locator('[data-gesture-window] .gesture-focus-layer:not(.gesture-focus-layer--departing) [data-focus-card]').first().getAttribute('data-details')) || '').split(' ').filter(Boolean);
            const single = detailIds.length === 1 && pending.has(detailIds[0]);
            const multi = detailIds.length > 1 && !seenMulti.has(detailIds.join('+'));
            if (multi) seenMulti.add(detailIds.join('+'));
            if (!single && !multi) continue;
            const frames = getVectorGestureFrames(card.name, detailIds, { paired: false });
            const key = `${card.name}|${detailIds.join('+')}|${orientation}|${lane(testInfo).viewportClass}|${lane(testInfo).motion}`;
            await capture({ page, testInfo, kind: single ? 'cells' : 'same-card-pairs', name: `${slug(card.name)}--${orientation}--${detailIds.join('+')}`, requiredCellKey: key,
              context: { study: 'deck', route: page.url().replace(/^https?:\/\/[^/]+/, ''), positionLabel: 'Artwork', associationId: gestureId, phraseText,
                prose: 'authored literal probe (test copy, not a recorded or personalized reading)', associationSource: 'deterministic aligner over authored probe' },
              expectedCards: [{ cardName: card.name, orientation, exact: label }],
              artExpectations: [{ cardName: card.name, orientation, detailIds, frames }],
              extra: single ? { card: card.name, detailId: detailIds[0], orientation, treatment: treatmentOf(details.find(detail => detail.id === detailIds[0])) } : { card: card.name, orientation } });
            if (single) pending.delete(detailIds[0]);
          }
          for (const detailId of pending) {
            const lanes = lane(testInfo);
            await recordMissing({ testInfo, kind: 'cells', name: `${slug(card.name)}--${orientation}--${detailId}`,
              requiredCellKey: `${card.name}|${detailId}|${orientation}|${lanes.viewportClass}|${lanes.motion}`,
              reason: 'no authored probe association held this single detail', extra: { card: card.name, detailId, orientation } });
          }
        }
      });
    }
  });

  // Recorded fixture prose with authored sidecar or deterministic aligner
  // associations: same-card two-detail, two-card relationships and grounded
  // returns. Sidecars are reviewed fixtures; none of this is model output.
  const sidecars = JSON.parse(readFileSync(new URL('../output/reading-motion/fixtures/gesture-sidecars.json', import.meta.url), 'utf8'));
  const studies = {
    star: { sidecar: 'star', spread: 3, fixture: '../output/reading-motion/fixtures/three-card-transition.json',
      holds: ['balance', 'memory', 'ground'] },
    celtic: { sidecar: 'related', spread: 10, fixture: '../output/reading-motion/fixtures/gestures-celtic-deep-shift.json',
      holds: ['relationship', 'return'] },
    'five-card': { sidecar: 'fiveCard', spread: 5, fixture: '../output/reading-motion/fixtures/gestures-five-card-creative-project.json',
      holds: ['ace-meaning', 'drive-and-sensitivity', 'readiness', 'missing-swords-return', 'momentum-return', 'collaboration-return', 'closing-spark'] }
  };
  test.describe('recorded relationship presentations', () => {
    for (const [study, definition] of Object.entries(studies)) {
      test(`relationships · ${study}`, async ({ page }, testInfo) => {
        test.setTimeout(300000);
        const fixture = JSON.parse(await readFile(new URL(definition.fixture, import.meta.url), 'utf8'));
        const sidecar = sidecars[definition.sidecar];
        await openStudy(page, `study=${study}&associations=authored&arrival=complete`);
        for (const associationId of definition.holds) {
          const association = sidecar.associations.find(item => item.id === associationId);
          const phraseText = await hold(page, associationId);
          const paired = association.targets.length > 1;
          const artExpectations = association.targets.map(target => {
            const recorded = fixture.cards[target.spreadIndex];
            const orientation = recorded.orientation === 'Reversed' ? 'reversed' : 'upright';
            return { cardName: recorded.card, orientation, detailIds: target.detailIds, frames: getVectorGestureFrames(recorded.card, target.detailIds, { paired }) };
          });
          const expectedCards = artExpectations.map(item => ({ cardName: item.cardName, orientation: item.orientation }));
          const lanes = lane(testInfo);
          await capture({ page, testInfo, kind: 'relationships', name: `${study}--${associationId}`,
            requiredCellKey: `${study}|${associationId}|${lanes.viewportClass}|${lanes.motion}`,
            context: { study, route: page.url().replace(/^https?:\/\/[^/]+/, ''), associationId, associationKind: association.kind, phraseText,
              prose: `recorded ${definition.spread}-card fixture prose (${fixture.id || study}); authored reviewed sidecar association, not model output`,
              spreadCards: definition.spread, fixtureCards: fixture.cards.length },
            expectedCards, artExpectations, extra: { relationship: { study, associationId, kind: association.kind, sameCardTwoDetail: !paired && association.targets[0].detailIds.length > 1,
              twoCard: paired, groundedReturn: association.kind === 'interpretation' } } });
        }
      });
    }

    test('relationships · recorded ten-card reading', async ({ page }, testInfo) => {
      test.setTimeout(300000);
      const qualification = JSON.parse(await readFile(new URL('../scripts/evaluation/fixtures/readingCueQualification.regression-20261010.json', import.meta.url), 'utf8'));
      const caseData = qualification.cases.find(item => item.id === 'celtic-deep-shift');
      const samples = JSON.parse(await readFile(new URL('../data/evaluations/narrative-samples.json', import.meta.url), 'utf8'));
      const raw = samples.samples[4].reading;
      expect(sha256(raw)).toBe(caseData.rawSha256);
      const cards = caseData.cards.map(card => ({ card: card.card, orientation: card.orientation, position: card.position }));
      // Development fixture hook only: recorded prose plus a no-op probe sink.
      await page.addInitScript(value => { window.__cueTimingSink = { active: true, emit() {} }; window.__cueQualificationCase = value; },
        { id: caseData.id, raw, cards, spreadKey: 'celtic', userQuestion: caseData.question, reflectionsText: caseData.reflections });
      await openStudy(page, 'study=five-card&associations=dynamic&arrival=complete');
      await expect(page.getByTestId('gesture-source-diagnostics')).toHaveAttribute('data-qualification-case', caseData.id);
      await expect(page.locator('[data-gesture-shelf] li')).toHaveCount(10);
      const ids = await page.locator('.reading-gesture-association').evaluateAll(elements => [...new Set(elements.map(element => element.dataset.gestureId))]);
      expect(ids.length).toBeGreaterThan(0);
      for (const associationId of ids) {
        const phraseText = await hold(page, associationId);
        const focus = await page.locator('[data-gesture-window] .gesture-focus-layer:not(.gesture-focus-layer--departing) [data-focus-card]').evaluateAll(elements =>
          elements.map(element => ({ occurrenceId: element.dataset.occurrenceId, details: (element.dataset.details || '').split(' ').filter(Boolean), label: element.getAttribute('aria-label') })));
        const paired = focus.length > 1;
        const artExpectations = focus.map(item => {
          const index = cards.findIndex(card => (item.label || '').includes(`: ${card.card}, `));
          const recorded = cards[index];
          const orientation = recorded.orientation === 'Reversed' ? 'reversed' : 'upright';
          return { cardName: recorded.card, orientation, detailIds: item.details, frames: getVectorGestureFrames(recorded.card, item.details, { paired }) };
        });
        const expectedCards = artExpectations.map(item => ({ cardName: item.cardName, orientation: item.orientation }));
        const lanes = lane(testInfo);
        await capture({ page, testInfo, kind: 'relationships', name: `ten-card--${slug(associationId)}`,
          requiredCellKey: `ten-card|${associationId}|${lanes.viewportClass}|${lanes.motion}`,
          context: { study: 'recorded-ten-card', route: page.url().replace(/^https?:\/\/[^/]+/, ''), associationId, phraseText,
            prose: 'recorded ten-card Celtic reading (data/evaluations/narrative-samples.json samples[4]) through the development fixture hook; deterministic aligner associations, no model or cue transport',
            caseId: caseData.id, rawSha256: caseData.rawSha256, spreadCards: 10 },
          expectedCards, artExpectations, extra: { relationship: { study: 'recorded-ten-card', associationId, twoCard: paired,
            sameCardTwoDetail: !paired && focus[0]?.details.length > 1 } } });
      }
    });
  });

  // Held/release, settled and unmounted ownership for the five moving details.
  // Counts are relative to the explicit hold: an earlier automatic turn of a
  // different connection is a separate presentation, never a replay.
  const motionDetails = [['The Star', 'pool-pour'], ['The Star', 'land-pour'], ['Wheel of Fortune', 'wheel'], ['Ace of Wands', 'sprout'], ['Seven of Swords', 'two-swords']];
  test.describe('motion ownership', () => {
    for (const [cardName, detailId] of motionDetails) {
      test(`motion ownership · ${cardName} · ${detailId}`, async ({ page }, testInfo) => {
        test.setTimeout(120000);
        const lanes = lane(testInfo);
        const reduced = lanes.motion === 'reduced';
        // A no-op development probe sink labels each art with its association,
        // so handles and trace starts are attributed to the held presentation.
        await page.addInitScript(() => {
          window.__cueTimingSink = { active: true, emit() {} };
          const original = Element.prototype.animate;
          window.__traceStarts = {};
          Element.prototype.animate = function animate(keyframes, options) {
            if (this.matches?.('[data-gesture-finite]')) {
              const owner = this.closest('[data-gesture-art]')?.dataset.cueAssociation || 'unknown';
              window.__traceStarts[owner] = (window.__traceStarts[owner] || 0) + 1;
            }
            return original.call(this, keyframes, options);
          };
        });
        const detail = getVectorGestureDetails(cardName).find(item => item.id === detailId);
        const treatment = treatmentOf(detail);
        // Gentle arrival keeps appending authored probe prose after the hold.
        await page.goto(`/__e2e/reading-gestures?study=deck&card=${encodeURIComponent(cardName)}&arrival=gentle`);
        const diagnostics = page.getByTestId('gesture-source-diagnostics');
        const stage = page.locator('[data-gesture-window]');
        const tried = new Set();
        let gestureId = null;
        const started = Date.now();
        while (!gestureId && Date.now() - started < 30000) {
          const ids = await page.locator('.reading-gesture-association').evaluateAll(elements => [...new Set(elements.map(element => element.dataset.gestureId))]);
          for (const id of ids.filter(value => !tried.has(value))) {
            tried.add(id);
            await hold(page, id);
            const details = (await stage.locator('.gesture-focus-layer:not(.gesture-focus-layer--departing) [data-focus-card]').first().getAttribute('data-details')) || '';
            if (details === detailId) { gestureId = id; break; }
            await page.keyboard.press('Escape');
            await expect(stage).not.toHaveAttribute('data-held', 'true');
          }
          if (!gestureId) await page.waitForTimeout(150);
        }
        expect(gestureId, `${cardName}/${detailId} phrase`).toBeTruthy();
        const heldAt = Date.now();
        const sample = () => page.evaluate(({ owner, cardName: ownerCard }) => {
          const windowElement = document.querySelector('[data-gesture-window]');
          const artOf = animation => animation.effect.target.closest?.('[data-gesture-art]');
          const ownedBy = animation => artOf(animation)?.dataset.cueAssociation === owner && artOf(animation)?.dataset.cardName === ownerCard;
          const owned = document.getAnimations().filter(animation => animation.effect?.target && windowElement.contains(animation.effect.target));
          const detached = document.getAnimations().filter(animation => animation.effect?.target && !animation.effect.target.isConnected && animation.playState === 'running');
          const water = [...windowElement.querySelectorAll('[data-gesture-water]')].flatMap(element => element.getAnimations());
          const art = windowElement.querySelector('.gesture-focus-layer:not(.gesture-focus-layer--departing) .gesture-art');
          const running = owned.filter(animation => animation.playState === 'running');
          return { running: running.length, heldRunning: running.filter(ownedBy).length, otherRunning: running.filter(animation => !ownedBy(animation)).length,
            runningTraces: running.filter(animation => ownedBy(animation) && animation.effect.target.matches?.('[data-gesture-finite]')).length,
            waterRunning: water.filter(animation => animation.playState === 'running' && ownedBy(animation)).length,
            waterRates: water.filter(ownedBy).map(animation => Math.round(animation.playbackRate * 1000) / 1000),
            traceStarts: window.__traceStarts[owner] || 0, allTraceStarts: { ...window.__traceStarts }, detachedRunning: detached.length,
            cardRunning: running.filter(animation => artOf(animation)?.dataset.cardName === ownerCard).length,
            cardArtsConnected: [...document.querySelectorAll('[data-gesture-art]')].filter(element => element.dataset.cardName === ownerCard).length,
            association: windowElement.dataset.association, phase: windowElement.dataset.phase, held: windowElement.dataset.held === 'true',
            reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
            waterOpacity: art ? getComputedStyle(art).getPropertyValue('--gesture-water-opacity') : null, at: Math.round(performance.now()) };
        }, { owner: gestureId, cardName });
        const timeline = { held: await sample() };
        await expect(diagnostics).toHaveAttribute('data-source-status', 'complete', { timeout: 30000 });
        timeline.afterAppends = await sample();
        await page.waitForTimeout(Math.max(0, 2100 - (Date.now() - heldAt)));
        timeline.afterFiniteWindow = await sample();
        await page.keyboard.press('Escape');
        await expect(stage).not.toHaveAttribute('data-held', 'true');
        await page.waitForTimeout(1800);
        timeline.afterRelease = await sample();
        await page.getByRole('combobox', { name: 'Card', exact: true }).selectOption('The Fool');
        await expect(page.locator('[data-gesture-shelf] img')).toHaveAttribute('src', /major-00-fool\.webp$/);
        timeline.afterUnmount = await sample();
        const failures = [];
        if (reduced) {
          for (const [moment, value] of Object.entries(timeline)) if (value.running || Object.values(value.allTraceStarts).some(Boolean)) failures.push(`${moment}: reduced motion ran ${value.running} handles / ${JSON.stringify(value.allTraceStarts)} traces`);
        } else {
          if (treatment === 'finite' && timeline.held.traceStarts < detail.traces.length) failures.push(`held finite trace starts ${timeline.held.traceStarts} < ${detail.traces.length}`);
          if (timeline.afterAppends.traceStarts !== timeline.held.traceStarts) failures.push('a finite trace replayed while prose appended');
          if (treatment === 'finite' && timeline.afterFiniteWindow.runningTraces) failures.push(`finite trace still running after 2100 ms: ${timeline.afterFiniteWindow.runningTraces}`);
          if (treatment === 'water' && !timeline.afterFiniteWindow.waterRunning) failures.push('held water not running');
          if (treatment !== 'water' && timeline.afterFiniteWindow.waterRunning) failures.push('non-water detail ran water');
          if (timeline.afterRelease.heldRunning) failures.push(`released presentation still runs ${timeline.afterRelease.heldRunning} handles 1800 ms after release`);
          if (timeline.afterRelease.traceStarts !== timeline.held.traceStarts) failures.push('release replayed the finite trace');
        }
        if (timeline.afterUnmount.cardRunning || timeline.afterUnmount.cardArtsConnected || timeline.afterUnmount.detachedRunning) {
          failures.push(`unmounted ${cardName} art left ${timeline.afterUnmount.cardArtsConnected} connected arts / ${timeline.afterUnmount.cardRunning} running handles`);
        }
        const record = { schema: 'task12-motion-ownership/v1', project: testInfo.project.name, engine: lanes.engine, viewportClass: lanes.viewportClass, motion: lanes.motion,
          browserVersion: page.context().browser()?.version() ?? null, card: cardName, detailId, treatment, gestureId, timeline, runtime: await runtimeIdentity(),
          prose: 'authored literal probe (test copy) with gentle recorded-clock arrival; release and unmount observed in this page',
          automatedPass: failures.length === 0, failures, capturedAt: new Date().toISOString() };
        await writeExclusive(path.join(evidenceDirectory, 'artwork-matrix', 'motion', testInfo.project.name, `${slug(cardName)}--${detailId}.json`), `${JSON.stringify(record, null, 2)}\n`);
        expect(failures).toEqual([]);
      });
    }
  });
}
