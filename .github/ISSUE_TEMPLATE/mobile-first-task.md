---
name: Mobile-First Design Task
about: Task for the mobile-first-designer agent
title: "[Mobile] "
labels: mobile, responsive, ui
assignees: ''
---

## Summary
<!-- One sentence describing what needs to be fixed or improved -->

## Problem
<!-- Describe the current mobile/responsive issue. Include:
- What breaks or looks wrong
- Which screen sizes are affected (e.g., <375px, 375-640px, tablet)
- Screenshots or device names if helpful
-->

## Components in Scope

| Component | File Path | Priority | Key Issues |
|-----------|-----------|----------|------------|
| | `src/components/` | Critical/High/Medium | |
| | `src/components/` | | |

## Acceptance Criteria
<!-- Checklist of what "done" looks like -->

- [ ] Works on 375px viewport (iPhone SE)
- [ ] Works on 393px viewport (iPhone 14 Pro with Dynamic Island)
- [ ] Works on 768px viewport (iPad Mini)
- [ ] Touch targets are 44x44px minimum
- [ ] No horizontal overflow or scroll
- [ ] Safe areas handled for notched devices
- [ ] Reduced motion preferences respected
- [ ] Existing desktop experience preserved

## Specific Fixes Required

### 1. [Fix Name]
<!-- Describe what needs to change -->

**Current behavior:**
<!-- What happens now -->

**Expected behavior:**
<!-- What should happen -->

**Files to modify:**
- `src/components/Example.jsx`

### 2. [Fix Name]
<!-- Repeat as needed -->

## Technical Constraints

- Use existing design tokens from `tailwind.config.js`
- Use existing hooks: `useSmallScreen()`, `useReducedMotion()`
- Follow mobile-first class ordering (base → sm: → md: → lg:)
- Maintain accessibility (ARIA labels, focus management)

## Testing Checklist

- [ ] Chrome DevTools device emulation
- [ ] iPhone SE (375px) - smallest common viewport
- [ ] iPhone 14 Pro (393px) - Dynamic Island safe areas
- [ ] iPad Mini (768px) - tablet breakpoint
- [ ] Landscape orientation tested
- [ ] Touch interactions tested (not just click)

## References
<!-- Links to designs, related issues, or documentation -->

- Agent: `@mobile-first-designer`
- Tailwind config: `tailwind.config.js`
- Related issue: #
