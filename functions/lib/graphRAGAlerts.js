// GraphRAG telemetry alert helpers
// Emits human-friendly warnings for missing or degraded GraphRAG grounding.

export function collectGraphRAGAlerts(promptMeta = {}) {
    const graphMeta = promptMeta?.graphRAG;
    const alerts = [];

    if (!graphMeta) return alerts;

    if (graphMeta.includedInPrompt === false) {
        alerts.push('GraphRAG requested but omitted from prompt');
    }

    const passagesUsed = graphMeta.passagesUsedInPrompt;
    const truncated = graphMeta.truncatedPassages;
    if (typeof truncated === 'number' && typeof passagesUsed === 'number' && truncated > passagesUsed) {
        alerts.push(`GraphRAG passages heavily truncated (${truncated} trimmed vs ${passagesUsed} kept)`);
    }

    if (graphMeta.semanticScoringFallback) {
        alerts.push('GraphRAG semantic scoring fell back to keyword ranking');
    }

    return alerts;
}
