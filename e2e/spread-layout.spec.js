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
    relationship: 41,
    // Compact handset Celtic fits a square board six card-heights tall.
    celtic: 55
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
    ],
    // Handsets substitute the compact plus-over-staff layout; every other
    // viewport keeps the desktop geometry above.
    positionsByViewportWidth: {
      390: [
        { x: 50, y: 37.5 },
        { x: 50, y: 37.5, challengeOffset: true },
        { x: 22, y: 37.5 },
        { x: 78, y: 37.5 },
        { x: 50, y: 12.5 },
        { x: 50, y: 62.5 },
        { x: 12.5, y: 87.5 },
        { x: 37.5, y: 87.5 },
        { x: 62.5, y: 87.5 },
        { x: 87.5, y: 87.5 }
      ]
    }
  }
];

function getExpectedPositions(spread, viewportWidth) {
  return spread.positionsByViewportWidth?.[viewportWidth] || spread.positions;
}

function boxOverlap(left, right) {
  return {
    width: Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x),
    height: Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y)
  };
}

function seedReadingUi(page) {
  return page.addInitScript(() => {
    localStorage.setItem('tarot-onboarding-complete', 'true');
    // Suppress the Tactile Lens micro-tutorial; its pulse animation would
    // resize the button mid-measurement.
    localStorage.setItem('tableu_lens_tutorial_shown', 'true');
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
      const overlap = boxOverlap(cardBoxes[leftIndex], cardBoxes[rightIndex]);

      expect(
        overlap.width <= 1 || overlap.height <= 1,
        `${spreadKey} slots ${leftIndex}/${rightIndex} overlap by ${overlap.width.toFixed(2)}x${overlap.height.toFixed(2)}px`
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
        getExpectedPositions(spread, viewport.width),
        CELTIC_CHALLENGE_OFFSET_BY_VIEWPORT[viewport.width] || 0,
        CARD_WIDTH_FLOORS[viewport.width][spread.key]
      );
    }
  });
}

test('keeps handset Celtic board controls clear of the card field', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS[0]);
  await seedReadingUi(page);
  await openSpread(page, 'celtic', 10);

  const controlBoxes = {
    'tactile lens': await page.getByRole('button', { name: 'Position meanings' }).boundingBox(),
    reset: await page.getByRole('button', { name: /reset reveals/i }).boundingBox()
  };

  for (const [name, box] of Object.entries(controlBoxes)) {
    expect(box, `${name} control must be rendered`).not.toBeNull();
  }

  for (let index = 0; index < 10; index += 1) {
    const cardBox = await page.locator(`[data-slot-index="${index}"] [data-layout-card]`).boundingBox();
    expect(cardBox).not.toBeNull();

    for (const [name, controlBox] of Object.entries(controlBoxes)) {
      const overlap = boxOverlap(controlBox, cardBox);
      expect(
        overlap.width <= 1 || overlap.height <= 1,
        `${name} control overlaps card ${index} by ${overlap.width.toFixed(2)}x${overlap.height.toFixed(2)}px`
      ).toBe(true);
    }
  }

  const controlOverlap = boxOverlap(controlBoxes['tactile lens'], controlBoxes.reset);
  expect(
    controlOverlap.width <= 1 || controlOverlap.height <= 1,
    `tactile lens overlaps reset by ${controlOverlap.width.toFixed(2)}x${controlOverlap.height.toFixed(2)}px`
  ).toBe(true);

  await expect(page.getByRole('button', { name: 'Position meanings' })).toHaveAttribute('aria-pressed', 'false');
});

test('grows compact Celtic cards to the board on a wide handset', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 900 });
  await seedReadingUi(page);
  await openSpread(page, 'celtic', 10);

  const table = page.locator('[role="region"][aria-label$="layout"]');
  const tableBox = await table.boundingBox();
  const cardBoxes = [];
  const logicalCardWidths = [];

  for (let index = 0; index < 10; index += 1) {
    const card = page.locator(`[data-slot-index="${index}"] [data-layout-card]`);
    const cardBox = await card.boundingBox();
    expect(cardBox).not.toBeNull();

    expect(cardBox.x, `slot ${index} left edge`).toBeGreaterThanOrEqual(tableBox.x - 1);
    expect(cardBox.y, `slot ${index} top edge`).toBeGreaterThanOrEqual(tableBox.y - 1);
    expect(cardBox.x + cardBox.width, `slot ${index} right edge`).toBeLessThanOrEqual(tableBox.x + tableBox.width + 1);
    expect(cardBox.y + cardBox.height, `slot ${index} bottom edge`).toBeLessThanOrEqual(tableBox.y + tableBox.height + 1);

    cardBoxes.push(cardBox);
    logicalCardWidths.push(await card.evaluate((element) => Number.parseFloat(getComputedStyle(element).width)));
  }

  for (let leftIndex = 0; leftIndex < cardBoxes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < cardBoxes.length; rightIndex += 1) {
      if (leftIndex === 0 && rightIndex === 1) continue;
      const overlap = boxOverlap(cardBoxes[leftIndex], cardBoxes[rightIndex]);
      expect(
        overlap.width <= 1 || overlap.height <= 1,
        `celtic slots ${leftIndex}/${rightIndex} overlap by ${overlap.width.toFixed(2)}x${overlap.height.toFixed(2)}px`
      ).toBe(true);
    }
  }

  // The board, not a fixed size class, must set the card size across the whole
  // handset range: a 544px board fits cards a sixth of its height.
  expect(Math.min(...logicalCardWidths), 'wide handset celtic card width floor').toBeGreaterThanOrEqual(88);
});

test('anchors handset Celtic orientation overlays to the compact coordinates', async ({ page }) => {
  const compactPositions = SPREADS.find((spread) => spread.key === 'celtic').positionsByViewportWidth[390];
  // Self/Advice moves from the desktop staff column (82%, 88%) to the compact
  // staff row, so it separates live coordinates from stale ones.
  const adviceIndex = 6;
  const advice = compactPositions[adviceIndex];

  await page.setViewportSize(VIEWPORTS[0]);
  await seedReadingUi(page);
  await openSpread(page, 'celtic', 10);

  const expectCentredAt = async (marker, container, position, label) => {
    const markerBox = await marker.boundingBox();
    const containerBox = await container.boundingBox();
    expect(markerBox, `${label} marker must be rendered`).not.toBeNull();

    const actualX = markerBox.x + (markerBox.width / 2);
    const actualY = markerBox.y + (markerBox.height / 2);
    const expectedX = containerBox.x + (containerBox.width * (position.x / 100));
    const expectedY = containerBox.y + (containerBox.height * (position.y / 100));

    expect(Math.abs(actualX - expectedX), `${label} horizontal centre`).toBeLessThanOrEqual(2);
    expect(Math.abs(actualY - expectedY), `${label} vertical centre`).toBeLessThanOrEqual(2);
  };

  const lensButton = page.getByRole('button', { name: 'Position meanings' });
  const lensButtonBox = await lensButton.boundingBox();
  await page.mouse.move(
    lensButtonBox.x + (lensButtonBox.width / 2),
    lensButtonBox.y + (lensButtonBox.height / 2)
  );
  await page.mouse.down();

  const lensOverlay = page.getByRole('region', { name: 'Position meanings' });
  await expect(lensOverlay).toBeVisible();
  await expectCentredAt(
    lensOverlay.getByText('Self / Advice — how to meet this').locator('xpath=../..'),
    page.locator('[role="region"][aria-label$="layout"]'),
    advice,
    'tactile lens Self/Advice'
  );
  await page.mouse.up();
  await expect(lensOverlay).toBeHidden();

  await page.getByRole('button', { name: 'Show Celtic Cross position map' }).click();
  const mapOverlay = page.getByRole('dialog', { name: 'Celtic Cross position map' });
  await expect(mapOverlay).toBeVisible();
  await expectCentredAt(
    mapOverlay.getByText('Advice', { exact: true }).locator('xpath=..'),
    mapOverlay,
    advice,
    'position map Advice'
  );
});

// Motion is set per test rather than left to the runner: these cases assert
// opposite behaviour under each setting.
async function openStagedCelticReveal(page, reducedMotion) {
  await page.emulateMedia({ reducedMotion });
  await page.setViewportSize(VIEWPORTS[2]);
  await seedReadingUi(page);
  await page.goto('/__e2e/spread-layout?spread=celtic&staged=1', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('spread-layout-fixture')).toBeVisible();
  await expect(page.locator('[data-slot-index] [data-layout-card]')).toHaveCount(10, { timeout: 10000 });
}

// Samples the page for the whole burst window. Started before the click so the
// first frames of the reveal are covered.
function sampleRevealWindow(page) {
  return page.evaluate(async () => {
    const countCanvases = () => document.querySelectorAll('canvas').length;
    let peakCanvases = countCanvases();
    let sawSpark = false;
    let sawBloom = false;
    const deadline = performance.now() + 2500;

    while (performance.now() < deadline) {
      peakCanvases = Math.max(peakCanvases, countCanvases());
      if (document.querySelector('[data-slot-reveal-spark]')) sawSpark = true;
      if (document.querySelector('.slot-reveal-bloom')) sawBloom = true;
      await new Promise((resolve) => { requestAnimationFrame(resolve); });
    }

    return { peakCanvases, sawSpark, sawBloom };
  });
}

test.describe('reveal burst under normal motion', () => {
  test('reveals a full Celtic spread without adding a canvas per slot', async ({ page }) => {
    await openStagedCelticReveal(page, 'no-preference');
    const baselineCanvases = await page.locator('canvas').count();

    const sampled = sampleRevealWindow(page);
    await page.getByRole('button', { name: 'Reveal all' }).click();
    const { peakCanvases, sawSpark, sawBloom } = await sampled;

    expect(peakCanvases, 'reveal-all must not add a canvas per slot').toBe(baselineCanvases);
    expect(sawSpark, 'the reveal must render burst sparks').toBe(true);
    expect(sawBloom, 'the slot reveal bloom must still run').toBe(true);
  });

  test('throws burst sparks radially outward from the slot', async ({ page }) => {
    await openStagedCelticReveal(page, 'no-preference');

    const measured = page.evaluate(async () => {
      const deadline = performance.now() + 3000;
      while (performance.now() < deadline) {
        const burst = document.querySelector('[data-slot-reveal-burst]');
        if (burst) {
          const sparks = [...burst.querySelectorAll('[data-slot-reveal-spark]')];
          const readTranslation = (spark, progress) => {
            const animation = spark.getAnimations()[0];
            if (!animation) return null;
            animation.pause();
            animation.currentTime = animation.effect.getComputedTiming().activeDuration * progress;
            const matrix = new DOMMatrixReadOnly(getComputedStyle(spark).transform);
            return { x: matrix.m41, y: matrix.m42 };
          };

          return sparks.map((spark) => {
            const start = readTranslation(spark, 0);
            const end = readTranslation(spark, 0.9);
            if (!start || !end) return null;
            return {
              startReach: Math.hypot(start.x, start.y),
              endReach: Math.hypot(end.x, end.y),
              endDirection: (((Math.atan2(end.y, end.x) * 180) / Math.PI) + 360) % 360
            };
          });
        }
        await new Promise((resolve) => { requestAnimationFrame(resolve); });
      }
      return null;
    });

    await page.getByRole('button', { name: 'Reveal all' }).click();
    const sparks = await measured;

    expect(sparks, 'a burst must render sparks with animations').not.toBeNull();
    expect(sparks.length).toBeGreaterThanOrEqual(6);

    sparks.forEach((spark, index) => {
      expect(spark, `spark ${index} must be animated`).not.toBeNull();
      expect(spark.startReach, `spark ${index} must start at the slot centre`).toBeLessThanOrEqual(1);
      expect(spark.endReach, `spark ${index} must travel outward`).toBeGreaterThanOrEqual(20);
    });

    const step = 360 / sparks.length;
    sparks.forEach((spark, index) => {
      const expectedDirection = (index * step) % 360;
      expect(
        Math.abs(spark.endDirection - expectedDirection),
        `spark ${index} must fan to ${expectedDirection} degrees`
      ).toBeLessThanOrEqual(1);
    });
  });
});

test('disables the reveal burst under reduced motion', async ({ page }) => {
  await openStagedCelticReveal(page, 'reduce');

  const observed = page.evaluate(async () => {
    const deadline = performance.now() + 3000;
    while (performance.now() < deadline) {
      const spark = document.querySelector('[data-slot-reveal-spark]');
      if (spark) {
        const style = getComputedStyle(spark);
        const raw = style.animationDuration;
        // Normalise the unit: the stylesheet declares seconds, the global
        // reduced-motion override declares milliseconds.
        const durationMs = raw.endsWith('ms')
          ? Number.parseFloat(raw)
          : Number.parseFloat(raw) * 1000;
        return { durationMs, raw, opacity: Number.parseFloat(style.opacity) };
      }
      await new Promise((resolve) => { requestAnimationFrame(resolve); });
    }
    return null;
  });

  await page.getByRole('button', { name: 'Reveal all' }).click();
  const spark = await observed;

  expect(spark, 'the burst markup must still render under reduced motion').not.toBeNull();
  expect(
    spark.durationMs,
    'the global reduced-motion block must collapse the burst animation'
  ).toBeLessThanOrEqual(1);
});

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
