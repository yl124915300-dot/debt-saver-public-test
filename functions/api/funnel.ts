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
  const attributed = await context.env.DB.prepare(
    `SELECT scope, source, landing_intent, medium, campaign, event, COUNT(*) AS count
     FROM funnel_attribution
     GROUP BY scope, source, landing_intent, medium, campaign, event
     ORDER BY scope, source, campaign, event`,
  ).all<{ scope: string; source: string; landing_intent: string; medium: string; campaign: string; event: string; count: number }>();
  type Aggregate = Record<string, Record<string, number>>;
  type ScopedAggregate = Record<'live' | 'demo' | 'smoke', Aggregate>;
  const emptyScoped = (): ScopedAggregate => ({ live: {}, demo: {}, smoke: {} });
  const bySource = emptyScoped();
  const byCampaign = emptyScoped();
  const bySourceCampaign = emptyScoped();
  const byLandingIntent = emptyScoped();
  const add = (aggregate: Aggregate, key: string, event: string, count: number) => {
    aggregate[key] ??= {};
    aggregate[key][event] = (aggregate[key][event] ?? 0) + count;
  };
  for (const row of attributed.results ?? []) {
    const scope = row.scope === 'demo' ? 'demo' : row.scope === 'smoke' ? 'smoke' : 'live';
    const count = Number(row.count);
    add(bySource[scope], row.source, row.event, count);
    add(byCampaign[scope], row.campaign, row.event, count);
    add(bySourceCampaign[scope], `${row.source}/${row.campaign}`, row.event, count);
    add(byLandingIntent[scope], row.landing_intent, row.event, count);
  }
  return json({
    generatedAt: new Date().toISOString(),
    note: 'Aggregate unique-session funnel and allowlisted campaign labels only. No wallet addresses, IP addresses, cookies, referrer URLs, signatures, free text, or personal profiles are stored.',
    funnel,
    attribution: {
      live: bySource.live,
      bySource,
      byCampaign,
      bySourceCampaign,
      byLandingIntent,
    },
  });
}
