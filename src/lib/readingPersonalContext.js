const hasText = value => typeof value === 'string' && value.trim().length > 0;

function cardLabel(card, index) {
  const position = card?.position || card?.positionLabel;
  const name = card?.displayName || card?.name || card?.canonicalName || card?.card;
  return [position, name].filter(hasText).join(' · ') || `Position ${index + 1}`;
}

/** Display original inputs without the trimming used for inference identities. */
export function buildReadingPersonalContext({ question = '', reflections = null, cards = [] } = {}) {
  const spread = Array.isArray(cards) ? cards : [];
  const general = [];
  const indexed = [];
  const remaining = [];
  const add = (list, id, spreadIndex, label, text) => {
    if (!hasText(text)) return;
    // Saved card notes can also be mirrored in the indexed reflections map.
    if (list.some(note => note.spreadIndex === spreadIndex && note.text === text)) return;
    list.push({ id, spreadIndex, label, text });
  };

  if (typeof reflections === 'string') {
    add(general, 'reading', null, 'Whole reading', reflections);
  } else if (reflections && typeof reflections === 'object') {
    for (const [key, text] of Object.entries(reflections)) {
      if (key === 'Overall') {
        add(general, 'reading:Overall', null, 'Whole reading', text);
      } else if (/^(0|[1-9]\d*)$/.test(key) && Number(key) < spread.length) {
        const index = Number(key);
        add(indexed, `reflection:${key}`, index, cardLabel(spread[index], index), text);
      } else {
        // Legacy labels and unmapped indices are supplied context, never cards.
        if (hasText(text)) remaining.push({ id: `reflection:${key}`, spreadIndex: null, label: key, text });
      }
    }
  }
  spread.forEach((card, index) => {
    add(indexed, `card:${index}:userReflection`, index, cardLabel(card, index), card?.userReflection);
    add(indexed, `card:${index}:reflection`, index, cardLabel(card, index), card?.reflection);
  });
  indexed.sort((a, b) => a.spreadIndex - b.spreadIndex);
  return { question: typeof question === 'string' ? question : '', notes: [...general, ...indexed, ...remaining] };
}
