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

// Model another device updating the server copy while this browser is closed.
// Only the account response is controlled; the real provider handles storage,
// adoption, edits and the subsequent reload.
async function accountCopy(page, initial) {
  const fixture = await createNarrativeFixture(page);
  let remote = initial;
  const writes = [];
  await page.route('**/api/account/preferences', async route => {
    if (route.request().method() === 'PUT') {
      const payload = route.request().postDataJSON();
      writes.push(payload);
      remote = { ...payload, onboardingCompletedAt: 1_700_000_000, updatedAt: 1_800_000_000 };
    }
    await route.fulfill({ json: { preferences: remote, available: true } });
  });
  return { writes, set: value => { remote = value; }, close: () => fixture.close() };
}

const storedPersonalization = page => page.evaluate(() => JSON.parse(localStorage.getItem('tarot-personalization:fixture-pro-user') || '{}'));

test.describe('Account choices and device choices across reloads', () => {
  test('an inherited account choice refreshes after another device changes it, without an automatic stale PUT', async ({ page }) => {
    const copy = await accountCopy(page, FINISHED_ELSEWHERE);
    try {
      await page.goto('/');
      await expect(page.getByRole('textbox', { name: 'What would you like to understand, Henry?' })).toBeVisible();
      copy.set({ ...FINISHED_ELSEWHERE, personalization: { displayName: 'Mira', tarotExperience: 'experienced' } });
      await page.reload();
      await expect(page.getByRole('textbox', { name: 'What would you like to understand, Mira?' })).toBeVisible();
      await expect.poll(async () => (await storedPersonalization(page)).tarotExperience).toBe('experienced');
      // The PUT is debounced for 700ms; let an erroneous stale upload fire.
      await page.waitForTimeout(900);
      expect(copy.writes).toEqual([]);
    } finally {
      await copy.close();
    }
  });

  test('an account reset removes inherited values and keeps a real local default-valued choice', async ({ page }) => {
    const copy = await accountCopy(page, { ...FINISHED_ELSEWHERE, personalization: { displayName: 'Henry', readingTone: 'blunt' }, explicitFields: ['displayName', 'readingTone'] });
    try {
      // Existing device choices without origin metadata remain local, including
      // deliberately chosen defaults that would otherwise look untouched.
      await page.addInitScript(() => {
        const key = 'tarot-personalization:fixture-pro-user';
        if (!localStorage.getItem(key)) {
          localStorage.setItem(key, JSON.stringify({ readingTone: 'balanced' }));
          localStorage.setItem(`${key}:explicit-fields`, JSON.stringify(['readingTone']));
        }
      });
      await page.goto('/');
      await expect(page.getByRole('textbox', { name: 'What would you like to understand, Henry?' })).toBeVisible();
      await expect.poll(() => copy.writes.length).toBe(1);
      copy.set({ ...FINISHED_ELSEWHERE, personalization: {}, explicitFields: [] });
      await page.reload();
      await expect(page.getByRole('textbox', { name: 'What would you like to understand?', exact: true })).toBeVisible();
      await expect.poll(() => copy.writes.length).toBe(2);
      expect(copy.writes[1].personalization).toEqual({ readingTone: 'balanced' });
      expect(copy.writes[1].explicitFields).toEqual(['readingTone']);
      expect(await storedPersonalization(page)).toMatchObject({ displayName: '', readingTone: 'balanced' });
    } finally {
      await copy.close();
    }
  });

  test('an inherited default-valued choice remains explicit for reading requests', async ({ page }) => {
    const copy = await accountCopy(page, { ...FINISHED_ELSEWHERE, personalization: { readingTone: 'balanced', focusAreas: [] }, explicitFields: ['readingTone', 'focusAreas'] });
    try {
      await page.goto('/');
      await expect(page.locator(SPREAD_GROUP)).toBeVisible();
      await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('tarot-personalization:fixture-pro-user:explicit-fields') || '[]'))).toEqual(['readingTone', 'focusAreas']);
      await page.reload();
      await expect(page.locator(SPREAD_GROUP)).toBeVisible();
      await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('tarot-personalization:fixture-pro-user:explicit-fields') || '[]'))).toEqual(['readingTone', 'focusAreas']);
      await page.waitForTimeout(900);
      expect(copy.writes).toEqual([]);
    } finally {
      await copy.close();
    }
  });

  test('a pending local reset survives a reload and clears the account copy before adopting again', async ({ page }) => {
    const copy = await accountCopy(page, FINISHED_ELSEWHERE);
    try {
      await seedReturningDevice(page);
      await page.addInitScript(() => {
        const key = 'tarot-personalization:fixture-pro-user';
        if (!localStorage.getItem(`${key}:account-origins`)) {
          localStorage.setItem(key, JSON.stringify({ displayName: '', tarotExperience: 'newbie' }));
          localStorage.setItem(`${key}:account-origins`, JSON.stringify({ v: 1, inheritedFields: [], resetPending: true }));
        }
      });
      await page.goto('/');
      await expect(page.getByRole('textbox', { name: 'What would you like to understand?', exact: true })).toBeVisible();
      await expect.poll(() => copy.writes.length).toBe(1);
      expect(copy.writes[0].personalization).toEqual({});
      await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('tarot-personalization:fixture-pro-user:account-origins') || '{}').resetPending)).toBe(false);
      // A completed reset does not permanently block future account adoption.
      copy.set(FINISHED_ELSEWHERE);
      await page.reload();
      await expect(page.getByRole('textbox', { name: 'What would you like to understand, Henry?' })).toBeVisible();
    } finally {
      await copy.close();
    }
  });

  test('an already empty account acknowledges a pending reset and allows later account choices', async ({ page }) => {
    const copy = await accountCopy(page, { ...FINISHED_ELSEWHERE, personalization: {}, explicitFields: [] });
    try {
      await seedReturningDevice(page);
      await page.addInitScript(() => {
        const key = 'tarot-personalization:fixture-pro-user';
        if (!localStorage.getItem(`${key}:account-origins`)) {
          localStorage.setItem(key, JSON.stringify({ displayName: '' }));
          localStorage.setItem(`${key}:account-origins`, JSON.stringify({ v: 1, inheritedFields: [], resetPending: true }));
        }
      });
      await page.goto('/');
      await expect(page.locator(SPREAD_GROUP)).toBeVisible();
      await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('tarot-personalization:fixture-pro-user:account-origins') || '{}').resetPending)).toBe(false);
      copy.set(FINISHED_ELSEWHERE);
      await page.reload();
      await expect(page.getByRole('textbox', { name: 'What would you like to understand, Henry?' })).toBeVisible();
      await page.waitForTimeout(900);
      expect(copy.writes).toEqual([]);
    } finally {
      await copy.close();
    }
  });
});

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
