import { useMemo } from 'react';
import { CheckCircle, MoonStars, Sun, WarningCircle, XCircle } from '@phosphor-icons/react';
import { GlobalNav } from '../components/GlobalNav';
import { usePreferences } from '../contexts/PreferencesContext';

function ColorSwatch({ name, className, sampleClassName = '' }) {
  return (
    <div className="rounded-2xl border border-secondary/20 bg-surface/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{name}</p>
          {sampleClassName && (
            <p className={`mt-1 text-sm font-semibold ${sampleClassName}`}>
              Aa
            </p>
          )}
        </div>
        <div className={`h-10 w-10 shrink-0 rounded-xl border border-secondary/20 ${className}`} aria-hidden="true" />
      </div>
    </div>
  );
}

export default function DesignSystemPage() {
  const { theme, setTheme } = usePreferences();
  const isLight = theme === 'light';

  const typographySamples = useMemo(() => ([
    { label: '2xs (12px min)', className: 'text-2xs text-muted' },
    { label: 'xs (12px)', className: 'text-xs text-muted' },
    { label: 'xs-plus (14px)', className: 'text-xs-plus text-muted-high' },
    { label: 'sm (14px)', className: 'text-sm text-main' },
    { label: 'sm-mobile (16px)', className: 'text-sm-mobile text-main' },
    { label: 'base', className: 'text-base text-main' },
    { label: 'lg', className: 'text-lg text-main' },
    { label: 'xl', className: 'text-xl text-main' },
  ]), []);

  return (
    <div className="min-h-screen bg-main text-main">
      <header className="sticky top-0 z-30 border-b border-secondary/20 bg-main/95 backdrop-blur-sm pt-[max(var(--safe-pad-top),0.75rem)] pl-[max(var(--safe-pad-left),1rem)] pr-[max(var(--safe-pad-right),1rem)]">
        <div className="mx-auto max-w-5xl px-4 py-3">
          <GlobalNav condensed withUserChip />
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-8 space-y-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-serif text-accent">Design System</h1>
            <p className="mt-1 text-sm text-muted">
              Apple-aligned typography and semantic color tokens.
            </p>
            <p className="mt-1 text-2xs text-muted/70">
              Reference: `apple-color.md` and `apple-typography.md`
            </p>
          </div>
          <button
            type="button"
            onClick={() => setTheme(isLight ? 'dark' : 'light')}
            className="inline-flex min-h-touch items-center gap-2 rounded-full border border-secondary/30 bg-surface/60 px-4 py-2 text-sm font-semibold text-main hover:bg-surface-muted/60 transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {isLight ? (
              <>
                <MoonStars className="h-4 w-4" aria-hidden="true" />
                Switch to dark
              </>
            ) : (
              <>
                <Sun className="h-4 w-4" aria-hidden="true" />
                Switch to light
              </>
            )}
          </button>
        </div>

        <section aria-label="Semantic colors" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-main">Semantic colors</h2>
            <p className="text-2xs text-muted/70">Prefer tokens over palette colors.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ColorSwatch name="Primary" className="bg-primary" sampleClassName="text-primary" />
            <ColorSwatch name="Secondary" className="bg-secondary" sampleClassName="text-secondary" />
            <ColorSwatch name="Accent" className="bg-accent" sampleClassName="text-accent" />
            <ColorSwatch name="Success" className="bg-success" sampleClassName="text-success" />
            <ColorSwatch name="Warning" className="bg-warning" sampleClassName="text-warning" />
            <ColorSwatch name="Error" className="bg-error" sampleClassName="text-error" />
          </div>
        </section>

        <section aria-label="Surface hierarchy" className="space-y-3">
          <h2 className="text-sm font-semibold text-main">Surface hierarchy</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <ColorSwatch name="Main" className="bg-main" sampleClassName="text-main" />
            <ColorSwatch name="Surface" className="bg-surface" sampleClassName="text-main" />
            <ColorSwatch name="Surface (muted)" className="bg-surface-muted" sampleClassName="text-muted-high" />
          </div>
        </section>

        <section aria-label="Typography scale" className="space-y-3">
          <h2 className="text-sm font-semibold text-main">Typography scale</h2>
          <div className="rounded-2xl border border-secondary/20 bg-surface/70 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {typographySamples.map((item) => (
                <div key={item.label} className="flex items-baseline justify-between gap-3">
                  <span className="text-2xs text-muted/70">{item.label}</span>
                  <span className={`text-right ${item.className}`}>The quick brown fox</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section aria-label="Component examples" className="space-y-3">
          <h2 className="text-sm font-semibold text-main">Component examples</h2>
          <div className="rounded-2xl border border-secondary/20 bg-surface/70 p-5 space-y-5">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex min-h-touch items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-surface hover:bg-primary/90 active:bg-primary/80 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <CheckCircle className="h-4 w-4" weight="duotone" aria-hidden="true" />
                Primary action
              </button>
              <button
                type="button"
                className="inline-flex min-h-touch items-center gap-2 rounded-full border border-secondary/30 bg-surface/60 px-4 py-2 text-sm font-semibold text-main hover:bg-surface-muted/60 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                Secondary
              </button>
              <button
                type="button"
                className="inline-flex min-h-touch items-center gap-2 rounded-full border border-error/40 bg-error/10 px-4 py-2 text-sm font-semibold text-error hover:bg-error/20 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40"
              >
                <XCircle className="h-4 w-4" weight="duotone" aria-hidden="true" />
                Destructive
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="ds-input" className="text-xs font-semibold text-muted">
                  Input (16px on mobile)
                </label>
                <input
                  id="ds-input"
                  type="text"
                  placeholder="Type here…"
                  className="w-full min-h-touch rounded-xl border border-secondary/20 bg-surface-muted/40 px-4 py-3 text-sm-mobile sm:text-sm text-main placeholder:text-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="ds-select" className="text-xs font-semibold text-muted">
                  Select
                </label>
                <select
                  id="ds-select"
                  className="w-full min-h-touch rounded-xl border border-secondary/20 bg-surface-muted/40 px-4 py-3 text-sm-mobile sm:text-sm text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  defaultValue="one"
                >
                  <option value="one">Option one</option>
                  <option value="two">Option two</option>
                  <option value="three">Option three</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted">Status banners</p>
              <div className="flex flex-col gap-2">
                <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-warning">
                  <WarningCircle className="mt-0.5 h-4 w-4 flex-shrink-0" weight="duotone" aria-hidden="true" />
                  <p className="text-sm text-warning/90">
                    Warning messages use the `warning` token (not `accent`).
                  </p>
                </div>
                <div className="flex items-start gap-2 rounded-xl border border-success/40 bg-success/10 px-3 py-2 text-success">
                  <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" weight="duotone" aria-hidden="true" />
                  <p className="text-sm text-success/90">
                    Success messages use the `success` token.
                  </p>
                </div>
                <div className="flex items-start gap-2 rounded-xl border border-error/40 bg-error/10 px-3 py-2 text-error">
                  <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" weight="duotone" aria-hidden="true" />
                  <p className="text-sm text-error/90">
                    Errors use the `error` token and stay high-contrast.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
