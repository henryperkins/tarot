/**
 * WCAG Code Analyzer
 * Static analysis of JSX and CSS for common accessibility issues
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

// Patterns to check
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
  divAsButton: {
    pattern: /<div[^>]*onClick/gi,
    description: 'div with onClick (should use button or role="button")',
    severity: 'WARNING',
    wcag: '4.1.2 Name, Role, Value'
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
  textXsPlus: {
    pattern: /text-xs-plus/gi,
    description: 'Custom text-xs-plus class (inconsistent typography scale)',
    severity: 'INFO',
    wcag: 'N/A (Design System)'
  },
  aggressiveOpacity: {
    pattern: /(?:bg|text|border)-[\w-]+\/(?:10|15|20|30|40|50)/gi,
    description: 'Low opacity values that may affect contrast',
    severity: 'WARNING',
    wcag: '1.4.3 Contrast (Minimum)'
  },
  missingAriaLive: {
    pattern: /(?:status|alert|announcement|message|notification)(?![^<]*aria-live)/gi,
    description: 'Status/alert elements without aria-live',
    severity: 'WARNING',
    wcag: '4.1.3 Status Messages'
  }
};

/**
 * Check if an input/select/textarea is wrapped in a <label> element
 * by finding the most recent unclosed label tag
 */
function isWrappedInLabel(content, matchIndex) {
  const beforeMatch = content.substring(0, matchIndex);
  
  // Find all label open/close positions
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
  
  // Match opens with closes (greedy - each close matches nearest preceding open)
  const unclosedOpens = [...opens];
  for (const closePos of closes) {
    // Find the most recent open before this close
    for (let i = unclosedOpens.length - 1; i >= 0; i--) {
      if (unclosedOpens[i] < closePos) {
        unclosedOpens.splice(i, 1);
        break;
      }
    }
  }
  
  // If any unclosed label opens exist, we're inside a label
  return unclosedOpens.length > 0;
}

/**
 * Check if an element has aria-label on a subsequent line (multiline JSX)
 */
function hasAriaLabelOnNextLines(content, matchIndex) {
  // Get the element up to its closing > or /> (could be many lines for JSX)
  const afterMatch = content.substring(matchIndex);
  
  // Find the end of this element (first unescaped > that's not inside a string)
  // Simple approach: find first > that's followed by whitespace or newline or another tag
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let elementEnd = -1;
  
  for (let i = 0; i < Math.min(afterMatch.length, 2000); i++) {
    const char = afterMatch[i];
    const prevChar = i > 0 ? afterMatch[i - 1] : '';
    
    // Track string state
    if ((char === '"' || char === "'") && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }
    
    if (!inString) {
      if (char === '{') depth++;
      if (char === '}') depth--;
      
      // Found closing > at depth 0
      if (char === '>' && depth === 0) {
        elementEnd = i;
        break;
      }
    }
  }
  
  if (elementEnd === -1) return false;
  
  const fullElement = afterMatch.substring(0, elementEnd + 1);
  return /aria-label=/i.test(fullElement);
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(projectRoot, filePath);
  const issues = [];

  Object.entries(checks).forEach(([checkName, check]) => {
    const matches = [...content.matchAll(check.pattern)];
    
    matches.forEach(match => {
      // For form element checks, filter out false positives
      if (['inputWithoutLabel', 'selectWithoutLabel', 'textareaWithoutLabel'].includes(checkName)) {
        // Skip if inside a comment (JSDoc or line comment)
        const lineStart = content.lastIndexOf('\n', match.index) + 1;
        const lineContent = content.substring(lineStart, match.index);
        if (lineContent.includes('*') || lineContent.includes('//')) {
          return;
        }
        
        // Skip if wrapped in <label>
        if (isWrappedInLabel(content, match.index)) {
          return;
        }
        // Skip if aria-label appears later in the same element (multiline JSX)
        if (hasAriaLabelOnNextLines(content, match.index)) {
          return;
        }
      }

      const lines = content.substring(0, match.index).split('\n');
      const lineNumber = lines.length;
      const columnNumber = lines[lines.length - 1].length + 1;
      
      // Get surrounding context
      const allLines = content.split('\n');
      const contextStart = Math.max(0, lineNumber - 2);
      const contextEnd = Math.min(allLines.length, lineNumber + 1);
      const context = allLines.slice(contextStart, contextEnd).join('\n');

      issues.push({
        file: relativePath,
        line: lineNumber,
        column: columnNumber,
        checkName,
        severity: check.severity,
        description: check.description,
        wcag: check.wcag,
        match: match[0].substring(0, 100) + (match[0].length > 100 ? '...' : ''),
        context
      });
    });
  });

  return issues;
}

function scanDirectory(dir, extensions = ['.jsx', '.tsx', '.js', '.ts', '.css']) {
  let allIssues = [];
  const files = fs.readdirSync(dir, { withFileTypes: true });

  files.forEach(file => {
    const fullPath = path.join(dir, file.name);
    
    // Skip node_modules, dist, build, etc.
    if (file.isDirectory()) {
      if (!['node_modules', 'dist', 'build', '.git', 'coverage'].includes(file.name)) {
        allIssues = allIssues.concat(scanDirectory(fullPath, extensions));
      }
    } else if (file.isFile()) {
      const ext = path.extname(file.name);
      if (extensions.includes(ext)) {
        const issues = scanFile(fullPath);
        allIssues = allIssues.concat(issues);
      }
    }
  });

  return allIssues;
}

console.log('╔════════════════════════════════════════════════════════════════════╗');
console.log('║           Tableu Tarot - WCAG Code Analysis Report                ║');
console.log('║                  Static Accessibility Checks                       ║');
console.log('╚════════════════════════════════════════════════════════════════════╝\n');

console.log('Scanning codebase...\n');

const srcDir = path.join(projectRoot, 'src');
const issues = scanDirectory(srcDir);

// Group by severity
const bySeverity = {
  ERROR: issues.filter(i => i.severity === 'ERROR'),
  WARNING: issues.filter(i => i.severity === 'WARNING'),
  INFO: issues.filter(i => i.severity === 'INFO')
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

// Display issues by severity
['ERROR', 'WARNING', 'INFO'].forEach(severity => {
  const severityIssues = bySeverity[severity];
  if (severityIssues.length === 0) return;

  const icon = severity === 'ERROR' ? '❌' : severity === 'WARNING' ? '⚠️' : 'ℹ️';
  console.log(`\n${icon} ${severity} (${severityIssues.length})`);
  console.log('─────────────────────────────────────────────────────────────────────\n');

  // Group by file
  const byFile = {};
  severityIssues.forEach(issue => {
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

// Group by check type
const byCheck = {};
issues.forEach(issue => {
  if (!byCheck[issue.checkName]) byCheck[issue.checkName] = [];
  byCheck[issue.checkName].push(issue);
});

Object.entries(byCheck).forEach(([checkName, checkIssues]) => {
  const check = checks[checkName];
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
  
  // Count unique error types
  const errorTypes = {};
  bySeverity.ERROR.forEach(issue => {
    if (!errorTypes[issue.checkName]) errorTypes[issue.checkName] = 0;
    errorTypes[issue.checkName]++;
  });
  
  Object.entries(errorTypes).forEach(([checkName, count]) => {
    console.log(`   • ${checks[checkName].description} (${count} instances)`);
    console.log(`     Fix: ${getFix(checkName)}\n`);
  });
}

if (warnings > 0) {
  console.log('🟡 IMPORTANT - Address these warnings:\n');
  
  const warningTypes = {};
  bySeverity.WARNING.forEach(issue => {
    if (!warningTypes[issue.checkName]) warningTypes[issue.checkName] = 0;
    warningTypes[issue.checkName]++;
  });
  
  Object.entries(warningTypes).forEach(([checkName, count]) => {
    console.log(`   • ${checks[checkName].description} (${count} instances)`);
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

// Exit with error code if there are errors
process.exit(errors > 0 ? 1 : 0);

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
    textXsPlus: 'Use standard Tailwind text- classes',
    aggressiveOpacity: 'Test final contrast ratio with DevTools or increase opacity',
    missingAriaLive: 'Add aria-live="polite" or "assertive" to dynamic status elements'
  };
  return fixes[checkName] || 'Review WCAG guidelines for this issue';
}
