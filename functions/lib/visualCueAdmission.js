/** Internal evaluation seam. Provider strings/fields cannot attest no dispatch. */
const admissions = new WeakSet();
const bindings = new WeakSet();
const providerCaptures = new WeakMap();
const undispatched = new WeakMap();
const reasons = new Set(['candidate-cost-bound', 'call-cap', 'round-halted', 'configuration', 'cancelled-before-dispatch']);

export function createVisualCueAdmissionError(reason = 'configuration') {
  const error = new Error('Cue admission rejected before dispatch; budget/configuration/registration bound.');
  error.code = 'cue_admission_rejected';
  error.reason = reasons.has(reason) ? reason : 'configuration';
  admissions.add(error);
  return error;
}

export const isVisualCueAdmissionError = error => admissions.has(error);
export const isTrustedVisualCueBinding = binding => bindings.has(binding);

export function createTrustedVisualCueBinding(run) {
  const binding = Object.freeze({ run });
  bindings.add(binding);
  return binding;
}

/** Only trusted transport code mints this object from the actual response/error. */
export function captureVisualCueUsageEvidence({ requestSha256, requestedModel, usage, returnedModel }) {
  const evidence = Object.freeze({});
  providerCaptures.set(evidence, { requestSha256, requestedModel, usage, returnedModel });
  return evidence;
}

export const readVisualCueUsageEvidence = evidence => providerCaptures.get(evidence) || null;

/** Trusted adapter attests that it has not invoked its underlying transport. */
export function captureVisualCueUndispatchedReservation(reservationId) {
  const evidence = Object.freeze({});
  undispatched.set(evidence, reservationId);
  return evidence;
}

export const isVisualCueUndispatchedReservation = (evidence, id) => undispatched.get(evidence) === id;
