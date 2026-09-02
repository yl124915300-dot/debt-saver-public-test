# Revenue Agent state machine

The only forward order is:

`LANDING_VISIT → ADDRESS_SUBMITTED → DEBT_FOUND → LIVE_QUOTE_READY → QUOTE_VIEWED → REVIEW_REQUESTED → EXECUTION_INTENT → FRESH_PREFLIGHT → TX_SIGNED → TX_CONFIRMED → FEE_RECEIVED`

Stages are observations, not commands. A recommendation never writes a stage. `LIVE_QUOTE_READY` requires current fail-closed quote evidence. `FRESH_PREFLIGHT` is distinct from a prior quote because rates, liquidity, caps, gas, and health factor can change.

## Input

- stage evidence and its source (`aggregate_analytics`, `current_session`, `revenue_ledger`, or `seeded_case`);
- borrower intent;
- debt-found result;
- quote economics: debt, current APR, target APR, net saving, fee, break-even, health factor, expiry, and live flag;
- stated objection;
- follow-up opt-in and channel availability;
- optional aggregate funnel context.

Aggregate counts may explain funnel health but cannot advance a particular borrower at any stage. Transaction and fee stages require server-side ledger evidence. A legacy `QUOTE_READY` ledger event becomes `LIVE_QUOTE_READY` only when the caller also proves the quote was live; an expired demo quote is not promoted.

## Output

`evaluateRevenueOpportunity(input)` returns:

- `score` from 0 to 100;
- `currentStage` and `borrowerIntent`;
- normalized `quoteEconomics` or null;
- `risk.level` and evidence-backed reasons;
- `objection.class` and response guidance;
- `followUpEligibility`, always marked draft-only and never auto-send;
- one `nextBestAction` with reason and optional draft;
- `stopReason` when selling should stop;
- immutable safety capabilities, all wallet/transaction mutations set to false.

## Next-action policy

- no address: invite a voluntary read-only address submission;
- no supported debt: explain and stop;
- debt without positive quote: wait for a verified edge;
- live quote: explain economics and expiry;
- objection: address the nearest objection with evidence;
- quote viewed: invite review, or create an opted-in draft only;
- review/execution intent: run a fresh preflight;
- fresh preflight: wait for user-controlled authorization;
- signed: wait for independently observed confirmation, never broadcast;
- confirmed: reconcile fee only from confirmed evidence;
- fee received: stop and mark complete only when the ledger proves it.
