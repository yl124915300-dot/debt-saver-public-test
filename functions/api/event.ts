import { json, parseBody, recordEvent, type PagesContext } from '../_shared.js';
import type { PublicEvent } from '../../src/services/publicTypes.js';

export async function onRequestPost(context: PagesContext) {
  try {
    const body = await parseBody(context.request);
    const stored = await recordEvent(
      context.env,
      String(body.event) as PublicEvent,
      body.scope === 'demo' ? 'demo' : body.scope === 'smoke' ? 'smoke' : 'live',
      String(body.sessionId ?? ''),
      body,
    );
    return json({ accepted: stored, mode: stored ? 'anonymous-aggregate' : 'analytics-unavailable' }, stored ? 202 : 503);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Invalid event.' }, 400);
  }
}
