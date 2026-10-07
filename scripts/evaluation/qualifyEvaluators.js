#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { createQualificationCorpus } from './lib/qualificationCorpus.js';
import { qualifyEvaluators } from './lib/clefQualification.js';

export async function main(args = process.argv.slice(2), environment = process.env) {
  const options = { mode: 'dry-run', maxRequests: 20, timeoutMs: 15000, safetyThreshold: 0.5 };
  let ids;
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === '--live') options.mode = 'live';
    else if (flag === '--dry-run') options.mode = 'dry-run';
    else if (['--max-requests', '--timeout-ms', '--safety-threshold', '--cases'].includes(flag)) {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
      if (flag === '--cases') ids = value.split(',');
      else options[{ '--max-requests': 'maxRequests', '--timeout-ms': 'timeoutMs', '--safety-threshold': 'safetyThreshold' }[flag]] = Number(value);
    } else throw new Error(`Unknown qualification option: ${flag}`);
  }
  const corpus = createQualificationCorpus();
  if (ids && (new Set(ids).size !== ids.length || ids.some((id) => !corpus.some((sample) => sample.id === id)))) throw new Error('Unknown or duplicate corpus case');
  options.cases = ids ? ids.map((id) => corpus.find((sample) => sample.id === id)) : corpus;
  // Validate every budget before even reading credential variables. Dry runs make no inference calls.
  const preview = await qualifyEvaluators({ ...options, mode: 'dry-run' });
  if (options.mode === 'dry-run') return preview;
  if (preview.plannedRequests > options.maxRequests) throw new Error('Planned requests exceed request cap; select fewer --cases');
  const accountId = environment.CLOUDFLARE_ACCOUNT_ID;
  const token = environment.CLOUDFLARE_AUTH_TOKEN;
  if (!accountId || !/^[a-f0-9]{32}$/i.test(accountId) || !token) throw new Error('Live qualification requires a valid account ID and authorization token in the environment');
  options.ai = { run: async (model, payload, { signal }) => {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, { method: 'POST', signal, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!response.ok) throw new Error('Qualification provider API error');
    const body = await response.json();
    if (body.success === false || !body.result) throw new Error('Qualification provider API error');
    return body.result;
  } };
  return qualifyEvaluators(options);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((result) => console.log(JSON.stringify(result, null, 2))).catch(() => {
    // Do not print provider/credential/request contents in failure messages.
    console.error('Evaluator qualification failed. Check options, request cap and (for explicit live runs) environment configuration.');
    process.exitCode = 1;
  });
}
