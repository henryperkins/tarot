/**
 * WCAG Code Analyzer
 * Static analysis of JSX and CSS for common accessibility issues
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const checks = {
  missingAlt: {
    pattern: /<img\s+(?![^>]*alt=)[^>]*>/gi,
    description: 'Images missing alt attribute',
    severity: 'ERROR',
    wcag: '1.1.1 Non-text Content'
  },
  emptyAlt: {
    pattern: /<img\s+[^>]*alt=""\s*[^>]*>/gi,
    description: 'Images with empty alt (should be decorative or have aria-hidden)',
    severity: 'WARNING',
    wcag: '1.1.1 Non-text Content'
  },
  buttonWithoutLabel: {
    pattern: /<button(?![^>]*(aria-label|aria-labelledby))[^>]*>\s*<(?:Icon|[A-Z]\w+Icon|Phosphor)[^>]*\/>\s*<\/button>/gi,
    description: 'Icon-only buttons without aria-label',
    severity: 'ERROR',
    wcag: '4.1.2 Name, Role, Value'
  },
  inputWithoutLabel: {
    pattern: /<input(?![^>]*(aria-label|aria-labelledby|id=))[^>]*>/gi,
    description: 'Input without label association',
    severity: 'ERROR',
    wcag: '3.3.2 Labels or Instructions'
  },
  selectWithoutLabel: {
    pattern: /<select(?![^>]*(aria-label|aria-labelledby|id=))[^>]*>/gi,
    description: 'Select/dropdown without label association',
    severity: 'ERROR',
    wcag: '3.3.2 Labels or Instructions'
  },
  textareaWithoutLabel: {
    pattern: /<textarea(?![^>]*(aria-label|aria-labelledby|id=))[^>]*>/gi,
    description: 'Textarea without label association',
    severity: 'ERROR',
    wcag: '3.3.2 Labels or Instructions'
  },
  linkWithoutText: {
    pattern: /<a\s+[^>]*href=["'][^"']*["'][^>]*>\s*<\/a>/gi,
    description: 'Empty links',
    severity: 'ERROR',
    wcag: '2.4.4 Link Purpose'
  },
  missingLang: {
    pattern: /<html(?![^>]*lang=)/gi,
    description: 'HTML missing lang attribute',
    severity: 'ERROR',
    wcag: '3.1.1 Language of Page'
  },
  autoplayVideo: {
    pattern: /<video[^>]*autoplay/gi,
    description: 'Video with autoplay',
    severity: 'WARNING',
    wcag: '2.2.2 Pause, Stop, Hide'
  },
  positiveTabIndex: {
    pattern: /tabIndex=["']?[1-9]\d*["']?/gi,
    description: 'Positive tabIndex (disrupts natural tab order)',
    severity: 'ERROR',
    wcag: '2.4.3 Focus Order'
  },
  aggressiveOpacity: {
    pattern: /(?:bg|text|border)-[\w-]+\/(?:10|15|20|30|40|50)/gi,
    description: 'Low opacity values that may affect contrast',
    severity: 'WARNING',
    wcag: '1.4.3 Contrast (Minimum)'
  }
};

const DIV_AS_BUTTON_CHECK = {
  description: 'div with onClick but no keyboard semantics',
  severity: 'WARNING',
  wcag: '4.1.2 Name, Role, Value'
};

function isWrappedInLabel(content, matchIndex) {
  const beforeMatch = content.substring(0, matchIndex);
  const openPattern = /<label[\s>]/gi;
  const closePattern = /<\/label>/gi;

  const opens = [];
  const closes = [];

  let match;
  while ((match = openPattern.exec(beforeMatch)) !== null) {
    opens.push(match.index);
  }
  while ((match = closePattern.exec(beforeMatch)) !== null) {
    closes.push(match.index);
  }

  const unclosedOpens = [...opens];
  for (const closePos of closes) {
    for (let i = unclosedOpens.length - 1; i >= 0; i -= 1) {
      if (unclosedOpens[i] < closePos) {
        unclosedOpens.splice(i, 1);
        break;
      }
    }
  }

  return unclosedOpens.length > 0;
}

function hasAriaLabelOnNextLines(content, matchIndex) {
  const tag = extractElementTag(content, matchIndex);
  return Boolean(tag && /aria-label=/i.test(tag));
}

function isCommentedLine(content, matchIndex) {
  const lineStart = content.lastIndexOf('\n', matchIndex) + 1;
  const lineContent = content.substring(lineStart, matchIndex);
  return lineContent.includes('*') || lineContent.includes('//');
}

function getLocation(content, matchIndex) {
  const lines = content.substring(0, matchIndex).split('\n');
  const lineNumber = lines.length;
  const columnNumber = lines[lines.length - 1].length + 1;
  const allLines = content.split('\n');
  const contextStart = Math.max(0, lineNumber - 2);
  const contextEnd = Math.min(allLines.length, lineNumber + 1);

  return {
    line: lineNumber,
    column: columnNumber,
    context: allLines.slice(contextStart, contextEnd).join('\n')
  };
}

function extractElementTag(content, startIndex) {
  const afterMatch = content.substring(startIndex);
  let depth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < Math.min(afterMatch.length, 4000); i += 1) {
    const char = afterMatch[i];
    const prevChar = i > 0 ? afterMatch[i - 1] : '';

    if ((char === '"' || char === '\'') && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }

    if (!inString) {
      if (char === '{') depth += 1;
      if (char === '}') depth -= 1;
      if (char === '>' && depth === 0) {
        return afterMatch.substring(0, i + 1);
      }
    }
  }

  return null;
}

function buildIssue({
  relativePath,
  matchIndex,
  checkName,
  description,
  severity,
  wcag,
  match,
  content
}) {
  const location = getLocation(content, matchIndex);
  return {
    file: relativePath,
    line: location.line,
    column: location.column,
    checkName,
    severity,
    description,
    wcag,
    match: match.substring(0, 100) + (match.length > 100 ? '...' : ''),
    context: location.context
  };
}

function hasKeyboardButtonSemantics(tag) {
  const hasRoleButton = /role\s*=\s*(?:["']button["']|\{\s*['"]button['"]\s*\})/i.test(tag);
  const hasTabIndex = /tabIndex\s*=/i.test(tag);
  const hasKeyboardHandler = /onKey(?:Down|Up|Press)\s*=/i.test(tag);
  return hasRoleButton && hasTabIndex && hasKeyboardHandler;
}

function isDialogBackdrop(tag) {
  return /role\s*=\s*(?:["']dialog["']|\{\s*['"]dialog['"]\s*\})/i.test(tag)
    || /aria-modal\s*=/i.test(tag);
}

function isStopPropagationShell(tag) {
  return /onClick\s*=\s*\{\s*\(?\w+\)?\s*=>\s*(?:\{\s*)?\w+\.stopPropagation\(\)\s*;?\s*(?:\}\s*)?\}/i.test(tag);
}

function findDivAsButtonIssues(content, relativePath) {
  const issues = [];
  const divStartRe = /<div\b/g;

  for (const match of content.matchAll(divStartRe)) {
    const tag = extractElementTag(content, match.index);
    if (!tag || !/onClick\s*=/.test(tag)) continue;
    if (hasKeyboardButtonSemantics(tag)) continue;
    if (isDialogBackdrop(tag)) continue;
    if (isStopPropagationShell(tag)) continue;

    issues.push(buildIssue({
      relativePath,
      matchIndex: match.index,
      checkName: 'divAsButton',
      description: DIV_AS_BUTTON_CHECK.description,
      severity: DIV_AS_BUTTON_CHECK.severity,
      wcag: DIV_AS_BUTTON_CHECK.wcag,
      match: tag,
      content
    }));
  }

  return issues;
}

export function scanContent(content, relativePath = 'inline.jsx') {
  const issues = [];

  Object.entries(checks).forEach(([checkName, check]) => {
    const matches = [...content.matchAll(check.pattern)];

    matches.forEach((match) => {
      if (['inputWithoutLabel', 'selectWithoutLabel', 'textareaWithoutLabel'].includes(checkName)) {
        if (isCommentedLine(content, match.index)) return;
        if (isWrappedInLabel(content, match.index)) return;
        if (hasAriaLabelOnNextLines(content, match.index)) return;
      }

      issues.push(buildIssue({
        relativePath,
        matchIndex: match.index,
        checkName,
        description: check.description,
        severity: check.severity,
        wcag: check.wcag,
        match: match[0],
        content
      }));
    });
  });

  issues.push(...findDivAsButtonIssues(content, relativePath));
  return issues;
}

export function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(projectRoot, filePath);
  return scanContent(content, relativePath);
}

function scanDirectory(dir, extensions = ['.jsx', '.tsx', '.js', '.ts', '.css']) {
  let allIssues = [];
  const files = fs.readdirSync(dir, { withFileTypes: true });

  files.forEach((file) => {
    const fullPath = path.join(dir, file.name);

    if (file.isDirectory()) {
      if (!['node_modules', 'dist', 'build', '.git', 'coverage'].includes(file.name)) {
        allIssues = allIssues.concat(scanDirectory(fullPath, extensions));
      }
    } else if (file.isFile()) {
      const ext = path.extname(file.name);
      if (extensions.includes(ext)) {
        allIssues = allIssues.concat(scanFile(fullPath));
      }
    }
  });

  return allIssues;
}

function getCheckMeta(checkName) {
  if (checkName === 'divAsButton') {
    return DIV_AS_BUTTON_CHECK;
  }
  return checks[checkName];
}

function getFix(checkName) {
  const fixes = {
    missingAlt: 'Add alt="" for decorative images or descriptive alt text',
    emptyAlt: 'Add aria-hidden="true" for decorative images',
    buttonWithoutLabel: 'Add aria-label="descriptive text" to icon-only buttons',
    inputWithoutLabel: 'Wrap with <label> or add aria-label/aria-labelledby',
    selectWithoutLabel: 'Wrap with <label> or add aria-label/aria-labelledby',
    textareaWithoutLabel: 'Wrap with <label> or add aria-label/aria-labelledby',
    linkWithoutText: 'Add descriptive text inside <a> tags',
    divAsButton: 'Use <button> or add role="button", tabIndex="0", and keyboard handlers',
    missingLang: 'Add lang="en" to <html> tag',
    autoplayVideo: 'Remove autoplay or add controls',
    positiveTabIndex: 'Use tabIndex="0" or "-1", never positive numbers',
    aggressiveOpacity: 'Test final contrast ratio with DevTools or increase opacity'
  };
  return fixes[checkName] || 'Review WCAG guidelines for this issue';
}

export function runCli() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║           Tableu Tarot - WCAG Code Analysis Report                ║');
  console.log('║                  Static Accessibility Checks                       ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  console.log('Scanning codebase...\n');

  const srcDir = path.join(projectRoot, 'src');
  const issues = scanDirectory(srcDir);

  const bySeverity = {
    ERROR: issues.filter((issue) => issue.severity === 'ERROR'),
    WARNING: issues.filter((issue) => issue.severity === 'WARNING'),
    INFO: issues.filter((issue) => issue.severity === 'INFO')
  };

  const total = issues.length;
  const errors = bySeverity.ERROR.length;
  const warnings = bySeverity.WARNING.length;
  const info = bySeverity.INFO.length;

  console.log('═════════════════════════════════════════════════════════════════════');
  console.log('Summary:');
  console.log('─────────');
  console.log(`  Total Issues:  ${total}`);
  console.log(`  ❌ Errors:     ${errors} (MUST fix)`);
  console.log(`  ⚠️  Warnings:   ${warnings} (SHOULD fix)`);
  console.log(`  ℹ️  Info:       ${info} (COULD fix)`);
  console.log('═════════════════════════════════════════════════════════════════════\n');

  ['ERROR', 'WARNING', 'INFO'].forEach((severity) => {
    const severityIssues = bySeverity[severity];
    if (severityIssues.length === 0) return;

    const icon = severity === 'ERROR' ? '❌' : severity === 'WARNING' ? '⚠️' : 'ℹ️';
    console.log(`\n${icon} ${severity} (${severityIssues.length})`);
    console.log('─────────────────────────────────────────────────────────────────────\n');

    const byFile = {};
    severityIssues.forEach((issue) => {
      if (!byFile[issue.file]) byFile[issue.file] = [];
      byFile[issue.file].push(issue);
    });

    Object.entries(byFile).forEach(([file, fileIssues]) => {
      console.log(`📄 ${file} (${fileIssues.length} ${fileIssues.length === 1 ? 'issue' : 'issues'})`);

      fileIssues.forEach((issue, idx) => {
        console.log(`\n  ${idx + 1}. Line ${issue.line}:${issue.column} - ${issue.description}`);
        console.log(`     WCAG: ${issue.wcag}`);
        console.log(`     Found: ${issue.match}`);
      });
      console.log('');
    });
  });

  console.log('\n═════════════════════════════════════════════════════════════════════');
  console.log('Detailed Findings by Check:');
  console.log('═════════════════════════════════════════════════════════════════════\n');

  const byCheck = {};
  issues.forEach((issue) => {
    if (!byCheck[issue.checkName]) byCheck[issue.checkName] = [];
    byCheck[issue.checkName].push(issue);
  });

  Object.entries(byCheck).forEach(([checkName, checkIssues]) => {
    const check = getCheckMeta(checkName);
    const icon = check.severity === 'ERROR' ? '❌' : check.severity === 'WARNING' ? '⚠️' : 'ℹ️';

    console.log(`${icon} ${checkName} (${checkIssues.length} occurrences)`);
    console.log(`   ${check.description}`);
    console.log(`   WCAG: ${check.wcag}\n`);
  });

  console.log('═════════════════════════════════════════════════════════════════════');
  console.log('Priority Actions:');
  console.log('═════════════════════════════════════════════════════════════════════\n');

  if (errors > 0) {
    console.log('🔴 CRITICAL - Fix these errors immediately:\n');
    const errorTypes = {};
    bySeverity.ERROR.forEach((issue) => {
      errorTypes[issue.checkName] = (errorTypes[issue.checkName] || 0) + 1;
    });

    Object.entries(errorTypes).forEach(([checkName, count]) => {
      const check = getCheckMeta(checkName);
      console.log(`   • ${check.description} (${count} instances)`);
      console.log(`     Fix: ${getFix(checkName)}\n`);
    });
  }

  if (warnings > 0) {
    console.log('🟡 IMPORTANT - Address these warnings:\n');
    const warningTypes = {};
    bySeverity.WARNING.forEach((issue) => {
      warningTypes[issue.checkName] = (warningTypes[issue.checkName] || 0) + 1;
    });

    Object.entries(warningTypes).forEach(([checkName, count]) => {
      const check = getCheckMeta(checkName);
      console.log(`   • ${check.description} (${count} instances)`);
      console.log(`     Fix: ${getFix(checkName)}\n`);
    });
  }

  console.log('═════════════════════════════════════════════════════════════════════');
  console.log('Next Steps:');
  console.log('═════════════════════════════════════════════════════════════════════\n');

  console.log('1. Review all ERROR items and fix before deployment');
  console.log('2. Address WARNING items to improve accessibility');
  console.log('3. Run axe DevTools on live app to catch runtime issues');
  console.log('4. Test with keyboard navigation and screen readers');
  console.log('5. Run: npm run test:a11y to re-validate after fixes\n');

  console.log('═════════════════════════════════════════════════════════════════════\n');

  process.exit(errors > 0 ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
