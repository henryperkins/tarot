import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const paragraphClass = 'text-[0.9rem] sm:text-base md:text-lg leading-relaxed md:leading-loose';
const headingClass = 'font-serif text-lg sm:text-xl text-secondary mt-4 mb-2';
const listClass = 'list-disc pl-5 space-y-1';

export function MarkdownRenderer({ content }) {
  if (!content || typeof content !== 'string') {
    return null;
  }

  return (
    <div className="text-main space-y-3 md:space-y-4 max-w-prose mx-auto text-left">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        className="space-y-2"
        components={{
          h1: ({ node, ...props }) => (
            <h1 {...props} className={`${headingClass} text-2xl`} />
          ),
          h2: ({ node, ...props }) => (
            <h2 {...props} className={`${headingClass} text-xl`} />
          ),
          h3: ({ node, ...props }) => (
            <h3 {...props} className={`${headingClass} text-lg`} />
          ),
          p: ({ node, ...props }) => (
            <p {...props} className={paragraphClass} />
          ),
          strong: ({ node, ...props }) => (
            <strong {...props} className="text-main font-semibold" />
          ),
          em: ({ node, ...props }) => (
            <em {...props} className="italic text-main/90" />
          ),
          ul: ({ node, ...props }) => (
            <ul {...props} className={`${listClass} ${paragraphClass}`} />
          ),
          ol: ({ node, ...props }) => (
            <ol {...props} className={`list-decimal pl-5 space-y-1 ${paragraphClass}`} />
          ),
          li: ({ node, ...props }) => (
            <li {...props} className="marker:text-secondary" />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote
              {...props}
              className={`${paragraphClass} border-l-2 border-secondary/40 pl-4 italic text-accent/85`}
            />
          ),
          a: ({ node, ...props }) => (
            <a
              {...props}
              className="text-secondary underline decoration-dotted underline-offset-4 hover:text-secondary"
              target="_blank"
              rel="noreferrer"
            />
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
