import { test, expect } from './helpers/frontendTest.js';

// The optional ritual happens at the reading table, on the deck itself: knock
// on its face, cut along its edge, then deal, or simply deal. Setup carries no
// ritual, and step 3 of the progress follows what the reader actually did.
test.use({ serviceWorkers: 'block' });

const SPREAD_GROUP = '[role="radiogroup"][aria-label="Spread selection"]';
const INVITE = 'Knock three times and cut where it feels right, or simply deal.';

async function openSetup(page, { hideRitual = false } = {}) {
  await page.addInitScript(hide => {
    localStorage.setItem('tarot-onboarding-complete', 'true');
    localStorage.setItem('tarot-nudge-state', JSON.stringify({
      readingCount: 2, hasSeenRitualNudge: true, hasSeenGestureCoach: true,
      hasSeenJournalNudge: true, hasDismissedAccountNudge: true
    }));
    if (hide) localStorage.setItem('tarot-personalization:guest', JSON.stringify({ showRitualSteps: false }));
  }, hideRitual);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator(SPREAD_GROUP)).toBeVisible({ timeout: 15000 });
}

const progressStep = (page, number) => page.getByRole('navigation', { name: 'Tarot reading progress', exact: true })
  .locator('.step-progress-canvas__item').nth(number - 1);
const deckFace = page => page.getByRole('button', { name: /^Knock on the deck|^Knocked three times$/ });
const cutEdge = page => page.getByRole('slider', { name: 'Cut the deck', exact: true });
const tableStatus = page => page.locator('.reading-table__status');
const snapshotRitual = page => page.evaluate(() => JSON.parse(sessionStorage.getItem('tarot:reading-snapshot') || 'null')?.ritual ?? null);

async function drawToTable(page) {
  await page.getByRole('button', { name: 'Draw cards', exact: true }).filter({ visible: true }).first().click();
  await expect(page.getByRole('button', { name: 'Deal spread', exact: true }).filter({ visible: true })).toBeVisible();
}

test.describe('The ritual at the reading table @desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('setup carries no ritual, and step 3 points at Draw cards until the cards are drawn', async ({ page }) => {
    await openSetup(page);
    await expect(page.getByRole('button', { name: /^Ritual/ })).toHaveCount(0);
    await expect(page.getByRole('slider')).toHaveCount(0);
    await expect(progressStep(page, 3)).toHaveAttribute('data-step-state', 'upcoming');
    await page.getByRole('button', { name: /^Step 3: Ritual/ }).click();
    await expect(page.getByRole('button', { name: 'Draw cards', exact: true })).toBeFocused();
    await expect(progressStep(page, 3)).toHaveAttribute('data-step-state', 'upcoming');
  });

  test('three knocks on the deck complete the ritual, and Deal keeps it done', async ({ page }) => {
    await openSetup(page);
    await drawToTable(page);
    const deal = page.getByRole('button', { name: 'Deal spread', exact: true });
    // Focus after Draw is unchanged; Deal carries the invitation for screen readers.
    await expect(deal).toBeFocused();
    await expect(deal).toHaveAccessibleDescription(INVITE);
    await expect(progressStep(page, 3)).toHaveAttribute('data-step-state', 'current');

    const face = deckFace(page);
    for (const next of [1, 2, 3]) {
      await expect(face).toHaveAccessibleName(`Knock on the deck, ${next} of 3`);
      await face.click();
    }
    await expect(face).toHaveAccessibleName('Knocked three times');
    await expect(face).toHaveAttribute('aria-disabled', 'true');
    await expect(tableStatus(page)).toHaveText('Knocked three times.');
    await expect(progressStep(page, 3)).toHaveAttribute('data-step-state', 'completed');
    await expect(progressStep(page, 4)).toHaveAttribute('data-step-state', 'current');

    await deal.click();
    await expect(page.getByRole('button', { name: /^Reveal next:/ })).toBeVisible();
    await expect(face).toHaveCount(0);
    await expect(tableStatus(page)).toHaveText('0 of 3 cards revealed');
    await expect(progressStep(page, 3)).toHaveAttribute('data-step-state', 'completed');
    // The resumable snapshot keeps the ritual with the dealt cards.
    await expect.poll(() => snapshotRitual(page)).toMatchObject({ hasKnocked: true, knockCount: 3, hasCut: false });
  });

  test('the edge cuts the deck: arrows move the cut, Enter or leaving makes it, a click points it', async ({ page }) => {
    await openSetup(page);
    await drawToTable(page);
    const edge = cutEdge(page);
    await expect(edge).toHaveAttribute('min', '1');
    await expect(edge).toHaveAttribute('max', '77');
    await expect(edge).toHaveAttribute('aria-valuetext', 'Card 39 of 78');
    await expect(tableStatus(page)).toHaveText('');

    // Arrows move the cut without making it; Escape puts it back.
    await edge.focus();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(edge).toHaveAttribute('aria-valuetext', 'Card 37 of 78');
    await expect(tableStatus(page)).toHaveText('');
    await page.keyboard.press('Escape');
    await expect(edge).toHaveAttribute('aria-valuetext', 'Card 39 of 78');
    await expect(progressStep(page, 3)).toHaveAttribute('data-step-state', 'current');

    // Enter makes the cut.
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(tableStatus(page)).toHaveText('Cut at card 41 of 78.');
    await expect(edge).toBeFocused();
    await expect(progressStep(page, 3)).toHaveAttribute('data-step-state', 'completed');

    // Leaving the edge after moving it makes the cut too.
    await page.keyboard.press('End');
    await page.keyboard.press('Shift+Tab');
    await expect(tableStatus(page)).toHaveText('Cut at card 77 of 78.');

    // A click along the edge cuts where it points; the reader may re-cut until Deal.
    const box = await page.locator('.table-ritual__edge').boundingBox();
    await page.mouse.click(box.x + box.width * 0.25, box.y + box.height - 16);
    await expect(edge).toHaveAttribute('aria-valuetext', /^Card (19|20) of 78$/);
    const cut = Number(await edge.inputValue());
    await expect(tableStatus(page)).toHaveText(`Cut at card ${cut} of 78.`);

    await page.getByRole('button', { name: 'Deal spread', exact: true }).click();
    await expect(cutEdge(page)).toHaveCount(0);
    await expect.poll(() => snapshotRitual(page)).toMatchObject({ hasCut: true, cutIndex: cut, knockCount: 0 });
  });

  test('a drag along the edge previews the cut and makes it on release', async ({ page }) => {
    await openSetup(page);
    await drawToTable(page);
    const box = await page.locator('.table-ritual__edge').boundingBox();
    const y = box.y + box.height - 16;
    await page.mouse.move(box.x + box.width * 0.5, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.7, y, { steps: 4 });
    await page.mouse.move(box.x + box.width * 0.75, y, { steps: 2 });
    await expect(page.locator('.table-ritual__edge')).toHaveAttribute('data-dragging', 'true');
    await expect(tableStatus(page)).toHaveText('');
    await page.mouse.up();
    await expect(cutEdge(page)).toHaveAttribute('aria-valuetext', /^Card (58|59) of 78$/);
    await expect(tableStatus(page)).toHaveText(/^Cut at card (58|59) of 78\.$/);
  });

  test('dealing without knocking three times or cutting marks the ritual skipped', async ({ page }) => {
    await openSetup(page);
    await drawToTable(page);
    // Step 3 at the table leads to the deck's face.
    await page.getByRole('button', { name: /^Step 3: Ritual/ }).click();
    await expect(deckFace(page)).toBeFocused();
    await deckFace(page).click();
    await expect(tableStatus(page)).toHaveText('Knocked once.');
    await expect(progressStep(page, 3)).toHaveAttribute('data-step-state', 'current');
    await page.getByRole('button', { name: 'Deal spread', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Step 3: Ritual (optional), skipped', exact: true })).toBeVisible();
  });

  test('readers who hide ritual steps see the deck and Deal only', async ({ page }) => {
    await openSetup(page, { hideRitual: true });
    await expect(page.getByRole('button', { name: 'Step 3: Ritual (optional), skipped', exact: true })).toBeVisible();
    await drawToTable(page);
    const deal = page.getByRole('button', { name: 'Deal spread', exact: true });
    await expect(deal).toBeFocused();
    await expect(deal).not.toHaveAttribute('aria-describedby', /.+/);
    await expect(page.getByText(INVITE)).toHaveCount(0);
    await expect(deckFace(page)).toHaveCount(0);
    await expect(cutEdge(page)).toHaveCount(0);
    await expect(tableStatus(page)).toHaveText('Your deck is ready. Deal when you feel ready.');
    await expect(progressStep(page, 4)).toHaveAttribute('data-step-state', 'current');
  });

  test('a reload at the table keeps the knocks and the cut', async ({ page }) => {
    await openSetup(page);
    await drawToTable(page);
    for (let knock = 0; knock < 3; knock++) await deckFace(page).click();
    await cutEdge(page).focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('Enter');
    await expect(tableStatus(page)).toHaveText('Knocked three times. Cut at card 1 of 78.');
    await page.reload();
    await expect(deckFace(page)).toHaveAccessibleName('Knocked three times');
    await expect(cutEdge(page)).toHaveAttribute('aria-valuetext', 'Card 1 of 78');
    await expect(tableStatus(page)).toHaveText('Knocked three times. Cut at card 1 of 78.');
    await expect(progressStep(page, 3)).toHaveAttribute('data-step-state', 'completed');
  });
});

test.describe('The ritual at the reading table on a phone-sized screen', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('the deck face and edge are full touch targets, read before Deal in the bottom bar', async ({ page }) => {
    await openSetup(page);
    await page.getByRole('button', { name: /^Step 3: Ritual/ }).click();
    await expect(page.locator('[data-app-bottom-actions]').getByRole('button', { name: 'Draw cards', exact: true })).toBeFocused();
    await drawToTable(page);
    const face = await deckFace(page).boundingBox();
    const edge = await page.locator('.table-ritual__edge').boundingBox();
    expect(face.width).toBeGreaterThanOrEqual(44);
    expect(face.height).toBeGreaterThanOrEqual(44);
    expect(edge.height).toBeGreaterThanOrEqual(44);
    expect(edge.width).toBeGreaterThan(300);
    // Deck, then edge, then Deal: the ritual comes before the action that ends it.
    await deckFace(page).focus();
    await page.keyboard.press('Tab');
    await expect(cutEdge(page)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-app-bottom-actions]').getByRole('button', { name: 'Deal spread', exact: true })).toBeFocused();
  });
});

test.describe('The ritual at the reading table — WebKit @mobile', () => {
  test('taps knock on the deck and cut along its edge', async ({ page }) => {
    await openSetup(page);
    await drawToTable(page);
    for (let knock = 0; knock < 3; knock++) await deckFace(page).tap();
    await expect(tableStatus(page)).toHaveText('Knocked three times.');
    const box = await page.locator('.table-ritual__edge').boundingBox();
    await page.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height - 16);
    await expect(tableStatus(page)).toHaveText(/^Knocked three times\. Cut at card (38|39|40) of 78\.$/);
    await page.locator('[data-app-bottom-actions]').getByRole('button', { name: 'Deal spread', exact: true }).tap();
    await expect(tableStatus(page)).toHaveText('0 of 3 cards revealed');
    await expect(page.getByRole('button', { name: 'Step 3: Ritual (optional), completed', exact: true })).toBeVisible();
  });
});
