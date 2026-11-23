/**
 * Push axis-aligned label boxes apart until they no longer intersect.
 * Returns the extra translation each box needs from its starting position.
 *
 * @param {Array<{ x: number, y: number, w: number, h: number }>} boxes
 * @param {{ gap?: number, iterations?: number, bounds?: { x: number, y: number, w: number, h: number } }} [options]
 * @returns {Array<{ x: number, y: number }>}
 */
function clampBox(box, bounds) {
  if (!bounds) return;
  const maxX = bounds.x + Math.max(0, bounds.w - box.w);
  const maxY = bounds.y + Math.max(0, bounds.h - box.h);
  box.x = Math.min(Math.max(box.x, bounds.x), maxX);
  box.y = Math.min(Math.max(box.y, bounds.y), maxY);
}

export function separateLabelBoxes(boxes, { gap = 4, iterations = 24, bounds } = {}) {
  const placed = boxes.map((box) => ({ x: box.x, y: box.y, w: box.w, h: box.h }));
  for (let pass = 0; pass < iterations; pass += 1) {
    let moved = false;
    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        const a = placed[i];
        const b = placed[j];
        const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (overlapX <= 0 || overlapY <= 0) continue;
        const dx = (b.x + b.w / 2) - (a.x + a.w / 2);
        const rawDy = (b.y + b.h / 2) - (a.y + a.h / 2);
        const dy = dx === 0 && rawDy === 0 ? 1 : rawDy;
        const length = Math.hypot(dx, dy) || 1;
        const push = (Math.min(overlapX, overlapY) + gap) / 2;
        const ux = (dx / length) * push;
        const uy = (dy / length) * push;
        a.x -= ux;
        a.y -= uy;
        b.x += ux;
        b.y += uy;
        clampBox(a, bounds);
        clampBox(b, bounds);
        moved = true;
      }
    }
    if (!moved) break;
    placed.forEach((box) => clampBox(box, bounds));
  }
  return placed.map((box, index) => ({
    x: box.x - boxes[index].x,
    y: box.y - boxes[index].y
  }));
}
