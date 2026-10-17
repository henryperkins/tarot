/** DOM-only reading measurements; no alignment or artwork dependencies. */
export function readBlockFocus(element) {
  if (!element?.dataset) return null;
  const { readingBlock, blockCards, blockPrimary, blockMode, blockTouches } = element.dataset;
  const cards = (blockCards || '').split(' ').filter(Boolean).map(Number).filter(Number.isInteger);
  if (!readingBlock || cards.length === 0) return null;
  const touches = {};
  for (const token of (blockTouches || '').split(' ').filter(Boolean)) {
    const split = token.indexOf(':');
    const card = Number(token.slice(0, split));
    const point = token.slice(split + 1);
    if (!Number.isInteger(card) || !point) continue;
    touches[card] = touches[card] || [];
    if (!touches[card].includes(point)) touches[card].push(point);
  }
  const primary = blockPrimary === '' || blockPrimary === undefined ? null : Number(blockPrimary);
  return {
    key: `block:${readingBlock}:${blockCards}:${blockTouches || ''}`,
    mode: blockMode === 'sweep' ? 'sweep' : 'single',
    cards,
    primary: Number.isInteger(primary) ? primary : null,
    touches
  };
}

export function measureNarrativePassage(element) {
  const doc = element.ownerDocument;
  const view = doc.defaultView;
  const range = doc.createRange();
  range.selectNodeContents(element);
  const rects = [...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0);
  const passed = rects.length > 0 && rects.every(rect => rect.bottom <= 0);
  if (!rects.length || doc.hidden) return { visible: false, passed };
  const bounds = { left: 0, right: view.innerWidth, top: 0, bottom: view.innerHeight };
  let opacity = 1;
  for (let node = element; node?.nodeType === 1; node = node.parentElement) {
    const style = view.getComputedStyle(node);
    opacity *= Number(style.opacity);
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || node.inert) {
      return { visible: false, passed };
    }
    if (/(hidden|clip|scroll|auto)/.test(`${style.overflowX} ${style.overflowY}`)) {
      const clip = node.getBoundingClientRect();
      if (/(hidden|clip|scroll|auto)/.test(style.overflowX)) {
        bounds.left = Math.max(bounds.left, clip.left); bounds.right = Math.min(bounds.right, clip.right);
      }
      if (/(hidden|clip|scroll|auto)/.test(style.overflowY)) {
        bounds.top = Math.max(bounds.top, clip.top); bounds.bottom = Math.min(bounds.bottom, clip.bottom);
      }
    }
  }
  // A sticky phone companion covers the top of the prose viewport. On desktop
  // its separate column does not reduce the text's readable area.
  const companion = element.closest?.('.narrative-panel__layout')?.querySelector('.gesture-companion');
  if (companion) {
    const style = view.getComputedStyle(companion);
    const clip = companion.getBoundingClientRect();
    if (style.position === 'sticky' && clip.top <= (parseFloat(style.top) || 0) + 1
      && rects.some(rect => rect.left < clip.right && rect.right > clip.left)) {
      bounds.top = Math.max(bounds.top, clip.bottom);
    }
  }
  const header = doc.querySelector?.('.header-sticky');
  if (header) {
    const clip = header.getBoundingClientRect();
    if (clip.top <= 1 && rects.some(rect => rect.left < clip.right && rect.right > clip.left)) {
      bounds.top = Math.max(bounds.top, clip.bottom);
    }
  }
  const exposed = rect => {
    if (rect.left < bounds.left || rect.right > bounds.right || rect.top < bounds.top || rect.bottom > bounds.bottom) return false;
    const hit = doc.elementFromPoint((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2);
    return Boolean(hit && (element.contains(hit) || hit.contains(element)));
  };
  const height = Math.max(...rects.map(rect => rect.bottom)) - Math.min(...rects.map(rect => rect.top));
  // Ordinary quotes still wait for their complete geometry. When enlarged text
  // cannot fit the readable strip, require a whole exposed source line instead
  // of making the connection impossible to play. Padded wrappers and clipped
  // slivers never count; exact source completion remains the scheduler's gate.
  const oversized = height > bounds.bottom - bounds.top;
  const visible = opacity > .01 && bounds.bottom > bounds.top
    && (oversized ? rects.some(exposed) : rects.every(exposed));
  return { visible, passed };
}

/** Native selection belongs to the reader while optional annotations arrive. */
export function hasNarrativeSelection(container) {
  const selection = container?.ownerDocument?.getSelection();
  return Boolean(selection && !selection.isCollapsed && selection.rangeCount
    && selection.getRangeAt(0).intersectsNode(container));
}

export function captureNarrativeSelection(container) {
  if (!hasNarrativeSelection(container)) return null;
  const selection = container.ownerDocument.getSelection();
  const endpoint = (node, offset) => {
    let textOffset = null;
    if (container.contains(node)) {
      const prefix = container.ownerDocument.createRange();
      prefix.selectNodeContents(container);
      prefix.setEnd(node, offset);
      textOffset = prefix.toString().length;
    }
    return { node, offset, textOffset };
  };
  return { anchor: endpoint(selection.anchorNode, selection.anchorOffset),
    focus: endpoint(selection.focusNode, selection.focusOffset) };
}

export function restoreNarrativeSelection(container, snapshot) {
  if (!container || !snapshot) return;
  const endpoint = saved => {
    if (saved.node.isConnected) {
      const length = saved.node.nodeType === 3 ? saved.node.length : saved.node.childNodes.length;
      return { node: saved.node, offset: Math.min(saved.offset, length) };
    }
    if (saved.textOffset === null) return null;
    const walker = container.ownerDocument.createTreeWalker(container, 4); // SHOW_TEXT
    let remaining = saved.textOffset;
    let node;
    while ((node = walker.nextNode())) {
      if (remaining <= node.length) return { node, offset: remaining };
      remaining -= node.length;
    }
    return null;
  };
  const anchor = endpoint(snapshot.anchor);
  const focus = endpoint(snapshot.focus);
  if (!anchor || !focus) return;
  const selection = container.ownerDocument.getSelection();
  if (selection.anchorNode === anchor.node && selection.anchorOffset === anchor.offset
    && selection.focusNode === focus.node && selection.focusOffset === focus.offset) return;
  // Preserve backward selections too; rebuilding only a Range loses direction.
  selection.setBaseAndExtent(anchor.node, anchor.offset, focus.node, focus.offset);
}
