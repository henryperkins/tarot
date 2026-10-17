/** Compatibility endpoint for clients with the retired narration engine. */
export function onRequestGet() {
  return Response.json({
    error: 'This narration option has been retired. Use reader voice.',
    errorCode: 'SPEECH_PROVIDER_RETIRED'
  }, { status: 410, headers: { 'cache-control': 'no-store' } });
}

export const onRequestPost = onRequestGet;

export default { onRequestGet, onRequestPost };
