import { getAddress, isAddress } from 'viem';
import type { LiveDebtPosition } from './publicTypes.js';

export const MORPHO_GRAPHQL = 'https://api.morpho.org/graphql';
export const MAX_SOURCE_AGE_SECONDS = 300;
export const MAX_INDEX_BLOCK_LAG = 50;

const query = `query UserDebt($address: String!, $chainId: Int!) {
  userByAddress(address: $address, chainId: $chainId) {
    marketPositions {
      healthFactor
      market {
        marketId
        loanAsset { address symbol decimals price { usd } }
        collateralAsset { address symbol decimals price { usd } }
        state { borrowApy blockNumber timestamp }
      }
      state { borrowAssets borrowAssetsUsd collateral collateralUsd }
    }
  }
}`;

interface MorphoPayload {
  data?: { userByAddress?: { marketPositions?: Array<{
    healthFactor?: number | null;
    market?: {
      marketId?: string;
      loanAsset?: { address?: string; symbol?: string; decimals?: number };
      collateralAsset?: { address?: string; symbol?: string; decimals?: number };
      state?: { borrowApy?: number; blockNumber?: number; timestamp?: number };
    };
    state?: { borrowAssets?: string | number; borrowAssetsUsd?: number; collateral?: string | number; collateralUsd?: number };
  }> } | null };
  errors?: Array<{ message?: string }>;
}

export async function scanMorphoDebt(wallet: string, fetcher: typeof fetch = fetch, nowMs = Date.now()): Promise<LiveDebtPosition[]> {
  if (!isAddress(wallet)) throw new Error('Enter a valid EVM wallet address.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetcher(MORPHO_GRAPHQL, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json', 'user-agent': 'Debt-Saver-Public-Test/0.3' },
      body: JSON.stringify({ query, variables: { address: wallet, chainId: 1 } }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Morpho read source returned HTTP ${response.status}.`);
    const payload = await response.json() as MorphoPayload;
    if (payload.errors?.length) throw new Error('Morpho read source rejected the query.');
    return (payload.data?.userByAddress?.marketPositions ?? []).map((item): LiveDebtPosition | null => {
      const market = item.market; const state = item.state; const marketState = market?.state;
      const debtUsd = Number(state?.borrowAssetsUsd ?? 0); const collateralUsd = Number(state?.collateralUsd ?? 0);
      const currentApy = Number(marketState?.borrowApy ?? Number.NaN) * 100;
      const blockNumber = Number(marketState?.blockNumber ?? 0); const timestamp = Number(marketState?.timestamp ?? 0);
      const debtAddress = market?.loanAsset?.address; const collateralAddress = market?.collateralAsset?.address;
      if (!market?.marketId || !debtAddress || !collateralAddress || !isAddress(debtAddress) || !isAddress(collateralAddress)) return null;
      if (![debtUsd, collateralUsd, currentApy, blockNumber, timestamp].every(Number.isFinite) || debtUsd <= 0 || collateralUsd <= 0 || blockNumber <= 0 || timestamp <= 0) return null;
      if (!Number.isInteger(market.loanAsset?.decimals) || !Number.isInteger(market.collateralAsset?.decimals)) return null;
      return {
        protocol: 'Morpho Blue', marketId: market.marketId,
        debtAsset: market.loanAsset?.symbol ?? 'Unknown', debtAssetAddress: getAddress(debtAddress), debtAssetDecimals: market.loanAsset!.decimals!,
        collateralAsset: market.collateralAsset?.symbol ?? 'Unknown', collateralAssetAddress: getAddress(collateralAddress), collateralAssetDecimals: market.collateralAsset!.decimals!,
        debtAssets: String(state?.borrowAssets ?? ''), collateralAssets: String(state?.collateral ?? ''), debtUsd, collateralUsd, currentApy,
        sourceHealthFactor: Number.isFinite(Number(item.healthFactor)) ? Number(item.healthFactor) : null,
        sourceFresh: Math.abs(nowMs / 1000 - timestamp) <= MAX_SOURCE_AGE_SECONDS,
        source: { source: 'Morpho official GraphQL API · Ethereum market position', timestamp: new Date(timestamp * 1000).toISOString(), blockNumber, endpoint: MORPHO_GRAPHQL },
      };
    }).filter((position): position is LiveDebtPosition => position !== null).sort((a, b) => b.debtUsd - a.debtUsd);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('Morpho read source timed out. No quote was created.');
    throw error;
  } finally { clearTimeout(timeout); }
}
