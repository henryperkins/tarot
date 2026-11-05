import { test, expect } from './helpers/frontendTest.js';
import { createNarrativeFixture } from './helpers/narrativeFixtures.js';

// A signed-in reader's setup should know them: on a new device it opens on
// their own setup, not first-run onboarding, offers saved memories only when
// there are some, and offers their last intention in their own words.
test.use({ serviceWorkers: 'block' });

const SPREAD_GROUP = '[role="radiogroup"][aria-label="Spread selection"]';
const WELCOME = { name: 'Welcome to Tableu' };
const FINISHED_ELSEWHERE = {
  v: 1,
  personalization: { displayName: 'Henry', tarotExperience: 'intermediate' },
  explicitFields: ['displayName', 'tarotExperience'],
  onboardingCompletedAt: 1_700_000_000,
  updatedAt: 1_700_000_000
};

async function seedReturningDevice(page) {
  await page.addInitScript(() => localStorage.setItem('tarot-onboarding-complete', 'true'));
}

test.describe('Signed-in continuity on the setup screen', () => {
  test('a new device opens on the reader\'s own setup when the account finished onboarding', async ({ page }) => {
    const fixture = await createNarrativeFixture(page, { accountPreferences: FINISHED_ELSEWHERE });
    try {
      await page.goto('/');
      await expect(page.locator(SPREAD_GROUP)).toBeVisible();
      await expect(page.getByRole('dialog', WELCOME)).toHaveCount(0);
      // The name chosen on another device greets the question.
      await expect(page.getByRole('textbox', { name: 'What would you like to understand, Henry?' })).toBeVisible();
      await expect.poll(() => page.evaluate(() => localStorage.getItem('tarot-onboarding-complete'))).toBe('true');
    } finally {
      await fixture.close();
    }
  });

  test('without an account record the welcome opens, and finishing it is kept on the account', async ({ page }) => {
    const fixture = await createNarrativeFixture(page);
    try {
      await page.goto('/');
      const welcome = page.getByRole('dialog', WELCOME);
      await expect(welcome).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(welcome).toHaveCount(0);
      await expect.poll(() => fixture.requests.accountPreferences.at(-1)?.onboardingCompleted ?? null).toBe(true);
    } finally {
      await fixture.close();
    }
  });

  test('saved memories are offered only when there are some, with where to review them', async ({ page }) => {
    const empty = await createNarrativeFixture(page);
    try {
      await seedReturningDevice(page);
      await page.goto('/');
      await expect(page.locator(SPREAD_GROUP)).toBeVisible();
      await expect(page.getByRole('checkbox', { name: 'Use saved memories in this reading.' })).toHaveCount(0);
    } finally {
      await empty.close();
    }
  });

  test('a reader with Reader Memory sees the choice, its meaning and a way to review it', async ({ page }) => {
    const fixture = await createNarrativeFixture(page, {
      memories: [{ id: 'memory-1', text: 'Returns often to questions about work and rest.', category: 'theme' }]
    });
    try {
      await seedReturningDevice(page);
      await page.goto('/');
      const choice = page.getByRole('checkbox', { name: 'Use saved memories in this reading.' });
      await expect(choice).toBeChecked();
      await expect(choice).toHaveAccessibleDescription(/kept from your chats/);
      await expect(page.getByRole('link', { name: 'Review Reader Memory' })).toHaveAttribute('href', '/account#practice');
    } finally {
      await fixture.close();
    }
  });

  test('the last saved intention returns in the reader\'s own words', async ({ page }) => {
    const fixture = await createNarrativeFixture(page);
    const intention = 'How can I balance work and rest this week?';
    try {
      await seedReturningDevice(page);
      await page.addInitScript(question => localStorage.setItem('tarot_coach_history_fixture-pro-user', JSON.stringify([
        { id: 'question-1', question, createdAt: 1_700_000_000_000 }
      ])), intention);
      await page.goto('/');
      const field = page.getByRole('textbox', { name: /What would you like to understand/ });
      await expect(field).toHaveValue('');
      await page.getByRole('button', { name: `Return to “${intention}”` }).click();
      await expect(field).toHaveValue(intention);
      await expect(field).toBeFocused();
      await expect(page.getByRole('button', { name: /^Return to/ })).toHaveCount(0);
    } finally {
      await fixture.close();
    }
  });
});

test.describe('Signed-in continuity on phones @mobile', () => {
  test('the last saved intention returns from the question card', async ({ page }) => {
    const fixture = await createNarrativeFixture(page);
    const intention = 'What would help me rest well?';
    try {
      await seedReturningDevice(page);
      await page.addInitScript(question => localStorage.setItem('tarot_coach_history_fixture-pro-user', JSON.stringify([
        { id: 'question-1', question, createdAt: 1_700_000_000_000 }
      ])), intention);
      await page.goto('/');
      const field = page.locator('#quick-intention');
      await page.getByRole('button', { name: `Return to “${intention}”` }).tap();
      await expect(field).toHaveValue(intention);
      await expect(field).toBeFocused();
    } finally {
      await fixture.close();
    }
  });
});
