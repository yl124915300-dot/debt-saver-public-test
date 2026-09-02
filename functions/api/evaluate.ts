import { evaluateLiveWallet } from '../../src/services/liveEvaluation.js';
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
      await recordEvent(context.env, 'ADDRESS_SUBMITTED', scope, sessionId, body);
      await recordEvent(context.env, 'DEBT_FOUND', scope, sessionId, body);
      await recordEvent(context.env, 'QUOTE_READY', scope, sessionId, body);
      return json(reviewedTop1Demo());
    }

    if (typeof body.wallet !== 'string') return json({ error: 'wallet is required' }, 400);
    await recordEvent(context.env, 'ADDRESS_SUBMITTED', scope, sessionId, body);
    const response: PublicScanResponse = await evaluateLiveWallet(body.wallet);
    if (response.positions.length) await recordEvent(context.env, 'DEBT_FOUND', scope, sessionId, body);
    if (response.status === 'LIVE_QUOTE_READY') await recordEvent(context.env, 'QUOTE_READY', scope, sessionId, body);
    return json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Live read source unavailable.';
    return json({ mode: 'live-read-only', status: 'FAIL_CLOSED', error: message, failClosed: true, quoteReady: false, quoteCreated: false, broadcastable: false }, /valid EVM/.test(message) ? 400 : 503);
  }
}
