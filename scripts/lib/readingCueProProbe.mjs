// Fail-closed preflight for explicitly invoked real Pro application probes
// (remediation Task 8). Any missing opt-in, private configuration, semantic
// eligibility or same-round allowance means the probe makes zero calls.
import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_CUE_CANDIDATES } from '../evaluation/lib/visualCueEvaluationHarness.mjs';

const PROTECTED_PORTS = new Set([8787, 5175, 8789, 9235]);
const PORT_KEYS = ['worker', 'frontend', 'gateway', 'inspector'];

function validIsolation(isolation) {
  const ports = PORT_KEYS.map(key => isolation?.ports?.[key]);
  return ports.every(port => Number.isInteger(port) && port >= 1024 && port <= 65535 && !PROTECTED_PORTS.has(port))
    && new Set(ports).size === ports.length
    && typeof isolation.privateDirectory === 'string' && path.isAbsolute(isolation.privateDirectory);
}

async function privateJson(file, { fs, uid }) {
  if (typeof file !== 'string' || !path.isAbsolute(file)) return { reason: 'absent' };
  const info = await fs.lstat(file).catch(() => null);
  if (!info?.isFile()) return { reason: 'not-regular-file' };
  if ((info.mode & 0o077) !== 0) return { reason: 'permissions' };
  if (Number.isInteger(uid) && info.uid !== uid) return { reason: 'owner' };
  try { return { value: JSON.parse(await fs.readFile(file, 'utf8')) }; } catch { return { reason: 'invalid-json' }; }
}

/**
 * Returns { allowed, reasons, plan } without reading credentials beyond the
 * explicit private configuration, starting servers or dispatching inference.
 * `openBudget` must open the same persistent round ledger used by Task 7.
 */
export async function preflightRealProProbes({ env = process.env, uid = process.getuid?.(), fs = { lstat, readFile, realpath }, openBudget = null } = {}) {
  // Without the explicit opt-in nothing is read and no ledger is touched.
  if (env.CUE_REAL_PRO_PROBES !== 'true') return { allowed: false, reasons: ['opt-in-absent'], plan: null };
  const reasons = [];
  const config = await privateJson(env.CUE_REAL_PRO_CONFIG, { fs, uid });
  if (config.reason) reasons.push(`private-config-${config.reason}`);
  const settings = config.value;
  if (settings) {
    if (settings.scope !== 'real-pro-probe') reasons.push('config-scope');
    if (settings.narrativeProvider !== 'codex-subscription' || settings.narrativeModel !== 'gpt-6.1-sol' || settings.narrativeEffort !== 'high') {
      reasons.push('narrative-configuration');
    }
    if (!validIsolation(settings.isolation)) reasons.push('isolation');
    const gatewayPort = Number(/^http:\/\/127\.0\.0\.1:(\d{4,5})\/$/.exec(typeof settings.visualBudgetGateway === 'string' ? settings.visualBudgetGateway : '')?.[1]);
    if (!(gatewayPort >= 1024 && gatewayPort <= 65535) || PROTECTED_PORTS.has(gatewayPort)) reasons.push('visual-budget-gateway-absent');
    if (!DEFAULT_CUE_CANDIDATES.some(candidate => candidate.id === settings.visualCandidateId)) reasons.push('visual-candidate');
    if (!Number.isInteger(settings.plannedVisualCalls) || settings.plannedVisualCalls < 1) reasons.push('planned-visual-calls');
  }
  const eligibility = settings ? await privateJson(settings.eligibilityRecordPath, { fs, uid }) : { reason: 'absent' };
  const record = eligibility.value;
  if (eligibility.reason) reasons.push(`eligibility-record-${eligibility.reason}`);
  else if (record?.semanticEligible !== true || !/^[a-f0-9]{64}$/.test(record?.runIdentityDigest ?? '')
    || record?.candidateId !== settings?.visualCandidateId) {
    reasons.push('semantic-ineligible');
  }
  // Opening an absent ledger would create a fresh full allowance; the shared
  // Task 7 round ledger must already exist at this exact canonical path, and it
  // is opened with requireExisting so a ledger removed meanwhile is never recreated.
  const ledgerPath = settings?.roundBudgetPath;
  const canonical = typeof ledgerPath === 'string' && path.isAbsolute(ledgerPath) && path.normalize(ledgerPath) === ledgerPath
    && await fs.realpath(ledgerPath).then(resolved => resolved === ledgerPath, () => false);
  const ledger = canonical ? await fs.lstat(ledgerPath).catch(() => null) : null;
  const candidate = DEFAULT_CUE_CANDIDATES.find(item => item.id === settings?.visualCandidateId);
  if (!openBudget || !settings?.roundId || !ledger?.isFile()) reasons.push('round-budget-unavailable');
  else {
    const budget = await openBudget({ path: ledgerPath, roundId: settings.roundId, mode: 'live', requireExisting: true,
      maxCalls: settings.roundMaxCalls, maxEstimatedUsd: settings.roundMaxEstimatedUsd }).catch(() => null);
    const snapshot = await budget?.snapshot().catch(() => null);
    const decision = candidate && snapshot ? await budget.canReserve({ candidate }).catch(() => null) : null;
    const planned = settings.plannedVisualCalls;
    if (!snapshot) reasons.push('round-budget-unavailable');
    else {
      // The whole planned probe must fit the same conservative reservation the Task 7 runner uses.
      if (snapshot.halted || snapshot.closed || snapshot.maxCalls - snapshot.attempts.length < planned || !decision?.allowed
        || !(planned * decision.reservedUsd <= snapshot.maxEstimatedUsd - snapshot.heldUsd)) reasons.push('insufficient-allowance');
      // Semantic eligibility must come from this round's frozen definition and a registered phase.
      if (!record || snapshot.definitionSha256 !== record.runIdentityDigest
        || !snapshot.phases?.some(phase => phase.definitionSha256 === snapshot.definitionSha256)) reasons.push('eligibility-unbound');
    }
  }
  return { allowed: reasons.length === 0, reasons,
    plan: reasons.length ? null : { readings: ['three-card-rws', 'five-card-rws'], plannedVisualCalls: settings.plannedVisualCalls,
      candidateId: candidate.id, model: candidate.model, eligibilityRunIdentity: record.runIdentityDigest } };
}
