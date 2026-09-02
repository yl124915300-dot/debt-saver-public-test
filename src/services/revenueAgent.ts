import type { PublicScanResponse, LiveRefinanceQuote } from './publicTypes.js';
import type { LedgerEvent, RefinanceQuote } from './types.js';

export const revenueFunnelStages = [
  'LANDING_VISIT',
  'ADDRESS_SUBMITTED',
  'DEBT_FOUND',
  'LIVE_QUOTE_READY',
  'QUOTE_VIEWED',
  'REVIEW_REQUESTED',
  'EXECUTION_INTENT',
  'FRESH_PREFLIGHT',
  'TX_SIGNED',
  'TX_CONFIRMED',
  'FEE_RECEIVED',
] as const;

export type RevenueFunnelStage = typeof revenueFunnelStages[number];
export type BorrowerIntent = 'NONE' | 'EXPLORING' | 'SAVINGS' | 'LIQUIDATION_RISK' | 'REVIEW' | 'EXECUTION';
export type ObjectionClass = 'NONE' | 'SECURITY' | 'TRUST' | 'FEE' | 'TIMING' | 'NO_EDGE' | 'UNKNOWN';
export type DealRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'STOP';
export type StageEvidenceSource = 'aggregate_analytics' | 'current_session' | 'revenue_ledger' | 'seeded_case';

export interface StageEvidence {
  stage: RevenueFunnelStage;
  source: StageEvidenceSource;
  observedAt?: string;
}

export interface QuoteEconomics {
  debtUsd: number;
  currentApr: number;
  targetApr: number;
  netSavingUsd: number;
  feeUsd: number;
  breakEvenDays: number;
  healthFactor: number;
  expiresAt: string | null;
  isLive: boolean;
}

export interface FollowUpContext {
  optedIn: boolean;
  channelAvailable: boolean;
  lastMeaningfulInteractionAt?: string;
  priorDraftCount?: number;
}

export interface RevenueOpportunityInput {
  stageEvidence: StageEvidence[];
  borrowerIntent?: BorrowerIntent;
  debtFound?: boolean | null;
  quoteEconomics?: QuoteEconomics | null;
  statedObjection?: ObjectionClass | null;
  followUp?: FollowUpContext;
  aggregateFunnel?: Partial<Record<RevenueFunnelStage, number>>;
  now?: string;
}

export type NextActionType =
  | 'REQUEST_READ_ONLY_ADDRESS'
  | 'EXPLAIN_NO_SUPPORTED_DEBT'
  | 'WAIT_FOR_POSITIVE_EDGE'
  | 'EXPLAIN_QUOTE_ECONOMICS'
  | 'ADDRESS_OBJECTION'
  | 'REQUEST_REVIEW'
  | 'DRAFT_FOLLOW_UP'
  | 'RUN_FRESH_PREFLIGHT'
  | 'WAIT_FOR_USER_AUTHORIZATION'
  | 'WAIT_FOR_USER_SIGNATURE'
  | 'WAIT_FOR_CONFIRMATION'
  | 'RECONCILE_CONFIRMED_FEE'
  | 'STOP';

export interface RevenueAgentResult {
  score: number;
  currentStage: RevenueFunnelStage;
  borrowerIntent: BorrowerIntent;
  quoteEconomics: QuoteEconomics | null;
  risk: { level: DealRiskLevel; reasons: string[] };
  objection: { class: ObjectionClass; responseGuidance: string | null };
  followUpEligibility: { eligible: boolean; reason: string; draftOnly: true; autoSend: false };
  nextBestAction: { type: NextActionType; reason: string; draft?: string };
  stopReason: string | null;
  safety: {
    readOnly: true;
    maySign: false;
    mayAuthorizeWallet: false;
    mayControlWallet: false;
    mayCreateBroadcastableTransaction: false;
    mayRequestSecrets: false;
    mayPromiseReturns: false;
  };
}

const stageIndex = new Map<RevenueFunnelStage, number>(revenueFunnelStages.map((stage, index) => [stage, index]));
function finiteNonNegative(value: number) {
  return Number.isFinite(value) && value >= 0;
}

function trustedStageEvidence(evidence: StageEvidence[]) {
  return evidence.filter((item) => {
    const index = stageIndex.get(item.stage);
    if (index === undefined) return false;
    // Aggregate counts describe the funnel, never one borrower.
    return item.source !== 'aggregate_analytics';
  });
}

function currentStage(evidence: StageEvidence[]): RevenueFunnelStage {
  return trustedStageEvidence(evidence).reduce<RevenueFunnelStage>((latest, item) =>
    stageIndex.get(item.stage)! > stageIndex.get(latest)! ? item.stage : latest, 'LANDING_VISIT');
}

function quoteIsValid(quote: QuoteEconomics | null | undefined) {
  return Boolean(quote
    && finiteNonNegative(quote.debtUsd)
    && finiteNonNegative(quote.currentApr)
    && finiteNonNegative(quote.targetApr)
    && Number.isFinite(quote.netSavingUsd)
    && finiteNonNegative(quote.feeUsd)
    && finiteNonNegative(quote.breakEvenDays)
    && finiteNonNegative(quote.healthFactor));
}

function quoteExpired(quote: QuoteEconomics, now: Date) {
  return !quote.isLive || quote.expiresAt === null || !Number.isFinite(Date.parse(quote.expiresAt)) || Date.parse(quote.expiresAt) <= now.getTime();
}

function apyToApr(apyPercent: number) {
  return Math.log1p(apyPercent / 100) * 100;
}

function objectionGuidance(objection: ObjectionClass) {
  const guidance: Record<ObjectionClass, string | null> = {
    NONE: null,
    SECURITY: 'Acknowledge the concern, explain the read-only and non-custodial boundary, and invite independent review. Never ask for a signature or secret.',
    TRUST: 'Acknowledge the trust gap and provide reproducible source, expiry, cost, and safety evidence without claiming certainty.',
    FEE: 'Show gross saving, every modeled cost, transparent fee, borrower net saving, and break-even side by side.',
    TIMING: 'Respect the timing constraint and recommend a fresh comparison only when the borrower asks to resume.',
    NO_EDGE: 'State that no positive verified saving exists and stop selling the route.',
    UNKNOWN: 'Ask one narrow question to identify whether the concern is safety, economics, timing, or evidence.',
  };
  return guidance[objection];
}

function scoreOpportunity(stage: RevenueFunnelStage, intent: BorrowerIntent, quote: QuoteEconomics | null, riskReasons: string[]) {
  const stagePoints: Record<RevenueFunnelStage, number> = {
    LANDING_VISIT: 0, ADDRESS_SUBMITTED: 10, DEBT_FOUND: 25, LIVE_QUOTE_READY: 45, QUOTE_VIEWED: 55,
    REVIEW_REQUESTED: 65, EXECUTION_INTENT: 75, FRESH_PREFLIGHT: 82, TX_SIGNED: 90, TX_CONFIRMED: 96, FEE_RECEIVED: 100,
  };
  const intentPoints: Record<BorrowerIntent, number> = { NONE: 0, EXPLORING: 2, SAVINGS: 5, LIQUIDATION_RISK: 5, REVIEW: 8, EXECUTION: 10 };
  const savingPoints = quote ? (quote.netSavingUsd >= 5_000 ? 12 : quote.netSavingUsd >= 500 ? 7 : quote.netSavingUsd > 0 ? 2 : -20) : 0;
  return Math.max(0, Math.min(100, stagePoints[stage] + intentPoints[intent] + savingPoints - riskReasons.length * 4));
}

function followUpEligibility(input: RevenueOpportunityInput, stage: RevenueFunnelStage, stopReason: string | null) {
  if (stopReason) return { eligible: false, reason: stopReason, draftOnly: true as const, autoSend: false as const };
  if (!input.followUp?.optedIn) return { eligible: false, reason: 'No explicit follow-up opt-in is recorded.', draftOnly: true as const, autoSend: false as const };
  if (!input.followUp.channelAvailable) return { eligible: false, reason: 'No user-provided follow-up channel is available.', draftOnly: true as const, autoSend: false as const };
  if (stageIndex.get(stage)! < stageIndex.get('QUOTE_VIEWED')!) return { eligible: false, reason: 'No quote engagement has been observed.', draftOnly: true as const, autoSend: false as const };
  return { eligible: true, reason: 'Opt-in, a user-provided channel, and quote engagement are all recorded.', draftOnly: true as const, autoSend: false as const };
}

function draftFollowUp(quote: QuoteEconomics | null, objection: ObjectionClass) {
  if (objection === 'SECURITY') return 'Your safety concern is valid. The current result is read-only and non-custodial: it cannot authorize, sign, or broadcast anything. If useful, the next step is simply to review the sources, costs, expiry, and health-factor assumptions.';
  if (quote) return `The read-only comparison showed modeled net saving of $${quote.netSavingUsd.toLocaleString('en-US')} after the disclosed $${quote.feeUsd.toLocaleString('en-US')} fee. Rates change, so the only useful next step is a fresh preflight when you are ready—no wallet authorization or signature is requested by this agent.`;
  return 'If you want to continue, the next step is a fresh read-only check. No wallet authorization, signature, private key, or seed phrase is needed.';
}

export function evaluateRevenueOpportunity(input: RevenueOpportunityInput): RevenueAgentResult {
  const now = new Date(input.now ?? Date.now());
  if (Number.isNaN(now.getTime())) throw new Error('Revenue Agent now must be a valid timestamp.');
  const stage = currentStage(input.stageEvidence);
  const intent = input.borrowerIntent ?? 'NONE';
  const quote = quoteIsValid(input.quoteEconomics) ? input.quoteEconomics! : null;
  const objection = input.statedObjection ?? (quote && quote.netSavingUsd <= 0 ? 'NO_EDGE' : 'NONE');
  const risks: string[] = [];

  if (input.quoteEconomics && !quote) risks.push('Quote economics are incomplete or invalid.');
  if (quote && quote.healthFactor < 1.1) risks.push('Post-migration health factor is below the 1.10 safety gate.');
  if (quote && quote.breakEvenDays > 90) risks.push('Break-even exceeds the 90-day quote horizon.');
  if (quote && quote.netSavingUsd > 0 && quote.netSavingUsd < 500) risks.push('Verified net saving is low and may not justify borrower attention.');
  if (quote && stageIndex.get(stage)! >= stageIndex.get('LIVE_QUOTE_READY')! && quoteExpired(quote, now)) risks.push('The quote is expired or not live.');
  if (stageIndex.get(stage)! >= stageIndex.get('LIVE_QUOTE_READY')! && !quote) risks.push('A quote-ready stage lacks verified quote economics.');

  let stopReason: string | null = null;
  if (stage === 'ADDRESS_SUBMITTED' && input.debtFound === false) stopReason = 'No supported debt was found.';
  else if (stageIndex.get(stage)! >= stageIndex.get('DEBT_FOUND')! && quote && quote.netSavingUsd <= 0) stopReason = 'No positive verified net saving exists.';
  else if (quote && quote.healthFactor < 1.1) stopReason = 'The safety health-factor gate failed.';
  else if (quote && quote.breakEvenDays > 90) stopReason = 'The route does not break even within the quote horizon.';

  const followUp = followUpEligibility(input, stage, stopReason);
  let nextBestAction: RevenueAgentResult['nextBestAction'];
  if (stopReason) {
    nextBestAction = { type: stage === 'ADDRESS_SUBMITTED' ? 'EXPLAIN_NO_SUPPORTED_DEBT' : 'STOP', reason: stopReason };
  } else if (stage === 'LANDING_VISIT') {
    nextBestAction = { type: 'REQUEST_READ_ONLY_ADDRESS', reason: 'A voluntary public wallet address is required to discover supported debt.' };
  } else if (stage === 'ADDRESS_SUBMITTED') {
    nextBestAction = { type: input.debtFound ? 'WAIT_FOR_POSITIVE_EDGE' : 'EXPLAIN_NO_SUPPORTED_DEBT', reason: input.debtFound ? 'Debt discovery is recorded but no verified live quote is available.' : 'Debt discovery has not produced a supported position.' };
  } else if (stage === 'DEBT_FOUND') {
    nextBestAction = { type: 'WAIT_FOR_POSITIVE_EDGE', reason: 'Do not advance without a fresh, positive, fail-closed quote.' };
  } else if (risks.some((reason) => /expired|not live|lacks verified quote/.test(reason)) || stage === 'REVIEW_REQUESTED' || stage === 'EXECUTION_INTENT') {
    nextBestAction = { type: 'RUN_FRESH_PREFLIGHT', reason: 'Review or execution intent requires newly verified market, economics, and safety inputs.' };
  } else if (objection !== 'NONE') {
    nextBestAction = { type: 'ADDRESS_OBJECTION', reason: `The recorded ${objection.toLowerCase()} objection is the closest blocker.`, draft: draftFollowUp(quote, objection) };
  } else if (stage === 'LIVE_QUOTE_READY') {
    nextBestAction = { type: 'EXPLAIN_QUOTE_ECONOMICS', reason: 'Present the live debt, rate, net saving, fee, break-even, expiry, and health factor before asking for review.' };
  } else if (stage === 'QUOTE_VIEWED' && followUp.eligible) {
    nextBestAction = { type: 'DRAFT_FOLLOW_UP', reason: 'The quote was viewed without a recorded review request; generate a value-adding draft only.', draft: draftFollowUp(quote, objection) };
  } else if (stage === 'QUOTE_VIEWED') {
    nextBestAction = { type: 'REQUEST_REVIEW', reason: 'Invite the borrower to review the evidence without requesting a wallet action.' };
  } else if (stage === 'FRESH_PREFLIGHT') {
    nextBestAction = { type: 'WAIT_FOR_USER_AUTHORIZATION', reason: 'Only the user may decide whether to authorize a wallet or credit delegation.' };
  } else if (stage === 'TX_SIGNED') {
    nextBestAction = { type: 'WAIT_FOR_CONFIRMATION', reason: 'A signature is recorded; the Revenue Agent cannot broadcast or control the transaction.' };
  } else if (stage === 'TX_CONFIRMED') {
    nextBestAction = { type: 'RECONCILE_CONFIRMED_FEE', reason: 'Reconcile only independently confirmed on-chain fee evidence.' };
  } else if (stage === 'FEE_RECEIVED') {
    nextBestAction = { type: 'STOP', reason: 'The verified revenue outcome is complete.' };
  } else {
    nextBestAction = { type: 'WAIT_FOR_USER_SIGNATURE', reason: 'Only the user may create the next wallet-controlled event.' };
  }

  const riskLevel: DealRiskLevel = stopReason ? 'STOP' : risks.length >= 2 ? 'HIGH' : risks.length === 1 ? 'MEDIUM' : 'LOW';
  return {
    score: scoreOpportunity(stage, intent, quote, risks), currentStage: stage, borrowerIntent: intent, quoteEconomics: quote,
    risk: { level: riskLevel, reasons: risks }, objection: { class: objection, responseGuidance: objectionGuidance(objection) },
    followUpEligibility: followUp, nextBestAction, stopReason,
    safety: { readOnly: true, maySign: false, mayAuthorizeWallet: false, mayControlWallet: false, mayCreateBroadcastableTransaction: false, mayRequestSecrets: false, mayPromiseReturns: false },
  };
}

function quoteEconomicsFromQuote(quote: LiveRefinanceQuote | RefinanceQuote, isLive: boolean): QuoteEconomics {
  if ('currentDebtUsd' in quote) return {
    debtUsd: quote.currentDebtUsd, currentApr: apyToApr(quote.currentMorphoBorrowApy), targetApr: quote.targetAaveVariableBorrowApr,
    netSavingUsd: quote.netSavingUsd, feeUsd: quote.costs.serviceFeeUsd, breakEvenDays: quote.breakEvenDays,
    healthFactor: quote.postMigrationHealthFactor, expiresAt: quote.expiresAt, isLive,
  };
  return {
    debtUsd: quote.position.debtUsd, currentApr: quote.position.currentApr, targetApr: quote.betterApr,
    netSavingUsd: quote.netSavingUsd, feeUsd: quote.feeUsd, breakEvenDays: quote.breakEvenDays,
    healthFactor: quote.postHealthFactor, expiresAt: quote.expiresAt, isLive,
  };
}

export function revenueInputFromPublicScan(
  response: PublicScanResponse,
  observedEvents: StageEvidence[],
  context: Omit<RevenueOpportunityInput, 'stageEvidence' | 'debtFound' | 'quoteEconomics'> = {},
): RevenueOpportunityInput {
  const stageEvidence = [...observedEvents];
  if (response.positions.length) stageEvidence.push({ stage: 'DEBT_FOUND', source: 'current_session', observedAt: response.scannedAt });
  if (response.status === 'LIVE_QUOTE_READY') stageEvidence.push({ stage: 'LIVE_QUOTE_READY', source: 'current_session', observedAt: response.scannedAt });
  return {
    ...context,
    stageEvidence,
    debtFound: response.positions.length > 0,
    quoteEconomics: response.quote ? quoteEconomicsFromQuote(response.quote, response.status === 'LIVE_QUOTE_READY') : null,
  };
}

export function stageEvidenceFromLedger(ledger: LedgerEvent[], options: { quoteIsLive?: boolean } = {}): StageEvidence[] {
  const map: Partial<Record<LedgerEvent['state'], RevenueFunnelStage>> = {
    VISITOR: 'LANDING_VISIT', ADDRESS_SUBMITTED: 'ADDRESS_SUBMITTED', DEBT_FOUND: 'DEBT_FOUND',
    QUOTE_VIEWED: 'QUOTE_VIEWED', REVIEW_REQUESTED: 'REVIEW_REQUESTED', EXECUTION_INTENT: 'EXECUTION_INTENT', FRESH_PREFLIGHT: 'FRESH_PREFLIGHT',
    TX_SIGNED: 'TX_SIGNED', TX_CONFIRMED: 'TX_CONFIRMED', FEE_RECEIVED: 'FEE_RECEIVED',
  };
  return ledger.flatMap((event) => {
    const stage = event.state === 'QUOTE_READY' && options.quoteIsLive ? 'LIVE_QUOTE_READY' : map[event.state];
    return stage ? [{ stage, source: 'revenue_ledger' as const, observedAt: event.at }] : [];
  });
}
