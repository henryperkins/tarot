import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 }
];

const CELTIC_CHALLENGE_OFFSET_BY_VIEWPORT = {
  390: 18,
  768: 22.32,
  1280: 30.72
};

const CARD_WIDTH_FLOORS = {
  390: {
    single: 63,
    threeCard: 63,
    fiveCard: 44,
    decision: 63,
    relationship: 41
  },
  768: {
    single: 127,
    threeCard: 127,
    fiveCard: 99,
    decision: 127,
    relationship: 92,
    celtic: 99
  },
  1280: {
    single: 127,
    threeCard: 127,
    fiveCard: 127,
    decision: 127,
    relationship: 127,
    celtic: 127
  }
};

const SPREADS = [
  {
    key: 'single',
    name: 'One-Card',
    positions: [{ x: 50, y: 50 }]
  },
  {
    key: 'threeCard',
    name: 'Three-Card',
    positions: [
      { x: 20, y: 50 },
      { x: 50, y: 50 },
      { x: 80, y: 50 }
    ]
  },
  {
    key: 'fiveCard',
    name: 'Five-Card',
    positions: [
      { x: 50, y: 20 },
      { x: 20, y: 50 },
      { x: 50, y: 50 },
      { x: 80, y: 50 },
      { x: 50, y: 80 }
    ]
  },
  {
    key: 'decision',
    name: 'Decision',
    positions: [
      { x: 50, y: 22 },
      { x: 20, y: 50 },
      { x: 80, y: 50 },
      { x: 40, y: 78 },
      { x: 60, y: 78 }
    ]
  },
  {
    key: 'relationship',
    name: 'Relationship',
    positions: [
      { x: 30, y: 50 },
      { x: 70, y: 50 },
      { x: 50, y: 75 },
      { x: 25, y: 22 },
      { x: 75, y: 22 }
    ]
  },
  {
    key: 'celtic',
    name: 'Celtic',
    positions: [
      { x: 35, y: 50 },
      { x: 35, y: 50, challengeOffset: true },
      { x: 12, y: 50 },
      { x: 58, y: 50 },
      { x: 35, y: 12 },
      { x: 35, y: 88 },
      { x: 82, y: 88 },
      { x: 82, y: 62.67 },
      { x: 82, y: 37.33 },
      { x: 82, y: 12 }
    ]
  }
];

function seedReadingUi(page) {
  return page.addInitScript(() => {
    localStorage.setItem('tarot-onboarding-complete', 'true');
    localStorage.setItem('tarot-nudge-state', JSON.stringify({
      readingCount: 1,
      hasSeenRitualNudge: true,
      hasSeenGestureCoach: true,
      hasSeenJournalNudge: true,
      journalSaveCount: 0,
      hasDismissedAccountNudge: false
    }));
    sessionStorage.setItem('tarot-prepare-sections', JSON.stringify({
      intention: false,
      experience: false,
      ritual: true,
      audio: false
    }));
  });
}

async function openSpread(page, spreadKey, expectedCardCount) {
  await page.goto(`/__e2e/spread-layout?spread=${spreadKey}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('spread-layout-fixture')).toBeVisible();
  await expect(page.locator('[data-slot-index] [data-layout-card]')).toHaveCount(expectedCardCount, { timeout: 10000 });
}

async function expectLayoutGeometry(page, spreadKey, positions, challengeOffsetPx, cardWidthFloor) {
  const table = page.locator('[role="region"][aria-label$="layout"]');
  const tableBox = await table.boundingBox();
  const tableMetrics = await table.evaluate((element) => ({
    clientLeft: element.clientLeft,
    clientTop: element.clientTop,
    clientWidth: element.clientWidth,
    clientHeight: element.clientHeight
  }));
  expect(tableBox).not.toBeNull();

  const cardBoxes = [];
  const logicalCardWidths = [];

  for (let index = 0; index < positions.length; index += 1) {
    const position = positions[index];
    const slot = page.locator(`[data-slot-index="${index}"]`);
    const card = slot.locator('[data-layout-card]');
    const cardBox = await card.boundingBox();
    const badgeBox = await slot.locator('[data-layout-card] > div[aria-hidden="true"]').first().boundingBox();

    expect(cardBox).not.toBeNull();
    expect(badgeBox).not.toBeNull();
    expect(badgeBox.width).toBeGreaterThan(0);
    expect(badgeBox.height).toBeGreaterThan(0);

    const offsetPx = position.challengeOffset ? challengeOffsetPx : (position.offsetPx || 0);
    const expectedX = tableBox.x + tableMetrics.clientLeft + (tableMetrics.clientWidth * (position.x / 100)) + offsetPx;
    const expectedY = tableBox.y + tableMetrics.clientTop + (tableMetrics.clientHeight * (position.y / 100));
    const actualX = cardBox.x + (cardBox.width / 2);
    const actualY = cardBox.y + (cardBox.height / 2);

    expect(Math.abs(actualX - expectedX), `slot ${index} horizontal centre`).toBeLessThanOrEqual(2);
    expect(Math.abs(actualY - expectedY), `slot ${index} vertical centre`).toBeLessThanOrEqual(2);
    expect(cardBox.x, `slot ${index} left edge`).toBeGreaterThanOrEqual(tableBox.x - 1);
    expect(cardBox.y, `slot ${index} top edge`).toBeGreaterThanOrEqual(tableBox.y - 1);
    expect(cardBox.x + cardBox.width, `slot ${index} right edge`).toBeLessThanOrEqual(tableBox.x + tableBox.width + 1);
    expect(cardBox.y + cardBox.height, `slot ${index} bottom edge`).toBeLessThanOrEqual(tableBox.y + tableBox.height + 1);

    cardBoxes.push(cardBox);
    logicalCardWidths.push(await card.evaluate((element) => Number.parseFloat(getComputedStyle(element).width)));
  }

  for (let leftIndex = 0; leftIndex < cardBoxes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < cardBoxes.length; rightIndex += 1) {
      if (spreadKey === 'celtic' && leftIndex === 0 && rightIndex === 1) continue;
      const left = cardBoxes[leftIndex];
      const right = cardBoxes[rightIndex];
      const overlapWidth = Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x);
      const overlapHeight = Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y);

      expect(
        overlapWidth <= 1 || overlapHeight <= 1,
        `${spreadKey} slots ${leftIndex}/${rightIndex} overlap by ${overlapWidth.toFixed(2)}x${overlapHeight.toFixed(2)}px`
      ).toBe(true);
    }
  }

  if (cardWidthFloor != null) {
    expect(
      Math.min(...logicalCardWidths),
      `${spreadKey} logical card width floor`
    ).toBeGreaterThanOrEqual(cardWidthFloor);
  }
}

for (const viewport of VIEWPORTS) {
  test(`keeps revealed spread cards centred and unclipped at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await seedReadingUi(page);
    for (const spread of SPREADS) {
      await openSpread(page, spread.key, spread.positions.length);
      await expectLayoutGeometry(
        page,
        spread.key,
        spread.positions,
        CELTIC_CHALLENGE_OFFSET_BY_VIEWPORT[viewport.width] || 0,
        CARD_WIDTH_FLOORS[viewport.width][spread.key]
      );
    }
  });
}

test('keeps a narrative mention pulse visible beyond the revealed card border', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS[2]);
  await seedReadingUi(page);
  await openSpread(page, 'single', 1);
  const cardBox = await page.locator('[data-slot-index="0"] [data-layout-card]').boundingBox();
  expect(cardBox).not.toBeNull();
  const outsideTopBorder = {
    x: cardBox.x + 12,
    y: cardBox.y - (cardBox.height * 0.1) - 4,
    width: cardBox.width - 24,
    height: 8
  };
  const beforePulse = await page.screenshot({ clip: outsideTopBorder });

  await page.getByRole('button', { name: /trigger mention pulse/i }).click();
  await expect(page.locator('[data-mention-pulse-ring]')).toBeVisible();
  const afterPulse = await page.screenshot({ clip: outsideTopBorder });

  expect(afterPulse.equals(beforePulse), 'mention pulse must paint pixels outside the card border').toBe(false);
});

test('keeps reversed-card labels upright and exposes reversal in every live representation', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS[2]);
  await seedReadingUi(page);
  await page.goto('/__e2e/spread-layout?spread=single&reversed=1', { waitUntil: 'domcontentloaded' });

  const card = page.locator('[data-slot-index="0"] [data-layout-card]');
  await expect(card).toHaveAccessibleName(/the fool, reversed, in theme position\. click to view details\./i);
  await expect(card.getByText('Reversed', { exact: true })).toBeVisible();
  const cardImage = card.locator('img[alt="The Fool"]');
  const face = cardImage.locator('xpath=..');
  const nameOverlay = face.locator('xpath=./div');
  await expect(cardImage).toHaveCSS('transform', 'matrix(-1, 0, 0, -1, 0, 0)');
  await expect(face).toHaveCSS('transform', 'matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0.1, 1)');
  await expect(nameOverlay).toHaveCSS('transform', 'none');

  await card.hover();
  await expect(page.getByRole('dialog', { name: /the fool, reversed, in theme position card information/i })).toBeVisible();

  const compactCard = page.getByRole('group', { name: /theme: the fool, reversed/i });
  await expect(compactCard).toContainText('⟲');

  await page.goto('/__e2e/spread-layout?spread=single', { waitUntil: 'domcontentloaded' });
  const uprightCard = page.locator('[data-slot-index="0"] [data-layout-card]');
  await expect(uprightCard).toHaveAccessibleName(/the fool, in theme position\. click to view details\./i);
  await expect(uprightCard).not.toHaveAccessibleName(/reversed/i);
  await expect(uprightCard.getByLabel('Reversed')).toHaveCount(0);

  await page.goto('/__e2e/spread-layout?spread=single&reversed=1&compact=1', { waitUntil: 'domcontentloaded' });
  const compactPrimaryCard = page.locator('[data-slot-index="0"] [data-layout-card]');
  await expect(compactPrimaryCard.getByLabel('Reversed')).toHaveText('⟲');
});
