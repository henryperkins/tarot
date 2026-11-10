// A mock provider must honor the requested transport while keeping the same
// fictional reading content. This helper never renders facts or scores output.
export function modelReadingForRequest(requestBody, reading) {
  const serialized = typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody);
  return serialized.includes('SCENE OUTPUT CONTRACT:')
    ? JSON.stringify({ format: 'card-scenes-v1', blocks: [{ type: 'prose', text: reading }] })
    : reading;
}
