import http from 'node:http';
import { test, expect } from '@playwright/test';

const FINAL_TEXT = '## A grounded next step\n\nKeep one small commitment to yourself this week. Your choices remain your own.';

// Hold a real SSE connection open so partial text cannot be mistaken for done.
async function mockReadingJobs(page, firstStatus = 200) {
  const clients = new Set();
  const requests = [];
  let eventId = 0;
  const send = (response, event, data) => response.write(
    `event: ${event}\ndata: ${JSON.stringify({ ...data, eventId: ++eventId })}\n\n`
  );
  const server = http.createServer((request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Headers', 'X-Job-Token, Accept');
    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }
    response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
    clients.add(response);
    response.on('close', () => clients.delete(response));
    send(response, 'meta', { provider: 'fixture', requestId: 'hardening-reading' });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const streamUrl = `http://127.0.0.1:${server.address().port}/stream`;
  await page.route('**/api/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/tarot-reading/jobs') {
      requests.push(route.request().postDataJSON());
      const status = requests.length === 1 ? firstStatus : 200;
      return route.fulfill({ status, json: status === 200
        ? { jobId: `hardening-${requests.length}`, jobToken: 'local-fixture-token' }
        : { error: `Reading service returned ${status}. Please try again.` } });
    }
    if (pathname.endsWith('/stream')) return route.continue({ url: streamUrl });
    if (pathname.endsWith('/cancel')) return route.fulfill({ json: { status: 'cancelled' } });
    return route.fulfill({ status: pathname === '/api/auth/me' ? 401 : 404, json: { user: null } });
  });
  return {
    requests,
    async emit(event, data) {
      await expect.poll(() => clients.size).toBeGreaterThan(0);
      for (const response of clients) {
        send(response, event, data);
        if (event === 'done' || event === 'error') response.end();
      }
    },
    async close() {
      for (const response of clients) response.end();
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  };
}

async function openReading(page) {
  await page.addInitScript(() => {
    localStorage.setItem('tarot-onboarding-complete', 'true');
    localStorage.setItem('tarot-nudge-state', JSON.stringify({
      readingCount: 2, hasSeenRitualNudge: true, hasSeenGestureCoach: true,
      hasSeenJournalNudge: true, journalSaveCount: 1
    }));
  });
  await page.goto('/');
  await expect(page.getByRole('radiogroup', { name: 'Spread selection' })).toBeVisible();
}

async function prepareNarrative(page) {
  await openReading(page);
  const question = page.locator('#question-input, #quick-intention').filter({ visible: true }).first();
  await question.fill('How can I find balance? 🌿 ما الذي يدعمني؟ 自分を大切にする');
  await page.getByRole('button', { name: /^Draw cards$|^Shuffle & draw/ }).click();
  await page.getByRole('button', { name: /^Deal the cards/ }).click();
  await page.getByRole('button', { name: /^Reveal all cards/ }).click();
  await expect(page.getByRole('button', { name: /^Create Personal Narrative$|^Create narrative/ })).toBeEnabled();
}

async function generate(page) {
  await page.getByRole('button', { name: /^Create Personal Narrative$|^Create narrative/ }).press('Enter');
}

async function effectiveOpacity(locator) {
  return locator.evaluate(element => {
    let opacity = 1;
    for (let node = element; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
    return opacity;
  });
}

test('page remains painted when motion preference changes or its animation is paused', async ({ page }) => {
  const jobs = await mockReadingJobs(page);
  try {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await openReading(page);
    await page.evaluate(() => {
      const wrapper = document.querySelector('.app-shell').parentElement;
      for (const animation of wrapper.getAnimations()) {
        animation.pause();
        animation.currentTime = 0;
      }
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(() => effectiveOpacity(page.locator('#main-content'))).toBe(1);
    await page.getByRole('button', { name: 'Journal', exact: true }).click();
    await expect(page).toHaveURL(/\/journal$/);
    await page.goBack();
    await expect(page.getByRole('radiogroup', { name: 'Spread selection' })).toBeVisible();
    await expect.poll(() => effectiveOpacity(page.locator('#main-content'))).toBe(1);
  } finally {
    await jobs.close();
  }
});

for (const width of [320, 390, 1440]) {
  test(`partial server text never announces completion at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const jobs = await mockReadingJobs(page);
    try {
      await prepareNarrative(page);
      await generate(page);
      await expect(page.getByLabel('Generating your personalized narrative')).toBeVisible();
      await jobs.emit('delta', { text: '## Opening\n\nA pause can help you notice what matters.' });
      await expect(page.locator('.narrative-stream')).toContainText('A pause can help');
      await expect(page.locator('.narrative-stream [role="status"]')).not.toContainText('Narrative ready');
      await expect(page.locator('.narrative-stream [role="status"]')).toContainText(/still|preparing|progress/i);
      await expect(page.getByRole('button', { name: 'Open visual studio' })).toHaveCount(0);
      await jobs.emit('done', { fullText: FINAL_TEXT, requestId: 'hardening-reading', provider: 'fixture' });
      await expect(page.locator('.narrative-stream')).toContainText('Keep one small commitment');
      await expect(page.locator('.narrative-stream [role="status"]')).toHaveText('Narrative ready.');
      await expect(page.getByRole('heading', { name: 'Your Personalized Narrative' })).toBeFocused();
      await expect.poll(() => effectiveOpacity(page.locator('.narrative-stream'))).toBe(1);
    } finally {
      await jobs.close();
    }
  });
}

for (const status of [401, 403, 429, 500]) {
  test(`desktop can retry a ${status} response without changing cards or the question`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const jobs = await mockReadingJobs(page, status);
    try {
      await prepareNarrative(page);
      await generate(page);
      await expect(page.getByRole('alert')).toContainText(`Reading service returned ${status}`);
      await expect(page.getByText('Narrative ready.', { exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /How did this reading land/ })).toHaveCount(0);
      const retry = page.getByRole('button', { name: 'Retry narrative', exact: true });
      await expect(retry).toBeVisible();
      await retry.press('Enter');
      await jobs.emit('done', { fullText: FINAL_TEXT, provider: 'fixture', requestId: 'hardening-retry' });
      await expect(page.locator('.narrative-stream')).toContainText('Keep one small commitment');
      expect(jobs.requests).toHaveLength(2);
      expect(jobs.requests[1]).toEqual(jobs.requests[0]);
    } finally {
      await jobs.close();
    }
  });
}

test('a mid-stream failure is an error, not a finished reading', async ({ page }) => {
  const jobs = await mockReadingJobs(page);
  try {
    await prepareNarrative(page);
    await generate(page);
    await jobs.emit('delta', { text: 'Partial reading that is not complete.' });
    await expect(page.locator('.narrative-stream')).toContainText('Partial reading');
    await jobs.emit('error', { message: 'Connection interrupted. Please retry your reading.' });
    await expect(page.getByRole('alert')).toContainText('Connection interrupted');
    await expect(page.getByText('Narrative ready.', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Your reading could not be completed' })).toBeFocused();
    await expect(page.getByRole('button', { name: /How did this reading land/ })).toHaveCount(0);
  } finally {
    await jobs.close();
  }
});

test('narrow readings keep usable text width and contain long mixed-script content', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const jobs = await mockReadingJobs(page);
  try {
    await prepareNarrative(page);
    await generate(page);
    const longText = `## Reflection 🌿\n\n${'LongUnbrokenReflection'.repeat(15)}\n\nما الذي يدعمني؟ 自分を大切にする\n\n${FINAL_TEXT}`;
    await jobs.emit('done', { fullText: longText, provider: 'fixture' });
    const paragraph = page.locator('[data-scene="complete"] .narrative-stream__text p').last();
    await expect(paragraph).toContainText('Keep one small commitment');
    await expect.poll(async () => (await paragraph.boundingBox())?.width || 0).toBeGreaterThanOrEqual(200);
    const overflow = await page.locator('.narrative-stream__text').evaluate(node => ({
      // The decorative atmosphere intentionally extends beyond its clipping box.
      // Check the text itself, so clipped words cannot pass as contained content.
      text: [...node.querySelectorAll('p, h2, h3')].map(element => ({
        scroll: element.scrollWidth, client: element.clientWidth
      })),
      page: document.documentElement.scrollWidth, viewport: window.innerWidth
    }));
    for (const element of overflow.text) expect(element.scroll).toBeLessThanOrEqual(element.client + 1);
    expect(overflow.page).toBeLessThanOrEqual(overflow.viewport + 1);
  } finally {
    await jobs.close();
  }
});

test('a delayed request stays truthful and completion preserves focus chosen elsewhere', async ({ page }) => {
  test.setTimeout(45000);
  const jobs = await mockReadingJobs(page);
  try {
    await prepareNarrative(page);
    await generate(page);
    await expect(page.getByRole('heading', { name: 'Preparing your reading' })).toBeFocused();
    await expect(page.locator('.narrative-skeleton [role="status"]')).toContainText('taking longer than usual', { timeout: 16000 });
    await expect(page.getByText(/Almost there|Step [123] of 3/)).toHaveCount(0);
    const readingStep = page.getByRole('button', { name: 'Step 4: Reading', exact: true });
    await readingStep.focus();
    await jobs.emit('done', { fullText: FINAL_TEXT, provider: 'fixture' });
    await expect(page.locator('.narrative-stream')).toContainText('Keep one small commitment');
    await expect(readingStep).toBeFocused();
  } finally {
    await jobs.close();
  }
});

test('mobile retry and motion changes remain usable through generation and failure', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const jobs = await mockReadingJobs(page);
  try {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await prepareNarrative(page);
    await generate(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(() => effectiveOpacity(page.locator('.narrative-skeleton'))).toBe(1);
    await jobs.emit('error', { message: 'The connection was interrupted.' });
    await expect(page.getByRole('alert')).toContainText('connection was interrupted');
    await page.getByRole('button', { name: /Retry narrative generation/ }).press('Enter');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await jobs.emit('done', { fullText: FINAL_TEXT, provider: 'fixture' });
    await expect(page.locator('.narrative-stream')).toContainText('Keep one small commitment');
    await expect.poll(() => effectiveOpacity(page.locator('.narrative-stream'))).toBe(1);
    expect(jobs.requests).toHaveLength(2);
    expect(jobs.requests[1]).toEqual(jobs.requests[0]);
  } finally {
    await jobs.close();
  }
});
