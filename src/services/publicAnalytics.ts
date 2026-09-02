import {
  attributionCampaigns,
  attributionMediums,
  attributionSources,
  landingIntents,
  type PublicAttribution,
  type PublicEvent,
} from './publicTypes.js';

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

function allowlisted<T extends readonly string[]>(value: string | null, allowed: T, fallback: T[number]): T[number] {
  return value !== null && (allowed as readonly string[]).includes(value) ? value as T[number] : fallback;
}

export function parsePublicAttribution(search: string): PublicAttribution {
  const params = new URLSearchParams(search);
  return {
    landing_intent: allowlisted(params.get('landing_intent'), landingIntents, 'main'),
    utm_source: allowlisted(params.get('utm_source'), attributionSources, 'direct'),
    utm_medium: allowlisted(params.get('utm_medium'), attributionMediums, 'none'),
    utm_campaign: allowlisted(params.get('utm_campaign'), attributionCampaigns, 'none'),
  };
}

export function getPublicAttribution() {
  return parsePublicAttribution(window.location.search);
}

export async function recordPublicEvent(event: PublicEvent, scope: AnalyticsScope = 'live', attribution = getPublicAttribution()) {
  try {
    await fetch('/api/event', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event, scope, ...attribution, sessionId: getPublicSessionId() }),
      keepalive: true,
    });
  } catch {
    // Analytics must never block or change the read-only product result.
  }
}
