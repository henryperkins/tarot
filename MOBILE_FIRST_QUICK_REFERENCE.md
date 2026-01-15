# Mobile-First Quick Reference

**Use this guide when developing new components or reviewing mobile patterns.**

---

## Touch Targets (CRITICAL)

### Minimum Size: 44x44px
```jsx
// ✅ CORRECT - Explicit minimum
<button className="min-h-[44px] px-4 py-2.5">

// ❌ WRONG - Too small
<button className="px-2 py-1">
```

### Expansion Technique for Icons/Small Elements
```jsx
// Use negative margins to expand tappable area without visual change
<button className="min-h-[44px] min-w-[44px] p-2 -m-2">
  <Icon className="h-4 w-4" />
</button>
```

### Touch Optimization
```jsx
// Always add for instant tap response (removes 300ms delay)
className="touch-manipulation"
```

---

## Typography (Mobile-First)

### Text Sizing Pattern
```jsx
// Pattern: Mobile size → Desktop size
text-sm sm:text-xs      // 14px → 12px (labels)
text-base sm:text-sm    // 16px → 14px (body)
text-lg sm:text-base    // 18px → 16px (headings)

// ⚠️ CRITICAL: Never use text smaller than 16px for inputs
// This prevents iOS auto-zoom on focus
<input className="text-base" /> // ✅ 16px minimum
<input className="text-sm" />   // ❌ 14px causes zoom
```

### Icon Sizing
```jsx
// Larger on mobile for better visibility and touch
h-4 w-4 sm:h-3 sm:w-3  // 16px → 12px
```

---

## Form Elements

### Number Input (Mobile Keyboard)
```jsx
<input
  type="number"
  inputMode="numeric"    // Triggers number keyboard
  pattern="[0-9]*"       // iOS optimization
  min="1"
  max="10"
  className="min-h-[44px] px-3 py-2 text-base touch-manipulation"
  aria-label="Clear, concise description"
/>
```

### Radio Buttons (Minimum 20px)
```jsx
<input
  type="radio"
  className="h-5 w-5 touch-manipulation"  // 20px minimum
  aria-label="Option description"
/>
```

### Select Elements
```jsx
<label htmlFor="my-select">Label</label>
<select
  id="my-select"
  className="min-h-[44px] px-3 py-2 text-base touch-manipulation"
  aria-describedby="helper-text-id"
>
  <option>...</option>
</select>
<p id="helper-text-id">Helper text</p>
```

### Read-Only Inputs
```jsx
// Use native readOnly, not ARIA
<input
  type="text"
  readOnly
  value={value}
  className="min-h-[44px]"
/>
```

---

## Accessibility

### ARIA Best Practices
```jsx
// ✅ Use native HTML when possible
<input readOnly />              // Not role="textbox" aria-readonly

// ✅ Concise labels (avoid redundancy with native attributes)
<input min="1" max="10" aria-label="Amount" />  // Not "Amount (1-10)"

// ✅ Associate related content
<select aria-describedby="info">
<p id="info">Helpful context</p>

// ✅ Screen reader text for visual-only elements
<span className="sr-only">Descriptive text for icon</span>
```

### Reduced Motion
```jsx
// Always respect user preferences
import { useReducedMotion } from '../hooks/useReducedMotion';

const prefersReducedMotion = useReducedMotion();

<Icon 
  className={`${isAnimating && !prefersReducedMotion ? 'animate-spin' : ''}`}
/>
```

---

## Button Patterns

### Standard Button
```jsx
const BUTTON_CLASS = `
  flex items-center gap-2 px-4 py-2.5 min-h-[44px]
  rounded-lg text-sm font-medium
  border border-amber-300/20 text-amber-100/80 bg-amber-200/5
  hover:bg-amber-200/10 hover:border-amber-300/30
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50
  disabled:opacity-50 disabled:cursor-not-allowed
  touch-manipulation
`;
```

### Icon-Only Button
```jsx
<button
  className="min-h-[44px] min-w-[44px] flex items-center justify-center"
  aria-label="Descriptive action"
>
  <Icon className="h-5 w-5" />
</button>
```

### Link as Button (Expanded Tap Area)
```jsx
<Link
  to="/path"
  className="inline-flex items-center gap-1 min-h-[44px] py-2 px-2 -m-2"
>
  Text <Icon />
</Link>
```

---

## Spacing

### Mobile-First Gaps
```jsx
gap-4         // 16px (standard between touch elements)
gap-3         // 12px (tight spacing)
space-y-4     // 16px vertical stack
```

### Padding (Touch-Friendly)
```jsx
px-4 py-2.5   // Standard button padding
px-3 py-3     // List item padding
p-5           // Card padding
```

---

## Responsive Patterns

### Hide on Mobile, Show on Desktop
```jsx
<div className="hidden sm:block">Desktop only</div>
```

### Hide on Desktop, Show on Mobile
```jsx
<div className="sm:hidden">Mobile only</div>
```

### Stack on Mobile, Row on Desktop
```jsx
<div className="flex flex-col sm:flex-row gap-4">
  <div>Item 1</div>
  <div>Item 2</div>
</div>
```

### Full Width on Mobile, Constrained on Desktop
```jsx
<div className="w-full sm:w-auto sm:max-w-md">
```

---

## Scrolling

### Horizontal Scroll (Cards, Badges)
```jsx
<div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
  {items.map(...)}
</div>
```

### Overscroll Containment (Modals)
```jsx
<div className="overflow-y-auto overscroll-contain">
```

---

## Safe Areas (Notched Devices)

### Bottom Sheet / Modal
```jsx
style={{
  paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 1.25rem))'
}}
```

### Dynamic Viewport Height
```jsx
style={{
  maxHeight: 'min(calc(100dvh - 8px), calc(100vh - 8px - env(safe-area-inset-bottom, 0px)))'
}}
```

---

## Common Mistakes to Avoid

### ❌ Desktop-First Text Sizing
```jsx
// WRONG - Requires sm: override for mobile
<p className="text-xs">Small on mobile too</p>

// CORRECT - Mobile first, scales down
<p className="text-sm sm:text-xs">Readable mobile</p>
```

### ❌ Touch Targets Too Small
```jsx
// WRONG - Only 32px height
<button className="px-3 py-1.5">

// CORRECT - 44px minimum
<button className="min-h-[44px] px-3 py-2.5">
```

### ❌ Missing inputMode for Number Inputs
```jsx
// WRONG - Generic keyboard on mobile
<input type="number" />

// CORRECT - Number keyboard on mobile
<input type="number" inputMode="numeric" pattern="[0-9]*" />
```

### ❌ Hover-Only Feedback
```jsx
// WRONG - Touch users never see hover
<button className="hover:bg-blue-500">

// CORRECT - Add active state for touch
<button className="hover:bg-blue-500 active:bg-blue-600">
```

### ❌ Animations Without Reduced Motion Check
```jsx
// WRONG - Always animates
<Icon className="animate-spin" />

// CORRECT - Respects preferences
<Icon className={`${isLoading && !prefersReducedMotion ? 'animate-spin' : ''}`} />
```

---

## Testing Checklist

- [ ] All buttons/links ≥ 44px height
- [ ] Radio/checkboxes ≥ 20px
- [ ] Body text ≥ 14px on mobile
- [ ] Input text ≥ 16px (prevents iOS zoom)
- [ ] Number inputs trigger numeric keyboard
- [ ] Animations respect reduced motion
- [ ] Screen reader labels present and concise
- [ ] Keyboard navigation works
- [ ] Touch targets testable with finger (not mouse)
- [ ] Safe areas handled on notched devices

---

## Reference Components

**Exemplary implementations to study:**

1. **JourneyMobileSheet.jsx**
   - Swipe-to-dismiss
   - Safe area support
   - Dynamic viewport height
   - Focus management

2. **ExportSection.jsx**
   - Form optimization
   - Radio buttons
   - Number inputs
   - ARIA patterns

3. **MajorArcanaMap.jsx**
   - Mobile-first responsive sizing
   - Overflow handling
   - Touch-friendly grid

4. **BackfillBanner.jsx**
   - Reduced motion
   - Button sizing
   - Dismiss patterns

---

## Quick Decision Tree

**"Should I add mobile-first styles?"**
→ Is it an interactive element? → YES → Add `min-h-[44px]` and `touch-manipulation`
→ Is it text content? → YES → Use `text-base sm:text-sm` pattern
→ Is it a form input? → YES → Add `inputMode` and `min-h-[44px]`
→ Is it an animation? → YES → Add `useReducedMotion()` check

**"Is my touch target big enough?"**
→ Can you tap it accurately with your thumb? → NO → Increase size or expand with negative margins

**"Will this cause iOS zoom?"**
→ Is input text < 16px? → YES → Increase to `text-base` (16px)

---

**Last Updated:** 2024-12-19
**Source:** Mobile-First Review of Reading Journey Components
