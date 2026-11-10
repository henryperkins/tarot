# Documentation Index

Type: index
Status: active reference
Last reviewed: 2026-10-23

Start here for the current source of truth. This index links maintained documentation; generated packages and historical snapshots are called out separately.

## Start Here

- [Developer onboarding](DEVELOPER_ONBOARDING.md) - local setup, runtime boundaries, and daily workflows
- [Project overview](../README.md) - scripts, deployment, and repository layout
- [Product context](../PRODUCT.md) - purpose, operating context, and constraints
- [Design contract](../DESIGN.md) - current visual system and interaction contract
- [Agent guidance](../AGENTS.md) - canonical repository instructions for coding agents
- [Claude-specific guidance](../CLAUDE.md) - Claude tool deltas that supplement `AGENTS.md`

## Canonical References

- [Provider inventory and reference](provider-reference.md) - services, feature routing, model defaults, configuration, and React contexts
- [Architecture index](architecture/README.md) - system, narrative, and runtime diagrams
- [Full system diagrams](architecture/full-system-diagrams.md) - detailed component and request flows
- [System overview diagram](architecture/overview-diagram.md) - high-level runtime view
- [Narrative architecture](architecture/narrative-architecture.md) - narrative generation, providers, GraphRAG, and prompt assembly
- [Design contract](design-contract.md) - current design-system contract
- [Evaluation system](evaluation-system.md) - evaluation pipeline, rubrics, and quality gates
- [Vision pipeline](vision-pipeline.md) - current vision pipeline and evaluation flow
- [Knowledge graph index](knowledge-graph/README.md) - archetypal pattern detection and GraphRAG references
- [Monetization logic](monetization/monetization-logic.md) - implemented monetization behavior
- [AI feature safeguards](ai-feature-safeguards.md) - quotas and request limits
- [Narration safeguards](narration-safeguards.md) - narration accounting, providers, and fail-closed behavior
- [Inference provenance](inference-provenance.md) - inference ledger and evaluator provenance
- [Reference index](reference/README.md) - canonical reference material, including the design-system gate checklist

## Runbooks

- [AI reliability and release checks](ai-reliability.md) - migrations and release verification
- [Browserbase smoke checks](browserbase-smoke.md) - deployed guest journey checks
- [Claude subscription inference](claude-subscription.md) - owner subscription provider setup
- [Codex subscription provider](codex-subscription.md) - Codex CLI provider setup
- [Local reviewer account](local-reviewer-account.md) - authenticated local UI review
- [Saved reading visual replay](reading-visual-replay.md) - replay endpoints and current gates

## Current Work

- [Workstream index](superpowers/README.md) - dated specs, plans, reviews, and status conventions
- [Intent closure roadmap](superpowers/plans/2026-10-11-reading-intent-closure.md) - approved scope, decisions, and ordered work
- [Aligner release plan](superpowers/plans/2026-10-11-reading-aligner-release.md) - web tiers, production UI, saved-reading access, and release
- [Aligner execution evidence](superpowers/reviews/2026-10-11-reading-aligner-release.md) - implementation checkpoint and open release gates
- [Post-reading model plan](superpowers/plans/2026-10-11-reading-post-reading-model.md) - semantic associations, accounting, privacy, and qualification
- [Local acceptance](superpowers/reviews/2026-10-11-reading-ui-acceptance.md) and [readiness history](superpowers/reviews/2026-10-10-reading-cue-readiness.md) - accepted locally with two owner exceptions; no production activation claim
- [Original intent](superpowers/specs/2026-10-08-reading-imagery-motion.md), [bridge milestone](superpowers/plans/2026-10-09-reading-gestures-react-bridge.md), and [studies](../output/reading-motion/README.md) - preserved design and implementation history

## Integrations

- [Integrations index](integrations/README.md) - external integration docs and generated packages
- [Custom GPT / GPT Actions setup](integrations/openai/chatgpt-gpt-actions-setup.md) - listing and action setup
- [ChatGPT App + MCP adapter](integrations/openai/tableau-backend-chatgpt-app-integration.md) - app integration
- [ChatGPT MCP endpoint](integrations/openai/chatgpt-mcp.md) - Worker MCP runbook
- [Public listing runbook](integrations/openai/public-listing.md) - package and listing release
- [Plugin file map](integrations/openai/plugin/README.md) - source files and package relationship

## Reviews And Audits

- [Reviews index](reviews/README.md) - point-in-time audits and their evidence
- [Frontend UI review](reviews/2026-frontend-ui-review.md) - historical frontend review
- [Design contract audit](reviews/design-contract-responsive-a11y-audit.md) - responsive and accessibility snapshot
- [Test coverage analysis](reviews/2026-test-coverage-analysis.md) - historical coverage audit
- [Primary reconciliation](reviews/primary-reconciliation-20261017.md) - branch reconciliation record

## Product And Strategy

- [Monetization index](monetization/README.md) - strategy, gaps, logic, and payment integration
- [Monetization strategy](monetization/monetization-strategy.md) - forward-looking strategy
- [Monetization gaps and plan](monetization/monetization-gaps-and-plan.md) - rollout gaps and backlog
- [Payment integration guide](monetization/enhanced-monetization.md) - Stripe and Google Play setup
- [Generative media spec](feature-spec-generative-media.md) - media generation scope
- [Practice system spec](feature-spec-practice-system.md) - practice product scope
- [Custom illustrations spec](CUSTOM_ILLUSTRATIONS_SPEC.md) - illustration direction
- [Interactive card tooltips](INTERACTIVE_CARD_TOOLTIPS.md) - card interaction notes
- [Motion strategy](motion-strategy.md) - motion principles and tokens
- [Apple web standards](apple-web-standards.md), [color](apple-color.md), and [typography](apple-typography.md) - platform references
- [App Store metadata](app-store-metadata.md), [differentiation](app-store-differentiation.md), and [review guidelines](app-review-guidelines.md) - store references

## Domain

- [Tarot AI teaching techniques](TAROT_AI_TEACHING_TECHNIQUES.md) - domain teaching approach
- [AI Tarot Master](AI_Tarot_Master.md) - domain reference

## Evidence

- [Evidence index](evidence/README.md) - canonical evidence root and retention rules
- [PWA install evidence](evidence/pwa-install-2026-10-08/README.md) - screenshots and verification records

## History

- [Legacy plan archive](plans/README.md) - completed or superseded plans, with active work moved to `superpowers/`
- [Upload and submit your plugin](Uploadandsubmityourplugin.md) - clipped OpenAI plugin submission page
- [Azure Responses API reference](azure-responses-api.md) - superseded vendor reference
- [Azure TTS reference](azure-tts-reference.md) - superseded vendor reference
- [Sora 2 reference](sora2.md) - vendor snapshot

## Conventions

- Use lowercase kebab-case filenames. Prefix dated work with an ISO date (`2026-10-23-topic.md`).
- Start maintained docs with `Type`, `Status`, and `Last reviewed` metadata immediately after the `H1`.
- Active specs, plans, and reviews live in `superpowers/`; `plans/` is a legacy archive and `reviews/` holds point-in-time audits.
- Put new evidence under `docs/evidence/<topic>-<YYYY-MM-DD>/`. Do not add a second evidence root.
- Mark generated output as generated. Do not edit `docs/integrations/openai/submission/` packages by hand.
- Run `npm run docs:check` after changing maintained Markdown. The checker currently excludes `docs/plans`, `docs/reviews`, and `docs/superpowers`; verify links in those folders separately until the exclusion is removed.
