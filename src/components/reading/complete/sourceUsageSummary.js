export const USAGE_BADGE_CLASSES = {
    used: 'border-[color:rgb(var(--status-success-rgb)/0.45)] bg-[color:rgb(var(--status-success-rgb)/0.12)] text-[color:rgb(var(--status-success-rgb)/0.95)]',
    requestedNotUsed: 'border-[color:rgb(var(--status-warning-rgb)/0.45)] bg-[color:rgb(var(--status-warning-rgb)/0.12)] text-[color:rgb(var(--status-warning-rgb)/0.95)]',
    skipped: 'border-[color:rgb(var(--status-warning-rgb)/0.45)] bg-[color:rgb(var(--status-warning-rgb)/0.12)] text-[color:rgb(var(--status-warning-rgb)/0.95)]',
    notRequested: 'border-secondary/35 bg-surface-muted/40 text-muted-high'
};

function toReadableLabel(value) {
    return String(value).replaceAll('_', ' ');
}

function getUsageState(entry) {
    if (!entry || typeof entry !== 'object') return 'notRequested';
    if (entry.used) return 'used';
    if (entry.requested && entry.skippedReason) return 'skipped';
    if (entry.requested) return 'requestedNotUsed';
    return 'notRequested';
}

export function formatUsageSummary(sourceUsage) {
    if (!sourceUsage || typeof sourceUsage !== 'object') {
        return { rows: [], summary: { used: 0, requestedNotUsed: 0 } };
    }

    const rows = [];

    const pushRow = (label, entry, detail = '') => {
        const state = getUsageState(entry);
        const badgeText = state === 'used'
            ? 'Used'
            : state === 'requestedNotUsed'
                ? 'Requested not used'
                : state === 'skipped'
                    ? 'Skipped'
                    : 'Not requested';
        const fallbackDetail = state === 'skipped' && entry?.skippedReason
            ? `Reason: ${toReadableLabel(entry.skippedReason)}`
            : '';
        rows.push({
            label,
            state,
            badgeText,
            detail: detail || fallbackDetail
        });
    };

    pushRow('Spread & cards', sourceUsage.spreadCards);
    pushRow('Vision uploads', sourceUsage.vision);

    if (sourceUsage.userContext && typeof sourceUsage.userContext === 'object') {
        const contextParts = [];
        if (sourceUsage.userContext.questionProvided) contextParts.push('question');
        if (sourceUsage.userContext.reflectionsProvided) contextParts.push('reflections');
        if (sourceUsage.userContext.focusAreasProvided) contextParts.push('focus areas');
        const contextDetail = contextParts.length > 0
            ? contextParts.join(', ')
            : '';
        pushRow('User context', sourceUsage.userContext, contextDetail);
    }

    if (sourceUsage.graphRAG && typeof sourceUsage.graphRAG === 'object') {
        const mode = sourceUsage.graphRAG.mode ? String(sourceUsage.graphRAG.mode) : 'none';
        const passagesUsed = Number.isFinite(sourceUsage.graphRAG.passagesUsedInPrompt)
            ? sourceUsage.graphRAG.passagesUsedInPrompt
            : 0;
        const passagesProvided = Number.isFinite(sourceUsage.graphRAG.passagesProvided)
            ? sourceUsage.graphRAG.passagesProvided
            : 0;
        const graphDetail = sourceUsage.graphRAG.used
            ? `${mode} mode, ${passagesUsed}/${passagesProvided} passages`
            : '';
        pushRow('Traditional wisdom', sourceUsage.graphRAG, graphDetail);
    }

    pushRow('Ephemeris', sourceUsage.ephemeris);
    pushRow('Forecast', sourceUsage.forecast);

    const used = rows.filter((row) => row.state === 'used').length;
    const requestedNotUsed = rows.filter((row) => row.state === 'requestedNotUsed' || row.state === 'skipped').length;

    return {
        rows,
        summary: {
            used,
            requestedNotUsed
        }
    };
}
