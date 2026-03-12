import fs from 'node:fs/promises';

const COMMENT_RE = /\/\*[\s\S]*?\*\//g;
const DECLARATION_RE = /--([\w-]+)\s*:\s*([^;]+);/g;
const VAR_FUNCTION_RE = /^var\(\s*--([\w-]+)(?:\s*,\s*([^)]+))?\s*\)$/;
const HEX_RE = /^#[0-9a-f]{3,8}$/i;

function stripComments(cssText) {
  return cssText.replace(COMMENT_RE, '');
}

function escapeSelector(selector) {
  return selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findBlock(cssText, selector) {
  const selectorRe = new RegExp(`${escapeSelector(selector)}\\s*\\{`, 'm');
  const match = selectorRe.exec(cssText);
  if (!match) return '';

  const braceStart = cssText.indexOf('{', match.index);
  let depth = 0;

  for (let i = braceStart; i < cssText.length; i += 1) {
    const char = cssText[i];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) {
      return cssText.slice(braceStart + 1, i);
    }
  }

  throw new Error(`Unterminated CSS block for selector '${selector}'.`);
}

function parseVariables(blockText) {
  const variables = {};
  for (const match of blockText.matchAll(DECLARATION_RE)) {
    const [, name, value] = match;
    variables[name] = value.trim();
  }
  return variables;
}

function resolveVariable(name, variables, seen = new Set()) {
  if (seen.has(name)) {
    throw new Error(`Circular CSS variable reference detected for '--${name}'.`);
  }
  if (!(name in variables)) {
    throw new Error(`Missing CSS variable '--${name}'.`);
  }

  const rawValue = variables[name];
  const varMatch = rawValue.match(VAR_FUNCTION_RE);
  if (!varMatch) {
    return rawValue;
  }

  const [, refName, fallback] = varMatch;
  seen.add(name);
  if (refName in variables) {
    return resolveVariable(refName, variables, seen);
  }
  if (fallback) {
    return fallback.trim();
  }
  throw new Error(`Unable to resolve CSS variable '--${name}'.`);
}

function resolveScope(variables) {
  const resolved = {};
  for (const name of Object.keys(variables)) {
    resolved[name] = resolveVariable(name, variables, new Set());
  }
  return resolved;
}

export async function loadThemeTokenScopes(themeCssPath) {
  const cssText = stripComments(await fs.readFile(themeCssPath, 'utf8'));
  const darkVariables = parseVariables(findBlock(cssText, ':root'));
  const lightOverrides = parseVariables(findBlock(cssText, ':root.light'));

  return {
    dark: resolveScope(darkVariables),
    light: resolveScope({
      ...darkVariables,
      ...lightOverrides
    })
  };
}

export function getHexToken(scope, tokenName) {
  const value = scope[tokenName];
  if (!value) {
    throw new Error(`Token '${tokenName}' was not found in the requested theme scope.`);
  }
  if (!HEX_RE.test(value)) {
    throw new Error(`Token '${tokenName}' did not resolve to a hex color: '${value}'.`);
  }
  return value.toUpperCase();
}
