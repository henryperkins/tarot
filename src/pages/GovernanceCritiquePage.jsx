import { useEffect } from 'react';
import './GovernanceCritiquePage.css';

const LAYERS = [
  { label: 'prompt: no invented cards', soft: true },
  { label: 'prompt: no medical/legal/financial directives', soft: true },
  { label: 'prompt: agency, not fate', soft: true },
  { label: 'prompt: anti-vagueness', soft: true },
  { label: 'input crisis gate (English-first)', soft: false },
  { label: 'output structural gate', soft: false },
  { label: 'heuristic safety scan (English-first)', soft: false },
  { label: 'model evaluator (telemetry by default)', soft: true },
  { label: 'selective eval enforcement (shipped later)', soft: false }
];

const METRICS = [
  {
    value: '9 / 9',
    label: 'narrative eval samples pass - spine, coverage, agency, rubric all 1.0'
  },
  {
    value: '0',
    label: 'adversarial / crisis inputs in that eval set',
    warn: true
  },
  {
    value: '0',
    label: 'rows in the narrative human-review queue',
    warn: true
  }
];

function Field({ label, children, why = false }) {
  return (
    <p className="governance-critique-page__field">
      <span className="governance-critique-page__field-label">{label}</span>
      <span className={`governance-critique-page__field-value${why ? ' governance-critique-page__field-value--why' : ''}`}>
        {children}
      </span>
    </p>
  );
}

function CritiqueCard({ stage, title, shipped = false, badge = null, children }) {
  return (
    <article className={`governance-critique-page__card${shipped ? ' governance-critique-page__card--shipped' : ''}`}>
      <h3 className="governance-critique-page__card-title">
        <span className="governance-critique-page__stage">{stage}</span>
        {title}
        {badge ? <span className="governance-critique-page__pill">{badge}</span> : null}
      </h3>
      {children}
    </article>
  );
}

function Metric({ value, label, warn = false }) {
  return (
    <div className={`governance-critique-page__metric${warn ? ' governance-critique-page__metric--warn' : ''}`}>
      <div className="governance-critique-page__metric-number">{value}</div>
      <div className="governance-critique-page__metric-label">{label}</div>
    </div>
  );
}

function UpdateNote({ children }) {
  return (
    <div className="governance-critique-page__update">
      <p>{children}</p>
    </div>
  );
}

export default function GovernanceCritiquePage() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Human-in-the-Loop Governance Critique - Tableu';

    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <main id="main-content" tabIndex={-1} className="governance-critique-page">
      <div className="governance-critique-page__sheet">
        <header className="governance-critique-page__header">
          <p className="governance-critique-page__eyebrow">Human-in-the-Loop Governance Critique</p>
          <h1 className="governance-critique-page__title">
            Where Tableu&apos;s guardrails are hard, where they&apos;re soft, and why that allocation
            doesn&apos;t match the risk.
          </h1>
          <div className="governance-critique-page__meta">
            <span><b>Subject:</b> Tableu - AI tarot reading app</span>
            <span><b>Lens:</b> critical evaluation of AI output</span>
            <span className="governance-critique-page__meta-note">
              Scenarios are realistic and code-grounded, not confirmed production incidents.
            </span>
          </div>
          <UpdateNote>
            <strong>Update:</strong> This critique preserves the original pre-remediation defect framing.
            Where later guardrails shipped, the sections below now include current-state notes describing
            how the implementation changed.
          </UpdateNote>
        </header>

        <section className="governance-critique-page__section">
          <span className="governance-critique-page__section-number">01</span>
          <h2 className="governance-critique-page__section-title">The system and its objective</h2>
          <p className="governance-critique-page__lead">
            Tableu is an AI tarot app (React + Cloudflare Workers). It stacks four components:
            deterministic card draws, computer-vision card recognition, GraphRAG context, and{' '}
            <strong>LLM narrative synthesis</strong> (Azure OpenAI primary, Claude / local composer
            fallback). The AI output under critique is the <strong>generated reading</strong>.
          </p>
          <p>
            Its objective is a specific, grounded, <strong>non-deterministic reflective</strong>{' '}
            reading - reflection and agency, not fortune-telling. The bar isn&apos;t &ldquo;fluent,
            mystical-sounding text&rdquo; but &ldquo;valid against the draw and inside its ethical lane.&rdquo;
            Fluent output can still fail that bar.
          </p>
          <p>
            Guardrails exist at several layers. The question is which are{' '}
            <span className="governance-critique-page__accent">hard</span> versus{' '}
            <span className="governance-critique-page__accent">soft</span> (requested):
          </p>
          <div className="governance-critique-page__layers">
            {LAYERS.map((layer) => (
              <span
                key={layer.label}
                className={`governance-critique-page__chip${layer.soft ? ' governance-critique-page__chip--soft' : ''}`}
              >
                {layer.label}
              </span>
            ))}
          </div>
          <UpdateNote>
            <strong>Current state:</strong> since this critique was first drafted, the model evaluator is
            no longer only soft telemetry. A selective synchronous gate now forces evaluation for flagged
            subsets, even though the saved narrative-eval artifact below is still the original benign snapshot.
          </UpdateNote>
        </section>

        <hr className="governance-critique-page__rule" />

        <section className="governance-critique-page__section">
          <span className="governance-critique-page__section-number">02</span>
          <h2 className="governance-critique-page__section-title">Two defects</h2>

          <CritiqueCard stage="Input" title="Example 1 - A non-English crisis disclosure is read as an ordinary question">
            <Field label="Could happen">
              A user writes in Spanish: <em>&ldquo;No quiero seguir viviendo. &iquest;Qu&eacute; dicen las cartas?&rdquo;</em>{' '}
              The prompt mandates answering in the user&apos;s language, so Tableu generates a Spanish
              reading instead of returning crisis resources.
            </Field>
            <Field label="Gate">
              <code>detectCrisisSignals</code> in <code>safetyChecks.js</code> should catch crisis
              language before generation.
            </Field>
            <Field label="Why it didn&apos;t">
              <strong>Technical + design.</strong> The detector is English regex (
              <code>suicidal</code>, <code>end my life</code>, <code>want to die</code>). The
              generation surface is multilingual; the screening surface is not - a coverage mismatch.
              Tableu answers users in languages it cannot safety-screen with the same reliability.
            </Field>
            <Field label="What shipped later">
              <strong>Mitigation shipped.</strong> Crisis routing now runs before spread analysis or generation
              on the combined question + reflections input, and matched English-language crisis disclosures are
              blocked with crisis resources instead of producing a reading. The original Spanish example remains
              here as the reason the next step is multilingual crisis classification, not just earlier placement.
            </Field>
          </CritiqueCard>

          <CritiqueCard stage="Output" title="Example 2 - A non-English medical directive reaches the user">
            <Field label="Could happen">
              A French user asks about burnout; the model replies <em>&ldquo;Vous devriez arr&ecirc;ter votre traitement...&rdquo;</em>{' '}
              (&ldquo;you should stop your treatment&rdquo;) - exactly the directive the prompt
              forbids.
            </Field>
            <Field label="Gate">
              The output safety / evaluation layer - deterministic heuristics in{' '}
              <code>evaluation.js</code>, and the model-based evaluation gate.
            </Field>
            <Field label="Why it didn&apos;t">
              <strong>Technical + config + design.</strong> The output heuristics are also English
              regex. The model evaluator <em>could</em> generalize across languages, but{' '}
              <code>EVAL_GATE_ENABLED=false</code> makes it telemetry, not a block. And readings have
              no required human-review step - the emotionally sensitive surface users actually consume.
            </Field>
            <Field label="What shipped later">
              <strong>Fixed in code.</strong> <code>buildSelectiveEvalGatePolicy()</code> now forces the
              synchronous model-eval gate for non-English readings and for restricted wellbeing / medical /
              financial / legal / abuse-safety inputs. Safety-triggered subsets fail closed, and streaming
              tests cover the blocked fallback path. Language-only non-English forcing still fails open on
              evaluator outage to preserve availability.
            </Field>
          </CritiqueCard>
        </section>

        <hr className="governance-critique-page__rule" />

        <section className="governance-critique-page__section">
          <span className="governance-critique-page__section-number">03</span>
          <h2 className="governance-critique-page__section-title">Does the output meet the objective?</h2>
          <p className="governance-critique-page__lead">
            Decomposed, because a single blended number would be misleading.
          </p>

          <div className="governance-critique-page__metrics">
            {METRICS.map((metric) => (
              <Metric
                key={metric.label}
                value={metric.value}
                label={metric.label}
                warn={metric.warn}
              />
            ))}
          </div>

          <p>
            <strong>Quality / coherence:</strong> high for the tested distribution. The structural gate
            runs on every reading; the eval set scores perfectly.
          </p>
          <p>
            <strong>Safety / ethics:</strong> deliberately unrated in this saved eval artifact. The eval set is 9 benign prompts -
            even the one non-English sample is benign - so the perfect safety score isn&apos;t evidence
            the objective is met; it&apos;s evidence the measurement doesn&apos;t touch the failure
            surface. The original safety gap was a <strong>deterministic coverage hole</strong> for
            non-English crisis input at the screening layer, not a &ldquo;15% of the time&rdquo; rate.
          </p>
          <p className="governance-critique-page__quote">
            A green dashboard here means &ldquo;we measured where the light is good,&rdquo; not
            &ldquo;the system is safe.&rdquo;
          </p>
          <UpdateNote>
            <strong>Current state:</strong> the 9-sample narrative artifact is still a benign regression
            snapshot, not a full safety benchmark. Runtime enforcement is now stronger than this artifact
            suggests because selective eval gating covers flagged subsets even though the saved sample set
            still has zero adversarial / crisis prompts and the checked-in offline review CSV is header-only.
          </UpdateNote>
        </section>

        <hr className="governance-critique-page__rule" />

        <section className="governance-critique-page__section">
          <span className="governance-critique-page__section-number">04</span>
          <h2 className="governance-critique-page__section-title">Which defect to fix first - Example 1</h2>
          <p>By a risk model of <strong>severity + observability + reversibility</strong>, not frequency:</p>
          <Field label="Severity">
            A missed crisis is the maximum-severity, irreversible outcome - a suicidal user gets a
            tarot reading instead of help.
          </Field>
          <Field label="Observability">
            It&apos;s the blind spot: no flag fires, the eval set doesn&apos;t probe it, the review queue
            is empty. The failure is invisible. Example 2 is at least scored into telemetry.
          </Field>
          <Field label="Coverage">
            It&apos;s the gap least addressed by the enforcement fix already shipped (which mainly closes
            Example 2).
          </Field>
          <p style={{ marginTop: '14px' }}>
            Frequency is low, but for an irreversible safety-critical harm, severity and reversibility
            dominate frequency.
          </p>
          <UpdateNote>
            <strong>Current state:</strong> this prioritization drove a split remediation path. DP2 shipped
            first as selective enforcement, DP1 shipped as an early English-first crisis gate, and DP3
            remains the observability gap.
          </UpdateNote>
        </section>

        <hr className="governance-critique-page__rule" />

        <section className="governance-critique-page__section">
          <span className="governance-critique-page__section-number">05</span>
          <h2 className="governance-critique-page__section-title">Decision points &amp; human-judgment checkpoints</h2>
          <p className="governance-critique-page__lead">
            Defense-in-depth across three pipeline stages. DP1 and DP2 are human-enabled gates
            (automated execution of a human policy call); DP3 is the genuine human-in-the-loop.
          </p>

          <CritiqueCard
            stage="Input"
            title="DP1 - Pre-generation crisis routing"
            shipped
            badge="shipped / english-first"
          >
            <Field label="Decision">
              Is the user disclosing crisis? If yes, suppress the reading and surface region-aware
              crisis resources instead of generating.
            </Field>
            <Field label="Trigger">
              <code>detectCrisisSignals()</code> now runs on the combined question + reflections input
              before spread analysis or generation. Matched English-language self-harm, crisis, and medical-emergency
              patterns are blocked immediately and return crisis resources.
            </Field>
            <Field label="Ethical stake" why>
              A human sets the loss function. A false positive is minor friction; a false negative is
              irreversible - so the gate must fail toward resources, which an accuracy- or
              engagement-optimizing system would never choose.
            </Field>
            <Field label="Historical gap">
              The original non-English example is preserved because this checkpoint is still English-first.
              The remediation that shipped solved placement and early blocking, not multilingual classifier coverage.
            </Field>
          </CritiqueCard>

          <CritiqueCard
            stage="Output"
            title="DP2 - Selective model-eval enforcement"
            shipped
            badge="shipped / tested"
          >
            <Field label="Decision">
              Is the finished reading safe to deliver? On a safety flag - or the evaluator being
              unavailable - block and swap the safe fallback.
            </Field>
            <Field label="Trigger">
              <code>buildSelectiveEvalGatePolicy()</code> forces the synchronous evaluator for
              non-English readings and restricted wellbeing / medical / legal / financial / abuse-safety
              inputs. Safety-triggered subsets fail closed; language-only non-English forcing stays
              fail open on evaluator outage. Implemented in <code>evalGatePolicy.js</code> with regression tests.
            </Field>
            <Field label="Ethical stake" why>
              Someone has to decide where availability yields to safety. The shipped policy now makes
              that trade explicitly for safety-triggered subsets instead of leaving the model evaluator
              as telemetry-only by default.
            </Field>
          </CritiqueCard>

          <CritiqueCard stage="Feedback" title="DP3 - Mandatory human review of the flagged subset">
            <Field label="Decision">
              A reviewer judges whether each flagged reading was handled right - routing appropriate,
              block warranted, no directive or fate-claim slipped - and whether thresholds should move.
            </Field>
            <Field label="Trigger">
              Every crisis-routed, safety-flagged, or sampled non-English reading should enter the review
              queue. The checked-in offline narrative review queue is still header-only, and the eval set
              still needs explicit multilingual + adversarial expansion.
            </Field>
            <Field label="Ethical stake" why>
              Only a person catches the false negatives no flag fired on, and judges whether an
              emotionally sensitive reading was actually appropriate - and that verdict recalibrates
              DP1 and DP2.
            </Field>
          </CritiqueCard>
        </section>

        <div className="governance-critique-page__status">
          <span className="governance-critique-page__status-title">Status</span>
          <span className="governance-critique-page__status-item">
            <b>One checkpoint still to build</b> - DP3 (review &amp; observability)
          </span>
          <span className="governance-critique-page__status-item">
            <b>Two checkpoints shipped</b> - DP1 (early crisis routing, English-first), DP2 (selective enforcement)
          </span>
        </div>
      </div>
    </main>
  );
}
