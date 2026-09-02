import { describe, expect, it } from 'vitest';
import { evaluateRevenueOpportunity, stageEvidenceFromLedger, type QuoteEconomics, type RevenueOpportunityInput } from '../src/services/revenueAgent.js';

const now = '2026-09-02T08:00:00.000Z';
const highQuote: QuoteEconomics = {
  debtUsd: 10_000_000, currentApr: 4.5, targetApr: 3.8, netSavingUsd: 12_000, feeUsd: 1_400,
  breakEvenDays: 12, healthFactor: 1.72, expiresAt: '2026-09-02T08:05:00.000Z', isLive: true,
};
const evaluate = (input: Omit<RevenueOpportunityInput, 'now'>) => evaluateRevenueOpportunity({ ...input, now });

describe('Debt Saver Revenue Agent seeded cases', () => {
  it('requests only a read-only address when none was submitted', () => {
    const result = evaluate({ stageEvidence: [], borrowerIntent: 'EXPLORING' });
    expect(result.currentStage).toBe('LANDING_VISIT');
    expect(result.nextBestAction.type).toBe('REQUEST_READ_ONLY_ADDRESS');
    expect(result.followUpEligibility.eligible).toBe(false);
  });

  it('stops after an address returns no supported debt', () => {
    const result = evaluate({ stageEvidence: [{ stage: 'ADDRESS_SUBMITTED', source: 'current_session' }], debtFound: false });
    expect(result.stopReason).toMatch(/No supported debt/);
    expect(result.nextBestAction.type).toBe('EXPLAIN_NO_SUPPORTED_DEBT');
  });

  it('stops when debt exists but there is no positive edge', () => {
    const result = evaluate({
      stageEvidence: [{ stage: 'DEBT_FOUND', source: 'current_session' }], debtFound: true,
      quoteEconomics: { ...highQuote, netSavingUsd: 0, feeUsd: 0 },
    });
    expect(result.objection.class).toBe('NO_EDGE');
    expect(result.stopReason).toMatch(/No positive verified/);
  });

  it('explains a low-saving live quote without auto-follow-up', () => {
    const result = evaluate({
      stageEvidence: [{ stage: 'LIVE_QUOTE_READY', source: 'current_session' }], debtFound: true,
      borrowerIntent: 'SAVINGS', quoteEconomics: { ...highQuote, netSavingUsd: 120, feeUsd: 15 },
    });
    expect(result.nextBestAction.type).toBe('EXPLAIN_QUOTE_ECONOMICS');
    expect(result.followUpEligibility.autoSend).toBe(false);
  });

  it('handles a high-saving quote with a security objection before review', () => {
    const result = evaluate({
      stageEvidence: [{ stage: 'LIVE_QUOTE_READY', source: 'current_session' }], debtFound: true,
      borrowerIntent: 'SAVINGS', quoteEconomics: highQuote, statedObjection: 'SECURITY',
    });
    expect(result.nextBestAction).toMatchObject({ type: 'ADDRESS_OBJECTION' });
    expect(result.nextBestAction.draft).toMatch(/cannot authorize, sign, or broadcast/);
    expect(result.safety.maySign).toBe(false);
  });

  it('drafts but never sends after QUOTE_VIEWED when follow-up is allowed', () => {
    const result = evaluate({
      stageEvidence: [{ stage: 'QUOTE_VIEWED', source: 'current_session' }], debtFound: true,
      borrowerIntent: 'REVIEW', quoteEconomics: highQuote, followUp: { optedIn: true, channelAvailable: true },
    });
    expect(result.followUpEligibility).toMatchObject({ eligible: true, draftOnly: true, autoSend: false });
    expect(result.nextBestAction.type).toBe('DRAFT_FOLLOW_UP');
  });

  it('requires a fresh preflight after REVIEW_REQUESTED', () => {
    const result = evaluate({
      stageEvidence: [{ stage: 'REVIEW_REQUESTED', source: 'current_session' }], debtFound: true,
      borrowerIntent: 'EXECUTION', quoteEconomics: highQuote,
    });
    expect(result.nextBestAction.type).toBe('RUN_FRESH_PREFLIGHT');
  });

  it('does not let aggregate analytics fabricate transaction or revenue stages', () => {
    const result = evaluate({
      stageEvidence: [{ stage: 'FEE_RECEIVED', source: 'aggregate_analytics' }],
      aggregateFunnel: { FEE_RECEIVED: 99 },
    });
    expect(result.currentStage).toBe('LANDING_VISIT');
    expect(result.nextBestAction.type).toBe('REQUEST_READ_ONLY_ADDRESS');
  });

  it('does not promote a historical ledger quote to LIVE_QUOTE_READY', () => {
    const ledger = [{ state: 'QUOTE_READY' as const, at: now, evidence: { mode: 'reviewed-snapshot-demo' } }];
    expect(stageEvidenceFromLedger(ledger)).toEqual([]);
    expect(stageEvidenceFromLedger(ledger, { quoteIsLive: true })).toEqual([
      { stage: 'LIVE_QUOTE_READY', source: 'revenue_ledger', observedAt: now },
    ]);
  });

  it('never exposes signing, wallet control, secrets, promises, or broadcastable transactions', () => {
    const result = evaluate({
      stageEvidence: [{ stage: 'FRESH_PREFLIGHT', source: 'revenue_ledger' }], quoteEconomics: highQuote,
    });
    expect(result.safety).toEqual({
      readOnly: true, maySign: false, mayAuthorizeWallet: false, mayControlWallet: false,
      mayCreateBroadcastableTransaction: false, mayRequestSecrets: false, mayPromiseReturns: false,
    });
    expect(JSON.stringify(result)).not.toMatch(/private key|seed phrase|calldata/i);
  });
});
