import { Children, cloneElement, isValidElement } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  normalizeHighlightPhrases,
  passesWordBoundary
} from '../lib/highlightUtils';

const STYLE_VARIANTS = {
  default: {
    wrapper:
      'text-main space-y-4 xs:space-y-5 md:space-y-6 max-w-[calc(100vw-1.5rem)] xs:max-w-sm sm:max-w-prose mx-auto text-left px-1 xs:px-2 sm:px-4 lg:px-6',
    inner: 'space-y-3 xs:space-y-4',
    paragraph: 'text-base md:text-lg leading-relaxed xs:leading-7 md:leading-loose',
    heading: 'font-serif text-lg sm:text-xl text-secondary mt-5 xs:mt-6 mb-2 xs:mb-3',
    headingSizes: {
      h1: 'text-xl xs:text-2xl',
      h2: 'text-lg xs:text-xl',
      h3: 'text-base xs:text-lg'
    },
    list: 'list-disc pl-4 sm:pl-5 space-y-1.5 xs:space-y-2',
    blockquote:
      'border-l-2 border-secondary/40 pl-4 xs:pl-5 italic text-accent/85 my-4 xs:my-5',
    inlineCode:
      'bg-surface-muted/70 text-accent px-1.5 py-0.5 rounded text-[0.85rem] xs:text-sm font-mono break-words',
    codeBlock:
      'block p-3 text-[0.8rem] xs:text-sm font-mono whitespace-pre-wrap break-words',
    pre: 'bg-surface-muted/50 rounded-lg overflow-x-auto my-3 xs:my-4 border border-secondary/20 max-w-full',
    hr: 'border-secondary/30 my-6 xs:my-8',
    tableWrapper: 'overflow-x-auto my-4 xs:my-5 -mx-1 px-1',
    table: 'w-full border-collapse text-[0.8rem] xs:text-sm',
    thead: 'bg-surface-muted/50',
    th: 'border border-secondary/30 px-2 xs:px-3 py-1.5 xs:py-2 text-left font-semibold text-accent',
    td: 'border border-secondary/30 px-2 xs:px-3 py-1.5 xs:py-2',
    showSectionDivider: true
  },
  compact: {
    wrapper: 'text-main text-left',
    inner: 'space-y-2',
    paragraph: 'text-sm leading-relaxed',
    heading: 'font-serif text-sm text-secondary mt-3 mb-2',
    headingSizes: {
      h1: 'text-base',
      h2: 'text-sm',
      h3: 'text-sm'
    },
    list: 'list-disc pl-4 space-y-1 text-sm',
    blockquote: 'border-l-2 border-secondary/40 pl-3 italic text-accent/85 my-2 text-sm',
    inlineCode:
      'bg-surface-muted/70 text-accent px-1.5 py-0.5 rounded text-[0.75rem] font-mono break-words',
    codeBlock: 'block p-2 text-[0.75rem] font-mono whitespace-pre-wrap break-words',
    pre: 'bg-surface-muted/50 rounded-lg overflow-x-auto my-2 border border-secondary/20 max-w-full',
    hr: 'border-secondary/30 my-3',
    tableWrapper: 'overflow-x-auto my-2 -mx-1 px-1',
    table: 'w-full border-collapse text-[0.75rem]',
    thead: 'bg-surface-muted/50',
    th: 'border border-secondary/30 px-2 py-1 text-left font-semibold text-accent',
    td: 'border border-secondary/30 px-2 py-1',
    showSectionDivider: false
  }
};

const getVariantStyles = (variant) => STYLE_VARIANTS[variant] || STYLE_VARIANTS.default;

function splitTextWithHighlights(text, phrases) {
  if (!text || typeof text !== 'string') return text;
  if (!phrases || phrases.length === 0) return text;

  const lower = text.toLowerCase();
  const phrasesLower = phrases.map(p => p.toLowerCase());
  const parts = [];
  let i = 0;
  let key = 0;

  while (i < text.length) {
    let bestIndex = -1;
    let bestPhraseIndex = -1;

    // Find the earliest match among phrases.
    for (let p = 0; p < phrasesLower.length; p++) {
      const idx = lower.indexOf(phrasesLower[p], i);
      if (idx === -1) continue;
      if (bestIndex === -1 || idx < bestIndex) {
        bestIndex = idx;
        bestPhraseIndex = p;
      }
    }

    if (bestIndex === -1 || bestPhraseIndex === -1) {
      parts.push(text.slice(i));
      break;
    }

    // If the match isn't a word-boundary hit, advance by one character and keep scanning.
    const phrase = phrases[bestPhraseIndex];
    const start = bestIndex;
    const end = bestIndex + phrase.length;
    if (!passesWordBoundary(text, start, end)) {
      parts.push(text.slice(i, bestIndex + 1));
      i = bestIndex + 1;
      continue;
    }

    if (bestIndex > i) {
      parts.push(text.slice(i, bestIndex));
    }

    parts.push(
      <span key={`hl-${key++}-${bestIndex}`} className="narrative-emphasis">
        {text.slice(start, end)}
      </span>
    );
    i = end;
  }

  return parts;
}

function highlightChildren(children, phrases) {
  if (!phrases || phrases.length === 0) return children;
  return Children.map(children, (child) => {
    if (typeof child === 'string') {
      return splitTextWithHighlights(child, phrases);
    }

    if (!isValidElement(child)) {
      return child;
    }

    // Avoid highlighting inside code blocks / inline code.
    // react-markdown will often pass custom renderer *functions* as element types,
    // so we also inspect the node metadata it provides.
    const tagName = child.props?.node?.tagName;
    const nodeType = child.props?.node?.type;
    const isInlineCode = Boolean(child.props?.inline);
    const isCodeLike =
      child.type === 'code' ||
      child.type === 'pre' ||
      tagName === 'code' ||
      tagName === 'pre' ||
      nodeType === 'code' ||
      nodeType === 'inlineCode' ||
      isInlineCode;

    if (isCodeLike) {
      return child;
    }

    const nextChildren = highlightChildren(child.props?.children, phrases);
    if (nextChildren === child.props?.children) {
      return child;
    }
    return cloneElement(child, { ...child.props, children: nextChildren });
  });
}

export function MarkdownRenderer({
  content,
  highlightPhrases = [],
  variant = 'default',
  className = ''
}) {
  if (!content || typeof content !== 'string') {
    return null;
  }

  const styles = getVariantStyles(variant);
  const normalizedPhrases = normalizeHighlightPhrases(highlightPhrases);

  const renderHeading = (Tag, props, className) => (
    styles.showSectionDivider ? (
      <div className="narrative-section">
        <div className="narrative-section__divider" aria-hidden="true"><span>✦</span></div>
        <Tag {...props} className={className}>
          {highlightChildren(props.children, normalizedPhrases)}
        </Tag>
      </div>
    ) : (
      <Tag {...props} className={className}>
        {highlightChildren(props.children, normalizedPhrases)}
      </Tag>
    )
  );

  const wrapperClassName = [styles.wrapper, className].filter(Boolean).join(' ');

  return (
    // max-w-prose ensures 65-75 character line length for optimal readability
    // Using calc for very small screens to prevent text touching edges
    <div className={wrapperClassName}>
      <div className={styles.inner}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          skipHtml
          components={{
          h1: ({ node: _node, ...props }) => (
            <h1 {...props} className={`${styles.heading} ${styles.headingSizes.h1}`}>
              {highlightChildren(props.children, normalizedPhrases)}
            </h1>
          ),
          h2: ({ node: _node, ...props }) => renderHeading('h2', props, `${styles.heading} ${styles.headingSizes.h2}`),
          h3: ({ node: _node, ...props }) => renderHeading('h3', props, `${styles.heading} ${styles.headingSizes.h3}`),
          p: ({ node: _node, ...props }) => (
            <p {...props} className={styles.paragraph}>
              {highlightChildren(props.children, normalizedPhrases)}
            </p>
          ),
          strong: ({ node: _node, ...props }) => (
            <strong {...props} className="text-main font-semibold">
              {highlightChildren(props.children, normalizedPhrases)}
            </strong>
          ),
          em: ({ node: _node, ...props }) => (
            <em {...props} className="italic text-main/90">
              {highlightChildren(props.children, normalizedPhrases)}
            </em>
          ),
          ul: ({ node: _node, ...props }) => (
            <ul {...props} className={`${styles.list} ${styles.paragraph}`}>
              {highlightChildren(props.children, normalizedPhrases)}
            </ul>
          ),
          ol: ({ node: _node, ...props }) => (
            <ol {...props} className={`list-decimal pl-5 space-y-1.5 xs:space-y-2 ${styles.paragraph}`}>
              {highlightChildren(props.children, normalizedPhrases)}
            </ol>
          ),
          li: ({ node: _node, ...props }) => (
            <li {...props} className="marker:text-secondary pl-1">
              {highlightChildren(props.children, normalizedPhrases)}
            </li>
          ),
          blockquote: ({ node: _node, ...props }) => (
            <blockquote
              {...props}
              className={`${styles.paragraph} ${styles.blockquote}`}
            >
              {highlightChildren(props.children, normalizedPhrases)}
            </blockquote>
          ),
          a: ({ node: _node, ...props }) => (
            <a
              {...props}
              className="text-secondary underline decoration-dotted underline-offset-4 hover:text-secondary break-words overflow-wrap-anywhere"
              target="_blank"
              rel="noopener noreferrer"
            />
          ),
          // Inline code (backticks)
          code: ({ node: _node, inline, className, children, ...props }) => {
            if (inline) {
              return (
                <code
                  {...props}
                  className={styles.inlineCode}
                >
                  {children}
                </code>
              );
            }
            // Code blocks (triple backticks) - pre handles container styling
            return (
              <code
                {...props}
                className={`${styles.codeBlock} ${className || ''}`}
              >
                {children}
              </code>
            );
          },
          // Pre wrapper for code blocks - handles scrolling with mobile overflow fix
          pre: ({ node: _node, ...props }) => (
            <pre
              {...props}
              className={styles.pre}
            />
          ),
          // Horizontal rule - section break
          hr: ({ node: _node, ...props }) => (
            <hr {...props} className={styles.hr} />
          ),
          // Tables (from GFM) - scrollable container with keyboard support
          table: ({ node: _node, ...props }) => (
            <div
              className={styles.tableWrapper}
              role="region"
              aria-label="Data table"
              tabIndex={0}
            >
              <table {...props} className={styles.table} />
            </div>
          ),
          thead: ({ node: _node, ...props }) => (
            <thead {...props} className={styles.thead} />
          ),
          th: ({ node: _node, ...props }) => (
            <th {...props} className={styles.th} />
          ),
          td: ({ node: _node, ...props }) => (
            <td {...props} className={styles.td} />
          )
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
