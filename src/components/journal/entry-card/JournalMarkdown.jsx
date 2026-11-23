import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { cn } from './EntryCard.primitives';
import { remarkJournalHeadings } from './journalHeadings.js';

const MARKDOWN_COMPONENTS = {
  a: ({ node: _node, ...props }) => (
    <a
      {...props}
      className="text-(--brand-primary) underline decoration-dotted underline-offset-4 hover:text-(--text-main) wrap-anywhere"
      target="_blank"
      rel="noopener noreferrer"
    />
  ),
  pre: ({ node: _node, ...props }) => (
    <pre
      {...props}
      className="overflow-x-auto rounded-xl border border-(--border-warm-light) bg-(--bg-surface-muted) p-3 text-sm leading-relaxed"
    />
  ),
  code: ({ node: _node, inline, className, children, ...props }) => {
    if (inline) {
      return (
        <code
          {...props}
          className="rounded bg-(--border-warm-subtle) px-1.5 py-0.5 font-mono text-[0.85em] text-(--text-main) wrap-break-word"
        >
          {children}
        </code>
      );
    }
    return (
      <code {...props} className={cn('font-mono whitespace-pre-wrap wrap-break-word', className)}>
        {children}
      </code>
    );
  },
  table: ({ node: _node, ...props }) => (
    <div className="my-4 -mx-1 overflow-x-auto px-1" role="region" aria-label="Reading table" tabIndex={0}>
      <table {...props} className="w-full border-collapse text-sm text-main" />
    </div>
  ),
  thead: ({ node: _node, ...props }) => (
    <thead {...props} className="bg-(--border-warm-subtle)" />
  ),
  th: ({ node: _node, ...props }) => (
    <th {...props} className="border border-(--border-warm-light) px-2 py-2 text-left text-xs font-semibold text-main" />
  ),
  td: ({ node: _node, ...props }) => (
    <td {...props} className="border border-(--border-warm-subtle) px-2 py-2 align-top text-xs text-muted" />
  )
};

const DEFAULT_PLUGINS = [remarkGfm, remarkBreaks];
const JOURNAL_PLUGINS = [...DEFAULT_PLUGINS, remarkJournalHeadings];

export default function JournalMarkdown({ children, journalHeadings = false }) {
  return (
    <ReactMarkdown
      remarkPlugins={journalHeadings ? JOURNAL_PLUGINS : DEFAULT_PLUGINS}
      skipHtml
      components={journalHeadings ? MARKDOWN_COMPONENTS : undefined}
    >
      {children}
    </ReactMarkdown>
  );
}
