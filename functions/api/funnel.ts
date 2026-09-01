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
  return json({
    generatedAt: new Date().toISOString(),
    note: 'Aggregate unique-session funnel only. No wallet addresses, IP addresses, signatures, or personal profiles are stored.',
    funnel,
  });
}
