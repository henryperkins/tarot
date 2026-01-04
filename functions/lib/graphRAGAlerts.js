// GraphRAG telemetry alert helpers
// Emits human-friendly warnings for missing or degraded GraphRAG grounding.

export function collectGraphRAGAlerts(promptMeta = {}) {
    const graphMeta = promptMeta?.graphRAG;
    const alerts = [];

    if (!graphMeta) return alerts;

    // Only warn when GraphRAG had something to contribute but was omitted.
    // If no passages were retrieved (e.g. no graph keys/patterns), omission is expected.
    const passagesProvided =
        (typeof graphMeta.passagesProvided === 'number' ? graphMeta.passagesProvided : null) ??
        (typeof graphMeta.passagesRetrieved === 'number' ? graphMeta.passagesRetrieved : 0);

    if (graphMeta.includedInPrompt === false && passagesProvided > 0) {
        alerts.push('GraphRAG passages were retrieved but omitted from prompt');
    }

    const passagesUsed = graphMeta.passagesUsedInPrompt;
    const truncated = graphMeta.truncatedPassages;
    if (typeof truncated === 'number' && typeof passagesUsed === 'number' && truncated > passagesUsed) {
        alerts.push(`GraphRAG passages heavily truncated (${truncated} trimmed vs ${passagesUsed} kept)`);
    }

    const semanticRequested = graphMeta.semanticScoringRequested === true;
    if (semanticRequested && graphMeta.semanticScoringFallback) {
        alerts.push('GraphRAG semantic scoring fell back to keyword ranking');
    }

    return alerts;
}
