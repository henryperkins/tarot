import http from 'node:http';
import { expect } from '@playwright/test';

export const QUESTION = 'How can I find a sustainable balance between work and rest?';
export const NARRATIVE = `## Opening

Balance begins by noticing what restores you. The cards offer a reflective invitation to make room for effort and rest.

## The Story of Your Cards

The first card asks you to notice your energy. The second invites a gentler pace. The final card suggests a practical boundary.

### A smaller commitment

Choose a task that is small enough to finish without borrowing from tomorrow.

#### Protecting a pause

Put a short pause on your calendar and let it remain a pause.

##### An everyday reminder

You can return to this intention whenever the day becomes crowded.

###### A final detail

Notice your breath before choosing your next step.

## Synthesis

Sustainable progress does not require constant motion. Your attention can move between meaningful work and nourishing rest.

## Practical Guidance

1. Choose one priority for today.
2. Put a fifteen-minute rest beside it.
3. Tell someone which boundary will help.

## Reflection

What would enough look like today? Use what resonates, and set aside what does not.`;

export const SOURCE_USAGE = {
  reference: {
    spreadCards: { requested: true, used: true },
    vision: { requested: false, used: false },
    userContext: { requested: true, used: true, usedInputs: ['question', 'tone'] },
    graphRAG: { requested: true, used: true, mode: 'semantic', passagesProvided: 3, passagesUsedInPrompt: 2 },
    ephemeris: { requested: true, used: false },
    forecast: { requested: true, used: false, skippedReason: 'budget_limit' }
  },
  alternate: {
    spreadCards: { requested: true, used: true },
    vision: { requested: true, used: true, evidencePacketsUsed: 2 },
    userContext: { requested: true, used: false, skippedReason: 'consent_required' },
    graphRAG: { requested: false, used: false },
    ephemeris: { requested: false, used: false },
    forecast: { requested: false, used: false }
  }
};

// These are real, controllable SSE connections, not pre-completed route bodies.
// They let tests close/reopen or resize while the same response is in flight.
export async function createNarrativeFixture(page, options = {}) {
  const clients = { reading: new Set(), followup: new Set() };
  const requests = { reading: [], followup: [], feedback: [] };
  let eventId = 0;
  let successfulFollowupStreams = 0;
  let feedbackStatus = options.feedbackStatus || 200;
  let followupStatus = 200;
  let feedbackRelease;
  let feedbackGate = null;
  const sourceUsage = SOURCE_USAGE[options.source || 'reference'];
  const send = (response, event, data) => response.write(
    `event: ${event}\ndata: ${JSON.stringify({ ...data, eventId: ++eventId })}\n\n`
  );
  const server = http.createServer((request, response) => {
    response.setHeader('Access-Control-Allow-Origin', request.headers.origin || 'http://localhost:5173');
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Headers', request.headers['access-control-request-headers']
      || 'X-Job-Token, Accept, Content-Type, sentry-trace, baggage');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }
    const kind = request.url.startsWith('/followup') ? 'followup' : 'reading';
    response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
    clients[kind].add(response);
    response.on('close', () => clients[kind].delete(response));
    send(response, 'meta', kind === 'reading'
      ? { provider: 'fixture', requestId: 'narrative-remediation', sourceUsage }
      : { provider: 'fixture', requestId: 'narrative-followup', turn: ++successfulFollowupStreams });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  // Keep fixture errors and interaction traces out of production telemetry.
  await page.route(/https:\/\/[^/]*sentry\.io\/.*\/envelope\//, route => route.fulfill({ json: {} }));
  await page.route('**/api/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/auth/me') return route.fulfill({
      status: options.signedOut ? 401 : 200,
      json: { user: options.signedOut ? null : {
        id: 'fixture-pro-user', email: 'fixture@example.invalid', username: 'fixture',
        subscription_tier: 'pro', subscription_status: 'active', subscription_provider: 'stripe'
      } }
    });
    if (pathname === '/api/tarot-reading/jobs') {
      requests.reading.push(route.request().postDataJSON());
      return route.fulfill({ json: { jobId: 'fixture-reading', jobToken: 'local-fixture-token' } });
    }
    if (pathname.endsWith('/stream')) return route.continue({ url: `${origin}/reading` });
    if (pathname.endsWith('/cancel')) return route.fulfill({ json: { status: 'cancelled' } });
    if (pathname === '/api/reading-followup') {
      requests.followup.push(route.request().postDataJSON());
      if (followupStatus !== 200) return route.fulfill({ status: followupStatus, json: { message: followupStatus === 403
        ? 'The follow-up limit has been reached.' : 'The follow-up service is temporarily unavailable.' } });
      return route.continue({ url: `${origin}/followup` });
    }
    if (pathname === '/api/feedback') {
      requests.feedback.push(route.request().postDataJSON());
      if (feedbackGate) await feedbackGate;
      return route.fulfill({ status: feedbackStatus, json: { ok: feedbackStatus === 200 } });
    }
    if (pathname === '/api/journal') return route.fulfill({ json: { entries: [] } });
    return route.fulfill({ status: 200, json: { ok: true, entries: [], items: [] } });
  });
  return {
    requests,
    setFeedbackStatus(status) { feedbackStatus = status; },
    setFollowupStatus(status) { followupStatus = status; },
    holdFeedback() { feedbackGate = new Promise(resolve => { feedbackRelease = resolve; }); },
    releaseFeedback() { feedbackRelease?.(); feedbackGate = null; },
    async emit(kind, event, data) {
      await expect.poll(() => clients[kind].size).toBeGreaterThan(0);
      for (const response of clients[kind]) {
        send(response, event, data);
        if (event === 'done' || event === 'error') response.end();
      }
    },
    async completeReading() {
      await this.emit('reading', 'done', { fullText: NARRATIVE, requestId: 'narrative-remediation', provider: 'fixture', sourceUsage });
      await expect(page.locator('.narrative-stream')).toContainText('What would enough look like today?');
      await expect(page.getByText('Narrative ready.', { exact: true })).toBeAttached();
      await page.evaluate(() => Promise.race([
        document.fonts.ready,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Reading fonts did not finish loading')), 10000))
      ]));
      expect(requests.reading).toHaveLength(1);
    },
    async close() {
      feedbackRelease?.();
      for (const group of Object.values(clients)) for (const response of group) response.end();
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  };
}

export async function openSetup(page) {
  await page.addInitScript(() => {
    localStorage.setItem('tarot-onboarding-complete', 'true');
    localStorage.setItem('tarot-nudge-state', JSON.stringify({
      readingCount: 2, hasSeenRitualNudge: true, hasSeenGestureCoach: true,
      hasSeenJournalNudge: true, hasDismissedAccountNudge: true, journalSaveCount: 1
    }));
  });
  await page.goto('/');
  await expect(page.getByRole('radiogroup', { name: 'Spread selection' })).toBeVisible();
}

export async function startReading(page, fixture, { complete = true } = {}) {
  await openSetup(page);
  await page.locator('#question-input, #quick-intention').filter({ visible: true }).first().fill(QUESTION);
  await page.getByRole('button', { name: /^Draw cards$|^Shuffle & draw/ }).filter({ visible: true }).first().click();
  await page.getByRole('button', { name: /^Deal the cards/ }).filter({ visible: true }).first().click();
  await page.getByRole('button', { name: /^Reveal all cards/ }).filter({ visible: true }).first().click();
  await page.getByRole('button', { name: /^Create Personal Narrative$|^Create narrative/ }).filter({ visible: true }).first().press('Enter');
  if (complete) await fixture.completeReading();
}

export async function openChat(page) {
  const opener = page.getByRole('button', { name: /^Open chat$|^Open follow-up chat$|^Ask follow-up question$|^Ask a follow-up$|^Ask$/ }).filter({ visible: true }).first();
  await expect(opener).toBeVisible();
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Follow-up chat' });
  await expect(dialog).toBeVisible();
  // A01 starts after the drawer reaches its open state. A visible first frame
  // still has a translated hit region under normal motion in mobile WebKit.
  await dialog.evaluate(async element => {
    await Promise.allSettled(element.getAnimations().map(animation => animation.finished));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  return { opener, dialog };
}

export async function expectForeground(locator) {
  await expect.poll(async () => {
    try {
      // Native scrolling also works after changing an emulated WebKit viewport;
      // its automation scroll command can wait indefinitely for stale bounds.
      // The check below still uses the actual rendered center and hit result.
      await locator.evaluate(element => element.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' }));
      return await locator.evaluate(element => {
        const box = element.getBoundingClientRect();
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        return x >= 0 && x < innerWidth && y >= 0 && y < innerHeight
        && element.contains(document.elementFromPoint(x, y));
      });
    } catch (error) {
      if (/not attached/.test(error.message)) return false;
      throw error;
    }
  }).toBe(true);
}

export async function expectSeparateBoxes(first, second) {
  const [a, b] = await Promise.all([first.boundingBox(), second.boundingBox()]);
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  const intersectionWidth = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const intersectionHeight = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  expect(intersectionWidth * intersectionHeight).toBe(0);
}

export async function expectTarget(locator, minimum = 44) {
  const box = await locator.boundingBox();
  expect(box, `Missing hit area for ${await locator.textContent()}`).not.toBeNull();
  expect(box.width).toBeGreaterThanOrEqual(minimum - 0.5);
  expect(box.height).toBeGreaterThanOrEqual(minimum - 0.5);
}

export async function expectNoHorizontalOverflow(page, scope = 'body') {
  const overflow = await page.locator(scope).evaluate(element => ({
    page: document.documentElement.scrollWidth,
    viewport: innerWidth,
    clipped: [...element.querySelectorAll('button, label, textarea, p, h2, h3, h4, h5, h6')]
      .filter(node => node.getClientRects().length && getComputedStyle(node).position !== 'absolute')
      .filter(node => node.scrollWidth > node.clientWidth + 1)
      .map(node => `${node.tagName}: ${node.textContent?.slice(0, 90)}`)
  }));
  expect(overflow.page).toBeLessThanOrEqual(overflow.viewport + 1);
  expect(overflow.clipped).toEqual([]);
}

export async function installSimulatedVisualViewport(page) {
  await page.addInitScript(() => {
    const viewport = new EventTarget();
    Object.assign(viewport, { width: innerWidth, height: innerHeight, offsetTop: 0, offsetLeft: 0, pageTop: 0, pageLeft: 0, scale: 1 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
    window.__setVisualViewport = (height, width = innerWidth) => {
      Object.assign(viewport, { height, width });
      viewport.dispatchEvent(new Event('resize'));
    };
  });
}

export async function badgeContrast(locator) {
  return locator.evaluate(element => {
    const rgba = value => {
      const values = value.match(/[\d.]+/g)?.map(Number) || [0, 0, 0, 0];
      return [values[0], values[1], values[2], values[3] ?? 1];
    };
    const over = (fg, bg) => fg.slice(0, 3).map((channel, i) => channel * fg[3] + bg[i] * (1 - fg[3]));
    const ancestors = [];
    for (let node = element; node; node = node.parentElement) ancestors.unshift(node);
    let background = [255, 255, 255];
    let opacity = 1;
    for (const node of ancestors) {
      const style = getComputedStyle(node);
      background = over(rgba(style.backgroundColor), background);
      opacity *= Number(style.opacity);
    }
    const foreground = rgba(getComputedStyle(element).color);
    foreground[3] *= opacity;
    const renderedText = over(foreground, background);
    const luminance = rgb => rgb.map(channel => {
      const c = channel / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
    const values = [luminance(renderedText), luminance(background)].sort((a, b) => b - a);
    return { ratio: (values[0] + 0.05) / (values[1] + 0.05), foreground, background, opacity };
  });
}
