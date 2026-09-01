import { seededSimulation, top1Quote } from './seed.js';
import type { PublicScanResponse } from './publicTypes.js';

export function reviewedTop1Demo(): PublicScanResponse {
  return {
    mode: 'reviewed-snapshot-demo',
    status: 'DEMO_QUOTE_READY',
    scannedAt: new Date().toISOString(),
    indexedBlock: seededSimulation.forkBlock,
    positions: [{
      protocol: 'Morpho Blue',
      marketId: 'reviewed-snapshot',
      debtAsset: top1Quote.position.debtAsset,
      debtAssetAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      debtAssetDecimals: 6,
      collateralAsset: top1Quote.position.collateralAsset,
      collateralAssetAddress: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
      collateralAssetDecimals: 8,
      debtAssets: '34469224460000',
      collateralAssets: '0',
      debtUsd: top1Quote.position.debtUsd,
      collateralUsd: 0,
      currentApy: top1Quote.position.currentApr,
      sourceHealthFactor: top1Quote.position.healthFactor,
      sourceFresh: false,
      source: { source: 'Expired reviewed fixed-block snapshot', timestamp: '2026-09-01T08:19:35.063Z', blockNumber: seededSimulation.forkBlock },
    }],
    quote: top1Quote,
    simulation: seededSimulation,
    explanation: `Reviewed historical snapshot: over ${top1Quote.horizonDays} days, the saved model showed $${top1Quote.netSavingUsd.toLocaleString('en-US')} net savings after the modeled fee. It is expired and is not a live quote.`,
    limitation: 'Reviewed fixed-block snapshot only. It is expired, non-broadcastable, and must not be treated as current market pricing.',
    quoteReady: true,
    broadcastable: false,
  };
}
