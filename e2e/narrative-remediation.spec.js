import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  NARRATIVE, badgeContrast, createNarrativeFixture, expectForeground,
  expectNoHorizontalOverflow, expectSeparateBoxes, expectTarget, installSimulatedVisualViewport,
  openChat, openSetup, startReading
} from './helpers/narrativeFixtures.js';

test.setTimeout(60000);
// Intercept the actual fetches instead of allowing the app's service worker to
// send fixture requests to the local Workers proxy, especially in mobile WebKit.
test.use({ serviceWorkers: 'block' });

const desktop = { width: 1440, height: 1000 };
const handsets = [{ width: 320, height: 740 }, { width: 390, height: 844 }];
const motions = ['no-preference', 'reduce'];
const retainedDraft = 'Which boundary could I try tomorrow?';
const finalAnswer = 'A small boundary can protect your energy while leaving room for care.';
const suggestionsIn = dialog => dialog.locator('[aria-label="Suggested questions"]').getByRole('button');

async function withReading(page, options, check) {
  await page.setViewportSize(options.viewport || desktop);
  if (options.motion) await page.emulateMedia({ reducedMotion: options.motion });
  if (options.theme) await page.addInitScript(theme => localStorage.setItem('tarot-theme', theme), options.theme);
  const fixture = await createNarrativeFixture(page, options);
  try {
    await startReading(page, fixture);
    await check(fixture);
  } finally {
    await fixture.close();
  }
}

async function expectClosed(page, opener) {
  await expect(page.getByRole('dialog', { name: 'Follow-up chat' })).toHaveCount(0);
  const closed = page.locator('#mobile-followup-drawer');
  await expect(closed).toHaveJSProperty('inert', true);
  await expect(closed).toBeHidden();
  await expect(opener).toBeFocused();
  // Cover the previous independent autofocus timer after the close settles.
  await page.waitForTimeout(350);
  await expect(opener).toBeFocused();
  await page.keyboard.press('Tab');
  expect(await closed.evaluate(element => element.contains(document.activeElement))).toBe(false);
  expect(await page.locator('body').ariaSnapshot()).not.toContain('dialog "Follow-up chat"');
}

async function expectFocusLoop(page, dialog) {
  const controls = dialog.locator('button:enabled, textarea:enabled, input:enabled, a[href], [tabindex="0"]').filter({ visible: true });
  expect(await controls.count()).toBeGreaterThan(2);
  await controls.first().focus();
  await page.keyboard.press('Shift+Tab');
  await expect(controls.last()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(controls.first()).toBeFocused();
  await controls.last().focus();
  await page.keyboard.press('Tab');
  await expect(controls.first()).toBeFocused();
}

for (const viewport of [desktop, ...handsets]) {
  for (const motion of motions) {
    const tag = viewport.width < 769 ? ' @mobile' : '';
    test(`A01 A02 A08 foreground, targets, and three close cycles at ${viewport.width}px ${motion}${tag}`, async ({ page }) => {
      // This covers five opens and four closes, including a live response.
      // Normal-motion WebKit actionability waits accumulate across that flow.
      if (motion === 'no-preference') test.setTimeout(90000);
      await withReading(page, { viewport, motion }, async fixture => {
        const { dialog, opener } = await openChat(page);
        const input = dialog.getByRole('textbox', { name: 'Follow-up question' });
        const send = dialog.getByRole('button', { name: 'Send question' });
        const close = dialog.getByRole('button', { name: 'Close follow-up chat' });
        const history = dialog.getByRole('checkbox', { name: 'Include insights from my journal history' });
        // Handset Ask opens the composer; desktop Continue avoids summoning it.
        await expect(viewport.width < 769 ? input : close).toBeFocused();
        await expect(dialog).toHaveAttribute('aria-modal', 'true');
        await expect(page.getByRole('dialog')).toHaveCount(1);
        await expect(send).toBeDisabled();
        for (const target of [close, suggestionsIn(dialog).first(), input, send]) await expectForeground(target);
        await expectTarget(close, 48);
        await expectTarget(send, 48);
        for (const suggestion of await suggestionsIn(dialog).all()) await expectTarget(suggestion);
        await expectTarget(history.locator('..'));
        await expectNoHorizontalOverflow(page, '#mobile-followup-drawer');
        await expectFocusLoop(page, dialog);
        await input.fill(retainedDraft);
        await history.uncheck();
        for (const closeMode of ['button', 'escape', 'backdrop']) {
          if (closeMode === 'button') await close.click();
          if (closeMode === 'escape') await page.keyboard.press('Escape');
          if (closeMode === 'backdrop') await page.mouse.click(2, 2);
          await expectClosed(page, opener);
          await openChat(page);
          await expect(input).toHaveValue(retainedDraft);
          await expect(history).not.toBeChecked();
          await expectFocusLoop(page, dialog);
        }
        await input.click();
        await send.click();
        await expect.poll(() => fixture.requests.followup.length).toBe(1);
        expect(fixture.requests.followup[0].followUpQuestion).toBe(retainedDraft);
        expect(fixture.requests.followup[0].options.includeJournalContext).toBe(false);
        await fixture.emit('followup', 'delta', { text: 'A small boundary ' });
        await expect(dialog.getByRole('log')).toContainText('A small boundary');
        await close.click();
        await fixture.emit('followup', 'done', { fullText: finalAnswer });
        await expectClosed(page, opener);
        await openChat(page);
        await expect(dialog.getByRole('log')).toContainText(finalAnswer);
        await expect(history).not.toBeChecked();
        await expect(input).toBeEnabled();
        expect(fixture.requests.followup).toHaveLength(1);
        expect(fixture.requests.reading).toHaveLength(1);
        await expect(dialog).toContainText('1/10');
      });
    });
  }
}

for (const mobile of [false, true]) {
  test(`A03 suggestions submit once by Enter, Space, and pointer${mobile ? ' @mobile' : ''}`, async ({ page }) => {
    await withReading(page, { viewport: mobile ? handsets[1] : desktop }, async fixture => {
      const { dialog } = await openChat(page);
      for (const [index, activation] of ['Enter', 'Space', 'pointer'].entries()) {
        if (index) await dialog.getByRole('button', { name: 'Need ideas? Show suggestions' }).click();
        const suggestions = suggestionsIn(dialog);
        await expect(suggestions).toHaveCount(4);
        const suggestion = suggestions.first();
        const question = (await suggestion.textContent()).trim();
        await expect(suggestion).toHaveAccessibleName(question);
        if (activation === 'pointer') await suggestion.click();
        else await suggestion.press(activation === 'Space' ? ' ' : activation);
        await expect.poll(() => fixture.requests.followup.length).toBe(index + 1);
        expect(fixture.requests.followup[index].followUpQuestion).toBe(question);
        expect(fixture.requests.followup[index].options.stream).toBe(true);
        expect(fixture.requests.followup[index].readingContext.narrative).toBe(NARRATIVE);
        await expect(dialog.getByRole('textbox', { name: 'Follow-up question' })).toBeDisabled();
        await expect(dialog.getByRole('button', { name: 'Send question' })).toBeDisabled();
        await page.keyboard.press('Enter');
        expect(fixture.requests.followup).toHaveLength(index + 1);
        await fixture.emit('followup', 'done', { fullText: `${finalAnswer} Turn ${index + 1}.` });
        await expect(dialog.getByRole('textbox', { name: 'Follow-up question' })).toBeEnabled();
      }
      const axe = await new AxeBuilder({ page }).include('#mobile-followup-drawer')
        .withRules(['aria-roles', 'aria-required-children', 'aria-required-parent', 'button-name', 'label']).analyze();
      expect(axe.violations).toEqual([]);
      expect(fixture.requests.followup).toHaveLength(3);
    });
  });
}

test('A02 responsive presentation retains draft, suggestions, preference and one stream', async ({ page }) => {
  await withReading(page, {}, async fixture => {
    const { dialog } = await openChat(page);
    const input = dialog.getByRole('textbox', { name: 'Follow-up question' });
    const history = dialog.getByRole('checkbox', { name: 'Include insights from my journal history' });
    await history.uncheck();
    await input.fill(retainedDraft);
    const initialQuestions = await suggestionsIn(dialog).allTextContents();
    for (const width of [768, 769, 390, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(page.getByRole('dialog')).toHaveCount(1);
      await expect(input).toHaveValue(retainedDraft);
      await expect(history).not.toBeChecked();
      expect(await suggestionsIn(dialog).allTextContents()).toEqual(initialQuestions);
      await expectFocusLoop(page, dialog);
    }
    await input.press('Enter');
    await fixture.emit('followup', 'delta', { text: 'Keep the same conversation. ' });
    await page.setViewportSize({ width: 768, height: 844 });
    await page.setViewportSize({ width: 769, height: 500 });
    await fixture.emit('followup', 'done', { fullText: finalAnswer });
    await expect(dialog.getByRole('log')).toContainText(finalAnswer);
    expect(fixture.requests.followup).toHaveLength(1);
    expect(fixture.requests.reading).toHaveLength(1);
  });
});

test('A02 closing after its desktop opener disappears restores the narrative heading', async ({ page }) => {
  await withReading(page, {}, async fixture => {
    const { dialog } = await openChat(page);
    await page.setViewportSize(handsets[1]);
    await expect(page.getByRole('button', { name: 'Open chat', exact: true })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Close follow-up chat' }).click();
    const title = page.getByRole('heading', { name: 'Your Personalized Narrative', level: 2 });
    await expect(title).toBeFocused();
    await page.waitForTimeout(350);
    await expect(title).toBeFocused();
    expect(fixture.requests.reading).toHaveLength(1);
    expect(fixture.requests.followup).toHaveLength(0);
  });
});

test('A03 composer preserves Enter, Shift+Enter, IME, 500-character and retry guards', async ({ page }) => {
  await withReading(page, {}, async fixture => {
    const { dialog } = await openChat(page);
    const input = dialog.getByRole('textbox', { name: 'Follow-up question' });
    const send = dialog.getByRole('button', { name: 'Send question' });
    await input.fill('   ');
    await expect(send).toBeDisabled();
    await input.press('Enter');
    expect(fixture.requests.followup).toHaveLength(0);
    await input.fill('Draft');
    await input.press('Shift+Enter');
    await expect(input).toHaveValue('Draft\n');
    await input.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true });
    expect(fixture.requests.followup).toHaveLength(0);
    await input.fill('x'.repeat(520));
    await expect(input).toHaveValue('x'.repeat(500));
    fixture.setFollowupStatus(500);
    await input.press('Enter');
    await expect(dialog.getByRole('alert')).toContainText('temporarily unavailable');
    await expect(input).toHaveValue('x'.repeat(500));
    expect(fixture.requests.followup[0].followUpQuestion).toHaveLength(500);
    fixture.setFollowupStatus(200);
    await input.press('Enter');
    await fixture.emit('followup', 'done', { fullText: finalAnswer });
    await expect(dialog.getByRole('log')).toContainText(finalAnswer);
    await expect(dialog).toContainText('1/10');
    expect(fixture.requests.followup).toHaveLength(2);
  });
});

test('A02 handset Back guard closes chat without leaving or regenerating @mobile', async ({ page }) => {
  await withReading(page, { viewport: handsets[1] }, async fixture => {
    const { opener } = await openChat(page);
    const url = page.url();
    await page.evaluate(() => history.back());
    await expectClosed(page, opener);
    expect(page.url()).toBe(url);
    expect(fixture.requests.reading).toHaveLength(1);
    expect(fixture.requests.followup).toHaveLength(0);
  });
});

test('A02 short coarse-pointer tablets retain handset chat behavior @mobile', async ({ page }) => {
  await withReading(page, { viewport: { width: 980, height: 800 } }, async () => {
    expect(await page.evaluate(() => matchMedia('(hover: none) and (pointer: coarse)').matches)).toBe(true);
    const { dialog } = await openChat(page);
    await expect(page.getByRole('button', { name: 'Open chat', exact: true })).toHaveCount(0);
    await expectForeground(dialog.getByRole('button', { name: 'Close follow-up chat' }));
    await expectTarget(dialog.getByRole('button', { name: 'Send question' }), 48);
  });
});

for (const signedOut of [false, true]) {
  test(`A03 ${signedOut ? 'signed-out' : 'server turn-limit'} guard prevents another request`, async ({ page }) => {
    await withReading(page, { signedOut }, async fixture => {
      const { dialog } = await openChat(page);
      if (signedOut) {
        await expect(dialog).toContainText('Sign in to ask follow-up questions');
        for (const suggestion of await suggestionsIn(dialog).all()) await expect(suggestion).toBeDisabled();
        await expect(dialog.getByRole('textbox')).toBeDisabled();
        await expect(dialog.getByRole('button', { name: 'Send question' })).toBeDisabled();
        expect(fixture.requests.followup).toHaveLength(0);
      } else {
        fixture.setFollowupStatus(403);
        await dialog.getByRole('textbox').fill(retainedDraft);
        await dialog.getByRole('button', { name: 'Send question' }).click();
        await expect(dialog.getByRole('alert')).toContainText('limit');
        await expect(dialog).toContainText("You've used all 10 follow-up questions");
        await expect(dialog.getByRole('textbox')).toHaveCount(0);
        for (const suggestion of await suggestionsIn(dialog).all()) await expect(suggestion).toBeDisabled();
        expect(fixture.requests.followup).toHaveLength(1);
      }
    });
  });
}

const expectedSourceRows = {
  reference: [
    ['Spread & cards', 'Used'], ['Vision uploads', 'Not requested'], ['User context', 'Used'],
    ['Traditional wisdom', 'Used'], ['Ephemeris', 'Requested not used'], ['Forecast', 'Skipped']
  ],
  alternate: [
    ['Spread & cards', 'Used'], ['Vision uploads', 'Used'], ['User context', 'Skipped'],
    ['Traditional wisdom', 'Not requested'], ['Ephemeris', 'Not requested'], ['Forecast', 'Not requested']
  ]
};

for (const source of ['reference', 'alternate']) {
  for (const theme of ['light', 'dark']) {
    test(`A04 ${theme} source badges have accurate ${source} states and composited contrast`, async ({ page }, testInfo) => {
      await withReading(page, { source, theme }, async () => {
        const trigger = page.getByRole('button', { name: 'Reading Inputs Used', exact: true });
        await expect(trigger).toHaveAttribute('aria-expanded', 'true');
        const region = page.getByRole('region', { name: 'Reading Inputs Used' });
        const panel = page.locator(`#${await trigger.getAttribute('aria-controls')}`);
        const rows = panel.getByRole('listitem');
        await expect(rows).toHaveCount(6);
        await expect(region.getByText(source === 'reference' ? '3 used' : '2 used', { exact: true })).toBeVisible();
        await expect(region.getByText(source === 'reference' ? '2 requested not used' : '1 requested not used', { exact: true })).toBeVisible();
        const contrast = [];
        for (const [label, state] of expectedSourceRows[source]) {
          const row = rows.filter({ has: page.getByText(label, { exact: true }) });
          await expect(row).toHaveCount(1);
          const badge = row.locator('span:has(> svg)').filter({ hasText: new RegExp(`^\\s*${state}\\s*$`) });
          await expect(badge).toBeVisible();
          const colors = await badgeContrast(badge);
          expect(colors.ratio, `${theme} ${label}: ${JSON.stringify(colors)}`).toBeGreaterThanOrEqual(4.5);
          expect(colors.opacity).toBe(1);
          contrast.push({ label, state, ...colors });
          const icon = badge.locator('svg');
          if (await icon.count()) expect((await badgeContrast(icon)).ratio).toBeGreaterThanOrEqual(3);
        }
        if (source === 'reference') {
          await expect(panel).toContainText('Used: question, tone');
          await expect(panel).toContainText('semantic mode, 2/3 passages');
          await expect(panel).toContainText('Reason: budget limit');
        } else {
          await expect(panel).toContainText('2 uploaded evidence packets used');
          await expect(panel).toContainText('Reason: consent required');
        }
        await testInfo.attach(`source-contrast-${source}-${theme}`, { body: JSON.stringify(contrast, null, 2), contentType: 'application/json' });
        await trigger.click();
        await expect(panel).toBeHidden();
        await trigger.press('Enter');
        await expect(panel).toBeVisible();
      });
    });
  }
}

for (const motion of motions) {
  test(`A05 short desktop has a real scroll region and reachable footer at 200% text ${motion}`, async ({ page }) => {
    await withReading(page, { viewport: { width: 1440, height: 500 }, motion }, async fixture => {
      const { dialog } = await openChat(page);
      const input = dialog.getByRole('textbox', { name: 'Follow-up question' });
      await input.fill(retainedDraft);
      await input.press('Enter');
      await fixture.emit('followup', 'done', { fullText: `${'A longer reflection deserves room to breathe.\n\n'.repeat(30)}The final reflection remains reachable.` });
      await expect(input).toBeEnabled();
      await expect(dialog.getByRole('log')).toContainText('The final reflection remains reachable.');
      const scroll = dialog.locator('.follow-up-chat__scroll');
      await expect.poll(() => scroll.evaluate(node => node.scrollHeight - node.clientHeight)).toBeGreaterThan(50);
      await scroll.evaluate(node => node.scrollTo(0, node.scrollHeight));
      await expectForeground(dialog.getByText('The final reflection remains reachable.', { exact: true }));
      await expectForeground(input);
      await expectForeground(dialog.getByRole('checkbox').locator('..'));
      await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
      await expectForeground(input);
      await input.fill('An enlarged-text question');
      await expectForeground(dialog.getByRole('button', { name: 'Send question' }));
      await expectForeground(dialog.getByRole('checkbox').locator('..'));
      await expectNoHorizontalOverflow(page, '#mobile-followup-drawer');
      await page.setViewportSize({ width: 1440, height: 1000 });
      await expectForeground(input);
      expect(fixture.requests.followup).toHaveLength(1);
    });
  });
}

for (const viewport of handsets) {
  for (const motion of motions) {
    test(`A05 A08 simulated keyboard and enlarged text remain reachable at ${viewport.width}px ${motion} @mobile`, async ({ page }) => {
      await installSimulatedVisualViewport(page);
      await withReading(page, { viewport, motion }, async fixture => {
        const { dialog } = await openChat(page);
        const input = dialog.getByRole('textbox', { name: 'Follow-up question' });
        const send = dialog.getByRole('button', { name: 'Send question' });
        await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
        await page.evaluate(() => window.__setVisualViewport(340));
        await expect.poll(async () => (await dialog.boundingBox()).height).toBeLessThanOrEqual(340);
        await input.focus();
        await input.fill(retainedDraft);
        await expectForeground(input);
        await expectSeparateBoxes(input, dialog.getByText(`${retainedDraft.length}/500`, { exact: true }));
        const inputBox = await input.boundingBox();
        expect(inputBox.y + inputBox.height).toBeLessThanOrEqual(341);
        await expectForeground(send);
        await expectTarget(send, 48);
        const historyLabel = dialog.getByRole('checkbox').locator('..');
        await expectForeground(historyLabel);
        await expectTarget(historyLabel);
        await expectNoHorizontalOverflow(page, '#mobile-followup-drawer');
        await page.evaluate(() => window.__setVisualViewport(innerHeight));
        await page.setViewportSize({ width: viewport.height, height: viewport.width });
        await page.evaluate(() => window.__setVisualViewport(innerHeight));
        await expectForeground(input);
        await page.setViewportSize(viewport);
        await page.evaluate(() => window.__setVisualViewport(innerHeight));
        await expectForeground(input);
        await expect(input).toHaveValue(retainedDraft);
        expect(fixture.requests.followup).toHaveLength(0);
      });
    });
  }
}

for (const mobile of [false, true]) {
  test(`A06 native ratings support keyboard selection, one pending submit and failed-submit retention${mobile ? ' @mobile' : ''}`, async ({ page }) => {
    await withReading(page, { viewport: mobile ? handsets[1] : desktop, feedbackStatus: 500 }, async fixture => {
      const disclosure = page.getByRole('button', { name: /How did this reading land/ });
      await disclosure.click();
      const submit = page.getByRole('button', { name: 'Submit feedback', exact: true });
      await expect(submit).toBeDisabled();
      const groups = ['overallAccuracy', 'narrativeCoherence', 'practicalValue'];
      for (const name of groups) {
        await expect(page.locator(`input[type="radio"][name="${name}"]`)).toHaveCount(5);
        await expect(page.locator(`input[type="radio"][name="${name}"]:checked`)).toHaveCount(0);
      }
      await disclosure.focus();
      await page.keyboard.press('Tab');
      for (const [index, name] of groups.entries()) {
        const radios = page.locator(`input[type="radio"][name="${name}"]`);
        await expect(radios.first()).toBeFocused();
        await expect(radios.first()).toHaveAccessibleName('1 Poor');
        for (let step = 0; step < index + 2; step++) await page.keyboard.press('ArrowRight');
        await page.keyboard.press(' ');
        await expect(radios.nth(index + 2)).toBeChecked();
        await expect(radios.nth(index + 2)).toBeFocused();
        for (const label of await radios.locator('..').all()) await expectTarget(label);
        if (index < 2) await expect(submit).toBeDisabled();
        await page.keyboard.press('Tab');
      }
      const notes = page.getByRole('textbox', { name: 'Additional notes (optional)' });
      await expect(notes).toBeFocused();
      await expect(notes).toHaveAttribute('maxlength', '750');
      await notes.fill('The rest boundary resonated; I want to try it tomorrow.');
      fixture.holdFeedback();
      await submit.click();
      await expect(page.getByRole('button', { name: 'Sending…' })).toBeDisabled();
      await expect.poll(() => fixture.requests.feedback.length).toBe(1);
      fixture.releaseFeedback();
      await expect(page.getByRole('alert')).toContainText('Unable to save feedback.');
      expect(fixture.requests.feedback[0].ratings).toEqual({ overallAccuracy: 3, narrativeCoherence: 4, practicalValue: 5 });
      expect(fixture.requests.feedback[0].requestId).toBe('narrative-remediation');
      await expect(notes).toHaveValue('The rest boundary resonated; I want to try it tomorrow.');
      for (const [index, name] of groups.entries()) await expect(page.locator(`input[name="${name}"]`).nth(index + 2)).toBeChecked();
      fixture.setFeedbackStatus(200);
      await page.getByRole('button', { name: 'Submit feedback', exact: true }).click();
      await expect(page.getByRole('status').filter({ hasText: 'Feedback submitted successfully.' })).toHaveText('Feedback submitted successfully.');
      await expect(page.getByRole('button', { name: 'Feedback saved', exact: true })).toBeDisabled();
      expect(fixture.requests.feedback).toHaveLength(2);
      expect(fixture.requests.feedback[1]).toEqual(fixture.requests.feedback[0]);
    });
  });
}

for (const mobile of [false, true]) {
  test(`A07 heading outline preserves all narrative sections, focus mode and chat levels${mobile ? ' @mobile' : ''}`, async ({ page }) => {
    await withReading(page, { viewport: mobile ? handsets[1] : desktop }, async fixture => {
      await expect(page.getByRole('heading', { name: 'Tableu', level: 1, exact: true })).toHaveCount(1);
      const title = page.getByRole('heading', { name: 'Your Personalized Narrative', level: 2 });
      await expect(title).toHaveAttribute('id', 'personalized-narrative-title');
      await expect(title).toHaveAttribute('tabindex', '-1');
      const narrative = page.locator('.narrative-stream');
      const expectedLevels = [
        ['Opening', 3], ['The Story of Your Cards', 3], ['A smaller commitment', 4],
        ['Protecting a pause', 5], ['An everyday reminder', 6], ['A final detail', 6],
        ['Synthesis', 3], ['Practical Guidance', 3], ['Reflection', 3]
      ];
      for (const [name, level] of expectedLevels) await expect(narrative.getByRole('heading', { name, level, exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Reading Inputs Used', level: 2 })).toBeVisible();
      await expect(page.getByRole('heading', { name: /How did this reading land/, level: 2 })).toBeVisible();
      if (mobile) {
        const insights = page.getByRole('button', { name: /^Spread Insights/ });
        await expect(insights).toHaveAttribute('aria-expanded', 'false');
        await insights.click();
        await expect(page.getByRole('heading', { name: 'Highlights', level: 3 })).toBeVisible();
        await insights.click();
        await expect(page.getByRole('heading', { name: 'Highlights', level: 3 })).toHaveCount(0);
        // The existing focus toggle is desktop-only. Exercise its retained mode
        // across the breakpoint instead of inventing a handset-only action.
        await page.setViewportSize(desktop);
      }
      const focusToggle = page.getByRole('button', { name: 'Focus on narrative', exact: true });
      await focusToggle.focus();
      await focusToggle.press('Enter');
      if (mobile) await page.setViewportSize(handsets[1]);
      for (const [name, level] of expectedLevels) await expect(narrative.getByRole('heading', { name, level, exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: /^Spread Insights/, level: 2 })).toHaveCount(0);
      if (mobile) await page.setViewportSize(desktop);
      await expect(page.getByRole('button', { name: 'Show insight panels', exact: true })).toHaveAttribute('aria-pressed', 'true');
      const showPanels = page.getByRole('button', { name: 'Show insight panels', exact: true });
      await showPanels.focus();
      await showPanels.press('Enter');
      if (mobile) await page.setViewportSize(handsets[1]);
      await expect(page.getByRole('heading', { name: 'Reading Inputs Used', level: 2 })).toBeVisible();
      const { dialog } = await openChat(page);
      await dialog.getByRole('textbox').fill('What does this invite?');
      await dialog.getByRole('button', { name: 'Send question' }).click();
      await fixture.emit('followup', 'done', { fullText: '# Chat heading\n\nChat content.\n\n## Chat subheading\n\nThe shared renderer keeps its default levels.' });
      await expect(dialog.getByRole('heading', { name: 'Chat heading', level: 1 })).toBeVisible();
      await expect(dialog.getByRole('heading', { name: 'Chat subheading', level: 2 })).toBeVisible();
    });
  });
}

async function verifySkipLinks(page) {
  const links = page.locator('.skip-links a');
  expect(await links.count()).toBeGreaterThan(0);
  for (const link of await links.all()) {
    const target = page.locator(await link.getAttribute('href'));
    await expect(target, `${await link.textContent()} must target mounted content`).toHaveCount(1);
    await link.focus();
    expect((await link.boundingBox()).y).toBeGreaterThanOrEqual(0);
    await link.press('Enter');
    await expect(target).toBeFocused();
    const box = await target.boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(-1);
    expect(box.y).toBeLessThan(page.viewportSize().height);
  }
}

for (const mobile of [false, true]) {
  test(`A09 skip links focus only mounted destinations across setup, stream, completed and focus modes${mobile ? ' @mobile' : ''}`, async ({ page }) => {
    await page.setViewportSize(mobile ? handsets[1] : desktop);
    const fixture = await createNarrativeFixture(page);
    try {
      await openSetup(page);
      await verifySkipLinks(page);
      expect(fixture.requests.reading).toHaveLength(0);
      await startReading(page, fixture, { complete: false });
      await fixture.emit('reading', 'delta', { text: '## Opening\n\nA partial reflection remains in progress.' });
      await expect(page.locator('.narrative-stream')).toContainText('partial reflection');
      await verifySkipLinks(page);
      expect(fixture.requests.reading).toHaveLength(1);
      await fixture.completeReading();
      await verifySkipLinks(page);
      await expect(page.getByRole('link', { name: 'Skip to spreads', exact: true })).toHaveCount(0);
      if (mobile) await page.setViewportSize(desktop);
      await page.getByRole('button', { name: 'Focus on narrative', exact: true }).click();
      if (mobile) await page.setViewportSize(handsets[1]);
      await verifySkipLinks(page);
      await expect(page.getByRole('link', { name: 'Skip to spreads', exact: true })).toHaveCount(0);
      expect(fixture.requests.reading).toHaveLength(1);
      expect(fixture.requests.followup).toHaveLength(0);
      await expect(page.locator('.narrative-stream')).toContainText('What would enough look like today?');
    } finally {
      await fixture.close();
    }
  });
}
