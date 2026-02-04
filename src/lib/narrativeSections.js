const SECTION_KEYWORDS = [
  { key: 'opening', keywords: ['opening', 'beginning', 'threshold', 'arrival'] },
  { key: 'cards', keywords: ['cards', 'the cards', 'story', 'throughline', 'spread', 'timeline'] },
  { key: 'synthesis', keywords: ['synthesis', 'bringing it together', 'overall', 'arc', 'summary', 'together'] },
  { key: 'guidance', keywords: ['guidance', 'moving forward', 'next steps', 'closing', 'gentle next', 'action'] },
  { key: 'guidance', keywords: ['reflections', 'reflection'] }
];

export function getSectionKeyFromHeading(heading) {
  if (!heading) return '';
  const normalized = heading.toLowerCase().trim();
  for (const entry of SECTION_KEYWORDS) {
    if (entry.keywords.some(keyword => normalized.includes(keyword))) {
      return entry.key;
    }
  }
  return '';
}
