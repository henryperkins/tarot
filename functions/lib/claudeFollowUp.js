// Compatibility for existing Claude-only callers; application routes use the
// provider-neutral module directly.
export { generatePersonalFollowUp as generateClaudeFollowUp } from './personalFollowUp.js';
