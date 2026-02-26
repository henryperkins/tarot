# Accessibility Testing Guide

This directory contains automated and manual testing tools to validate WCAG 2.1 AA compliance for the Tableu Tarot application.

## Automated Tests

### 1. Contrast Ratio Checker (`contrast-checker.mjs`)

Validates color contrast ratios between foreground and background colors used throughout the application.

**Run:**
```bash
npm run test:contrast
# or
node tests/accessibility/contrast-checker.mjs
```

**What it checks:**
- Text contrast (WCAG AA: 4.5:1, AAA: 7.0:1)
- UI component contrast (WCAG AA: 3.0:1)
- Focus ring visibility
- Translucent surface contrast (with warnings)

**Expected output:**
- Pass/fail status for each color combination
- Contrast ratios with required thresholds
- Specific locations in code where issues occur
- Recommendations for fixes

### 2. WCAG Code Analyzer (`wcag-analyzer.mjs`)

Static code analysis to detect common accessibility issues in JSX/CSS.

**Run:**
```bash
npm run test:wcag
# or
node tests/accessibility/wcag-analyzer.mjs
```

**What it checks:**
- Missing alt attributes on images
- Icon-only buttons without aria-labels
- Inputs without label associations
- Positive tabIndex values
- div elements used as buttons
- Low opacity values that may affect contrast
- Dynamic content without aria-live regions

**Expected output:**
- Error/warning/info severity levels
- File locations and line numbers
- Code snippets showing issues
- Fix suggestions for each issue

### 3. Playwright axe-core Tests (`accessibility.spec.js`)

Runtime accessibility testing using axe-core on actual rendered pages. Catches issues that static analysis misses.

**Run:**
```bash
npm run test:a11y:e2e
# or with UI
npm run test:a11y:e2e:ui
```

**What it checks:**
- Actual computed color contrast
- ARIA attributes and state on rendered DOM
- Keyboard navigation and focus management
- Heading hierarchy and landmarks
- Form label associations
- Touch target sizes (mobile)
- Reduced motion respect
- Live regions

**Test Suites:**
- Core Pages - Home page, spread selector, question input
- Interactive Components - Buttons, focus indicators, contrast
- Keyboard Navigation - Tab order, arrow key navigation, escape key
- Live Regions - Landmarks, heading hierarchy
- Mobile - Touch targets, horizontal scroll
- Reduced Motion - Animation duration checks
- Forms - Labels, error associations

### 4. Run All Automated Tests

```bash
npm run test:a11y:all   # Static + runtime tests
npm run test:a11y       # Static tests only (faster)
npm run test:a11y:e2e   # Runtime tests only
```

This runs contrast checker, WCAG analyzer, and Playwright axe-core tests.

---

## Manual Testing Guides

### Browser-Based Testing

#### axe DevTools Extension

**Setup:**
1. Install [axe DevTools](https://www.deque.com/axe/devtools/) for Chrome/Firefox/Edge
2. Run the app: `npm run dev:vite`
3. Open DevTools → axe DevTools tab
4. Click "Scan ALL of my page"

**Focus Areas:**
- ReadingPreparation component (helper chips, summaries)
- SpreadSelector cards (complexity badges, borders)
- Card component (focus states, reveal overlays)
- Mobile action bar
- Modal dialogs
- Form inputs and toggles

**Document:**
- Screenshot violations
- Note contrast ratios shown by axe
- Save HTML/ARIA issues to file

#### Lighthouse Audit

**Run:**
1. Open app in Chrome
2. DevTools → Lighthouse tab
3. Select "Accessibility" category
4. Run audit

**Target Score:** 95+

**Focus on:**
- Contrast ratios
- ARIA attributes
- Keyboard navigation
- Form labels
- Image alt text

**Document:**
- Final score
- Failed audits with screenshots
- Opportunities for improvement

---

### Keyboard Navigation Testing

**Test Plan:**

1. **Tab Through Entire Flow:**
   ```
   ✓ Skip links appear on first Tab
   ✓ Can skip to main content
   ✓ Can skip to spread selector
   ✓ Can skip to reading area
   ✓ Tab order is logical
   ✓ No keyboard traps
   ```

2. **Focus Indicators:**
   ```
   ✓ All interactive elements show focus ring
   ✓ Focus ring contrast ≥ 3:1 against background
   ✓ Focus ring visible on gradients
   ✓ Custom controls (checkboxes, sliders) have visible focus
   ```

3. **Keyboard Shortcuts:**
   ```
   ✓ Enter/Space activates buttons
   ✓ Escape closes modals
   ✓ Arrow keys navigate spread carousel (mobile)
   ✓ Tab navigates between spread cards
   ```

4. **Modal Focus Management:**
   ```
   ✓ Focus moves to modal on open
   ✓ Focus trapped within modal
   ✓ Focus returns to trigger on close
   ✓ Escape key closes modal
   ```

**Test Each:**
- [ ] Global navigation
- [ ] Step progress chips
- [ ] Deck selector
- [ ] Spread selector cards
- [ ] Preparation sections (intention, experience, ritual)
- [ ] Draw cards button
- [ ] Card reveal interaction
- [ ] Card modal open/close
- [ ] Reflection textareas
- [ ] Generate narrative button
- [ ] Save to journal button
- [ ] Journal filters
- [ ] Mobile action bar

**Document:**
- Components without visible focus
- Tab order issues
- Keyboard traps
- Missing keyboard shortcuts

---

### Screen Reader Testing

#### NVDA (Windows)

**Setup:**
1. Install [NVDA](https://www.nvaccess.org/)
2. Press `Insert + N` to open menu
3. Navigate to Tools → Speech Viewer (to see output)

**Test Script:**

1. **Page Load:**
   ```
   ✓ Page title announced
   ✓ Landmark regions identified
   ✓ Skip links announced
   ```

2. **Navigation:**
   ```
   ✓ "Reading" and "Journal" tabs announced
   ✓ Active tab state communicated
   ✓ Step progress chips announce position
   ```

3. **Spread Selection:**
   ```
   ✓ Spread cards announced as radio buttons
   ✓ Spread name, card count, description read
   ✓ Selected state communicated
   ✓ Recommended/complexity badges announced
   ```

4. **Card Reveals:**
   ```
   ✓ Unrevealed card: "Reveal card for [position]"
   ✓ On reveal: "[Position]: [Card Name] [reversed/upright]"
   ✓ Card meaning read
   ✓ Reflection textarea label read
   ```

5. **Narrative Generation:**
   ```
   ✓ "Step 1 of 3: Analyzing spread" announced
   ✓ "Step 2 of 3: Drafting narrative" announced
   ✓ "Step 3 of 3: Final polishing" announced
   ✓ Narrative content read progressively
   ```

6. **Form Controls:**
   ```
   ✓ Checkbox state announced (checked/unchecked)
   ✓ Slider value announced
   ✓ Input labels associated correctly
   ```

#### VoiceOver (macOS/iOS)

**Setup:**
- **macOS:** Cmd + F5 to enable
- **iOS:** Settings → Accessibility → VoiceOver

**Test Same Script as NVDA**

**Additional iOS Gestures:**
- Swipe right: Next item
- Swipe left: Previous item
- Double tap: Activate
- Two-finger swipe up: Read all

**Document:**
- Unlabeled or poorly labeled elements
- Missing live region announcements
- Confusing or verbose announcements
- Elements not reachable with gestures

---

### Reduced Motion Testing

**Enable:**
- **macOS:** System Preferences → Accessibility → Display → Reduce motion
- **Windows:** Settings → Ease of Access → Display → Show animations
- **Browser:** DevTools → Rendering → Emulate CSS media `prefers-reduced-motion`

**Test:**
```
✓ Card flip animations removed or simplified
✓ Particle effects disabled
✓ Modal entrance/exit simplified
✓ Hover effects simplified
✓ Page transitions simplified
```

**Check Files:**
- Card.jsx (flip animation)
- Modal components
- Any CSS animations
- Framer Motion components

**Document:**
- Animations that don't respect reduced motion
- Elements that feel "jumpy" without transition

---

## Testing Checklist

### Priority 1: Critical Issues

- [ ] Run `npm run test:contrast` - all tests pass
- [ ] Run `npm run test:wcag` - no ERROR level issues
- [ ] axe DevTools - no violations
- [ ] Lighthouse accessibility score ≥ 95
- [ ] Keyboard navigation - all elements reachable and focusable
- [ ] Screen reader - all content announced correctly
- [ ] Reduced motion - all animations respect preference

### Priority 2: Important Issues

- [ ] All WARNING level issues from WCAG analyzer addressed
- [ ] Focus indicators visible on all interactive elements
- [ ] Form labels explicitly associated (for/id pairs)
- [ ] aria-live regions working for dynamic content
- [ ] Modal focus management working correctly

### Priority 3: Nice to Have

- [ ] INFO level issues from WCAG analyzer addressed
- [ ] Keyboard shortcuts documented
- [ ] Screen reader instructions added for complex interactions
- [ ] High contrast mode tested
- [ ] Color blind simulation tested

---

## Continuous Integration

Add to `.github/workflows/accessibility.yml`:

```yaml
name: Accessibility Tests

on: [push, pull_request]

jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:a11y
```

---

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [axe DevTools Documentation](https://www.deque.com/axe/devtools/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Keyboard Accessibility](https://webaim.org/articles/keyboard/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [NVDA User Guide](https://www.nvaccess.org/files/nvda/documentation/userGuide.html)
- [VoiceOver User Guide](https://support.apple.com/guide/voiceover/welcome/mac)

---

## Reporting Issues

When documenting accessibility issues, include:

1. **What:** Description of the issue
2. **Where:** Component/file/line number
3. **Severity:** Critical/High/Medium/Low
4. **WCAG Criterion:** e.g., "1.4.3 Contrast (Minimum)"
5. **Evidence:** Screenshot, screen reader output, code snippet
6. **Fix:** Proposed solution
7. **Testing:** How to verify the fix

---

## Next Steps

1. Run automated tests: `npm run test:a11y`
2. Fix any ERROR level issues
3. Run axe DevTools on live app
4. Conduct keyboard walkthrough
5. Test with one screen reader (NVDA or VoiceOver)
6. Address findings and re-test
7. Document results in UX report
