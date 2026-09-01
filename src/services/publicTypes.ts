export type PublicEvent =
  | 'VISITOR'
  | 'ADDRESS_SUBMITTED'
  | 'WALLET_CONNECTED'
  | 'DEBT_FOUND'
  | 'QUOTE_READY'
  | 'QUOTE_VIEWED'
  | 'REVIEW_REQUESTED';

export interface LiveDebtPosition {
  protocol: 'Morpho Blue';
  marketId: string;
  debtAsset: string;
  collateralAsset: string;
  debtUsd: number;
  currentApr: number;
}

export interface PublicScanResponse {
  mode: 'live-read-only' | 'reviewed-snapshot-demo';
  status: 'NO_DEBT_FOUND' | 'DEBT_FOUND_NO_QUOTE' | 'DEMO_QUOTE_READY';
  scannedAt: string;
  indexedBlock: number | null;
  positions: LiveDebtPosition[];
  quote: import('./types.js').RefinanceQuote | null;
  simulation: import('./types.js').SimulationResult | null;
  explanation: string;
  limitation: string;
  quoteReady: boolean;
  broadcastable: false;
}
