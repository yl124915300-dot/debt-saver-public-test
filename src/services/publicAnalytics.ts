import type { PublicEvent } from './publicTypes.js';

const sessionKey = 'debt-saver-public-session';

export function getPublicSessionId() {
  let value = sessionStorage.getItem(sessionKey);
  if (!value) {
    value = crypto.randomUUID();
    sessionStorage.setItem(sessionKey, value);
  }
  return value;
}

export type AnalyticsScope = 'live' | 'demo' | 'smoke';

export async function recordPublicEvent(event: PublicEvent, scope: AnalyticsScope = 'live') {
  try {
    await fetch('/api/event', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event, scope, sessionId: getPublicSessionId() }),
      keepalive: true,
    });
  } catch {
    // Analytics must never block or change the read-only product result.
  }
}
