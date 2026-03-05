# Operating Procedure

## 1) Scope and Surface Motion Paths

Run:

```bash
rg -n "useReducedMotion|prefers-reduced-motion|animate|loading=|aria-live|role=|classList" src/components/StreamingNarrative.jsx src/components/AtmosphericInterlude.jsx src/components/SpreadTable.jsx src/lib/colorScript.js src/styles/tarot.css
```

## 2) Performance Smell Checklist

- Reject per-token/per-word JS animation instances for long text paths.
- Reject unconditional eager loading on collections of media.
- Check for stale animation handles or missing cleanup on unmount.
- Check animation work scales with content size and viewport.

## 3) Accessibility Checklist

- Any asynchronous or "working" region must expose status semantics.
- Motion must have reduced-motion fallback preserving meaning and focus order.
- Interactive controls need keyboard visibility (`focus-visible`) and clear labels.

## 4) Browser Compatibility Checklist

- Avoid fragile DOM APIs without compatibility wrappers.
- Confirm class manipulation is safe across older engines used by target users.

## 5) Allowed Changes

- Move heavy JS animation to CSS or chunked/batched logic.
- Add ARIA/status semantics and reduced-motion guards.
- Adjust image loading strategy for current/next/visible content.

## 6) Avoid

- Reworking entire visual system for single review comments.
- Adding animation frameworks to fix small timing issues.
- Introducing inline style-heavy patterns when CSS classes already exist.

## 7) Report Format

- Severity, file line, impact category (`perf`, `a11y`, `compat`), minimal fix, validation commands.