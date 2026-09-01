import type { AaveSnapshot } from './aaveLive.js';
import { MAX_INDEX_BLOCK_LAG } from './liveScan.js';
import type { LiveDebtPosition, LiveRefinanceQuote } from './publicTypes.js';

export const QUOTE_HORIZON_DAYS = 90 as const;
export const GAS_UNITS_MODEL = 1_200_000;
export const MIN_POST_HEALTH_FACTOR = 1.1;

function raw(value: string) { if (!/^\d+$/.test(value)) throw new Error('Morpho position amount is not verifiable.'); return BigInt(value); }
function toUnits(value: bigint, decimals: number) { return Number(value) / 10 ** decimals; }
function round(value: number, digits = 6) { const factor = 10 ** digits; return Math.round(value * factor) / factor; }

export function buildLiveQuote(position: LiveDebtPosition, aave: AaveSnapshot, nowMs = Date.now()): { quote: LiveRefinanceQuote | null; reasons: string[] } {
  const reasons: string[] = [];
  if (!position.sourceFresh) reasons.push('Morpho indexed market data is stale.');
  if (aave.proof.blockNumber - position.source.blockNumber > MAX_INDEX_BLOCK_LAG) reasons.push('Morpho index block is too far behind Ethereum head.');
  const debtRaw = raw(position.debtAssets); const collateralRaw = raw(position.collateralAssets);
  if (debtRaw <= 0n || collateralRaw <= 0n) reasons.push('Debt or collateral amount is zero.');
  if (!aave.borrowingEnabled || !aave.debtReserveActive || aave.debtReserveFrozen) reasons.push('Aave debt reserve is not open for new variable borrowing.');
  if (!aave.collateralEnabled || !aave.collateralReserveActive || aave.collateralReserveFrozen) reasons.push('Aave collateral reserve is not eligible for migration.');
  if (aave.collateralDebtCeiling > 0n) reasons.push('Aave collateral is in isolation mode and this public preflight does not verify aggregate debt-ceiling headroom.');
  if (aave.siloedBorrowing) reasons.push('Aave target debt asset uses siloed borrowing.');
  if (aave.userEMode !== 0) reasons.push('The target account uses Aave eMode, which this public preflight does not model.');
  if (aave.debtPriceUsd <= 0 || aave.collateralPriceUsd <= 0) reasons.push('Aave oracle does not publish both required asset prices.');
  if (aave.availableLiquidityAssets < debtRaw) reasons.push('Aave reserve liquidity is below the requested debt.');
  if (aave.borrowCapHeadroomAssets !== null && aave.borrowCapHeadroomAssets < debtRaw) reasons.push('Aave borrow-cap headroom is below the requested debt.');
  if (aave.supplyCapHeadroomAssets !== null && aave.supplyCapHeadroomAssets < collateralRaw) reasons.push('Aave collateral supply-cap headroom is below the requested collateral.');
  const currentDebtUsd = toUnits(debtRaw, aave.debtDecimals) * aave.debtPriceUsd;
  const collateralUsdAtAaveOracle = toUnits(collateralRaw, aave.collateralDecimals) * aave.collateralPriceUsd;
  const liquidationWeightedCollateral = aave.existingCollateralUsd * (aave.existingLiquidationThreshold / 100) + collateralUsdAtAaveOracle * (aave.liquidationThreshold / 100);
  const postMigrationDebtUsd = aave.existingDebtUsd + currentDebtUsd;
  const postMigrationHealthFactor = postMigrationDebtUsd > 0 ? liquidationWeightedCollateral / postMigrationDebtUsd : 0;
  if (!Number.isFinite(postMigrationHealthFactor) || postMigrationHealthFactor < MIN_POST_HEALTH_FACTOR) reasons.push(`Post-migration health factor is below ${MIN_POST_HEALTH_FACTOR.toFixed(2)}.`);
  const morphoApy = position.currentApy / 100; const aaveApy = aave.variableBorrowApy / 100;
  if (morphoApy <= aaveApy) reasons.push('Aave variable borrow APY is not lower than the current Morpho APY.');
  const grossSavingUsd = currentDebtUsd * (Math.pow(1 + morphoApy, QUOTE_HORIZON_DAYS / 365) - Math.pow(1 + aaveApy, QUOTE_HORIZON_DAYS / 365));
  const useMorphoFlash = aave.morphoFlashLiquidityAssets >= debtRaw;
  const flashPremiumUsd = useMorphoFlash ? 0 : currentDebtUsd * aave.aaveFlashPremiumBps / 10_000;
  if (!useMorphoFlash && aave.availableLiquidityAssets < debtRaw + debtRaw * BigInt(aave.aaveFlashPremiumBps) / 10_000n) reasons.push('Neither verified Morpho free-flash liquidity nor Aave fallback flash liquidity is sufficient.');
  const gasUsd = Number(aave.gasPriceWei) * GAS_UNITS_MODEL / 1e18 * aave.nativePriceUsd;
  const serviceFeeUsd = Math.min(Math.max(grossSavingUsd, 0) * 0.1, 5_000);
  const totalCostUsd = flashPremiumUsd + gasUsd + serviceFeeUsd; const netSavingUsd = grossSavingUsd - totalCostUsd;
  const dailyGrossSaving = grossSavingUsd / QUOTE_HORIZON_DAYS; const breakEvenDays = dailyGrossSaving > 0 ? totalCostUsd / dailyGrossSaving : Number.POSITIVE_INFINITY;
  if (!Number.isFinite(netSavingUsd) || netSavingUsd <= 0 || breakEvenDays > QUOTE_HORIZON_DAYS) reasons.push('Net saving is not positive within the 90-day quote horizon.');
  if (reasons.length) return { quote: null, reasons };
  return { reasons: [], quote: {
    id: `live-${position.marketId.slice(2, 10)}-${aave.proof.blockNumber}`, route: 'Morpho Blue → Aave V3 Ethereum', marketId: position.marketId, debtAsset: position.debtAsset, collateralAsset: position.collateralAsset,
    currentDebtUsd: round(currentDebtUsd, 2), collateralUsdAtAaveOracle: round(collateralUsdAtAaveOracle, 2), currentMorphoBorrowApy: round(position.currentApy), targetAaveVariableBorrowApy: round(aave.variableBorrowApy), targetAaveVariableBorrowApr: round(aave.variableBorrowApr),
    grossSavingUsd: round(grossSavingUsd, 2), netSavingUsd: round(netSavingUsd, 2), horizonDays: QUOTE_HORIZON_DAYS, breakEvenDays: round(breakEvenDays, 2), postMigrationHealthFactor: round(postMigrationHealthFactor, 4), liquidationThreshold: aave.liquidationThreshold, ltv: aave.ltv,
    costs: { flashSource: useMorphoFlash ? 'Morpho Blue free flash loan' : 'Aave V3 flash loan', flashPremiumUsd: round(flashPremiumUsd, 2), gasUnitsModel: GAS_UNITS_MODEL, gasPriceGwei: round(Number(aave.gasPriceWei) / 1e9, 4), gasUsd: round(gasUsd, 2), slippageUsd: 0, protocolFeeUsd: 0, serviceFeeUsd: round(serviceFeeUsd, 2), serviceFeePolicy: '10% of modeled 90-day gross saving, capped at $5,000; no fee is charged in read-only test mode.', totalCostUsd: round(totalCostUsd, 2) },
    expiresAt: new Date(Math.min(nowMs + 5 * 60_000, Date.parse(aave.proof.timestamp) + 5 * 60_000)).toISOString(),
    assumptions: ['Same debt and collateral assets move without a swap, so modeled slippage is $0.', 'Post-migration health factor includes the target wallet’s existing Aave collateral and debt at the same fixed block.', 'Gas uses a conservative 1,200,000-gas preflight model at the live eth_gasPrice; no transaction was estimated or constructed.', 'Rates are variable and the quote expires after five minutes.', 'This is an informational preflight, not a transaction simulation or guarantee.'],
    sources: [position.source, aave.proof], broadcastable: false,
  } };
}
