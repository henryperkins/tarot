// Serialized by Playwright into the page. All clocks here are performance.now.
// The reader runs on absolute deadlines; neither RPC nor annotation can pace it.
export function installCueBrowserCollector(config) {
  const limit = 20000;
  const report = { caseId: config.caseId, deliveryMode: config.deliveryMode, lane: config.lane || 'automatic',
    viewport: { width: innerWidth, height: innerHeight }, motionPreference: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduce' : 'no-preference',
    clockDomain: 'browser performance.now', narrativeEvents: [], serverTimingEvents: [], renderEvents: [], passageEvents: [], passageIntervals: [],
    cueReceipts: [], cueAdoptions: [], stageAdoptions: [], detailExposures: [], heldIntervals: [], readerSteps: [],
    sourceProjectionErrors: [], sourceDigests: [], layout: { proseStart: null, maxProseStartDriftPx: 0, maxOverflowPx: 0 }, unexpectedScrolls: [], samplingGaps: [], visibilityEvents: [], completionAt: null, window: { start: null, end: null, completed: false, endReason: null, readerEnabled: config.reader !== false }, truncated: false };
  const append = (name, item) => { if (report[name].length < limit) report[name].push(item); else report.truncated = true; };
  const anchors = config.opportunities.flatMap(o => o.anchors.map((a, index) => ({ opportunityId: o.id, anchorIndex: index, start: a.start, end: a.end })));
  const openPassages = new Map(); const openExposures = new Map();
  let held = null; let stageKey = ''; let nextStep = 0; let frame; let stopped = false;
  let lastFrameAt = null; let frameProjectionCache = null; let frameFragments = null; let frameSyntax = null;
  let source = null; let expectedScroll = 0; let scrollGrace = 0;
  const revisions = new Map();
  const key = a => `${a.opportunityId}:${a.anchorIndex}`;
  const close = (entry, at, reason) => { entry.end = at; entry.endReason = reason; };
  function closeVisibleIntervals(at, reason) {
    for (const p of openPassages.values()) close(p, at, reason);
    openPassages.clear();
    for (const e of openExposures.values()) close(e, at, reason);
    openExposures.clear();
  }
  document.addEventListener('visibilitychange', () => {
    const at = performance.now();
    append('visibilityEvents', { at, hidden: document.hidden });
    if (document.hidden) closeVisibleIntervals(at, 'document-hidden');
  });
  function endWindow(at, reason = 'reader-endpoint') {
    if (report.window.end !== null) return;
    report.window.end = at;
    report.window.endReason = reason;
    report.window.completed = report.window.readerEnabled && reason === 'reader-endpoint'
      && Number.isFinite(report.window.start) && Number.isFinite(report.scheduledEndpoint)
      && at === report.scheduledEndpoint && at > report.window.start;
    for (const p of openPassages.values()) close(p, at, reason);
    openPassages.clear();
    for (const e of openExposures.values()) close(e, at, reason);
    openExposures.clear();
    if (held) { close(held, at, reason); held = null; }
  }
  window.__cueTimingSink = { active: true, emit(event) {
    if (stopped || !event || !Number.isFinite(event.at)) return;
    if (event.type === 'narrative-receipt') {
      append('narrativeEvents', event);
      if (event.complete && report.completionAt === null) report.completionAt = event.at;
      if (['delta', 'snapshot', 'done'].includes(event.eventType)) for (const a of anchors) {
        let p = report.passageEvents.find(p => p.opportunityId === a.opportunityId && p.anchorIndex === a.anchorIndex && p.sourceRevision === event.sourceRevision);
        if (!p && a.end <= event.end) {
          p = { ...a, runId: event.runId, sourceRevision: event.sourceRevision, receivedAt: event.at, renderedAt: null };
          append('passageEvents', p);
        }
      }
    } else if (event.type === 'source-render') {
      append('renderEvents', event);
      const nextSource = `${event.runId}:${event.sourceRevision}`;
      if (source && nextSource !== source) {
        for (const p of openPassages.values()) close(p, event.at, 'source-replaced');
        openPassages.clear();
        for (const e of openExposures.values()) close(e, event.at, 'source-replaced');
        openExposures.clear();
        if (held) { close(held, event.at, 'source-replaced'); held = null; }
      }
      source = nextSource; revisions.set(source, event);
      if (event.end > 0 && report.window.start === null) {
        report.window.start = event.at;
        // Absolute, prose-owned endpoint established before any cue is needed.
        report.scheduledEndpoint = event.at + config.readerSchedule.durationMs;
      }
      for (const p of report.passageEvents) if (p.runId === event.runId && p.sourceRevision === event.sourceRevision
        && p.end <= event.end && p.renderedAt === null) p.renderedAt = event.at;
    } else if (event.type === 'source-digest') append('sourceDigests', event);
    else if (event.type === 'cue-server-timing') append('serverTimingEvents', event);
    else if (event.type === 'cue-receipt') append('cueReceipts', event);
    else if (event.type === 'cue-adoption') append('cueAdoptions', event);
  } };
  const intersect = (a, b) => ({ left: Math.max(a.left, b.left), right: Math.min(a.right, b.right), top: Math.max(a.top, b.top), bottom: Math.min(a.bottom, b.bottom) });
  function visibleRect(rect, element, { passage = false } = {}) {
    let clipped = intersect(rect, { left: 0, right: innerWidth, top: 0, bottom: innerHeight });
    let opacity = 1;
    for (let node = element; node instanceof Element; node = node.parentElement) {
      const style = getComputedStyle(node);
      opacity *= Number(style.opacity);
      if (style.visibility === 'hidden' || style.display === 'none' || node.inert) return false;
      if (/(hidden|clip|scroll|auto)/.test(`${style.overflowX} ${style.overflowY}`)) clipped = intersect(clipped, node.getBoundingClientRect());
    }
    if (opacity <= .01 || document.hidden || clipped.right <= clipped.left || clipped.bottom <= clipped.top) return false;
    // The sticky phone companion can overlap text even when it is in viewport.
    if (passage) {
      const companion = document.querySelector('.gesture-companion');
      if (companion && getComputedStyle(companion).position === 'sticky') {
        const b = companion.getBoundingClientRect();
        if (b.bottom > clipped.top && b.top < clipped.bottom && b.right > clipped.left && b.left < clipped.right) return false;
      }
    }
    const x = (clipped.left + clipped.right) / 2; const y = (clipped.top + clipped.bottom) / 2;
    const hit = document.elementFromPoint(x, y);
    return Boolean(hit && (element.contains(hit) || hit.contains(element)));
  }
  function projection(start, end) {
    const cacheKey = `${start}:${end}`;
    if (frameProjectionCache?.has(cacheKey)) return frameProjectionCache.get(cacheKey);
    const fragments = []; const coverage = [];
    for (const element of frameFragments || document.querySelectorAll('.narrative-stream__text [data-cue-source-start]')) {
      const a = Number(element.dataset.cueSourceStart); const b = Number(element.dataset.cueSourceEnd);
      if (a >= end || b <= start) continue;
      if (element.textContent !== config.raw.slice(a, b)) {
        if (!report.sourceProjectionErrors.some(e => e.start === a && e.end === b)) append('sourceProjectionErrors', { start: a, end: b, reason: 'source-text-mismatch' });
        continue;
      }
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT); let node; let offset = a;
      while ((node = walker.nextNode())) {
        const next = offset + node.length;
        if (offset < end && next > start) {
          const from = Math.max(start, offset); const to = Math.min(end, next);
          const range = document.createRange(); range.setStart(node, from - offset); range.setEnd(node, to - offset);
          fragments.push({ range, element }); coverage.push([from, to]);
        }
        offset = next;
      }
    }
    for (const element of frameSyntax || document.querySelectorAll('.narrative-stream__text [data-cue-syntax]')) {
      for (const token of element.dataset.cueSyntax.split(' ')) {
        const [a, b] = token.split(':').map(Number);
        if (a < end && b > start) coverage.push([Math.max(a, start), Math.min(b, end)]);
      }
    }
    coverage.sort((a, b) => a[0] - b[0]); let covered = start;
    for (const [a, b] of coverage) { if (a > covered) break; covered = Math.max(covered, b); }
    const result = { fragments, exact: covered >= end && fragments.length > 0 };
    frameProjectionCache?.set(cacheKey, result);
    return result;
  }
  function visiblePassage(a) {
    const projected = projection(a.start, a.end);
    if (!projected.exact) return false;
    // Every visible source fragment must have at least one unclipped text rect.
    return projected.fragments.every(f => [...f.range.getClientRects()].some(r => visibleRect(r, f.element, { passage: true })));
  }
  function reader(now) {
    if (report.window.start === null || report.window.end !== null || config.reader === false) return;
    while (nextStep < config.readerSchedule.steps.length && report.window.start + config.readerSchedule.steps[nextStep].atMs <= now) {
      const step = config.readerSchedule.steps[nextStep++];
      const { fragments, exact } = projection(step.start, step.end);
      const rect = fragments.at(-1)?.range.getBoundingClientRect();
      let scrolled = false;
      if (exact && rect) {
        const companion = document.querySelector('.gesture-companion');
        const top = companion && getComputedStyle(companion).position === 'sticky' ? Math.max(12, companion.getBoundingClientRect().bottom + 12) : 24;
        if (rect.bottom > innerHeight - 70) {
          expectedScroll = Math.max(scrollY, scrollY + rect.top - top);
          scrollGrace = now + 150;
          scrollTo({ top: expectedScroll, behavior: 'instant' });
          expectedScroll = scrollY; scrolled = true;
        }
      }
      append('readerSteps', { start: step.start, end: step.end, deadline: report.window.start + step.atMs,
        at: now, exact, scrolled, scrollY });
    }
  }
  addEventListener('scroll', () => {
    if (report.lane === 'automatic' && report.window.end === null && performance.now() > scrollGrace && Math.abs(scrollY - expectedScroll) > 2)
      append('unexpectedScrolls', { at: performance.now(), expected: expectedScroll, observed: scrollY });
    expectedScroll = scrollY;
  }, { passive: true });
  function sample() {
    if (stopped) return;
    const now = performance.now();
    frameProjectionCache = new Map();
    frameFragments = document.querySelectorAll('.narrative-stream__text [data-cue-source-start]');
    frameSyntax = document.querySelectorAll('.narrative-stream__text [data-cue-syntax]');
    // A long event-loop/background gap is not proof of continuous visibility.
    // Close at the last observed frame, then reopen from this actual sample.
    if (lastFrameAt !== null && now - lastFrameAt > 100) {
      append('samplingGaps', { start: lastFrameAt, end: now });
      closeVisibleIntervals(lastFrameAt, 'unobserved-frame-gap');
    }
    lastFrameAt = now;
    if (report.window.start !== null && now >= report.scheduledEndpoint) endWindow(report.scheduledEndpoint);
    reader(now);
    const prose = document.querySelector('.narrative-stream__text');
    if (prose && report.window.start !== null && report.window.end === null) {
      const top = prose.getBoundingClientRect().top + scrollY;
      report.layout.proseStart ??= top;
      report.layout.maxProseStartDriftPx = Math.max(report.layout.maxProseStartDriftPx, Math.abs(top - report.layout.proseStart));
      report.layout.maxOverflowPx = Math.max(report.layout.maxOverflowPx, document.documentElement.scrollWidth - innerWidth);
    }
    if (source) {
      const current = revisions.get(source);
      for (const a of anchors) {
        const k = key(a); const rendered = a.end <= current.end;
        const exact = rendered && projection(a.start, a.end).exact;
        const passage = report.passageEvents.find(p => p.opportunityId === a.opportunityId && p.anchorIndex === a.anchorIndex && p.sourceRevision === current.sourceRevision);
        if (passage && rendered) passage.projection = exact ? 'exact' : 'unprojectable-source';
        const visible = exact && visiblePassage(a);
        if (visible && !openPassages.has(k)) {
          const p = { ...a, runId: current.runId, sourceRevision: current.sourceRevision, start: now, end: null,
            sourceStart: a.start, sourceEnd: a.end, withinAutomaticWindow: report.window.end === null };
          // Preserve source span separately from interval timestamps.
          p.start = now; append('passageIntervals', p); openPassages.set(k, p);
        } else if (!visible && openPassages.has(k)) { close(openPassages.get(k), now, 'visibility-exit'); openPassages.delete(k); }
      }
      const stage = document.querySelector('[data-gesture-window]');
      const cueId = stage?.dataset.association; const isHeld = stage?.dataset.held === 'true';
      const origin = isHeld ? 'explicit' : stage?.dataset.phase === 'static' ? 'static' : 'automatic';
      const nextStage = `${source}:${cueId}:${origin}`;
      if (cueId && nextStage !== stageKey) {
        append('stageAdoptions', { at: now, cueId, origin, phase: stage.dataset.phase }); stageKey = nextStage;
      }
      if (isHeld && (!held || held.cueId !== cueId)) {
        if (held) close(held, now, 'held-changed');
        held = { cueId, start: now, end: null }; append('heldIntervals', held);
      } else if (!isHeld && held) { close(held, now, 'released'); held = null; }
      const targets = [];
      for (const card of stage?.querySelectorAll('.gesture-focus-layer:not(.gesture-focus-layer--departing) [data-focus-card]') || []) {
        const details = new Set(); let shown = false;
        for (const art of card.querySelectorAll('[data-gesture-art][data-active="true"]')) {
          const img = art.querySelector('img');
          if (!img?.complete || !img.naturalWidth || !visibleRect(art.getBoundingClientRect(), art)) continue;
          shown = true;
          const imageRect = img.getBoundingClientRect();
          const reversed = Boolean(art.querySelector('[data-reversed="true"]'));
          for (const spot of JSON.parse(art.dataset.cueDetailGeometry || '[]')) {
            const [id, x, y] = spot; const px = imageRect.left + imageRect.width * (reversed ? 1 - x : x);
            const py = imageRect.top + imageRect.height * (reversed ? 1 - y : y);
            if (visibleRect({ left: px - 1, right: px + 1, top: py - 1, bottom: py + 1 }, img)) details.add(id);
          }
        }
        if (shown) targets.push({ occurrenceId: card.dataset.occurrenceId,
          spreadIndex: Number(card.dataset.occurrenceId.split(':').at(-1)), detailIds: [...details].sort() });
      }
      // Exposure is independent of transport receipt. Saved/restored cues have
      // no receipt in this document, but their actual art still has exposure.
      const phrase = cueId ? document.querySelector(`[data-gesture-id="${CSS.escape(cueId)}"]`) : null;
      const sourceStart = phrase ? Number(phrase.dataset.sourceStart) : null;
      const sourceEnd = phrase ? Number(phrase.dataset.sourceEnd) : null;
      const passageVisible = Boolean(phrase && visiblePassage({ start: sourceStart, end: sourceEnd }));
      const exposureKey = cueId && targets.length ? JSON.stringify([cueId, origin, targets, passageVisible]) : null;
      for (const [k, e] of openExposures) if (k !== exposureKey) { close(e, now, 'exposure-exit'); openExposures.delete(k); }
      if (exposureKey && !openExposures.has(exposureKey)) {
        const e = { cueId, origin, targets, passageVisible, start: now, end: null, sourceRevision: current.sourceRevision, sourceStart, sourceEnd, withinAutomaticWindow: report.window.end === null };
        append('detailExposures', e); openExposures.set(exposureKey, e);
      }
    }
    frameProjectionCache = null; frameFragments = null; frameSyntax = null;
    frame = requestAnimationFrame(sample);
  }
  frame = requestAnimationFrame(sample);
  window.__cueBrowser = { report, projection, endWindow, snapshot: () => structuredClone(report),
    stop() { const at = performance.now(); endWindow(at, 'scenario-end-censored');
      closeVisibleIntervals(at, 'observation-ended');
      if (held) { close(held, at, 'observation-ended'); held = null; }
      report.observationEndedAt = at; stopped = true; cancelAnimationFrame(frame);
      window.__cueTimingSink.active = false; return structuredClone(report); } };
}
