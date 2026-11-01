import { canonicalCardKey } from '../../shared/vision/cardNameMapping.js';

export const CANONICAL_SCENE_FORMAT = 'card-scenes-v1';
export const CANONICAL_SCENE_CONTRACT_PREFIX = '- SCENE OUTPUT CONTRACT:';
export const CANONICAL_SCENE_FACTS_PREFIX = '- SCENE FACTS (JSON):';

// This bounded inventory authorizes only these reviewed observations. Other stored
// symbol positions, colors and poses are not promoted to verified scene facts.
const FACTS = Object.freeze([
  Object.freeze({
    id: 'rws-hierophant-keys-at-feet', deckStyle: 'rws-1909', cardKey: 'the hierophant',
    subject: 'crossed keys', position: 'at feet',
    source: 'https://sacred-texts.com/book/the-pictorial-key-to-the-tarot/v-the-hierophant',
    captions: Object.freeze({
      en: 'In the traditional RWS image, the crossed keys are at the Hierophant\'s feet.',
      fr: 'Dans l’image traditionnelle du RWS, les clés croisées sont aux pieds du Hiérophante.',
      es: 'En la imagen tradicional del RWS, las llaves cruzadas están a los pies del Hierofante.',
      pt: 'Na imagem tradicional do RWS, as chaves cruzadas estão aos pés do Hierofante.',
      de: 'Im traditionellen RWS-Bild liegen die gekreuzten Schlüssel zu Füßen des Hierophanten.',
      it: 'Nell’immagine tradizionale RWS, le chiavi incrociate sono ai piedi dello Ierofante.',
      ja: '伝統的なRWSの図像では、交差した鍵は教皇の足元にあります。',
      zh: '在传统的RWS图像中，交叉的钥匙位于教皇脚边。'
    })
  }),
  Object.freeze({
    id: 'thoth-art-motif-on-cauldron', deckStyle: 'thoth-a1', cardKey: 'temperance',
    subject: 'raven-on-skull motif', position: 'on cauldron',
    source: 'https://hermetic.com/crowley/book-of-thoth/atu',
    captions: Object.freeze({
      en: 'In the traditional Thoth Art image, the raven-on-skull motif is depicted on the cauldron.',
      fr: 'Dans l’image traditionnelle de l’Art du Thoth, le motif du corbeau sur un crâne figure sur le chaudron.',
      es: 'En la imagen tradicional de Art del Thoth, el motivo del cuervo sobre una calavera aparece en el caldero.',
      pt: 'Na imagem tradicional de Art do Thoth, o motivo do corvo sobre uma caveira está representado no caldeirão.',
      de: 'Im traditionellen Thoth-Bild der Karte Art ist das Motiv eines Raben auf einem Schädel auf dem Kessel dargestellt.',
      it: 'Nell’immagine tradizionale di Art dei Thoth, il motivo del corvo su un teschio è raffigurato sul calderone.',
      ja: '伝統的なトートのArtの図像では、大釜に頭蓋骨にとまるワタリガラスのモチーフが描かれています。',
      zh: '在传统的托特Art图像中，渡鸦立于头骨上的图案描绘在坩埚上。'
    })
  }),
  Object.freeze({
    id: 'rws-eight-cups-uncovered-head', deckStyle: 'rws-1909', cardKey: 'eight of cups',
    subject: 'traveler', position: 'with an uncovered head and a red cloak',
    source: 'https://commons.wikimedia.org/wiki/File:RWS1909_-_Cups_08.jpeg',
    captions: Object.freeze({
      en: 'In the traditional RWS image, the Eight of Cups traveler has an uncovered head and a red cloak.',
      fr: 'Dans l’image traditionnelle du RWS, le personnage du Eight of Cups a la tête découverte et porte une cape rouge.',
      es: 'En la imagen tradicional del RWS, la figura de Eight of Cups lleva la cabeza descubierta y una capa roja.',
      pt: 'Na imagem tradicional do RWS, a figura do Eight of Cups tem a cabeça descoberta e usa uma capa vermelha.',
      de: 'Im traditionellen RWS-Bild trägt die Figur auf der Karte Eight of Cups einen roten Umhang; ihr Kopf ist unbedeckt.',
      it: 'Nell’immagine tradizionale RWS, la figura dell’Eight of Cups ha il capo scoperto e indossa un mantello rosso.',
      ja: '伝統的なRWSの図像では、Eight of Cupsの人物は頭に何もかぶらず、赤いマントを着ています。',
      zh: '在传统的RWS图像中，Eight of Cups中的人物头部没有覆盖物，身穿红色斗篷。'
    })
  }),
  Object.freeze({
    id: 'rws-hermit-star-in-lantern', deckStyle: 'rws-1909', cardKey: 'the hermit',
    subject: 'lantern containing a star', position: 'held by The Hermit',
    source: 'https://commons.wikimedia.org/wiki/File:RWS1909_-_09_Hermit.jpeg',
    captions: Object.freeze({
      en: 'In the traditional RWS image, The Hermit holds a lantern containing a star.',
      fr: 'Dans l’image traditionnelle du RWS, The Hermit tient une lanterne contenant une étoile.',
      es: 'En la imagen tradicional del RWS, The Hermit sostiene un farol que contiene una estrella.',
      pt: 'Na imagem tradicional do RWS, The Hermit segura uma lanterna que contém uma estrela.',
      de: 'Im traditionellen RWS-Bild hält The Hermit eine Laterne, in der sich ein Stern befindet.',
      it: 'Nell’immagine tradizionale RWS, The Hermit tiene una lanterna che contiene una stella.',
      ja: '伝統的なRWSの図像では、The Hermitは星の入ったランタンを持っています。',
      zh: '在传统的RWS图像中，The Hermit手持一盏内有星星的灯笼。'
    })
  })
]);

const INTERPRETATION_LEADS = Object.freeze({
  en: 'As a symbolic reading:', fr: 'Comme lecture symbolique :', es: 'Como lectura simbólica:',
  pt: 'Como leitura simbólica:', de: 'Als symbolische Deutung:', it: 'Come lettura simbolica:',
  ja: '象徴的な読みとして：', zh: '作为象征性解读：'
});

export function getCanonicalSceneFacts(cardsInfo, deckStyle = 'rws-1909') {
  const drawn = new Set((Array.isArray(cardsInfo) ? cardsInfo : []).map(card =>
    canonicalCardKey(card?.card || card?.name, deckStyle)
  ).filter(Boolean));
  return FACTS.filter(fact => fact.deckStyle === deckStyle && drawn.has(fact.cardKey));
}

export function buildCanonicalSceneContract(cardsInfo, deckStyle = 'rws-1909') {
  const facts = getCanonicalSceneFacts(cardsInfo, deckStyle);
  if (!facts.length) return '';
  const data = facts.map(({ id, cardKey, subject, position }) => ({ id, card: cardKey, fact: `${subject} ${position}` }));
  return [
    // Spell out every block shape the renderer accepts; a shorthand once led a
    // model to send an interpretation block without its id and language. This
    // line is protected during fitting, so keep it near its previous length.
    `${CANONICAL_SCENE_CONTRACT_PREFIX} Return {"format":"${CANONICAL_SCENE_FORMAT}","blocks":[{"type":"prose","text":"Markdown"}]}. Optional {"type":"fact","id":"ID","language":"en"} renders a caption; {"type":"interpretation","id":"ID","language":"en","text":"..."} renders it, a symbolic lead-in, then text. No extra fields or covered scenes in prose. Locales en/fr/es/pt/de/it/ja/zh only; otherwise omit references.`,
    `${CANONICAL_SCENE_FACTS_PREFIX} ${JSON.stringify(data)}`
  ].join('\n');
}

function invalidReference() {
  const error = new Error('The reading contains an invalid canonical card fact reference.');
  error.code = 'invalid_card_fact_reference';
  return error;
}

function exactKeys(value, allowed) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).every(key => allowed.includes(key));
}

function hasInternalReference(text) {
  return text.includes(CANONICAL_SCENE_FORMAT) || FACTS.some(fact => text.includes(fact.id));
}

/** Validate references and label interpretation; free text still requires review. */
export function renderCanonicalSceneReading(rawText, {
  cardsInfo, deckStyle = 'rws-1909', allowedFactIds = [], required = false
} = {}) {
  if (typeof rawText !== 'string') throw invalidReference();
  const trimmed = rawText.trim();
  const jsonText = trimmed.startsWith('```json\n') && trimmed.endsWith('\n```')
    ? trimmed.slice(8, -4).trim() : trimmed;
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    if (required || /"format"\s*:\s*"card-scenes-v1"/.test(rawText)) throw invalidReference();
    return { reading: rawText, rawReading: rawText, usedFactIds: [] };
  }
  if (!required && parsed?.format !== CANONICAL_SCENE_FORMAT) {
    return { reading: rawText, rawReading: rawText, usedFactIds: [] };
  }
  if (!exactKeys(parsed, ['format', 'blocks']) || parsed.format !== CANONICAL_SCENE_FORMAT
    || !Array.isArray(parsed.blocks) || !parsed.blocks.length) throw invalidReference();

  const eligible = getCanonicalSceneFacts(cardsInfo, deckStyle);
  const allowed = new Set(allowedFactIds);
  const used = new Set();
  const paragraphs = [];
  let proseCount = 0;
  for (const block of parsed.blocks) {
    if (block?.type === 'prose' && exactKeys(block, ['type', 'text'])
      && typeof block.text === 'string' && block.text.trim()) {
      if (hasInternalReference(block.text)) throw invalidReference();
      paragraphs.push(block.text);
      proseCount += 1;
    } else if ((block?.type === 'fact' && exactKeys(block, ['type', 'id', 'language'])
        || block?.type === 'interpretation' && exactKeys(block, ['type', 'id', 'language', 'text'])
          && typeof block.text === 'string' && block.text.trim() && !hasInternalReference(block.text))
      && typeof block.id === 'string' && typeof block.language === 'string') {
      const fact = eligible.find(entry => entry.id === block.id && allowed.has(entry.id));
      const caption = fact && Object.hasOwn(fact.captions, block.language)
        ? fact.captions[block.language] : null;
      if (!caption) throw invalidReference();
      paragraphs.push(block.type === 'interpretation'
        ? `${caption} ${INTERPRETATION_LEADS[block.language]} ${block.text.trim()}`
        : caption);
      used.add(fact.id);
    } else {
      throw invalidReference();
    }
  }
  if (!proseCount) throw invalidReference();
  return { reading: paragraphs.join('\n\n'), rawReading: rawText, usedFactIds: [...used] };
}
