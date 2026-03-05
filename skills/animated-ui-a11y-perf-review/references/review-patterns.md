# Review Patterns

## Repeated Findings From PR Reviews

1. Per-word JS animation bottleneck.
- PR #44 feedback flagged `anime` ref-callback per word in `StreamingNarrative`.
- Fix path moved toward CSS reveal and chunked updates (`47747cd`, `8457941`).

2. Over-eager image loading in card spread.
- Review flagged `loading="eager"` for all cards as mobile/network risk.
- Follow-up fix switched to conditional eager/lazy (`2044fd5`).

3. Missing ARIA live/status semantics on interlude.
- PR #43 feedback added `role="status"`, `aria-live="polite"`, label (`5ce65f6`).

4. Reduced-motion compliance gaps.
- Review repeatedly called out animation without no-motion fallback.
- Pattern appears in component-level inline animations and page-level CSS.

5. Browser compatibility for classList iteration.
- PR #43 replaced `DOMTokenList.forEach` usage with `Array.from(...).forEach` in color script handling.

## Relevant Commits

- `5ce65f6` - ARIA, browser compatibility, and review-fix bundle.
- `47747cd` - Replaced per-word JS animation with CSS reveal.
- `2044fd5` - Conditional image loading for spread cards.
- `38a7f5b` - Dead code and comment cleanup in color script.