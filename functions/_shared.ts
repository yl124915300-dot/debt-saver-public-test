import {
  attributionCampaigns,
  attributionMediums,
  attributionSources,
  landingIntents,
  type PublicAttribution,
  type PublicEvent,
} from '../src/services/publicTypes.js';

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<unknown>;
  all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export interface Env {
  DB?: D1Database;
}

export interface PagesContext {
  request: Request;
  env: Env;
  next(): Promise<Response>;
}

const allowed = new Set<PublicEvent>([
  'LANDING_VISIT',
  'VISITOR',
  'ADDRESS_SUBMITTED',
  'DEBT_FOUND',
  'QUOTE_READY',
  'QUOTE_VIEWED',
  'REVIEW_REQUESTED',
]);

function allowlisted<T extends readonly string[]>(value: unknown, allowedValues: T, fallback: T[number]): T[number] {
  return typeof value === 'string' && (allowedValues as readonly string[]).includes(value) ? value as T[number] : fallback;
}

export function normalizeAttribution(input: Record<string, unknown> = {}): PublicAttribution {
  return {
    landing_intent: allowlisted(input.landing_intent, landingIntents, 'main'),
    utm_source: allowlisted(input.utm_source ?? input.source, attributionSources, 'direct'),
    utm_medium: allowlisted(input.utm_medium, attributionMediums, 'none'),
    utm_campaign: allowlisted(input.utm_campaign, attributionCampaigns, 'none'),
  };
}

export async function parseBody(request: Request) {
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 4_096) throw new Error('Request too large.');
  const raw = await request.text();
  if (raw.length > 4_096) throw new Error('Request too large.');
  return raw ? JSON.parse(raw) as Record<string, unknown> : {};
}

async function hashSession(sessionId: string) {
  const bytes = new TextEncoder().encode(`debt-saver-public-v1:${sessionId}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function isD1QuotaError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /D1_ERROR/i.test(message) && /exceeded.*(?:daily|free tier).*limit|quota/i.test(message);
}

export async function enforceRateLimit(env: Env, sessionId: string) {
  if (!/^[0-9a-f-]{16,64}$/i.test(sessionId)) throw new Error('Invalid anonymous session.');
  if (!env.DB) throw new Error('Anonymous analytics and rate limiting are not configured.');
  const sessionHash = await hashSession(sessionId);
  const window = Math.floor(Date.now() / 600_000);
  try {
    await env.DB.prepare(
      'INSERT INTO rate_windows (session_hash, window_id, count) VALUES (?, ?, 1) ON CONFLICT(session_hash, window_id) DO UPDATE SET count = count + 1',
    ).bind(sessionHash, window).run();
    const result = await env.DB.prepare(
      'SELECT count FROM rate_windows WHERE session_hash = ? AND window_id = ?',
    ).bind(sessionHash, window).all<{ count: number }>();
    if (Number(result.results?.[0]?.count ?? 0) > 12) throw new Error('Read-only scan rate limit reached. Try again later.');
  } catch (error) {
    if (isD1QuotaError(error)) return;
    throw error;
  }
}

export async function recordEvent(
  env: Env,
  event: PublicEvent,
  scope: 'live' | 'demo' | 'smoke',
  sessionId: string,
  attributionInput: Record<string, unknown> = {},
) {
  if (!allowed.has(event)) throw new Error('Unsupported funnel event.');
  if (!/^[0-9a-f-]{16,64}$/i.test(sessionId)) throw new Error('Invalid anonymous session.');
  if (!env.DB) return false;
  const sessionHash = await hashSession(sessionId);
  const attribution = normalizeAttribution(attributionInput);
  const day = new Date().toISOString().slice(0, 10);
  try {
    await env.DB.prepare(
      'INSERT OR IGNORE INTO funnel_events (event, scope, day, session_hash, created_at) VALUES (?, ?, ?, ?, ?)',
    ).bind(event, scope, day, sessionHash, new Date().toISOString()).run();
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS funnel_attribution (
        event TEXT NOT NULL,
        scope TEXT NOT NULL,
        source TEXT NOT NULL,
        landing_intent TEXT NOT NULL DEFAULT 'main',
        medium TEXT NOT NULL DEFAULT 'none',
        campaign TEXT NOT NULL DEFAULT 'none',
        day TEXT NOT NULL,
        session_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(scope, event, session_hash)
      )`,
    ).run();
    await env.DB.prepare(
      `INSERT INTO funnel_attribution
        (event, scope, source, landing_intent, medium, campaign, day, session_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(scope, event, session_hash) DO UPDATE SET
          source = excluded.source,
          landing_intent = excluded.landing_intent,
          medium = excluded.medium,
          campaign = excluded.campaign`,
    ).bind(
      event, scope, attribution.utm_source, attribution.landing_intent, attribution.utm_medium,
      attribution.utm_campaign, day, sessionHash, new Date().toISOString(),
    ).run();
    return true;
  } catch {
    return false;
  }
}

export function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
    },
  });
}
