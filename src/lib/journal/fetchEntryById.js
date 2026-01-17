/**
 * Fetch a journal entry by id from the API.
 * Returns { entry, status, message } where status is one of:
 * invalid | skipped | found | not-found | error
 */
export async function fetchJournalEntryById(
  entryId,
  {
    includeFollowups = true,
    isAuthenticated = false,
    canUseCloudJournal = false,
    fetcher = fetch
  } = {}
) {
  if (!entryId) return { entry: null, status: 'invalid' };
  if (!isAuthenticated || !canUseCloudJournal) return { entry: null, status: 'skipped' };

  const params = new URLSearchParams();
  if (includeFollowups) {
    params.set('includeFollowups', 'true');
  }
  const suffix = params.toString() ? `?${params.toString()}` : '';

  try {
    const response = await fetcher(`/api/journal/${entryId}${suffix}`, {
      credentials: 'include'
    });

    if (response.status === 404) {
      return { entry: null, status: 'not-found' };
    }
    if (!response.ok) {
      throw new Error('Failed to load journal entry');
    }

    const payload = await response.json();
    const entry = payload?.entry;
    if (!entry) {
      return { entry: null, status: 'not-found' };
    }

    return { entry, status: 'found' };
  } catch (error) {
    return { entry: null, status: 'error', message: error?.message || null };
  }
}

export default fetchJournalEntryById;
