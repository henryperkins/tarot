/** Compatibility endpoint for retired card video generation and job polling. */
export function onRequestGet() {
  return Response.json({
    error: 'Card video generation has been retired.',
    errorCode: 'CARD_VIDEO_RETIRED',
    cardVideo: false
  }, { status: 410, headers: { 'cache-control': 'no-store' } });
}

export const onRequestPost = onRequestGet;

export default { onRequestPost, onRequestGet };
