import { z } from 'zod';
import { generatedPassageAnnotationSchema } from './generatedPassageAnnotations.js';

const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const visualCueBindingSchema = z.object({
  readingResultId: z.string().min(1),
  sourceRevision: z.number().int().nonnegative(),
  spreadHash: digestSchema,
  contextHash: digestSchema,
  artworkEdition: z.string().min(1),
  catalogVersion: z.string().min(1)
}).strict();

// This record comes from the application's request registry, never model output.
export const issuedVisualCueRequestSchema = z.object({
  binding: visualCueBindingSchema,
  status: z.literal('active'),
  batchId: z.string().min(1),
  requestSequence: z.number().int().nonnegative(),
  analyzedEnd: z.number().int().positive().max(120000),
  analyzedHash: digestSchema,
  baseLedgerRevision: z.number().int().nonnegative()
});

export const visualCueProposalSchema = generatedPassageAnnotationSchema.omit({
  id: true, establishedBy: true
}).extend({
  localAlias: z.string().min(1).max(100),
  establishedBy: z.array(z.union([
    z.object({ acceptedCueId: z.string().regex(/^vc:[a-f0-9]{64}$/) }).strict(),
    z.object({ localAlias: z.string().min(1).max(100) }).strict()
  ])).max(8).optional()
}).strict();

// Validate proposals independently so a malformed sibling does not discard good
// work. Reject an invalid envelope explicitly; never silently truncate a batch.
export const visualCueResponseSchema = z.object({
  proposals: z.array(z.unknown()).max(240)
}).strict();

export function canonicalVisualCueJSON(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalVisualCueJSON).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key =>
      `${JSON.stringify(key)}:${canonicalVisualCueJSON(value[key])}`).join(',')}}`;
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new TypeError('Visual cue data must be JSON serializable');
  return serialized;
}

export function sameVisualCueBinding(left, right) {
  const a = visualCueBindingSchema.safeParse(left);
  const b = visualCueBindingSchema.safeParse(right);
  return a.success && b.success && canonicalVisualCueJSON(a.data) === canonicalVisualCueJSON(b.data);
}

export async function hashVisualCueText(text) {
  const hash = await globalThis.crypto.subtle.digest('SHA-256', new globalThis.TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}
