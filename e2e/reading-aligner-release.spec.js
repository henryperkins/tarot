import { readFileSync } from 'node:fs';
import { measureGestureFocusLayer } from './helpers/artworkGeometry.mjs';
import { test, expect } from '@playwright/test';
import { createGestureSource } from '../src/lib/narrativeGestureSource.js';
import { resolveNarrativePassages } from '../src/lib/generatedNarrativePassages.js';
import { createAlignerFixture, observeAligner, attachAlignerEvidence, proveServerNoConsent, scrollMobileWebKitDocument, inspectReadingViewport, clickInlineReadingPhrase, inspectInlineReadingPhrase, starEntry, sourceBinding, acceptedLedger } from './helpers/readingAlignerFixture.mjs';
import { startReading, openSetup, expectForeground } from './helpers/narrativeFixtures.js';

const editionManifest = JSON.parse(readFileSync(new URL('../public/images/cards/rws-vector/manifest.json', import.meta.url), 'utf8'));
const normalizeCardName = name => name.replace(/^the /i, '').toLowerCase();
const prose = '## Reflection\n\nThe Star shows one pitcher into a pool and the other onto the land. Your choices remain your own.';
const notes = '  I need a quiet pause.\nKeep my own wording 🌿.  ';
const imagePair = [
  { name: 'The Star', number: 17, position: 'Present', orientation: 'Upright' },
  { name: 'The Sun', number: 19, position: 'Next step', orientation: 'Reversed', isReversed: true }
];
async function startOrdinaryReading(page, fixture, { captureSpreadEdition = false } = {}) {
  await openSetup(page); await nativeClick(page.getByRole('radio', { name: /Three-Card Story/ }));
  if (!captureSpreadEdition) { await startReading(page, fixture, { complete: false, setup: false }); return null; }
  await page.locator('#question-input, #quick-intention').filter({ visible: true }).first().fill(fixture.question);
  await nativeClick(page.getByRole('button', { name: /^Draw cards$/ }).filter({ visible: true }).first());
  await nativeClick(page.getByRole('button', { name: /^Deal spread/ }).filter({ visible: true }).first());
  await nativeClick(page.getByRole('button', { name: /^Reveal all cards/ }).filter({ visible: true }).first());
  const table = page.getByRole('region', { name: /Three-Card Story.*layout/ }); await expect(table.locator('img')).toHaveCount(3);
  const spreadURLs = await table.locator('img').evaluateAll(images => images.map(image => image.getAttribute('src')));
  for (const url of spreadURLs) expect(url).toMatch(/^\/images\/cards\/RWS1909_.*\.jpeg$/);
  await page.getByRole('button', { name: /^Interpret cards/ }).filter({ visible: true }).first().press('Enter'); return spreadURLs;
}
async function nativeClick(locator) { await expectForeground(locator); await locator.click(); }
async function saveOrdinaryReading(page) {
  const control = page.getByRole('button', { name: 'Save to journal', exact: true }).filter({ visible: true });
  await expect(control).toHaveCount(1); await nativeClick(control);
}
async function viewOrdinaryJournal(page) {
  const control = page.getByRole('button', { name: 'View saved entry', exact: true }).filter({ visible: true });
  await expect(control).toHaveCount(1); await nativeClick(control);
}
export async function openAlignerEntry(page, id) {
  const card = page.locator(`[id="journal-entry-${id}"] article`); await expect(card).toBeVisible();
  const expand = card.locator('button[aria-controls]:not([aria-haspopup])').first();
  if (await expand.getAttribute('aria-expanded') === 'false') await nativeClick(expand);
  const narrative = card.getByRole('button', { name: 'Reading narrative', exact: true });
  if (await narrative.getAttribute('aria-expanded') === 'false') await nativeClick(narrative);
  await expect(card.getByTestId('restored-reading-gestures')).toBeVisible(); return card;
}
async function storedEntry(page, fixture, tier) {
  if (['plus', 'pro'].includes(tier)) return fixture.savedEntries[0];
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) || '[]')[0], tier === 'guest' ? 'tarot_journal' : 'tarot_journal_aligner-reader');
}
function readingFromPayload(payload) { return `## Your cards\n\n${payload.cardsInfo.map(card => `${card.card} is in ${card.position}.`).join(' ')}\n\nChoose one small next step. Your choices remain your own.`; }
async function expectNoAnnotations(fixture) { expect(fixture.annotationRequests).toEqual([]); expect(fixture.unexpectedRequests).toEqual([]); for (const headers of fixture.requests.readingHeaders) expect(headers['x-reading-cue-display']).toBeUndefined(); }

for (const tier of ['guest', 'free', 'plus', 'pro']) test(`${tier} ordinary draw, completion, save and journal reopen use only the local aligner`, async ({ page }, testInfo) => {
  const fixture = await createAlignerFixture(page, { tier }); await observeAligner(page);
  try {
    const spreadURLs = await startOrdinaryReading(page, fixture, { captureSpreadEdition: true }); await expect.poll(() => fixture.requests.reading.length).toBe(1);
    const payload = fixture.requests.reading[0]; const raw = readingFromPayload(payload);
    const expectedCompanionURLs = payload.cardsInfo.map(card => { const asset = editionManifest.cards.find(asset => normalizeCardName(asset.name) === normalizeCardName(card.card)); expect(asset).toBeTruthy(); return `/images/cards/rws-vector/${asset.filename}`; });
    await fixture.emit('reading', 'delta', { text: raw });
    await expect(page.locator('[data-gesture-shelf] img')).toHaveCount(payload.cardsInfo.length);
    const pendingCompanionURLs = await page.locator('[data-gesture-shelf] img').evaluateAll(images => images.map(image => image.getAttribute('src'))); expect(pendingCompanionURLs).toEqual(expectedCompanionURLs);
    await fixture.emit('reading', 'done', { fullText: raw, provider: 'controlled-offline' });
    await expect(page.locator('.narrative-stream')).toContainText('Choose one small next step.');
    await expect(page.locator('[data-gesture-shelf] button')).toHaveCount(payload.cardsInfo.length);
    const completedCompanionURLs = await page.locator('[data-gesture-shelf] img').evaluateAll(images => images.map(image => image.getAttribute('src'))); expect(completedCompanionURLs).toEqual(expectedCompanionURLs);
    const serverBoundary = await proveServerNoConsent(payload);
    await saveOrdinaryReading(page);
    await expect.poll(async () => Boolean((await storedEntry(page, fixture, tier))?.id)).toBe(true);
    const saved = await storedEntry(page, fixture, tier); expect(saved.personalReading).toBe(raw); expect(saved.visualBinding).toBeFalsy(); expect(saved.visual?.binding).toBeFalsy();
    await viewOrdinaryJournal(page); await expect(page).toHaveURL(/\/journal(?:\?|$)/);
    const card = await openAlignerEntry(page, saved.id); await expect(card).toContainText('Choose one small next step.');
    await expect(card.getByRole('button', { name: 'Retry card connections' })).toHaveCount(0);
    await expectNoAnnotations(fixture); await attachAlignerEvidence(page, testInfo, fixture, { tier, serverBoundary, liveImageEditions: { spreadURLs, pendingCompanionURLs, completedCompanionURLs, companionEdition: editionManifest.edition }, exactSavedRaw: saved.personalReading, noModelBinding: !saved.visualBinding });
    await card.screenshot({ path: testInfo.outputPath(`${tier}-ordinary-journal.png`) });
  } finally { await fixture.close(); }
});

for (const delivery of ['paced-partial', 'final-only', 'reconnect', 'source-replacement']) test(`${delivery} preserves exact server prose, held inspection and ordinary completion`, async ({ page }, testInfo) => {
  const fixture = await createAlignerFixture(page, { tier: 'free' }); await observeAligner(page);
  try {
    await startOrdinaryReading(page, fixture); await expect.poll(() => fixture.requests.reading.length).toBe(1);
    const payload = fixture.requests.reading[0]; const first = `## Your cards\n\n${payload.cardsInfo[0].card} is in ${payload.cardsInfo[0].position}.`;
    const ending = ` ${payload.cardsInfo.slice(1).map(card => `${card.card} is in ${card.position}.`).join(' ')}\n\nYour choices remain your own.`;
    let raw = first + ending;
    if (delivery === 'final-only') await fixture.emit('reading', 'done', { fullText: raw });
    else {
      await fixture.emit('reading', 'delta', { text: first }); await expect(page.locator('.narrative-stream')).toContainText(payload.cardsInfo[0].card);
      const phone = testInfo.project.name.includes('-phone-');
      const stage = page.locator('[data-gesture-window]');
      const cardDialog = page.getByRole('dialog').filter({ visible: true });
      const expectInspectedCard = async () => {
        await expect(cardDialog).toHaveCount(1);
        await expect(cardDialog.getByRole('heading', { level: 2 })).toContainText(payload.cardsInfo.at(-1).card);
        await expect(cardDialog.getByText(payload.cardsInfo.at(-1).position, { exact: true })).toBeVisible();
      };
      let held; let inspectedCard;
      if (phone) {
        // The ordinary reading uses its overview and full card dialog on phones.
        const overview = page.locator('[data-reading-overview]');
        const disclosure = page.locator('details.reading-spread-disclosure');
        if (await disclosure.count() && await disclosure.getAttribute('open') === null) await disclosure.locator('summary').click();
        const card = overview.getByRole('button', { name: /Open card/ }).last();
        inspectedCard = await card.getAttribute('aria-label');
        await nativeClick(card);
        await expectInspectedCard();
      } else {
        const shelf = page.locator('[data-gesture-shelf] button').last(); await expect(shelf).toBeEnabled(); await expect(shelf.locator('..')).toHaveAttribute('data-introduced', 'false'); await nativeClick(shelf);
        await expect(stage).toHaveAttribute('data-held', 'true'); held = await stage.getAttribute('data-association');
      }
      if (delivery === 'reconnect') { const previous = await fixture.connectionGeneration(); await fixture.disconnect(); await expect.poll(() => fixture.connected('reading', previous)).toBeGreaterThan(0); }
      if (delivery === 'source-replacement') {
        raw = '## A new source\n\nThis replacement preserves its own exact wording. Your choices remain your own.';
        await fixture.emit('reading', 'snapshot', { fullText: raw }); await expect(page.locator('.narrative-stream')).toContainText('This replacement preserves');
        await expect(stage).not.toHaveAttribute('data-held', 'true'); await expect(page.locator('.reading-gesture-association[aria-pressed="true"]')).toHaveCount(0);
      } else {
        const scroll = await page.evaluate(() => scrollY);
        await fixture.emit('reading', 'delta', { text: ending });
        await expect(page.locator('.narrative-stream')).toContainText('Your choices remain your own.');
        if (!phone) { await expect(stage).toHaveAttribute('data-association', held); await expect(stage).toHaveAttribute('data-held', 'true'); }
        else await expectInspectedCard();
        expect(await page.evaluate(() => scrollY)).toBe(scroll);
      }
      await fixture.emit('reading', 'done', { fullText: raw });
      if (delivery !== 'source-replacement' && !phone) { await expect(stage).toHaveAttribute('data-association', held); await expect(stage).toHaveAttribute('data-held', 'true'); }
      if (phone) {
        await expectInspectedCard();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog').filter({ visible: true })).toHaveCount(0);
        await expect(page.getByRole('button', { name: inspectedCard, exact: true })).toBeFocused();
      }
    }
    await expect(page.getByText('Narrative ready.', { exact: true })).toBeAttached();
    await saveOrdinaryReading(page); await expect.poll(async () => Boolean((await storedEntry(page, fixture, 'free'))?.id)).toBe(true);
    const saved = await storedEntry(page, fixture, 'free'); expect(saved.personalReading).toBe(raw);
    const observation = await page.evaluate(() => window.__alignerObservation);
    const last = observation.source.filter(event => event.event === 'done').at(-1); expect(last.data.fullText).toBe(raw);
    expect(observation.renders.some(event => event.text.includes('Your choices remain your own.'))).toBe(true);
    await expectNoAnnotations(fixture); await attachAlignerEvidence(page, testInfo, fixture, { tier: 'free', delivery, exactSavedRaw: saved.personalReading });
  } finally { await fixture.close(); }
});

test('a streaming error remains an error without fabricated complete prose or annotation work', async ({ page }, testInfo) => {
  const fixture = await createAlignerFixture(page); await observeAligner(page);
  try {
    await startOrdinaryReading(page, fixture); await fixture.emit('reading', 'delta', { text: 'A supplied unfinished sentence.' });
    await expect(page.locator('.narrative-stream')).toContainText('A supplied unfinished sentence.');
    await fixture.emit('reading', 'error', { message: 'Controlled source interrupted.' }); await expect(page.getByRole('alert')).toContainText('Controlled source interrupted.');
    await expect(page.getByText('Narrative ready.', { exact: true })).toHaveCount(0); await expectNoAnnotations(fixture); await attachAlignerEvidence(page, testInfo, fixture, { delivery: 'error' });
  } finally { await fixture.close(); }
});

for (const metadata of ['none', 'cached-accepted', 'expired-handle']) test(`${metadata} journal reload uses native expansion and static phrase/card inspection`, async ({ page }, testInfo) => {
  let entry = starEntry({ id: `aligner-${metadata}`, personalReading: prose, reflections: notes });
  if (metadata !== 'none') {
    const binding = await sourceBinding(entry, `result-${metadata}`); const ledger = metadata === 'cached-accepted' ? await acceptedLedger(binding, prose) : null;
    entry = { ...entry, readingResultId: binding.readingResultId, visualBinding: binding,
      visual: { readingResultId: binding.readingResultId, binding, status: metadata === 'cached-accepted' ? 'complete' : 'expired', sourceRevision: 0, ledgerRevision: ledger?.ledgerRevision || 0, snapshot: ledger } };
  }
  const fixture = await createAlignerFixture(page, { initialEntries: [entry], tier: 'free' }); await observeAligner(page);
  let keyboardGeometry; let keyboardStage; const keyboardEvidence = { metadata, project: testInfo.project.name, steps: [] };
  let phoneGeometry; const phoneEvidence = { metadata, project: testInfo.project.name };
  if (metadata === 'expired-handle') await page.addInitScript(binding => localStorage.setItem(`tarot_visual_resume:user:aligner-reader:${encodeURIComponent(binding.readingResultId)}`, JSON.stringify({ binding, visualJobToken: 'expired-controlled-token', expiresAt: 1 })), entry.visualBinding);
  try {
    await page.goto('/journal'); let card = await openAlignerEntry(page, entry.id); await page.reload(); card = await openAlignerEntry(page, entry.id);
    // Mobile companion inspection moves its stage into a body-level dialog.
    await expect(card).toContainText('one pitcher into a pool'); const stage = page.locator('[data-gesture-window]'); await expect(stage).toHaveAttribute('data-phase', 'static');
    const phrase = card.locator('.reading-gesture-association').filter({ hasText: /\bpool\b/ }); await expect(phrase).toHaveCount(1); await expect(phrase).toBeVisible();
    if (metadata === 'cached-accepted' && testInfo.project.name.includes('-phone-')) {
      keyboardGeometry = () => phrase.evaluate(inspectInlineReadingPhrase); keyboardStage = stage;
      const binding = entry.visualBinding; const ledger = entry.visual.snapshot;
      const projected = resolveNarrativePassages({ source: { ...createGestureSource({ runId: binding.readingResultId, raw: entry.personalReading, status: 'complete', sourceRevision: binding.sourceRevision, visualBinding: binding, cueLedger: ledger }), question: entry.question, reflections: entry.reflections },
        cards: entry.cards.map((card, index) => ({ ...card, index, canonicalName: card.name, occurrenceId: String(index), artworkEdition: binding.artworkEdition })), artworkEdition: binding.artworkEdition });
      const cue = ledger.cues.find(cue => cue.passage.quote === 'one pitcher into a pool');
      expect(projected.associations.some(association => association.id === cue.id && association.passage.quote === cue.passage.quote)).toBe(true);
      keyboardEvidence.expectedAssociation = cue.id;
      keyboardEvidence.setup = await page.evaluate(() => {
        const describe = element => ({ tag: element.tagName, id: element.id, label: element.getAttribute('aria-label') || element.textContent.slice(0,80), tabIndex: element.tabIndex });
        const focusable = [...document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')].filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && !element.closest('[inert]') && element.getClientRects().length && !['hidden','collapse'].includes(getComputedStyle(element).visibility));
        return { at: performance.now(), priorActiveControl: describe(document.activeElement), focusable: focusable.map(describe) };
      });
      for (let index = 0; index <= keyboardEvidence.setup.focusable.length && !await phrase.evaluate(element => element === document.activeElement); index++) {
        await page.keyboard.press('Tab'); keyboardEvidence.steps.push(await page.evaluate(() => ({ at: performance.now(), tag: document.activeElement.tagName, id: document.activeElement.id, label: document.activeElement.getAttribute('aria-label') || document.activeElement.textContent.slice(0,80), scrollY })));
      }
      keyboardEvidence.focused = await phrase.evaluate(element => element === document.activeElement); keyboardEvidence.beforeEnter = await keyboardGeometry();
      await testInfo.attach('cached-phrase-native-Tab-focus', { body: JSON.stringify(keyboardEvidence,null,2), contentType: 'application/json' });
      await expect(phrase).toBeFocused();
      await expect.poll(async () => { keyboardEvidence.beforeEnter = await keyboardGeometry(); return keyboardEvidence.beforeEnter.foreground; }, { timeout: 5000 }).toBe(true);
      await page.keyboard.press('Enter'); keyboardEvidence.enterDispatch = { geometry: await keyboardGeometry(), association: await stage.getAttribute('data-association'), held: await stage.getAttribute('data-held') };
      await testInfo.attach('cached-phrase-native-Enter-dispatch', { body: JSON.stringify(keyboardEvidence.enterDispatch,null,2), contentType: 'application/json' });
      await expect(stage).toHaveAttribute('data-association',cue.id); await expect(stage).toHaveAttribute('data-held','true');
      keyboardEvidence.afterEnter = { geometry: await keyboardGeometry(), association: await stage.getAttribute('data-association'), held: await stage.getAttribute('data-held') };
      await testInfo.attach('cached-phrase-native-Enter-held', { body: JSON.stringify(keyboardEvidence.afterEnter,null,2), contentType: 'application/json' });
      await expect(page.getByRole('dialog', { name: 'Card detail', exact: true })).toBeVisible();
      await page.keyboard.press('Escape'); await expect(stage).not.toHaveAttribute('data-held','true'); keyboardEvidence.released = await keyboardGeometry();
      await expect(phrase).toBeFocused();
      await expect.poll(async () => (await keyboardGeometry()).foreground).toBe(true);
    }
    await clickInlineReadingPhrase(phrase); await expect(stage).toHaveAttribute('data-held', 'true');
    if (testInfo.project.name.includes('-phone-')) {
      await expect(page.getByRole('dialog', { name: 'Card detail', exact: true })).toBeVisible();
      await page.keyboard.press('Escape'); await expect(phrase).toBeFocused();
    }
    await nativeClick(card.locator('[data-gesture-shelf] button').last()); await expect(stage).toHaveAttribute('data-held', 'true');
    if (testInfo.project.name.includes('-phone-')) {
      await expect(page.getByRole('dialog', { name: 'Card detail', exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(card.locator('[data-gesture-shelf] button').last()).toBeFocused();
    }
    await expect(card.getByTestId('saved-visual-recovery')).toHaveCount(0); await expect(card.getByRole('button', { name: 'Retry card connections' })).toHaveCount(0);
    if (metadata === 'none') {
      const eligibility = () => page.locator('#journal-history-filters').evaluate(element => {
        const rect = element.getBoundingClientRect(); return { at: performance.now(), scrollY, viewportHeight: innerHeight, filterRect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }, eligible: scrollY > 200 && rect.bottom <= 0 };
      });
      const before = await eligibility(); let requestedWheelDelta = 0; let eligibilityInput;
      if (!before.eligible) {
        requestedWheelDelta = Math.min(before.viewportHeight, Math.max(before.filterRect.bottom + 16, 201 - before.scrollY));
        if (testInfo.project.name.startsWith('webkit-phone-')) {
          eligibilityInput = {}; phoneEvidence.eligibilityInput = eligibilityInput;
          await scrollMobileWebKitDocument(page, { deltaY: requestedWheelDelta, pointer: { x: 16, y: before.viewportHeight / 2 }, measure: eligibility, exposed: geometry => geometry.eligible, canContinue: () => true, receipt: eligibilityInput });
        } else {
          await page.mouse.move(16, before.viewportHeight / 2); await page.mouse.wheel(0, requestedWheelDelta);
        }
      }
      await expect.poll(async () => (await eligibility()).eligible).toBe(true);
      const after = await eligibility(); expect(after.scrollY).toBeGreaterThan(200); expect(after.filterRect.bottom).toBeLessThanOrEqual(0);
      expect(Math.abs(after.scrollY - before.scrollY)).toBeLessThanOrEqual(before.viewportHeight + 1);
      await testInfo.attach('journal-floating-controls-eligibility', { body: JSON.stringify({ before, after, requestedWheelDelta, input: eligibilityInput || 'at most one bounded native mouse wheel before shortcut and phone prose checks' }, null, 2), contentType: 'application/json' });
      await expect(page.getByRole('button', { name: 'Jump to journal filters', exact: true }).filter({ visible: true })).toBeVisible();
      if (testInfo.project.name.includes('-phone-')) await expect(page.getByRole('button', { name: 'Start a new reading', exact: true }).filter({ visible: true })).toBeVisible();
    }
    if (metadata === 'none' && testInfo.project.name.includes('-phone-')) {
      const paragraph = card.locator('.narrative-stream__text p').last();
      const geometry = () => paragraph.evaluate(element => {
        const range = document.createRange(); range.selectNodeContents(element); const rects = [...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0);
        const header = document.querySelector('.header-sticky, header.sticky')?.getBoundingClientRect();
        const controls = [...document.querySelectorAll('button[aria-label="Start a new reading"], button[aria-label="Jump to journal filters"]')].map(button => button.parentElement).find(parent => getComputedStyle(parent).position === 'fixed');
        const controlBox = controls?.getBoundingClientRect(); const bounds = { top: header?.bottom || 0, bottom: controlBox?.top || innerHeight };
        const companion = element.closest('.reading-screen, .narrative-panel__layout')?.querySelector('.gesture-companion'); const companionBox = companion?.getBoundingClientRect();
        if (companion && getComputedStyle(companion).position === 'sticky' && companionBox.top <= (parseFloat(getComputedStyle(companion).top) || 0) + 1) bounds.top = Math.max(bounds.top, companionBox.bottom);
        const lines = rects.map(rect => { const hit = document.elementFromPoint((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2); return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, foreground: Boolean(hit && element.contains(hit)) }; });
        const history = document.querySelector('#history');
        return { clock: performance.now(), scrollY, scrollX, viewportHeight: innerHeight, history: { scrollLeft: history.scrollLeft, scrollWidth: history.scrollWidth, clientWidth: history.clientWidth }, bounds, controls: controlBox ? { top: controlBox.top, bottom: controlBox.bottom } : null, inset: getComputedStyle(document.querySelector('main.journal-page')).getPropertyValue('--journal-controls-inset'),
          top: Math.min(...lines.map(line => line.top)), bottom: Math.max(...lines.map(line => line.bottom)), lines,
          visible: lines.length > 0 && lines.every(line => line.foreground && line.left >= 0 && line.right <= innerWidth && line.top >= bounds.top && line.bottom <= bounds.bottom) };
      });
      phoneGeometry = geometry;
      phoneEvidence.settled = await page.evaluate(() => new Promise((resolve, reject) => {
        const startedAt = performance.now(); let previous = ''; let unchangedSince = startedAt;
        const sample = () => {
          const at = performance.now(); const history = document.querySelector('#history');
          const state = { scrollY, scrollX, historyLeft: history.scrollLeft, historyWidth: history.scrollWidth, historyClient: history.clientWidth,
            viewport: { width: innerWidth, height: innerHeight, offsetTop: visualViewport?.offsetTop, offsetLeft: visualViewport?.offsetLeft },
            rects: [...document.querySelectorAll('header.sticky, .gesture-companion, .narrative-stream__text p, button[aria-label="Start a new reading"], button[aria-label="Jump to journal filters"]')].map(element => element.getBoundingClientRect().toJSON()) };
          const signature = JSON.stringify(state); if (signature !== previous) { previous = signature; unchangedSince = at; }
          if (at - unchangedSince >= 250) return resolve({ startedAt, settledAt: at, unchangedSince, state });
          if (at - startedAt > 5000) return reject(new Error('Native journal scroll and prose geometry did not settle before wheel measurement'));
          requestAnimationFrame(sample);
        }; requestAnimationFrame(sample);
      }));
      const before = await geometry(); phoneEvidence.before = before;
      expect(before.scrollX).toBe(0); expect(before.history.scrollLeft).toBe(0); expect(before.history.scrollWidth).toBeLessThanOrEqual(before.history.clientWidth + 1);
      const needed = before.bottom > before.bounds.bottom ? before.bottom - before.bounds.bottom + 16 : before.top < before.bounds.top ? before.top - before.bounds.top - 16 : Math.min(48, Math.max(1, before.top - before.bounds.top - 8));
      const wheelDelta = Math.max(-before.viewportHeight, Math.min(before.viewportHeight, needed));
      await page.mouse.move(16, Math.min(before.viewportHeight - 32, Math.max(32, (before.bounds.top + before.bounds.bottom) / 2)));
      phoneEvidence.requestedWheelDelta = wheelDelta;
      if (testInfo.project.name.startsWith('webkit-phone-')) {
        phoneEvidence.keyboardInput = {};
        await scrollMobileWebKitDocument(page, { deltaY: wheelDelta, pointer: { x: 16, y: Math.min(before.viewportHeight - 32, Math.max(32, (before.bounds.top + before.bounds.bottom) / 2)) },
          measure: geometry, exposed: value => value.visible, canContinue: value => wheelDelta > 0 ? value.top >= value.bounds.top : value.bottom <= value.bounds.bottom, receipt: phoneEvidence.keyboardInput });
      } else {
        await page.mouse.wheel(0, wheelDelta);
      }
      await expect.poll(async () => (await geometry()).visible).toBe(true);
      const after = await geometry(); phoneEvidence.after = after;
      expect(after.scrollX).toBe(0); expect(after.history.scrollLeft).toBe(0); expect(after.history.scrollWidth).toBeLessThanOrEqual(after.history.clientWidth + 1);
      expect(after.controls, 'Phone check must include the actual floating journal controls').not.toBeNull(); expect(Math.abs(after.scrollY - before.scrollY)).toBeLessThanOrEqual(before.viewportHeight + 1);
      await testInfo.attach('journal-phone-native-wheel-prose', { body: JSON.stringify({ before, after, requestedWheelDelta: wheelDelta, input: phoneEvidence.keyboardInput || 'one native mouse wheel on emulated phone; no physical swipe claim', inference: 'before/after exposure only; no persistent obstruction claim' }, null, 2), contentType: 'application/json' });
    }
    if (metadata === 'none') {
      const floatingControls = [];
      for (const name of ['Start a new reading', 'Jump to journal filters']) {
        const control = page.getByRole('button', { name, exact: true }).filter({ visible: true });
        if (!await control.count()) continue;
        await expect(control).toHaveCount(1); await expectForeground(control);
        floatingControls.push(await control.evaluate(element => { const box = element.getBoundingClientRect(); const x = box.left + box.width / 2; const y = box.top + box.height / 2;
          return { name: element.getAttribute('aria-label'), x, y, foreground: element.contains(document.elementFromPoint(x, y)) }; }));
      }
      expect(floatingControls.map(control => control.name)).toEqual(testInfo.project.name.includes('-phone-') ? ['Start a new reading', 'Jump to journal filters'] : ['Jump to journal filters']);
      const gap = await page.evaluate(() => {
        const button = [...document.querySelectorAll('button[aria-label="Start a new reading"], button[aria-label="Jump to journal filters"]')].find(element => getComputedStyle(element.parentElement).position === 'fixed');
        const wrapper = button?.parentElement; if (!wrapper) return null;
        const children = [...wrapper.children].filter(element => element.getClientRects().length).map(element => element.getBoundingClientRect()).sort((a, b) => a.top - b.top);
        const index = children.findIndex((rect, index) => children[index + 1]?.top > rect.bottom); if (index < 0) return null;
        const box = wrapper.getBoundingClientRect(); const x = box.left + box.width / 2; const y = (children[index].bottom + children[index + 1].top) / 2;
        const hit = document.elementFromPoint(x, y); return { x, y, inViewport: x >= 0 && x < innerWidth && y >= 0 && y < innerHeight, hitPresent: Boolean(hit), hitTag: hit?.tagName, hitClass: String(hit?.className || ''), intercepted: Boolean(hit && wrapper.contains(hit)) };
      });
      expect(floatingControls.every(control => control.foreground)).toBe(true);
      if (floatingControls.length > 1) expect(gap, 'Two floating controls must expose their actual empty gap').not.toBeNull();
      if (gap) { expect(gap.inViewport).toBe(true); expect(gap.hitPresent).toBe(true); expect(gap.intercepted, 'Empty fixed-wrapper space must pass input through').toBe(false); }
      await testInfo.attach('journal-floating-controls-hit-geometry', { body: JSON.stringify({ controls: floatingControls, emptyGap: gap }, null, 2), contentType: 'application/json' });
    }
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('tarot_journal_aligner-reader'))[0]); expect(stored.personalReading).toBe(prose); expect(stored.reflections).toBe(notes);
    if (metadata === 'cached-accepted') expect(stored.visual.snapshot).toEqual(entry.visual.snapshot);
    const observation = await page.evaluate(() => window.__alignerObservation); expect(observation.turns.filter(turn => ['active', 'settling'].includes(turn.phase))).toEqual([]);
    await expectNoAnnotations(fixture); await attachAlignerEvidence(page, testInfo, fixture, { tier: 'free', metadata,
      exercisesHistoricalSharedControls: ['webkit-desktop-normal', 'chromium-phone-reduced'].includes(testInfo.project.name), exactSavedRaw: stored.personalReading, exactSavedNotes: stored.reflections });
    await card.screenshot({ path: testInfo.outputPath(`${metadata}-static-journal.png`) });
  } finally {
    try {
      if (keyboardGeometry && !page.isClosed()) { keyboardEvidence.final = await keyboardGeometry(); keyboardEvidence.finalStage = { association: await keyboardStage.getAttribute('data-association'), held: await keyboardStage.getAttribute('data-held') }; await testInfo.attach('cached-phrase-keyboard-final-or-failure', { body: JSON.stringify(keyboardEvidence,null,2), contentType: 'application/json' }); }
      if ((phoneGeometry || phoneEvidence.eligibilityInput) && !page.isClosed()) {
        if (phoneGeometry) phoneEvidence.final = await phoneGeometry();
        await testInfo.attach('journal-phone-geometry-final-or-failure', { body: JSON.stringify(phoneEvidence, null, 2), contentType: 'application/json' });
      }
    } finally { await fixture.close(); }
  }
});

test('RWS spread and companion follow the recorded edition decision', async ({ page }, testInfo) => {
  const entry = starEntry({ id: 'aligner-editions', cards: imagePair, personalReading: prose });
  const fixture = await createAlignerFixture(page, { initialEntries: [entry], tier: 'pro' }); await observeAligner(page);
  try {
    await page.goto('/journal');
    for (const iteration of ['first', 'reload']) {
      const card = await openAlignerEntry(page, entry.id); const shelf = card.locator('[data-gesture-shelf]');
      await expect(shelf.locator('img').nth(0)).toHaveAttribute('src', /images\/cards\/rws-vector\/major-17-star\.webp$/);
      await expect(shelf.locator('img').nth(1)).toHaveAttribute('src', /images\/cards\/rws-vector\/major-19-sun\.webp$/);
      const urls = await card.locator('img').evaluateAll(images => images.map(image => image.getAttribute('src')));
      expect(urls.some(url => /RWS1909_-_17_Star\.jpeg$/.test(url))).toBe(true); expect(urls.some(url => /RWS1909_-_19_Sun\.jpeg$/.test(url))).toBe(true);
      await expect(shelf.locator('[data-reversed="true"]')).toHaveCount(1);
      const painted = await shelf.locator('.gesture-art__upright').evaluateAll(planes => planes.map(plane => ({ reverse: plane.dataset.reversed === 'true', rotations: getComputedStyle(plane).transform, overlays: [...plane.querySelectorAll('svg image')].map(image => image.getAttribute('href')), image: plane.querySelector('img').getAttribute('src') })));
      expect(painted.map(item => item.reverse)).toEqual([false, true]); for (const item of painted) for (const overlay of item.overlays) expect(overlay).toBe(item.image);
      const literal = card.locator('.reading-gesture-association').filter({ hasText: /\bpool\b/ }); await expect(literal).toHaveCount(1);
      await clickInlineReadingPhrase(literal); await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-held', 'true');
      const light = page.locator('[data-gesture-window] .gesture-focus-layer:not(.gesture-focus-layer--departing) .gesture-art__light image'); await expect(light).toHaveCount(1);
      const detailPlane = await light.evaluate(image => ({ overlay: image.getAttribute('href'), image: image.closest('.gesture-art__upright').querySelector('img').getAttribute('src') }));
      expect(detailPlane.overlay).toBe('/images/cards/rws-vector/major-17-star.webp'); expect(detailPlane.overlay).toBe(detailPlane.image);
      const uprightGeometry = await page.evaluate(measureGestureFocusLayer);
      expect(uprightGeometry.layer).toBe(true); expect(uprightGeometry.cards).toHaveLength(1); expect(uprightGeometry.cards[0].arts).toHaveLength(1);
      for (const art of uprightGeometry.cards.flatMap(card => card.arts)) { expect(art.orientation.halfTurns).toHaveLength(0); expect(art.orientation.unexpected).toEqual([]); expect(art.orientation.reversed).toBe(false); }
      if (testInfo.project.name.includes('-phone-')) { await page.keyboard.press('Escape'); await expect(literal).toBeFocused(); }
      await nativeClick(shelf.locator('button').nth(1));
      await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-association', `identity-${await shelf.locator('button').nth(1).getAttribute('data-occurrence-id')}`);
      const reversedGeometry = await page.evaluate(measureGestureFocusLayer);
      expect(reversedGeometry.layer).toBe(true); expect(reversedGeometry.cards).toHaveLength(1); expect(reversedGeometry.cards[0].arts).toHaveLength(1);
      for (const art of reversedGeometry.cards.flatMap(card => card.arts)) { expect(art.orientation.halfTurns).toHaveLength(1); expect(art.orientation.unexpected).toEqual([]); expect(art.orientation.reversed).toBe(true); expect(art.orientation.composed[0]).toBeLessThan(0); expect(art.orientation.composed[3]).toBeLessThan(0); }
      await card.screenshot({ path: testInfo.outputPath(`editions-${iteration}.png`) });
      await attachAlignerEvidence(page, testInfo, fixture, { tier: 'pro', iteration, artworkDecision: fixture.manifest.decisions.D7, actualImageURLs: urls, planes: painted, actualDetailPlane: detailPlane, uprightGeometry, reversedGeometry });
      if (iteration === 'first') await page.reload();
    }
    await expectNoAnnotations(fixture);
  } finally { await fixture.close(); }
});

test('ten positions, duplicate occurrences, unknown art, non-RWS and translated prose preserve identity', async ({ page }, testInfo) => {
  const cards = [...imagePair, { name: 'The Star', number: 17, position: 'Duplicate star', orientation: 'Reversed' }, { name: 'Unknown traveler', position: 'Unknown', orientation: 'Upright' },
    ...Array.from({ length: 6 }, (_, index) => ({ name: 'The Sun', number: 19, position: `Position ${index + 5}`, orientation: 'Upright' }))];
  const raw = '## Una lectura\n\nLa Estrella acompaña una pausa. El Sol invita a mirar con calma. No se inventa significado personal. ما الذي يدعمني؟';
  const entry = starEntry({ id: 'aligner-ten', cards, personalReading: raw, spread: 'Celtic Cross', spreadKey: 'celtic', deckId: 'thoth-a1', reflections: notes });
  const fixture = await createAlignerFixture(page, { initialEntries: [entry] }); await observeAligner(page);
  const tenGeometry = { keyboard: {} }; let measureShelf;
  try {
    await page.goto('/journal'); const card = await openAlignerEntry(page, entry.id); const shelf = card.locator('[data-gesture-shelf] button'); await expect(shelf).toHaveCount(10);
    const ids = await shelf.evaluateAll(buttons => buttons.map(button => button.dataset.occurrenceId)); expect(new Set(ids).size).toBe(10);
    for (let index = 0; index < 10; index++) { await expect(shelf.nth(index)).toBeEnabled(); await expect(shelf.nth(index)).toHaveAttribute('aria-label', new RegExp(cards[index].position)); }
    measureShelf = (index = -1) => card.locator('[data-gesture-shelf]').evaluate((element, index) => {
      const target = [...element.querySelectorAll('button')].at(index); const rect = target.getBoundingClientRect();
      const label = element => element ? `${element.tagName}#${element.id}.${String(element.className).slice(0, 160)}` : null;
      const bounds = { left: 0, top: 0, right: innerWidth, bottom: innerHeight }; const ancestors = [];
      for (let parent = target; parent; parent = parent.parentElement) {
        const box = parent.getBoundingClientRect(); const style = getComputedStyle(parent);
        if (/(hidden|clip|scroll|auto)/.test(style.overflowX)) { bounds.left = Math.max(bounds.left, box.left); bounds.right = Math.min(bounds.right, box.right); }
        if (/(hidden|clip|scroll|auto)/.test(style.overflowY)) { bounds.top = Math.max(bounds.top, box.top); bounds.bottom = Math.min(bounds.bottom, box.bottom); }
        ancestors.push({ target: label(parent), rect: box.toJSON(), scrollTop: parent.scrollTop, scrollLeft: parent.scrollLeft, overflowX: style.overflowX, overflowY: style.overflowY });
      }
      const overlays = [];
      for (const overlay of document.querySelectorAll('header.sticky, button[aria-label="Start a new reading"], button[aria-label="Jump to journal filters"]')) {
        const box = overlay.getBoundingClientRect(); const style = getComputedStyle(overlay);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) <= .01 || box.bottom <= 0 || box.top >= innerHeight || box.right <= rect.left || box.left >= rect.right) continue;
        if (['sticky', 'fixed'].includes(style.position) && box.top <= (parseFloat(style.top) || 0) + 1 && overlay.matches('header')) bounds.top = Math.max(bounds.top, box.bottom);
        if (overlay.matches('button') && overlay.closest('.fixed')) bounds.bottom = Math.min(bounds.bottom, box.top);
        overlays.push({ target: label(overlay), rect: box.toJSON(), position: style.position });
      }
      const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; const hit = document.elementFromPoint(center.x, center.y); const hitAncestry = [];
      for (let parent = hit; parent; parent = parent.parentElement) hitAncestry.push(label(parent));
      const history = document.querySelector('#history'); const stage = document.querySelector('[data-gesture-window]');
      return { at: performance.now(), scrollX, scrollY, target: { occurrence: target.dataset.occurrenceId, rect: rect.toJSON(), marginTop: getComputedStyle(target).scrollMarginTop, marginBottom: getComputedStyle(target).scrollMarginBottom },
        active: { target: label(document.activeElement), occurrence: document.activeElement?.dataset.occurrenceId }, bounds, center, hitAncestry, ancestors, overlays,
        foreground: center.x >= 0 && center.x < innerWidth && center.y >= 0 && center.y < innerHeight && target.contains(hit),
        fullyVisible: rect.width > 0 && rect.height > 0 && rect.left >= bounds.left && rect.right <= bounds.right && rect.top >= bounds.top && rect.bottom <= bounds.bottom,
        shelf: { scrollLeft: element.scrollLeft, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth },
        history: { scrollLeft: history.scrollLeft, scrollWidth: history.scrollWidth, clientWidth: history.clientWidth }, document: { width: document.documentElement.scrollWidth, viewport: innerWidth },
        stage: { association: stage.dataset.association, held: stage.dataset.held, phase: stage.dataset.phase } };
    }, index);
    await nativeClick(shelf.nth(2)); await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-held', 'true');
    if (testInfo.project.name.includes('-phone-')) { await page.keyboard.press('Escape'); await expect(shelf.nth(2)).toBeFocused(); }
    const images = await shelf.locator('img').evaluateAll(elements => elements.map(element => element.getAttribute('src'))); expect(images[0]).toBe('/images/cards/thoth/thoth_major_17_the-star.png'); expect(images[1]).toBe('/images/cards/thoth/thoth_major_19_the-sun.png'); expect(images[2]).toBe('/images/cards/thoth/thoth_major_17_the-star.png'); expect(images[3]).toBe('/images/card-back.png');
    const unknownImage = shelf.nth(3).locator('img'); await expect.poll(() => unknownImage.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true); expect(images.every(url => !url.startsWith('/images/cards/rws-vector/'))).toBe(true);
    await expect(page.locator('.gesture-art__light, .gesture-art__water')).toHaveCount(0);
    const settleShelf = async (index, label) => {
      const samples = []; tenGeometry.keyboard[label] = { samples }; const started = Date.now(); let previous = ''; let unchangedSince = 0;
      while (Date.now() - started < 5000) {
        const geometry = await measureShelf(index); samples.push(geometry); const signature = JSON.stringify({ ...geometry, at: 0 });
        if (signature !== previous) { previous = signature; unchangedSince = geometry.at; }
        if (geometry.at - unchangedSince >= 250) return { geometry, unchangedSince, samples };
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
      }
      throw new Error(`Native shelf geometry did not settle for ${label}`);
    };
    const beforeLast = await measureShelf(); tenGeometry.beforeLast = beforeLast;
    await testInfo.attach('ten-card-shelf-before-native-last', { body: JSON.stringify(beforeLast, null, 2), contentType: 'application/json' });
    let beforePointer = beforeLast;
    if (testInfo.project.name.includes('-phone-')) {
      const beforeEnd = await settleShelf(2, 'focused-third-before-End'); tenGeometry.keyboard.beforeEnd = beforeEnd.geometry;
      await testInfo.attach('ten-card-shelf-native-keyboard-before-End', { body: JSON.stringify(beforeEnd, null, 2), contentType: 'application/json' });
      await expect(shelf.nth(2)).toBeFocused(); expect(beforeEnd.geometry.foreground).toBe(true); expect(beforeEnd.geometry.fullyVisible).toBe(true);
      await page.keyboard.press('End'); await expect(shelf.last()).toBeFocused();
      const afterEnd = await settleShelf(-1, 'focused-last-after-End'); tenGeometry.keyboard.afterEnd = afterEnd.geometry;
      await testInfo.attach('ten-card-shelf-native-keyboard-after-End', { body: JSON.stringify(afterEnd, null, 2), contentType: 'application/json' });
      expect(afterEnd.geometry.foreground).toBe(true); expect(afterEnd.geometry.fullyVisible).toBe(true); expect(afterEnd.geometry.active.occurrence).toBe(ids.at(-1));
      await page.keyboard.press('Enter'); await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-held', 'true');
      await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-association', `identity-${ids.at(-1)}`);
      await expect(page.getByRole('dialog', { name: 'Card detail', exact: true })).toBeVisible();
      await page.keyboard.press('Escape'); await expect(shelf.last()).toBeFocused();
      const afterEnter = await settleShelf(-1, 'last-focus-restored-after-inspection'); tenGeometry.keyboard.afterEnter = afterEnter.geometry;
      await testInfo.attach('ten-card-shelf-native-keyboard-after-Enter', { body: JSON.stringify(afterEnter, null, 2), contentType: 'application/json' });
      expect(afterEnter.geometry.foreground).toBe(true); expect(afterEnter.geometry.fullyVisible).toBe(true);
      await expect(page.locator('[data-gesture-window]')).not.toHaveAttribute('data-held', 'true');
      // Return through the shelf's public native keyboard navigation so the
      // pointer path must independently expose an offscreen last occurrence.
      await page.keyboard.press('Home'); await expect(shelf.first()).toBeFocused();
      await page.keyboard.press('ArrowRight'); await expect(shelf.nth(1)).toBeFocused();
      await page.keyboard.press('ArrowRight'); await expect(shelf.nth(2)).toBeFocused();
      await settleShelf(2, 'native-return-to-third-before-pointer'); beforePointer = await measureShelf();
      tenGeometry.beforePointer = beforePointer;
      await testInfo.attach('ten-card-shelf-fresh-pointer-baseline', { body: JSON.stringify(beforePointer, null, 2), contentType: 'application/json' });
      expect(beforePointer.target.rect.right).toBeGreaterThan(beforePointer.bounds.right);
    }
    await nativeClick(shelf.last()); await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-held', 'true');
    await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-association', `identity-${ids.at(-1)}`);
    if (testInfo.project.name.includes('-phone-')) {
      await expect(page.getByRole('dialog', { name: 'Card detail', exact: true })).toBeVisible();
      await page.keyboard.press('Escape'); await expect(shelf.last()).toBeFocused();
    }
    const afterLast = testInfo.project.name.includes('-phone-') ? (await settleShelf(-1, 'native-pointer-exact-held-last')).geometry : await measureShelf(); tenGeometry.afterLast = afterLast;
    await testInfo.attach('ten-card-shelf-after-native-last', { body: JSON.stringify({ before: beforePointer, after: afterLast, expectedOccurrence: ids.at(-1), input: 'native End/Enter/Escape on phone, then unchanged native foreground predicate and last-card click' }, null, 2), contentType: 'application/json' });
    expect(afterLast.history.scrollLeft).toBe(0); expect(afterLast.history.scrollWidth).toBeLessThanOrEqual(afterLast.history.clientWidth + 1); expect(afterLast.document.width).toBeLessThanOrEqual(afterLast.document.viewport + 1);
    if (testInfo.project.name.includes('-phone-')) { expect(afterLast.foreground).toBe(true); expect(afterLast.fullyVisible).toBe(true); expect(beforeLast.shelf.scrollWidth).toBeGreaterThan(beforeLast.shelf.clientWidth); expect(afterLast.shelf.scrollLeft).toBeGreaterThan(beforePointer.shelf.scrollLeft); }
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('tarot_journal'))[0]); expect(stored.personalReading).toBe(raw); expect(stored.reflections).toBe(notes);
    await expectNoAnnotations(fixture); await attachAlignerEvidence(page, testInfo, fixture, { occurrenceIds: ids, actualImageURLs: images, exactSavedRaw: raw });
  } finally {
    try {
      if (measureShelf && !page.isClosed()) { tenGeometry.final = { third: await measureShelf(2), last: await measureShelf() }; await testInfo.attach('ten-card-shelf-terminal-or-failure', { body: JSON.stringify(tenGeometry, null, 2), contentType: 'application/json' }); }
    } finally { await fixture.close(); }
  }
});

test('synchronous burst gives every eligible exposed phrase its existing 1800ms turn without scrolling or slowing prose', async ({ page }, testInfo) => {
  const fixture = await createAlignerFixture(page, { tier: 'free' }); await observeAligner(page);
  let setupStartedAt; let viewportSetup; let measuredInterval;
  try {
    await startOrdinaryReading(page, fixture); await expect.poll(() => fixture.requests.reading.length).toBe(1);
    const cards = fixture.requests.reading[0].cardsInfo; const heading = '## Your cards\n\n';
    const supplied = cards.map(card => `${card.card}.`).join(' '); const final = `${heading}${supplied}\n\nKeep your own pace.`;
    // The heading exposes the ordinary prose surface without introducing a card cue.
    // Viewport setup must finish before the synchronous card-name delivery begins.
    setupStartedAt = await page.evaluate(() => performance.now());
    await fixture.emit('reading', 'delta', { text: heading });
    const prose = page.locator('.narrative-stream__text'); await expect(prose).toContainText('Your cards');
    const stage = page.locator('[data-gesture-window]'); await expect(stage).toHaveAttribute('data-association', '');
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.querySelectorAll('.reading-screen img, .narrative-panel__layout img')].map(image => image.decode()));
    });
    await prose.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
    const settleViewport = () => page.evaluate(() => new Promise((resolve, reject) => {
      const startedAt = performance.now(); let unchangedSince = startedAt; let previous = '';
      const sample = () => {
        const at = performance.now(); const prose = document.querySelector('.narrative-stream__text'); const box = prose.getBoundingClientRect();
        const bounds = { left: 0, right: innerWidth, top: 0, bottom: innerHeight }; const overlays = [];
        for (const element of document.querySelectorAll('.header-sticky, .gesture-companion, .mobile-action-bar')) {
          const rect = element.getBoundingClientRect(); const style = getComputedStyle(element);
          if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) <= .01 || rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= box.left || rect.left >= box.right) continue;
          const lower = style.position === 'fixed' && rect.bottom >= innerHeight - 1;
          const stuck = !lower && ['fixed', 'sticky'].includes(style.position) && rect.top <= (parseFloat(style.top) || 0) + 1;
          if (stuck) bounds.top = Math.max(bounds.top, rect.bottom);
          if (lower) bounds.bottom = Math.min(bounds.bottom, rect.top);
          overlays.push({ className: element.className, rect: rect.toJSON(), position: style.position, top: style.top, bottom: style.bottom, stuck, lower });
        }
        const ancestors = [];
        for (let element = prose; element; element = element.parentElement) {
          const rect = element.getBoundingClientRect(); const style = getComputedStyle(element);
          if (/(hidden|clip|scroll|auto)/.test(style.overflowX)) { bounds.left = Math.max(bounds.left, rect.left); bounds.right = Math.min(bounds.right, rect.right); }
          if (/(hidden|clip|scroll|auto)/.test(style.overflowY)) { bounds.top = Math.max(bounds.top, rect.top); bounds.bottom = Math.min(bounds.bottom, rect.bottom); }
          ancestors.push({ tag: element.tagName, id: element.id, className: element.className, rect: rect.toJSON(), scrollTop: element.scrollTop, scrollLeft: element.scrollLeft, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, overflowX: style.overflowX, overflowY: style.overflowY });
        }
        // Text-node ranges exclude the atmosphere decoration's non-prose geometry.
        const walker = document.createTreeWalker(prose, NodeFilter.SHOW_TEXT); const fragments = []; let text;
        while ((text = walker.nextNode())) {
          if (!text.textContent.includes('Your cards')) continue;
          const range = document.createRange(); range.selectNodeContents(text);
          for (const rect of range.getClientRects()) if (rect.width > 0 && rect.height > 0) {
            const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
            fragments.push({ rect: rect.toJSON(), owned: Boolean(hit && prose.contains(hit)), hit: hit?.outerHTML.slice(0, 180) });
          }
        }
        const geometry = { scrollY, scrollX, viewport: { width: innerWidth, height: innerHeight }, documentHeight: document.documentElement.scrollHeight,
          prose: box.toJSON(), bounds, overlays, ancestors, fragments,
          wholeProseExposed: box.left >= bounds.left && box.right <= bounds.right && box.top >= bounds.top && box.bottom <= bounds.bottom };
        const signature = JSON.stringify(geometry); if (signature !== previous) { previous = signature; unchangedSince = at; }
        if (at - unchangedSince >= 250) return resolve({ startedAt, settledAt: at, unchangedSince, geometry });
        if (at - startedAt > 5000) return reject(new Error('Viewport/header/prose geometry did not settle before cue delivery'));
        requestAnimationFrame(sample);
      }; requestAnimationFrame(sample);
    }));
    viewportSetup = { kind: testInfo.project.name.startsWith('webkit-phone-') ? 'scripted initial viewport placement and bounded external-keyboard emulation before any card cue' : 'scripted initial viewport placement and at most one native document wheel before any card cue', initial: await settleViewport(), nativeWheel: null };
    await expect(stage).toHaveAttribute('data-association', '');
    expect(await page.evaluate(() => window.__alignerObservation.turns.filter(turn => turn.id))).toEqual([]);
    const initial = viewportSetup.initial.geometry;
    if (!initial.wholeProseExposed) {
      const deltaY = initial.prose.top < initial.bounds.top ? initial.prose.top - (initial.bounds.top + 16) : initial.prose.bottom - (initial.bounds.bottom - 16);
      expect(Math.abs(deltaY)).toBeLessThanOrEqual(initial.viewport.height);
      const pointer = { x: Math.max(1, initial.prose.left - 4), y: initial.viewport.height / 2 };
      const documentTarget = await page.evaluate(point => { const hit = document.elementFromPoint(point.x, point.y); return { present: Boolean(hit), ordinaryDocument: Boolean(hit && !hit.closest('[data-gesture-shelf], .mobile-action-bar')) }; }, pointer);
      expect(documentTarget).toEqual({ present: true, ordinaryDocument: true });
      viewportSetup.nativeWheel = { deltaY, pointer, documentTarget, before: initial };
      if (testInfo.project.name.startsWith('webkit-phone-')) {
        viewportSetup.nativeWheel.keyboardInput = {};
        await scrollMobileWebKitDocument(page, { deltaY, pointer, measure: () => prose.evaluate(inspectReadingViewport),
          exposed: geometry => geometry.wholeProseExposed && geometry.fragments.length > 0 && geometry.fragments.every(fragment => fragment.owned),
          canContinue: geometry => deltaY > 0 ? geometry.prose.top >= geometry.bounds.top : geometry.prose.bottom <= geometry.bounds.bottom,
          receipt: viewportSetup.nativeWheel.keyboardInput });
      } else {
        await page.mouse.move(pointer.x, pointer.y); await page.mouse.wheel(0, deltaY);
      }
    }
    viewportSetup.ready = await settleViewport();
    expect(viewportSetup.ready.geometry.wholeProseExposed).toBe(true);
    expect(viewportSetup.ready.geometry.fragments.length).toBeGreaterThan(0);
    expect(viewportSetup.ready.geometry.fragments.every(fragment => fragment.owned)).toBe(true);
    await expect(stage).toHaveAttribute('data-association', '');
    expect(await page.evaluate(() => window.__alignerObservation.turns.filter(turn => turn.id))).toEqual([]);
    measuredInterval = await page.evaluate(() => ({ startedAt: performance.now(), scrollY }));
    const scroll = measuredInterval.scrollY;
    const chunks = cards.map((card, index) => `${index ? ' ' : ''}${card.card}.`);
    await fixture.emitBurst(chunks.map(text => ({ event: 'delta', data: { text } })));
    await expect(page.locator('.narrative-stream')).toContainText(supplied);
    const phrases = page.locator('.narrative-stream__text [data-gesture-id]'); await expect(phrases).toHaveCount(cards.length);
    // Card names now support explicit full-card inspection. Automatic arrivals
    // must still never invoke that ordinary-route selection callback.
    await expect(page.locator('.reading-gesture-association')).toHaveCount(cards.length);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const calm = testInfo.project.name.endsWith('-reduced');
    {
      const expectedPhase = calm ? 'static' : 'active';
      await expect.poll(async () => page.evaluate(phase => new Set(window.__alignerObservation.turns.filter(turn => turn.id && turn.phase === phase && !turn.held).map(turn => turn.id)).size, expectedPhase), { timeout: 12000 }).toBeGreaterThanOrEqual(cards.length);
      if (!calm) await expect.poll(() => page.evaluate(() => {
        const turns = window.__alignerObservation.turns; const last = turns.findLastIndex(turn => turn.phase === 'active' && !turn.held);
        return last >= 0 && turns.slice(last + 1).some(turn => turn.id !== turns[last].id || turn.phase !== 'active');
      }), { timeout: 5000 }).toBe(true);
      expect(await page.evaluate(() => window.__alignerObservation.batchTransitionViolations), 'Multiple phase/id transitions in one observer batch require adjudication').toEqual([]);
      const turns = await page.evaluate(() => window.__alignerObservation.turns);
      const active = turns.filter((turn, index) => turn.id && turn.phase === expectedPhase && !turn.held && (turns[index - 1]?.id !== turn.id || turns[index - 1]?.phase !== turn.phase || turns[index - 1]?.held));
      const ids = await phrases.evaluateAll(elements => elements.map(element => element.dataset.gestureId));
      expect(active.map(turn => turn.id)).toEqual(ids);
      const visibility = await page.evaluate(() => window.__alignerObservation.phraseVisibility);
      for (const turn of active) { const exposure = visibility.filter(event => event.id === turn.id && event.at <= turn.at + 50).at(-1); expect(exposure?.visible).toBe(true); }
      if (calm) {
        expect(turns.filter(turn => ['active', 'settling'].includes(turn.phase))).toEqual([]);
        for (let index = 0; index < active.length - 1; index++) { const duration = active[index + 1].at - active[index].at; expect(duration).toBeGreaterThanOrEqual(1750); expect(duration).toBeLessThan(2300); }
        const last = active.at(-1); await expect.poll(() => page.evaluate(at => performance.now() - at, last.at), { timeout: 3000 }).toBeGreaterThanOrEqual(1800);
        await expect(stage).toHaveAttribute('data-association', last.id);
        expect(await page.locator('[data-gesture-art]').evaluateAll(arts => arts.flatMap(art => art.getAnimations({ subtree: true })).filter(animation => animation.playState === 'running').length)).toBe(0);
        expect(await page.evaluate(() => window.__alignerObservation.turns.filter(turn => ['active', 'settling'].includes(turn.phase)))).toEqual([]);
      } else {
        for (const entry of active) {
          const startIndex = turns.indexOf(entry); const exit = turns.slice(startIndex + 1).find(turn => turn.id !== entry.id || turn.phase !== 'active' || turn.held);
          expect(exit, `Missing exit for eligible active turn ${entry.id}`).toBeTruthy(); const duration = exit.at - entry.at;
          expect(duration).toBeGreaterThanOrEqual(1750); expect(duration).toBeLessThan(2300);
          expect(visibility.filter(event => event.id === entry.id && event.at >= entry.at && event.at < exit.at).every(event => event.visible)).toBe(true);
        }
      }
    }
    if (calm) await expect(stage).toHaveAttribute('data-phase', 'static');
    expect(await page.evaluate(() => scrollY)).toBe(scroll);
    const measuredScroll = await page.evaluate(start => window.__alignerObservation.scroll.filter(event => event.at >= start), measuredInterval.startedAt);
    expect(measuredScroll.every(event => event.y === scroll)).toBe(true);
    measuredInterval.endedAt = await page.evaluate(() => performance.now());
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await fixture.emit('reading', 'done', { fullText: final }); await expect(page.locator('.narrative-stream')).toContainText('Keep your own pace.');
    const observation = await page.evaluate(() => window.__alignerObservation); const received = observation.source.find(event => event.event === 'delta' && event.data.text === chunks[0]);
    const rendered = observation.renders.find(event => event.at >= received.at && event.text.includes(supplied)); expect(rendered.at - received.at).toBeLessThan(1000);
    await expectNoAnnotations(fixture); await attachAlignerEvidence(page, testInfo, fixture, { tier: 'free', delivery: 'synchronous-burst', setupStartedAt, viewportSetup, measuredInterval, synchronousChunks: chunks, suppliedRaw: final, D1: fixture.manifest.decisions.D1 });
  } finally {
    try { if (!page.isClosed()) await attachAlignerEvidence(page, testInfo, fixture, { tier: 'free', delivery: 'synchronous-burst', setupStartedAt, viewportSetup, measuredInterval, capture: 'terminal-or-failure-before-health-close' }); }
    finally { await fixture.close(); }
  }
});

test('English physical detail prose cannot attach RWS geometry to actual non-RWS artwork', async ({ page }, testInfo) => {
  const raw = 'The Star shows one pitcher into a pool and the other onto the land. The Sun is in the next position.';
  const entry = starEntry({ id: 'aligner-thoth-literal', cards: imagePair, personalReading: raw, deckId: 'thoth-a1' });
  const fixture = await createAlignerFixture(page, { initialEntries: [entry] }); await observeAligner(page);
  try {
    await page.goto('/journal'); const card = await openAlignerEntry(page, entry.id);
    const identity = card.locator('.reading-gesture-identity').filter({ hasText: 'The Star' }).first(); await expect(identity).toBeVisible();
    await expect(identity).not.toHaveAttribute('role', 'button'); await expect(card.locator('.reading-gesture-association')).toHaveCount(0);
    await nativeClick(card.locator('[data-gesture-shelf] button').first());
    await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-held', 'true');
    await expect(page.locator('[data-gesture-window] .gesture-focus-layer:not(.gesture-focus-layer--departing) img')).toHaveAttribute('src', '/images/cards/thoth/thoth_major_17_the-star.png');
    await expect(page.locator('.gesture-art__light, .gesture-art__water')).toHaveCount(0);
    const images = await card.locator('[data-gesture-shelf] img').evaluateAll(elements => elements.map(element => element.getAttribute('src')));
    expect(images).toEqual(['/images/cards/thoth/thoth_major_17_the-star.png', '/images/cards/thoth/thoth_major_19_the-sun.png']);
    expect(images.some(url => url.startsWith('/images/cards/rws-vector/'))).toBe(false);
    if (testInfo.project.name.includes('-phone-')) {
      await page.keyboard.press('Escape');
      await expect(card.locator('[data-gesture-shelf] button').first()).toBeFocused();
    }
    await expectNoAnnotations(fixture); await attachAlignerEvidence(page, testInfo, fixture, { exactSavedRaw: raw, actualNonRwsURLs: images, EnglishPhysicalDetailSource: true });
  } finally { await fixture.close(); }
});
