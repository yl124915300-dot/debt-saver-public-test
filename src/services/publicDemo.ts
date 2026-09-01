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
      collateralAsset: top1Quote.position.collateralAsset,
      debtUsd: top1Quote.position.debtUsd,
      currentApr: top1Quote.position.currentApr,
    }],
    quote: top1Quote,
    simulation: seededSimulation,
    explanation: `Reviewed historical snapshot: over ${top1Quote.horizonDays} days, the saved model showed $${top1Quote.netSavingUsd.toLocaleString('en-US')} net savings after the modeled fee. It is expired and is not a live quote.`,
    limitation: 'Reviewed fixed-block snapshot only. It is expired, non-broadcastable, and must not be treated as current market pricing.',
    quoteReady: true,
    broadcastable: false,
  };
}

