// Saved readings and follow-up answers nest beneath the entry's H3.
// The shallowest heading in a passage becomes H4; deeper ones follow it.
export function remarkJournalHeadings() {
  return (tree) => {
    const headings = [];
    const collect = (node) => {
      if (node.type === 'heading') headings.push(node);
      node.children?.forEach(collect);
    };
    collect(tree);
    if (headings.length === 0) return;
    const sourceBase = Math.min(...headings.map((heading) => heading.depth));
    headings.forEach((heading) => {
      heading.depth = Math.min(6, 4 + heading.depth - sourceBase);
    });
  };
}
