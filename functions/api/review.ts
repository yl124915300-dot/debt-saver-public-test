import { top1Quote } from '../../src/services/seed.js';
import { json, parseBody, recordEvent, type PagesContext } from '../_shared.js';

export async function onRequestPost(context: PagesContext) {
  try {
    const body = await parseBody(context.request);
    if (body.quoteId !== top1Quote.id) return json({ error: 'Only the reviewed snapshot has a preview.' }, 400);
    await recordEvent(context.env, 'REVIEW_REQUESTED', body.analyticsScope === 'smoke' ? 'smoke' : 'demo', String(body.sessionId ?? ''));
    return json({
      mode: 'read-only-preview',
      broadcastable: false,
      calldata: null,
      signerRequest: null,
      transaction: null,
      message: 'Historical assumptions and safety limits only. Nothing executable was generated.',
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Preview unavailable.' }, 400);
  }
}
