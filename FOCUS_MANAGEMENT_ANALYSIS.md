# Deep Analysis: Focus Management Issues in Card.jsx and GuidedIntentionCoach.jsx

## Executive Summary

Both components have **critical accessibility violations** related to focus management that impact keyboard navigation and screen reader users. The issues stem from misunderstanding how `tabIndex={-1}` works and missing focus trap implementations in modal dialogs.

---

## Card.jsx Issues

### Issue 1: Broken Focus After Card Reveal

**Location:** `src/components/Card.jsx:52-61`

```javascript
useEffect(() => {
  if (isRevealed) {
    if (userInitiatedRevealRef.current && revealedContentRef.current) {
      revealedContentRef.current.focus();  // ❌ PROBLEM
    }
    userInitiatedRevealRef.current = false;
  } else {
    userInitiatedRevealRef.current = false;
  }
}, [isRevealed]);
```

**The Problem:**
- Code attempts to focus `revealedContentRef` (line 260-262)
- That div has `tabIndex={-1}` which means it's NOT in the tab order
- Calling `.focus()` on an element with `tabIndex={-1}` will fail silently or focus the element but users can't tab to it naturally
- This creates confusion for keyboard users who expect focus to move somewhere meaningful after revealing

**Current DOM Structure:**
```jsx
<motion.div tabIndex={0} role="button">  // ✅ Card container - focusable
  <div ref={revealedContentRef} tabIndex={-1}>  // ❌ NOT in tab order
    <p>Card meaning text</p>
  </div>
  <textarea />  // ✅ Focusable but focus never moves here
</motion.div>
```

**User Experience Impact:**
1. Keyboard user tabs to card (focus on motion.div)
2. Presses Enter to reveal
3. Card animates and content appears
4. **Focus stays on the motion.div** (which now shows revealed content)
5. User tabs again → focus jumps to NEXT card
6. User never gets natural access to the textarea reflection input

**Screen Reader Impact:**
- ARIA label updates from "Reveal card..." to "Card name. Click to view details"
- But no announcement that card was revealed
- No guidance that there's now a reflection textarea available

### Issue 2: Event Propagation Complexity

**Location:** `src/components/Card.jsx:279-282`

```javascript
<textarea
  onClick={event => event.stopPropagation()}
  onPointerDown={event => event.stopPropagation()}
  onFocus={event => event.stopPropagation()}
  onKeyDown={event => event.stopPropagation()}
/>
```

**Why This Exists:**
- Parent motion.div has `onClick={handleCardActivate}`
- Without stopPropagation, clicking textarea would trigger card click handler
- This is necessary but shows architectural smell

**The Real Problem:**
- The motion.div serves TWO purposes:
  1. Unrevealed: Acts as reveal button
  2. Revealed: Acts as container with nested interactive elements
- This violates "one element, one purpose" principle

### Issue 3: Inconsistent Focus Ring

**Location:** `src/components/Card.jsx:185-188`

```javascript
className={`cursor-pointer transition-all duration-500 transform ${!isVisuallyRevealed
  ? 'hover:bg-surface-muted/70 hover:scale-105 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-main'
  : 'hover:bg-surface-muted/40 rounded-lg group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-main'
}`}
```

**The Problem:**
- Focus ring is identical before and after reveal
- When revealed, clicking the card background opens overlay (line 72)
- But there's no visual indication this is still interactive
- Focus ring should be different or removed when card is revealed since primary action changes

---

## GuidedIntentionCoach.jsx Issues

### Issue 1: Modal Focuses Non-Focusable Element

**Location:** `src/components/GuidedIntentionCoach.jsx:534-537`

```javascript
// Focus the modal when it opens
if (modalRef.current) {
  modalRef.current.focus();  // ❌ PROBLEM
}
```

**The Modal Definition (line 746-752):**
```jsx
<div
  ref={modalRef}
  role="dialog"
  aria-modal="true"
  aria-labelledby={titleId}
  tabIndex={-1}  // ❌ NOT IN TAB ORDER
  className="..."
>
```

**The Problem:**
- `tabIndex={-1}` means "programmatically focusable but not in tab order"
- Calling `.focus()` will succeed, but users can't tab back to it
- Violates [ARIA Authoring Practices for Modal Dialogs](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)

**ARIA Best Practice Says:**
> When a dialog opens, focus moves to an element inside the dialog. The element that receives focus depends on the nature of the dialog:
> - If the dialog has a form, focus should move to the first form field
> - If the dialog is for confirmation, focus should move to the least destructive action button
> - If the dialog is informational, focus can move to the dialog container itself

**What Should Happen:**
1. Modal opens
2. Focus moves to **Close button** (line 754) OR first step button (line 784)
3. User can immediately press Escape or Tab to navigate
4. When modal closes, focus returns to trigger element

**Current Behavior:**
1. Modal opens
2. Focus moves to non-tabbable dialog container
3. User presses Tab → focus jumps to first interactive element (not predictable)
4. When modal closes, focus is lost (not returned to trigger)

### Issue 2: No Focus Trap Implementation

**Critical Violation:** Modal dialogs MUST trap focus to prevent users from accessing background content.

**Current Behavior:**
```
User opens modal
├─ Tabs through modal content
├─ Eventually tabs PAST the last element
└─ Focus moves to BACKGROUND PAGE CONTENT ❌
```

**What Users Can Do (Incorrectly):**
- Tab past modal and interact with background cards
- Screen readers can navigate to background content
- Keyboard-only users can lose track of where they are

**Missing Implementation:**
- No focus trap library (e.g., `focus-trap-react`, `react-focus-lock`)
- No manual focus trap (cycling Tab from last→first element)
- No check for Shift+Tab from first→last element

### Issue 3: Focus Not Restored on Close

**Problem:**
When modal closes, focus doesn't return to the triggering element.

**Example User Flow:**
```
1. User focuses "Guided coach" button
2. User presses Enter → modal opens
3. User presses Escape → modal closes
4. Focus is... somewhere? Not back on the button ❌
```

**Best Practice:**
Store reference to trigger element, restore focus on close:
```javascript
const triggerRef = useRef(null);

const handleOpen = () => {
  triggerRef.current = document.activeElement;
  setIsOpen(true);
};

const handleClose = () => {
  setIsOpen(false);
  setTimeout(() => {
    triggerRef.current?.focus();
  }, 0);
};
```

### Issue 4: Template Panel Has Same Issues

**Location:** `src/components/GuidedIntentionCoach.jsx:1163-1294`

The nested template panel (slide-in drawer) has identical focus management issues:
- No focus trap
- Focus not managed on open/close
- Can tab to background modal content

**This Creates Layers of Broken Focus:**
```
Background Page (shouldn't be accessible)
  └─ Modal (aria-modal but no focus trap)
      └─ Template Panel (no focus trap, can reach modal)
```

---

## Accessibility Violations Summary

### WCAG 2.1 Violations

| Issue | WCAG Criterion | Level | Impact |
|-------|---------------|-------|---------|
| No focus trap in modals | 2.1.2 No Keyboard Trap | A | **Critical** |
| Focus not moved on reveal | 2.4.3 Focus Order | A | High |
| Focus not restored on close | 2.4.3 Focus Order | A | High |
| Confusing role="button" behavior | 4.1.2 Name, Role, Value | A | Medium |

### ARIA Authoring Practices Violations

1. ❌ Modal dialog doesn't trap focus
2. ❌ Modal doesn't focus appropriate element on open
3. ❌ Modal doesn't restore focus on close
4. ❌ Modal doesn't prevent background interaction

---

## Recommended Fixes

### For Card.jsx

**Option A: Remove Programmatic Focus (Simplest)**
```javascript
useEffect(() => {
  if (isRevealed) {
    // Let natural focus flow handle it
    // Textarea becomes tabbable on next Tab press
    userInitiatedRevealRef.current = false;
  } else {
    userInitiatedRevealRef.current = false;
  }
}, [isRevealed]);

// Remove tabIndex={-1} from revealedContentRef div
```

**Option B: Focus the Textarea (Better UX)**
```javascript
const textareaRef = useRef(null);

useEffect(() => {
  if (isRevealed && userInitiatedRevealRef.current) {
    // Focus textarea after animation completes
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 300); // Match animation duration
  }
  userInitiatedRevealRef.current = false;
}, [isRevealed]);
```

**Option C: Split Into Two Components (Best Architecture)**
```jsx
// UnrevealedCard.jsx
<button onClick={onReveal} aria-label="...">
  <TableuLogo />
  <span>Tap to reveal</span>
</button>

// RevealedCard.jsx
<div>
  <button onClick={onViewDetails} aria-label="View card details">
    <img src={card.image} />
    <p>{card.meaning}</p>
  </button>
  <textarea ref={textareaRef} />
</div>
```

### For GuidedIntentionCoach.jsx

**Option A: Use Focus Trap Library (Recommended)**
```bash
npm install focus-trap-react
```

```jsx
import FocusTrap from 'focus-trap-react';

<FocusTrap
  active={isOpen}
  focusTrapOptions={{
    initialFocus: () => closeButtonRef.current,
    fallbackFocus: () => modalRef.current,
    escapeDeactivates: true,
    returnFocusOnDeactivate: true,
  }}
>
  <div role="dialog" aria-modal="true" tabIndex={-1}>
    <button ref={closeButtonRef}>Close</button>
    {/* rest of modal */}
  </div>
</FocusTrap>
```

**Option B: Manual Focus Management (If Can't Add Dependency)**
```javascript
const closeButtonRef = useRef(null);
const firstFocusableRef = useRef(null);
const lastFocusableRef = useRef(null);
const previousFocusRef = useRef(null);

useEffect(() => {
  if (!isOpen) return;

  // Store previous focus
  previousFocusRef.current = document.activeElement;

  // Focus close button
  setTimeout(() => {
    closeButtonRef.current?.focus();
  }, 0);

  return () => {
    // Restore focus on close
    previousFocusRef.current?.focus();
  };
}, [isOpen]);

const handleKeyDown = (e) => {
  if (e.key === 'Tab') {
    const focusableElements = modalRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
};

<div role="dialog" onKeyDown={handleKeyDown} tabIndex={-1} ref={modalRef}>
```

---

## Priority Recommendations

### Immediate (Critical - Blocks Accessibility)
1. ✅ Add focus trap to GuidedIntentionCoach modal
2. ✅ Add focus trap to AuthModal
3. ✅ Focus close button when modal opens
4. ✅ Restore focus when modal closes

### High Priority (Impacts Usability)
5. ✅ Fix Card.jsx focus flow (Option B: focus textarea)
6. ✅ Add live region announcement when card reveals
7. ✅ Update ARIA label to reflect revealed state better

### Medium Priority (Code Quality)
8. Consider splitting Card into UnrevealedCard/RevealedCard components
9. Add focus trap to ConfirmModal
10. Add focus trap to template panel in GuidedIntentionCoach

---

## Testing Checklist

- [ ] Open modal with keyboard (Enter/Space)
- [ ] Modal focuses first interactive element
- [ ] Tab through modal elements
- [ ] Tab from last element cycles to first (no escape)
- [ ] Shift+Tab from first element cycles to last
- [ ] Escape key closes modal
- [ ] Focus returns to trigger button after close
- [ ] Screen reader announces modal open/close
- [ ] Background content not accessible while modal open
- [ ] Card reveal moves focus appropriately
- [ ] Textarea becomes accessible after reveal
- [ ] Screen reader announces card reveal

