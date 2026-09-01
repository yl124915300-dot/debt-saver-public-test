import { scanMorphoDebt } from '../../src/services/liveScan.js';
import { reviewedTop1Demo } from '../../src/services/publicDemo.js';
import type { PublicScanResponse } from '../../src/services/publicTypes.js';
import { enforceRateLimit, json, parseBody, recordEvent, type PagesContext } from '../_shared.js';

export async function onRequestPost(context: PagesContext) {
  try {
    const body = await parseBody(context.request);
    const sessionId = String(body.sessionId ?? '');
    const scope = body.analyticsScope === 'smoke' ? 'smoke' : body.demo === 'top1' ? 'demo' : 'live';
    await enforceRateLimit(context.env, sessionId);

    if (body.demo === 'top1') {
      await recordEvent(context.env, 'ADDRESS_SUBMITTED', scope, sessionId);
      await recordEvent(context.env, 'DEBT_FOUND', scope, sessionId);
      await recordEvent(context.env, 'QUOTE_READY', scope, sessionId);
      return json(reviewedTop1Demo());
    }

    if (typeof body.wallet !== 'string') return json({ error: 'wallet is required' }, 400);
    await recordEvent(context.env, 'ADDRESS_SUBMITTED', scope, sessionId);
    const positions = await scanMorphoDebt(body.wallet);
    if (positions.length) await recordEvent(context.env, 'DEBT_FOUND', scope, sessionId);

    const response: PublicScanResponse = positions.length ? {
      mode: 'live-read-only',
      status: 'DEBT_FOUND_NO_QUOTE',
      scannedAt: new Date().toISOString(),
      indexedBlock: null,
      positions,
      quote: null,
      simulation: null,
      explanation: 'Active Morpho Blue debt was found from the live public index.',
      limitation: 'The reviewed public Aave comparison source is not configured. Debt Saver failed closed and did not create QUOTE_READY, savings claims, simulation, review calldata, or any transaction data.',
      quoteReady: false,
      broadcastable: false,
    } : {
      mode: 'live-read-only',
      status: 'NO_DEBT_FOUND',
      scannedAt: new Date().toISOString(),
      indexedBlock: null,
      positions: [],
      quote: null,
      simulation: null,
      explanation: 'No active Ethereum Morpho Blue borrow position was returned by the public index. Other protocols and chains are outside this test.',
      limitation: 'No supported debt means no quote.',
      quoteReady: false,
      broadcastable: false,
    };
    return json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Live read source unavailable.';
    return json({ error: message, failClosed: true, quoteCreated: false, broadcastable: false }, /valid EVM/.test(message) ? 400 : 503);
  }
}
