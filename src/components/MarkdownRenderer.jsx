import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Mobile-optimized typography: 65-75 character line length, good paragraph spacing
// Using 16px (text-base) as minimum for accessibility and iOS zoom prevention
const paragraphClass = 'text-base md:text-lg leading-relaxed xs:leading-7 md:leading-loose';
const headingClass = 'font-serif text-lg sm:text-xl text-secondary mt-5 xs:mt-6 mb-2 xs:mb-3';
const listClass = 'list-disc pl-4 sm:pl-5 space-y-1.5 xs:space-y-2';

export function MarkdownRenderer({ content }) {
  if (!content || typeof content !== 'string') {
    return null;
  }

  return (
    // max-w-prose ensures 65-75 character line length for optimal readability
    // Using calc for very small screens to prevent text touching edges
    <div className="text-main space-y-4 xs:space-y-5 md:space-y-6 max-w-[calc(100vw-1.5rem)] xs:max-w-sm sm:max-w-prose mx-auto text-left px-1 xs:px-2 sm:px-4 lg:px-6">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        className="space-y-3 xs:space-y-4"
        components={{
          h1: ({ node: _node, ...props }) => (
            <h1 {...props} className={`${headingClass} text-xl xs:text-2xl`} />
          ),
          h2: ({ node: _node, ...props }) => (
            <h2 {...props} className={`${headingClass} text-lg xs:text-xl`} />
          ),
          h3: ({ node: _node, ...props }) => (
            <h3 {...props} className={`${headingClass} text-base xs:text-lg`} />
          ),
          p: ({ node: _node, ...props }) => (
            <p {...props} className={paragraphClass} />
          ),
          strong: ({ node: _node, ...props }) => (
            <strong {...props} className="text-main font-semibold" />
          ),
          em: ({ node: _node, ...props }) => (
            <em {...props} className="italic text-main/90" />
          ),
          ul: ({ node: _node, ...props }) => (
            <ul {...props} className={`${listClass} ${paragraphClass}`} />
          ),
          ol: ({ node: _node, ...props }) => (
            <ol {...props} className={`list-decimal pl-5 space-y-1.5 xs:space-y-2 ${paragraphClass}`} />
          ),
          li: ({ node: _node, ...props }) => (
            <li {...props} className="marker:text-secondary pl-1" />
          ),
          blockquote: ({ node: _node, ...props }) => (
            <blockquote
              {...props}
              className={`${paragraphClass} border-l-2 border-secondary/40 pl-4 xs:pl-5 italic text-accent/85 my-4 xs:my-5`}
            />
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
                  className="bg-surface-muted/70 text-accent px-1.5 py-0.5 rounded text-[0.85rem] xs:text-sm font-mono break-words"
                >
                  {children}
                </code>
              );
            }
            // Code blocks (triple backticks) - pre handles container styling
            return (
              <code
                {...props}
                className={`block p-3 text-[0.8rem] xs:text-sm font-mono whitespace-pre-wrap break-words ${className || ''}`}
              >
                {children}
              </code>
            );
          },
          // Pre wrapper for code blocks - handles scrolling with mobile overflow fix
          pre: ({ node: _node, ...props }) => (
            <pre
              {...props}
              className="bg-surface-muted/50 rounded-lg overflow-x-auto my-3 xs:my-4 border border-secondary/20 max-w-full"
            />
          ),
          // Horizontal rule - section break
          hr: ({ node: _node, ...props }) => (
            <hr {...props} className="border-secondary/30 my-6 xs:my-8" />
          ),
          // Tables (from GFM) - scrollable container with keyboard support
          table: ({ node: _node, ...props }) => (
            <div
              className="overflow-x-auto my-4 xs:my-5 -mx-1 px-1"
              role="region"
              aria-label="Data table"
              tabIndex={0}
            >
              <table {...props} className="w-full border-collapse text-[0.8rem] xs:text-sm" />
            </div>
          ),
          thead: ({ node: _node, ...props }) => (
            <thead {...props} className="bg-surface-muted/50" />
          ),
          th: ({ node: _node, ...props }) => (
            <th {...props} className="border border-secondary/30 px-2 xs:px-3 py-1.5 xs:py-2 text-left font-semibold text-accent" />
          ),
          td: ({ node: _node, ...props }) => (
            <td {...props} className="border border-secondary/30 px-2 xs:px-3 py-1.5 xs:py-2" />
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
