import { readAaveSnapshot } from './aaveLive.js';
import { buildLiveQuote } from './liveQuote.js';
import { scanMorphoDebt } from './liveScan.js';
import type { PublicScanResponse } from './publicTypes.js';
import { getAddress } from 'viem';

export async function evaluateLiveWallet(wallet: string, fetcher: typeof fetch = fetch, nowMs = Date.now()): Promise<PublicScanResponse> {
  const positions = await scanMorphoDebt(wallet, fetcher, nowMs);
  if (!positions.length) return {
    mode: 'live-read-only', status: 'NO_SUPPORTED_DEBT', scannedAt: new Date(nowMs).toISOString(), indexedBlock: null, positions: [], quote: null, simulation: null,
    explanation: 'No active Ethereum Morpho Blue borrow position was returned by the official index.', limitation: 'Only Morpho Blue → Aave V3 Ethereum is in scope.', quoteReady: false, broadcastable: false,
  };
  if (!positions.some((position) => position.sourceFresh)) return {
    mode: 'live-read-only', status: 'FAIL_CLOSED', scannedAt: new Date(nowMs).toISOString(), indexedBlock: null, positions, quote: null, simulation: null,
    explanation: 'Morpho debt was found, but no market position met the freshness requirement.', limitation: 'Stale indexed data cannot produce a live quote.', quoteReady: false, broadcastable: false,
    rejectedReasons: ['Morpho indexed market data is stale.'], sources: positions.map((position) => position.source),
  };
  const selectedPosition = positions.find((position) => position.sourceFresh)!;
  const selectedAave = await readAaveSnapshot(selectedPosition, getAddress(wallet), fetcher, nowMs);
  const evaluated = [{ position: selectedPosition, aave: selectedAave, ...buildLiveQuote(selectedPosition, selectedAave, nowMs) }];
  const live = evaluated[0].quote ? evaluated[0] : undefined;
  const sources = [selectedPosition.source, selectedAave.proof];
  if (live?.quote) return {
    mode: 'live-read-only', status: 'LIVE_QUOTE_READY', scannedAt: new Date(nowMs).toISOString(), indexedBlock: live.aave.proof.blockNumber, positions, quote: live.quote, simulation: null,
    explanation: `The largest fresh Morpho position was checked. A live, read-only ${live.quote.debtAsset} comparison found positive modeled net saving over ${live.quote.horizonDays} days after all disclosed costs.`,
    limitation: 'Preflight only: no wallet connection, calldata, approval, signature, transaction simulation, broadcast, deployment, or gas spend.', quoteReady: true, broadcastable: false, sources,
  };
  const rejectedReasons = [...new Set(evaluated.flatMap((item) => item.reasons))];
  const unsupported = rejectedReasons.some((reason) => /not eligible|does not publish|not open/.test(reason));
  return {
    mode: 'live-read-only', status: unsupported ? 'NO_SUPPORTED_DEBT' : 'DEBT_FOUND_NO_QUOTE', scannedAt: new Date(nowMs).toISOString(), indexedBlock: evaluated[0]?.aave.proof.blockNumber ?? null,
    positions, quote: null, simulation: null, explanation: 'Active Morpho Blue debt was found and checked against live Aave V3 Ethereum state.',
    limitation: 'The live route failed one or more feasibility or economics gates, so no quote was created.', quoteReady: false, broadcastable: false, sources, rejectedReasons,
  };
}
