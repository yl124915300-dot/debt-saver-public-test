export type PublicEvent =
  | 'VISITOR'
  | 'ADDRESS_SUBMITTED'
  | 'DEBT_FOUND'
  | 'QUOTE_READY'
  | 'QUOTE_VIEWED'
  | 'REVIEW_REQUESTED';

export interface DataProof {
  source: string;
  timestamp: string;
  blockNumber: number;
  blockHash?: string;
  endpoint?: string;
}

export interface LiveDebtPosition {
  protocol: 'Morpho Blue';
  marketId: string;
  debtAsset: string;
  debtAssetAddress: `0x${string}`;
  debtAssetDecimals: number;
  collateralAsset: string;
  collateralAssetAddress: `0x${string}`;
  collateralAssetDecimals: number;
  debtAssets: string;
  collateralAssets: string;
  debtUsd: number;
  collateralUsd: number;
  currentApy: number;
  sourceHealthFactor: number | null;
  sourceFresh: boolean;
  source: DataProof;
}

export interface CostBreakdown {
  flashSource: 'Morpho Blue free flash loan' | 'Aave V3 flash loan';
  flashPremiumUsd: number;
  gasUnitsModel: number;
  gasPriceGwei: number;
  gasUsd: number;
  slippageUsd: 0;
  protocolFeeUsd: 0;
  serviceFeeUsd: number;
  serviceFeePolicy: string;
  totalCostUsd: number;
}

export interface LiveRefinanceQuote {
  id: string;
  route: 'Morpho Blue → Aave V3 Ethereum';
  marketId: string;
  debtAsset: string;
  collateralAsset: string;
  currentDebtUsd: number;
  collateralUsdAtAaveOracle: number;
  currentMorphoBorrowApy: number;
  targetAaveVariableBorrowApy: number;
  targetAaveVariableBorrowApr: number;
  grossSavingUsd: number;
  netSavingUsd: number;
  horizonDays: 90;
  breakEvenDays: number;
  postMigrationHealthFactor: number;
  liquidationThreshold: number;
  ltv: number;
  costs: CostBreakdown;
  expiresAt: string;
  assumptions: string[];
  sources: DataProof[];
  broadcastable: false;
}

export interface PublicScanResponse {
  mode: 'live-read-only' | 'reviewed-snapshot-demo';
  status: 'LIVE_QUOTE_READY' | 'DEBT_FOUND_NO_QUOTE' | 'NO_SUPPORTED_DEBT' | 'FAIL_CLOSED' | 'DEMO_QUOTE_READY';
  scannedAt: string;
  indexedBlock: number | null;
  positions: LiveDebtPosition[];
  quote: LiveRefinanceQuote | import('./types.js').RefinanceQuote | null;
  simulation: import('./types.js').SimulationResult | null;
  explanation: string;
  limitation: string;
  quoteReady: boolean;
  broadcastable: false;
  sources?: DataProof[];
  rejectedReasons?: string[];
}
