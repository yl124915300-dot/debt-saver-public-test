import { top1Quote } from '../../src/services/seed.js';
import { json, parseBody, recordEvent, type PagesContext } from '../_shared.js';

export async function onRequestPost(context: PagesContext) {
  try {
    const body = await parseBody(context.request);
    const live = typeof body.quoteId === 'string' && /^live-[a-f0-9]{8}-\d+$/.test(body.quoteId);
    if (body.quoteId !== top1Quote.id && !live) return json({ error: 'Unknown or expired preflight reference.' }, 400);
    await recordEvent(context.env, 'REVIEW_REQUESTED', body.analyticsScope === 'smoke' ? 'smoke' : live ? 'live' : 'demo', String(body.sessionId ?? ''), body);
    return json({
      mode: 'read-only-preview',
      broadcastable: false,
      calldata: null,
      signerRequest: null,
      transaction: null,
      message: live ? 'Live-rate explanation and feasibility gates only. Refresh before relying on it.' : 'Historical assumptions and safety limits only.',
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Preview unavailable.' }, 400);
  }
}
