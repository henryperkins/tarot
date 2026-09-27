import { Children, cloneElement, isValidElement } from 'react';
import ReactMarkdown from 'react-markdown';
import { findInsightCardMentions } from '../../lib/spreadInsights.js';

export function InsightText({ text, cards = [], onSelectCard, sourceDeck }) {
  const linkChildren = children => Children.map(children, child => {
    if (typeof child === 'string') {
      if (!onSelectCard) return child;
      const parts = [];
      let cursor = 0;
      for (const { start, end, index } of findInsightCardMentions(child, cards, { sourceDeck })) {
        if (start > cursor) parts.push(child.slice(cursor, start));
        const card = cards[index];
        parts.push(
          <button
            key={`${start}-${index}`}
            type="button"
            className="insight-card-link text-accent underline underline-offset-4 decoration-current rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            aria-label={`View ${card.name}${card.position ? ` — ${card.position}` : ''}`}
            aria-haspopup="dialog"
            onClick={() => onSelectCard(index)}
          >
            {child.slice(start, end)}
          </button>
        );
        cursor = end;
      }
      if (cursor < child.length) parts.push(child.slice(cursor));
      return parts;
    }
    if (!isValidElement(child)) return child;
    const tag = child.props?.node?.tagName || child.type;
    if (['a', 'button', 'code', 'pre'].includes(tag)) return child;
    return cloneElement(child, {}, linkChildren(child.props.children));
  });

  return (
    <ReactMarkdown components={{
      p: ({ children }) => <span>{linkChildren(children)}</span>,
      strong: ({ children }) => <strong className="font-semibold text-main">{children}</strong>
    }}>
      {text || ''}
    </ReactMarkdown>
  );
}
