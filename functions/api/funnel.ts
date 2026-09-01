import { json, type PagesContext } from '../_shared.js';

export async function onRequestGet(context: PagesContext) {
  if (!context.env.DB) return json({ error: 'Anonymous analytics are not configured.' }, 503);
  const data = await context.env.DB.prepare(
    'SELECT scope, event, COUNT(*) AS count FROM funnel_events GROUP BY scope, event ORDER BY scope, event',
  ).all<{ scope: string; event: string; count: number }>();
  const funnel = { live: {} as Record<string, number>, demo: {} as Record<string, number>, smoke: {} as Record<string, number> };
  for (const row of data.results ?? []) {
    const scope = row.scope === 'demo' ? funnel.demo : row.scope === 'smoke' ? funnel.smoke : funnel.live;
    scope[row.event] = Number(row.count);
  }
  await context.env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS funnel_attribution (
      event TEXT NOT NULL, scope TEXT NOT NULL, source TEXT NOT NULL, day TEXT NOT NULL,
      session_hash TEXT NOT NULL, created_at TEXT NOT NULL,
      UNIQUE(scope, event, source, session_hash)
    )`,
  ).run();
  const attributed = await context.env.DB.prepare(
    'SELECT source, event, COUNT(*) AS count FROM funnel_attribution WHERE scope = ? GROUP BY source, event ORDER BY source, event',
  ).bind('live').all<{ source: string; event: string; count: number }>();
  const bySource: Record<string, Record<string, number>> = {};
  for (const row of attributed.results ?? []) {
    bySource[row.source] ??= {};
    bySource[row.source][row.event] = Number(row.count);
  }
  return json({
    generatedAt: new Date().toISOString(),
    note: 'Aggregate unique-session funnel and fixed source labels only. No wallet addresses, IP addresses, cookies, signatures, or personal profiles are stored.',
    funnel,
    attribution: { live: bySource },
  });
}
