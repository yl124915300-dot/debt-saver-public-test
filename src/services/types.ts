export type LedgerState =
  | 'VISITOR'
  | 'ADDRESS_SUBMITTED'
  | 'WALLET_CONNECTED'
  | 'DEBT_FOUND'
  | 'QUOTE_READY'
  | 'QUOTE_VIEWED'
  | 'SIMULATION_PASS'
  | 'REVIEW_REQUESTED'
  | 'EXECUTION_INTENT'
  | 'FRESH_PREFLIGHT'
  | 'TX_SIGNED'
  | 'TX_CONFIRMED'
  | 'FEE_RECEIVED';

export type SalesState =
  | 'DEBT_SCAN'
  | 'OPPORTUNITY_SCORE'
  | 'QUOTE_GENERATE'
  | 'SIMULATE'
  | 'EXPLAIN_SAVING'
  | 'HANDLE_OBJECTION'
  | 'REFRESH_QUOTE'
  | 'REQUEST_REVIEW'
  | 'TRACK_CONVERSION';

export interface DebtPosition {
  wallet: `0x${string}`;
  sourceProtocol: 'Morpho Blue' | 'Aave V3' | 'Compound V3' | 'Spark';
  debtAsset: string;
  collateralAsset: string;
  debtUsd: number;
  currentApr: number;
  healthFactor: number;
  source: 'seeded-mainnet-fork' | 'live-adapter';
}

export interface RefinanceQuote {
  id: string;
  position: DebtPosition;
  targetProtocol: 'Aave V3';
  betterApr: number;
  horizonDays: number;
  grossSavingUsd: number;
  feeUsd: number;
  netSavingUsd: number;
  breakEvenDays: number;
  postHealthFactor: number;
  hasOpportunity: boolean;
  expiresAt: string | null;
  broadcastable: false;
}

export interface SimulationResult {
  quoteId: string;
  pass: boolean;
  mode: 'seeded-evidence';
  forkBlock: number;
  mainAssertions: string;
  negativeProbes: string;
  warning: string;
}

export interface LedgerEvent {
  state: LedgerState;
  at: string;
  evidence: Record<string, unknown>;
}

export interface QuoteResponse {
  quote: RefinanceQuote;
  simulation: SimulationResult | null;
  salesState: SalesState;
  explanation: string;
  ledger: LedgerEvent[];
}
