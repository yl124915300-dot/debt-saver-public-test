---
name: debt-saver-revenue-agent
description: Evaluate Debt Saver borrower opportunities and recommend one evidence-backed next action from anonymous funnel, quote, objection, and risk data. Use for revenue-funnel triage and follow-up drafts; never for wallet or transaction execution.
---

# Debt Saver Revenue Agent

Turn verified Debt Saver funnel evidence into one `NEXT_BEST_ACTION`. Treat a borrower opportunity as real only to the stage directly supported by analytics, the current read-only session, or the server-side revenue ledger.

## Workflow

1. Read the current opportunity stage without inferring skipped or downstream events. Aggregate funnel counts are context, not borrower-specific proof.
2. Classify borrower intent from explicit behavior or words: none, exploring, savings, liquidation risk, review, or execution.
3. Require complete quote economics before treating a quote as actionable: debt, current APR, target APR, net saving, fee, break-even, health factor, freshness, and expiry.
4. Score priority transparently from observed stage, intent, verified savings, and risk. Missing data lowers confidence; it never becomes a positive signal.
5. Classify the closest objection. Use Listen → Acknowledge → Explore → Respond for security, trust, fee, timing, or no-edge concerns.
6. Return exactly one next action. The action should remove the closest blocker between the observed stage and a user-controlled review or execution step.
7. Generate follow-up recommendations or drafts only when the user opted in, supplied a permitted channel, and engaged with a quote. Never auto-send.

The canonical state and output schema are in [references/state-machine.md](references/state-machine.md). The deterministic implementation is `src/services/revenueAgent.ts`.

## Hard boundaries

- Never sign, authorize, control a wallet, request credit delegation, request a transaction signature, or create/send a broadcastable transaction.
- Never request or accept private keys, seed phrases, or wallet secrets.
- Never promise savings, rates, execution, or returns. Quotes are expiring models that require a fresh fail-closed preflight.
- Only the user can perform wallet authorization, credit delegation, and transaction signature.
- Do not record or claim `QUOTE_VIEWED`, `REVIEW_REQUESTED`, `EXECUTION_INTENT`, `TX_SIGNED`, `TX_CONFIRMED`, or `FEE_RECEIVED` without direct evidence from the authorized event source.
- Do not advance an individual opportunity from aggregate analytics.
- Stop when there is no supported debt, no positive verified edge, a failed health-factor gate, or break-even beyond the quote horizon.

## Adapted source framework

This skill is a focused adaptation of six Autter sales components: intent signal monitoring, lead scoring, SDR next-action discipline, objection handling, follow-up cadence, and deal-risk analysis. B2B terms are translated as follows:

- lead/prospect → borrower/opportunity;
- meeting/demo/proposal → quote/review;
- close/won → execution/confirmed fee.

Read [vendor/autter-agentic-sales-skills/SOURCE_MAP.md](vendor/autter-agentic-sales-skills/SOURCE_MAP.md) when auditing provenance or updating from upstream.
