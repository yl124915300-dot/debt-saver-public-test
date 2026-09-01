import { describe, expect, it } from 'vitest';
import { scanMorphoDebt } from '../src/services/liveScan.js';
import { reviewedTop1Demo } from '../src/services/publicDemo.js';
import { COMPETITIVE_WALLET, TOP1_WALLET } from '../src/services/seed.js';

describe('Debt Saver public read-only boundary', () => {
  it('normalizes a Morpho debt read without executable output', async () => {
    const fetcher = async () => new Response(JSON.stringify({
      data: {
        userByAddress: {
          marketPositions: [{
            market: {
              marketId: '0xmarket',
              loanAsset: { symbol: 'USDC' },
              collateralAsset: { symbol: 'cbBTC' },
              state: { borrowApy: 0.0525 },
            },
            state: { borrowAssetsUsd: 125000 },
          }],
        },
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
    const positions = await scanMorphoDebt(TOP1_WALLET, fetcher as typeof fetch);
    expect(positions[0]).toMatchObject({ debtUsd: 125000, currentApr: 5.25 });
    expect(JSON.stringify(positions)).not.toMatch(/calldata|signature|transaction/i);
  });

  it('returns no supported debt for an empty live position list', async () => {
    const fetcher = async () => new Response(JSON.stringify({
      data: { userByAddress: { marketPositions: [] } },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
    await expect(scanMorphoDebt(COMPETITIVE_WALLET, fetcher as typeof fetch)).resolves.toEqual([]);
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
});
