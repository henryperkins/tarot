/**
 * Single-reading share links: which links belong to an entry, and which one
 * the entry's share button reuses instead of minting another public link.
 */

/** True when a link shares exactly this one entry. */
export function isShareLinkForEntry(link, entryId) {
  if (!link || !entryId) return false;
  if (link.scope && link.scope !== 'entry') return false;
  const ids = Array.isArray(link.entryIds) ? link.entryIds : [];
  return ids.includes(entryId) || link.entryId === entryId;
}

function expiryTime(link) {
  if (link?.expiresAt == null || link.expiresAt === '') return null;
  const time = typeof link.expiresAt === 'number' ? link.expiresAt : new Date(link.expiresAt).getTime();
  return Number.isFinite(time) ? time : null;
}

/** True unless the link has an expiry that has passed. */
export function isShareLinkLive(link, now = Date.now()) {
  const expires = expiryTime(link);
  return expires === null || expires > now;
}

/**
 * @param {Array} links - Links from GET /api/share
 * @param {string} entryId
 * @param {number} [now]
 * @returns {Object|null} The newest live link for this entry
 */
export function findReusableShareLink(links, entryId, now = Date.now()) {
  if (!Array.isArray(links)) return null;
  let newest = null;
  for (const link of links) {
    if (!link?.token || !isShareLinkForEntry(link, entryId) || !isShareLinkLive(link, now)) continue;
    if (!newest || (Number(link.createdAt) || 0) > (Number(newest.createdAt) || 0)) newest = link;
  }
  return newest;
}
