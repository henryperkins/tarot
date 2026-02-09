# Lakefront Content Kit

This plugin packages reusable marketing sections for Gutenberg:

- Pattern: `lakefront/services-grid`
- Pattern: `lakefront/segment-cta-grid`
- Pattern: `lakefront/testimonials-grid`
- Pattern: `lakefront/faq-stack`
- Dynamic block: `lakefront/case-study-compare`
- Dynamic block: `lakefront/pricing-table`

## Install

1. Copy `wp-content/plugins/lakefront-content-kit` into your WordPress install.
2. Activate **Lakefront Content Kit** in `Plugins`.
3. Insert patterns from the `Lakefront` pattern category, or use block comments directly.

## Example block refs

```html
<!-- wp:lakefront/case-study-compare /-->
<!-- wp:pattern {"slug":"lakefront/services-grid"} /-->
<!-- wp:lakefront/pricing-table /-->
<!-- wp:pattern {"slug":"lakefront/segment-cta-grid"} /-->
<!-- wp:pattern {"slug":"lakefront/testimonials-grid"} /-->
<!-- wp:pattern {"slug":"lakefront/faq-stack"} /-->
```
