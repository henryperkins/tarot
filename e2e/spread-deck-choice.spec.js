import { test, expect } from './helpers/frontendTest.js';

// Spread and deck choice: what a tap keeps, what it asks first, what survives a
// reload, and how the shared choice carousel behaves on phones.
test.use({ serviceWorkers: 'block' });

const SPREAD_GROUP = '[role="radiogroup"][aria-label="Spread selection"]';
const DECK_GROUP = '[role="radiogroup"][aria-label="Choose your deck style"]';

function setupScript() {
  return ({ deck }) => {
    localStorage.setItem('tarot-onboarding-complete', 'true');
    localStorage.setItem('tarot-nudge-state', JSON.stringify({
      readingCount: 1,
      hasSeenRitualNudge: true,
      hasSeenGestureCoach: true,
      hasSeenJournalNudge: true,
      journalSaveCount: 0,
      hasDismissedAccountNudge: false
    }));
    if (deck) localStorage.setItem('tarot-deck-style', deck);
  };
}

async function openSetup(page, { deck = null } = {}) {
  await page.addInitScript(setupScript(), { deck });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator(SPREAD_GROUP)).toBeVisible({ timeout: 15000 });
}

const dealtCards = page => page.locator('button[aria-label*="Tap to reveal"], button[aria-label*="position. Click to reveal."], button[aria-label*="position. Click to view details."]');

async function drawThreeCards(page) {
  await page.getByRole('button', { name: /^Draw cards$/ }).first().click();
  await page.getByRole('button', { name: /^Deal spread/ }).click();
  await expect(dealtCards(page)).toHaveCount(3);
}

test.describe('Spread and deck choice @desktop', () => {
  test('re-choosing the spread in use keeps the cards; another spread asks first', async ({ page }) => {
    await openSetup(page);
    await drawThreeCards(page);
    await page.getByRole('button', { name: /^Step 1: Spread/ }).first().click();
    const threeCard = page.getByRole('radio', { name: /Three-Card Story/ });
    const fiveCard = page.getByRole('radio', { name: /Five-Card Clarity/ });
    await expect(threeCard).toHaveAttribute('aria-checked', 'true');

    await threeCard.click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(dealtCards(page)).toHaveCount(3);

    await fiveCard.click();
    const confirm = page.getByRole('dialog', { name: 'Switch to Five-Card Clarity?' });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Keep these cards' }).click();
    await expect(confirm).toBeHidden();
    await expect(fiveCard).toBeFocused();
    await expect(threeCard).toHaveAttribute('aria-checked', 'true');
    await expect(dealtCards(page)).toHaveCount(3);

    await fiveCard.click();
    await page.getByRole('dialog', { name: 'Switch to Five-Card Clarity?' }).getByRole('button', { name: 'Switch spread' }).click();
    await expect(fiveCard).toHaveAttribute('aria-checked', 'true');
    await expect(dealtCards(page)).toHaveCount(0);
  });

  test('a spread chosen before the draw survives a reload', async ({ page }) => {
    await openSetup(page);
    await page.getByRole('radio', { name: /Five-Card Clarity/ }).click();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('radio', { name: /Five-Card Clarity/ })).toHaveAttribute('aria-checked', 'true');
  });

  test('arrow keys browse without choosing, and one Tab leaves the group', async ({ page }) => {
    await openSetup(page);
    const group = page.locator(SPREAD_GROUP);
    await group.locator('[aria-checked="true"]').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('radio', { name: 'One-Card Insight', exact: true })).toBeFocused();
    await expect(page.getByRole('radio', { name: /Three-Card Story/ })).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Tab');
    expect(await group.evaluate(el => el.contains(document.activeElement))).toBe(false);
  });

  test('deck copy explains the choice, and says when it waits for the next draw', async ({ page }) => {
    await openSetup(page);
    // The Prepare panel reuses the deck panel's class; take the one holding the decks.
    const deckPanel = page.locator('.deck-selector-panel').filter({ has: page.locator(DECK_GROUP) });
    await expect(deckPanel).toContainText('The deck sets the card art and the card names in your reading.');
    // The photo study is off in this build, so nobody is recruited for it.
    await expect(deckPanel).not.toContainText(/vision study|research participants/i);

    await drawThreeCards(page);
    await page.getByRole('button', { name: /^Step 1: Spread/ }).first().click();
    await expect(deckPanel).toContainText('Your next draw uses the deck you choose. The cards on the table keep theirs.');
  });

  test('the upgrade dialog names the plan as the card does', async ({ page }) => {
    await openSetup(page);
    const celtic = page.getByRole('radio', { name: /Celtic Cross/ });
    await expect(celtic).toHaveAccessibleDescription(/Requires Plus/);
    await celtic.click();
    const dialog = page.getByRole('dialog', { name: 'Unlock Celtic Cross (Classic 10-Card)' });
    await expect(dialog).toHaveAccessibleDescription('Celtic Cross (Classic 10-Card) comes with Plus, along with everything listed below.');
    await expect(dialog).not.toContainText('Enlightened');
    await expect(dialog.getByRole('button', { name: /^Upgrade to Plus/ })).toBeVisible();
  });
});

test.describe('Spread and deck carousels @mobile', () => {
  test('the deck drawer opens on the saved deck, with Previous and Next', async ({ page }) => {
    await openSetup(page, { deck: 'marseille-classic' });
    await page.getByRole('button', { name: 'Change deck' }).click();
    const drawer = page.getByRole('dialog');
    const group = drawer.locator(DECK_GROUP);
    await expect(group).toBeVisible();
    const visibleFraction = await group.evaluate(el => {
      const card = el.querySelector('[aria-checked="true"]').closest('.deck-card').getBoundingClientRect();
      const view = el.getBoundingClientRect();
      return (Math.min(card.right, view.right) - Math.max(card.left, view.left)) / card.width;
    });
    expect(visibleFraction).toBeGreaterThan(0.98);
    await expect(drawer.getByRole('button', { name: 'Show Tarot de Marseille' })).toHaveAttribute('aria-current', 'true');
    await expect(drawer.getByRole('button', { name: 'Previous deck' })).toBeVisible();
  });

  test('spread arrows sit level with the artwork, clear of the text', async ({ page }) => {
    await openSetup(page);
    const group = page.locator(SPREAD_GROUP);
    await group.scrollIntoViewIfNeeded();
    const layout = await group.evaluate(el => {
      const view = el.getBoundingClientRect();
      const centre = view.left + view.width / 2;
      const card = [...el.children].reduce((best, item) => {
        const r = item.getBoundingClientRect();
        const distance = Math.abs(r.left + r.width / 2 - centre);
        return !best || distance < best.distance ? { item, distance } : best;
      }, null).item;
      const art = card.querySelector('.spread-card__preview').getBoundingClientRect();
      const title = card.querySelector('.spread-card__title-text').getBoundingClientRect();
      const next = document.querySelector('button[aria-label="Next spread"]').getBoundingClientRect();
      return {
        offset: Math.abs((next.top + next.height / 2) - (art.top + art.height / 2)),
        overTitle: next.left < title.right && next.right > title.left && next.top < title.bottom && next.bottom > title.top
      };
    });
    expect(layout.offset).toBeLessThan(4);
    expect(layout.overTitle).toBe(false);
  });
});
