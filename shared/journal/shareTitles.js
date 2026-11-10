// Shared by the HTTP title normalizer and both journal title inputs.
export const SHARE_TITLE_MAX_LENGTH = 80;

// XML 1.0 text accepts these code points. Iterating code points preserves
// supplementary Unicode while replacing controls and unpaired surrogates.
export function replaceInvalidXmlCharacters(value) {
  return Array.from(String(value), character => {
    const point = character.codePointAt(0);
    return point === 0x9 || point === 0xA || point === 0xD
      || (point >= 0x20 && point <= 0xD7FF)
      || (point >= 0xE000 && point <= 0xFFFD)
      || (point >= 0x10000 && point <= 0x10FFFF)
      ? character : ' ';
  }).join('');
}
