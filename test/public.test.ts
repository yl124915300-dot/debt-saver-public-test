import { describe, expect, it } from 'vitest';
import { scanMorphoDebt } from '../src/services/liveScan.js';
import { buildLiveQuote } from '../src/services/liveQuote.js';
import type { AaveSnapshot } from '../src/services/aaveLive.js';
import type { LiveDebtPosition } from '../src/services/publicTypes.js';
import { reviewedTop1Demo } from '../src/services/publicDemo.js';
import { COMPETITIVE_WALLET, TOP1_WALLET } from '../src/services/seed.js';

describe('Debt Saver public read-only boundary', () => {
  const now = Date.parse('2026-09-01T12:00:00Z');
  it('normalizes a Morpho debt read without executable output', async () => {
    const fetcher = async () => new Response(JSON.stringify({
      data: {
        userByAddress: {
          marketPositions: [{
            market: {
              marketId: '0xmarket',
              loanAsset: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6 },
              collateralAsset: { address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', symbol: 'cbBTC', decimals: 8 },
              state: { borrowApy: 0.0525, blockNumber: 25_000_000, timestamp: now / 1000 },
            },
            healthFactor: 1.8,
            state: { borrowAssets: '125000000000', borrowAssetsUsd: 125000, collateral: '400000000', collateralUsd: 300000 },
          }],
        },
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
    const positions = await scanMorphoDebt(TOP1_WALLET, fetcher as typeof fetch, now);
    expect(positions[0]).toMatchObject({ debtUsd: 125000, currentApy: 5.25, debtAssets: '125000000000' });
    expect(JSON.stringify(positions)).not.toMatch(/calldata|signature|transaction/i);
  });

  it('returns no supported debt for an empty live position list', async () => {
    const fetcher = async () => new Response(JSON.stringify({
      data: { userByAddress: { marketPositions: [] } },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
    await expect(scanMorphoDebt(COMPETITIVE_WALLET, fetcher as typeof fetch)).resolves.toEqual([]);
  });

  it('marks stale Morpho data so it cannot enter a live quote', async () => {
    const fetcher = async () => new Response(JSON.stringify({ data: { userByAddress: { marketPositions: [{
      healthFactor: 2,
      market: { marketId: '0xmarket', loanAsset: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6 }, collateralAsset: { address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', symbol: 'cbBTC', decimals: 8 }, state: { borrowApy: 0.05, blockNumber: 1, timestamp: now / 1000 - 301 } },
      state: { borrowAssets: '1', borrowAssetsUsd: 1, collateral: '1', collateralUsd: 2 },
    }] } } }), { status: 200 });
    const positions = await scanMorphoDebt(TOP1_WALLET, fetcher as typeof fetch, now);
    expect(positions[0].sourceFresh).toBe(false);
  });

  it('fails closed when the public source is unavailable', async () => {
    const fetcher = async () => new Response('unavailable', { status: 503 });
    await expect(scanMorphoDebt(TOP1_WALLET, fetcher as typeof fetch)).rejects.toThrow('HTTP 503');
  });

  it('keeps the reviewed snapshot expired and non-broadcastable', () => {
    const demo = reviewedTop1Demo();
    expect(demo.mode).toBe('reviewed-snapshot-demo');
    expect(demo.broadcastable).toBe(false);
    expect(demo.simulation?.warning).toMatch(/expired/i);
    expect(JSON.stringify(demo)).not.toMatch(/0x[a-f0-9]{8,}.*calldata/i);
  });

  const position: LiveDebtPosition = {
    protocol: 'Morpho Blue', marketId: '0x64d65c9a2d91c36d56fbc42d69e979335320169b3df63bf92789e2c8883fcc64',
    debtAsset: 'USDC', debtAssetAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', debtAssetDecimals: 6,
    collateralAsset: 'cbBTC', collateralAssetAddress: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', collateralAssetDecimals: 8,
    debtAssets: '36000000000000', collateralAssets: '100000000000', debtUsd: 36_000_000, collateralUsd: 78_000_000, currentApy: 4.7, sourceHealthFactor: 1.8, sourceFresh: true,
    source: { source: 'Morpho official GraphQL API', timestamp: '2026-09-01T12:00:00Z', blockNumber: 25_000_000 },
  };
  const aave: AaveSnapshot = {
    proof: { source: 'Aave contracts', timestamp: '2026-09-01T12:00:00Z', blockNumber: 25_000_002, blockHash: '0xabc' }, witnessHeads: [25_000_002, 25_000_001],
    debtPriceUsd: 1, collateralPriceUsd: 78_000, nativePriceUsd: 2_500, debtDecimals: 6, collateralDecimals: 8,
    variableBorrowApr: 4, variableBorrowApy: Math.expm1(0.04) * 100, ltv: 73, liquidationThreshold: 78,
    availableLiquidityAssets: 200_000_000_000_000n, borrowCapHeadroomAssets: 100_000_000_000_000n, supplyCapHeadroomAssets: 2_000_000_000_000n,
    collateralEnabled: true, borrowingEnabled: true, debtReserveActive: true, debtReserveFrozen: false, collateralReserveActive: true, collateralReserveFrozen: false,
    collateralDebtCeiling: 0n, siloedBorrowing: false, morphoFlashLiquidityAssets: 100_000_000_000_000n, aaveFlashPremiumBps: 5, gasPriceWei: 200_000_000n,
    existingCollateralUsd: 0, existingDebtUsd: 0, existingLiquidationThreshold: 0, existingHealthFactor: null, userEMode: 0,
  };

  it('computes positive net saving, costs, break-even, and health factor', () => {
    const result = buildLiveQuote(position, aave, now);
    expect(result.reasons).toEqual([]);
    expect(result.quote).toMatchObject({ broadcastable: false, currentDebtUsd: 36_000_000, postMigrationHealthFactor: 1.69 });
    expect(result.quote!.grossSavingUsd).toBeGreaterThan(result.quote!.netSavingUsd);
    expect(result.quote!.costs).toMatchObject({ flashPremiumUsd: 0, slippageUsd: 0, protocolFeeUsd: 0 });
    expect(result.quote!.breakEvenDays).toBeLessThan(90);
  });

  it('refuses a quote when APY, liquidity, cap, or health gates fail', () => {
    const result = buildLiveQuote({ ...position, currentApy: 3 }, { ...aave, availableLiquidityAssets: 1n, borrowCapHeadroomAssets: 1n, collateralPriceUsd: 40_000 }, now);
    expect(result.quote).toBeNull();
    expect(result.reasons.join(' ')).toMatch(/liquidity|borrow-cap/);
    expect(result.reasons.join(' ')).toMatch(/health factor/);
    expect(result.reasons.join(' ')).toMatch(/not lower/);
  });

  it('uses the disclosed Aave flash fallback premium only when Morpho liquidity is short', () => {
    const result = buildLiveQuote(position, { ...aave, morphoFlashLiquidityAssets: 1n }, now);
    expect(result.quote?.costs.flashSource).toBe('Aave V3 flash loan');
    expect(result.quote?.costs.flashPremiumUsd).toBe(18_000);
  });
});
