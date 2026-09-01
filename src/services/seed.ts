import type { DebtPosition, RefinanceQuote, SimulationResult } from './types.js';

export const TOP1_WALLET = '0x56eCBF8844bD7a64dc661EC41D52005D4E224adc' as const;
export const COMPETITIVE_WALLET = '0x0000000000000000000000000000000000000001' as const;

export const top1Position: DebtPosition = {
  wallet: TOP1_WALLET,
  sourceProtocol: 'Morpho Blue',
  debtAsset: 'USDC',
  collateralAsset: 'cbBTC',
  debtUsd: 34_469_224.46,
  currentApr: 4.6595,
  healthFactor: 1.75184,
  source: 'seeded-mainnet-fork',
};

export const competitivePosition: DebtPosition = {
  wallet: COMPETITIVE_WALLET,
  sourceProtocol: 'Morpho Blue',
  debtAsset: 'USDC',
  collateralAsset: 'WETH',
  debtUsd: 250_000,
  currentApr: 3.98,
  healthFactor: 2.14,
  source: 'seeded-mainnet-fork',
};

export const top1Quote: RefinanceQuote = {
  id: 'eth-morpho-aave-usdc-cbbtc-top1',
  position: top1Position,
  targetProtocol: 'Aave V3',
  betterApr: 4.1479,
  horizonDays: 90,
  grossSavingUsd: 43_419.95,
  feeUsd: 5_000,
  netSavingUsd: 38_419.95,
  breakEvenDays: 10.37,
  postHealthFactor: 1.74601,
  hasOpportunity: true,
  expiresAt: null,
  broadcastable: false,
};

export const competitiveQuote: RefinanceQuote = {
  id: 'demo-already-competitive',
  position: competitivePosition,
  targetProtocol: 'Aave V3',
  betterApr: 4.11,
  horizonDays: 90,
  grossSavingUsd: 0,
  feeUsd: 0,
  netSavingUsd: 0,
  breakEvenDays: 0,
  postHealthFactor: competitivePosition.healthFactor,
  hasOpportunity: false,
  expiresAt: null,
  broadcastable: false,
};

export const seededSimulation: SimulationResult = {
  quoteId: top1Quote.id,
  pass: true,
  mode: 'seeded-evidence',
  forkBlock: 25_881_978,
  mainAssertions: '21/21 PASS',
  negativeProbes: '13/13 PASS',
  warning: 'Historical local-fork evidence only. This is expired and cannot be broadcast.',
};
