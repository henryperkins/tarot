// Keep quoted '>' characters inside tags, and leave comments/raw-text elements
// intact when inspecting the trusted app shell's head.
const HEAD_NODES = /<!--[\s\S]*?-->|<(script|style)\b(?:[^>"']|"[^"]*"|'[^']*')*>[\s\S]*?<\/\1\s*>|<meta\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;

function isSocialMetaTag(tag) {
  if (!/^<meta\b/i.test(tag)) return false;
  const attributes = tag.slice(5, -1).matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g);
  for (const [, name, doubleQuoted, singleQuoted, unquoted] of attributes) {
    if (!/^(name|property)$/i.test(name)) continue;
    const value = doubleQuoted ?? singleQuoted ?? unquoted ?? '';
    if (/^(og|twitter):/i.test(value.trim())) return true;
  }
  return false;
}

/** Replace default social metadata with already escaped, per-share tags. */
export function replaceSocialMetadata(html, metadata) {
  return html.replace(/(<head\b[^>]*>)([\s\S]*?)(<\/head\s*>)/i, (_head, opening, content, closing) => {
    const retained = content.replace(HEAD_NODES, tag => isSocialMetaTag(tag) ? '' : tag);
    // A replacement callback preserves '$&', '$\'', and '$`' in escaped titles.
    return `${opening}${retained}${metadata}\n  ${closing}`;
  });
}
