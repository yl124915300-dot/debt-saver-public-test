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

const sourcePattern = /^[a-z0-9_-]{1,64}$/;

export function getPublicSource() {
  const value = new URLSearchParams(window.location.search).get('utm_source') ?? '';
  return sourcePattern.test(value) ? value : 'direct';
}

export async function recordPublicEvent(event: PublicEvent, scope: AnalyticsScope = 'live', source = getPublicSource()) {
  try {
    await fetch('/api/event', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event, scope, source, sessionId: getPublicSessionId() }),
      keepalive: true,
    });
  } catch {
    // Analytics must never block or change the read-only product result.
  }
}
