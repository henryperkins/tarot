import { memo } from 'react';

/**
 * CardRelationshipGraph - Visualizes connections between cards in a reading.
 * 
 * @param {Object} props
 * @param {Array} props.cards - Array of { name, position, id }
 * @param {Object} props.graphKeys - { completeTriadIds, dyadPairs }
 */
const CardRelationshipGraph = memo(function CardRelationshipGraph({ cards = [], graphKeys }) {
  if (!cards.length || !graphKeys) return null;

  // Extract relationships
  const triads = graphKeys.completeTriadIds || [];
  const dyads = graphKeys.dyadPairs || [];
  
  if (!triads.length && !dyads.length) return null;

  const width = 300;
  const height = 200;
  const cx = width / 2;
  const cy = height / 2;
  const radius = 60; // Slightly smaller to fit labels

  // Helper to normalize names for matching
  const normalize = str => str.toLowerCase().replace(/[^a-z0-9]/g, '');

  const cardNodes = cards.map((card, i) => {
    const angle = (i / cards.length) * 2 * Math.PI - Math.PI / 2;
    return {
      ...card,
      normName: normalize(card.name),
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  });

  const getNode = (identifier) => {
    const target = normalize(identifier);
    // Try exact match first, then partial
    return cardNodes.find(n => n.normName === target || n.normName.includes(target) || target.includes(n.normName));
  };

  return (
    <div className="w-full flex flex-col items-center bg-surface/40 rounded-xl p-4 border border-[color:var(--border-warm-subtle)]">
      <h4 className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Pattern Web</h4>
      <div style={{ width: '100%', height: '180px' }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
          {/* Edges for Dyads */}
          {dyads.map((dyad, i) => {
            // dyad.cards is likely array of names or IDs
            if (!Array.isArray(dyad.cards)) return null;
            const nodes = dyad.cards.map(id => getNode(String(id))).filter(Boolean);
            if (nodes.length !== 2) return null;
            return (
              <line 
                key={`dyad-${i}`}
                x1={nodes[0].x} y1={nodes[0].y}
                x2={nodes[1].x} y2={nodes[1].y}
                stroke="var(--brand-primary)"
                strokeWidth="1"
                strokeDasharray="3 3"
                opacity="0.4"
              />
            );
          })}

          {/* Edges for Triads */}
          {triads.map((triad, i) => {
            // Triad ID format "card1-card2-card3" or similar
            const parts = triad.split('-');
            const nodes = parts.map(p => getNode(p)).filter(Boolean);
            if (nodes.length < 2) return null;
            
            // Draw lines between all nodes in triad to form shape
            const pathData = nodes.map((n, idx) => 
              (idx === 0 ? 'M' : 'L') + `${n.x},${n.y}`
            ).join(' ') + ' Z';

            return (
              <path 
                key={`triad-${i}`}
                d={pathData}
                fill="var(--brand-primary)"
                fillOpacity="0.08"
                stroke="var(--brand-primary)"
                strokeWidth="1.5"
                strokeOpacity="0.6"
              />
            );
          })}

          {/* Nodes */}
          {cardNodes.map((node, i) => (
            <g key={i} transform={`translate(${node.x},${node.y})`}>
              <circle r="3" fill="var(--brand-primary)" />
              {/* Short name label */}
              <text 
                y={node.y > cy ? 12 : -8} 
                x={node.x > cx ? 5 : -5}
                textAnchor={node.x > cx ? "start" : "end"}
                fontSize="9" 
                fill="var(--text-muted)"
                className="font-serif"
              >
                {node.name}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="flex gap-4 mt-2 text-[10px] text-muted">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-[color:var(--border-warm-subtle)] border border-[color:var(--border-warm-light)] rounded-sm"></span>
          Triad
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 border-t border-[color:var(--border-warm-light)] border-dashed"></span>
          Dyad
        </span>
      </div>
    </div>
  );
});

export default CardRelationshipGraph;
