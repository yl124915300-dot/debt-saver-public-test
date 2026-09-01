import { isAddress } from 'viem';
import type { LiveDebtPosition } from './publicTypes.js';

const MORPHO_GRAPHQL = 'https://api.morpho.org/graphql';

const query = `query UserDebt($address: String!, $chainId: Int!) {
  userByAddress(address: $address, chainId: $chainId) {
    address
    marketPositions {
      market {
        marketId
        loanAsset { symbol }
        collateralAsset { symbol }
        state { borrowApy }
      }
      state { borrowAssetsUsd }
    }
  }
}`;

interface MorphoPayload {
  data?: {
    userByAddress?: {
      marketPositions?: Array<{
        market?: {
          marketId?: string;
          loanAsset?: { symbol?: string };
          collateralAsset?: { symbol?: string };
          state?: { borrowApy?: number };
        };
        state?: { borrowAssetsUsd?: number };
      }>;
    } | null;
  };
  errors?: Array<{ message?: string }>;
}

export async function scanMorphoDebt(wallet: string, fetcher: typeof fetch = fetch): Promise<LiveDebtPosition[]> {
  if (!isAddress(wallet)) throw new Error('Enter a valid EVM wallet address.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetcher(MORPHO_GRAPHQL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'user-agent': 'Debt-Saver-Public-Test/0.2',
      },
      body: JSON.stringify({ query, variables: { address: wallet, chainId: 1 } }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Morpho read source returned HTTP ${response.status}.`);
    const payload = await response.json() as MorphoPayload;
    if (payload.errors?.length) throw new Error('Morpho read source rejected the query.');

    return (payload.data?.userByAddress?.marketPositions ?? [])
      .map((item): LiveDebtPosition | null => {
        const debtUsd = Number(item.state?.borrowAssetsUsd ?? 0);
        const marketId = item.market?.marketId;
        const borrowApy = Number(item.market?.state?.borrowApy ?? 0);
        if (!marketId || !Number.isFinite(debtUsd) || debtUsd <= 0) return null;
        return {
          protocol: 'Morpho Blue',
          marketId,
          debtAsset: item.market?.loanAsset?.symbol ?? 'Unknown',
          collateralAsset: item.market?.collateralAsset?.symbol ?? 'Unknown',
          debtUsd,
          currentApr: borrowApy * 100,
        };
      })
      .filter((position): position is LiveDebtPosition => position !== null)
      .sort((a, b) => b.debtUsd - a.debtUsd);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Morpho read source timed out. No quote was created.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

