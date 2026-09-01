import type { PublicEvent } from '../src/services/publicTypes.js';

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
  'VISITOR',
  'ADDRESS_SUBMITTED',
  'DEBT_FOUND',
  'QUOTE_READY',
  'QUOTE_VIEWED',
  'REVIEW_REQUESTED',
]);

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

export async function enforceRateLimit(env: Env, sessionId: string) {
  if (!/^[0-9a-f-]{16,64}$/i.test(sessionId)) throw new Error('Invalid anonymous session.');
  if (!env.DB) throw new Error('Anonymous analytics and rate limiting are not configured.');
  const sessionHash = await hashSession(sessionId);
  const window = Math.floor(Date.now() / 600_000);
  await env.DB.prepare(
    'INSERT INTO rate_windows (session_hash, window_id, count) VALUES (?, ?, 1) ON CONFLICT(session_hash, window_id) DO UPDATE SET count = count + 1',
  ).bind(sessionHash, window).run();
  const result = await env.DB.prepare(
    'SELECT count FROM rate_windows WHERE session_hash = ? AND window_id = ?',
  ).bind(sessionHash, window).all<{ count: number }>();
  if (Number(result.results?.[0]?.count ?? 0) > 12) throw new Error('Read-only scan rate limit reached. Try again later.');
}

export async function recordEvent(
  env: Env,
  event: PublicEvent,
  scope: 'live' | 'demo' | 'smoke',
  sessionId: string,
  source = 'direct',
) {
  if (!allowed.has(event)) throw new Error('Unsupported funnel event.');
  if (!/^[0-9a-f-]{16,64}$/i.test(sessionId)) throw new Error('Invalid anonymous session.');
  if (!env.DB) return false;
  const sessionHash = await hashSession(sessionId);
  const normalizedSource = /^[a-z0-9_-]{1,64}$/.test(source) ? source : 'direct';
  const day = new Date().toISOString().slice(0, 10);
  await env.DB.prepare(
    'INSERT OR IGNORE INTO funnel_events (event, scope, day, session_hash, created_at) VALUES (?, ?, ?, ?, ?)',
  ).bind(event, scope, day, sessionHash, new Date().toISOString()).run();
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS funnel_attribution (
      event TEXT NOT NULL,
      scope TEXT NOT NULL,
      source TEXT NOT NULL,
      day TEXT NOT NULL,
      session_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(scope, event, source, session_hash)
    )`,
  ).run();
  await env.DB.prepare(
    'INSERT OR IGNORE INTO funnel_attribution (event, scope, source, day, session_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).bind(event, scope, normalizedSource, day, sessionHash, new Date().toISOString()).run();
  return true;
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
