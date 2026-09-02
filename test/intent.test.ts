import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const pages = [
  ['aave-borrow-rate', 'intent_aave_borrow_rate'],
  ['morpho-vs-aave', 'intent_morpho_vs_aave'],
  ['defi-liquidation-risk', 'intent_liquidation_risk'],
] as const;

describe('intent landing pages', () => {
  for (const [slug, landingIntent] of pages) {
    it(`${slug} is indexable, bounded, and attributed`, async () => {
      const html = await readFile(new URL(`../public/${slug}/index.html`, import.meta.url), 'utf8');
      expect(html).toMatch(new RegExp(`<title>[^<]+`));
      expect(html).toContain('name="description"');
      expect(html).toContain(`rel="canonical" href="https://debt-saver-public-test.pages.dev/${slug}/"`);
      expect(html).toContain(`data-landing-intent="${landingIntent}"`);
      expect(html).toContain(`landing_intent=${landingIntent}`);
      expect(html).not.toContain('data-source=');
      expect(html).toMatch(/READ-ONLY/i);
      expect(html).toMatch(/NO WALLET CONNECTION/i);
      expect(html).toMatch(/NO SIGNING/i);
      expect(html).toMatch(/NO CUSTODY/i);
      expect(html).toMatch(/NO GAS/i);
    });
  }

  it('uses only allowlisted attribution fields and keeps smoke traffic isolated', async () => {
    const script = await readFile(new URL('../public/intent-attribution.js', import.meta.url), 'utf8');
    expect(script).toContain("event: 'LANDING_VISIT'");
    expect(script).toContain("scope: smoke ? 'smoke' : 'live'");
    expect(script).toContain("'realtime_rate_snapshot', 'intent_monitor', 'savings_outcome_v1'");
    for (const field of ['landing_intent', 'utm_source', 'utm_medium', 'utm_campaign']) expect(script).toContain(field);
    expect(script).not.toMatch(/document\.cookie|referrer|wallet|location\.href\s*[,}]/);
  });

  it('publishes robots and sitemap discovery', async () => {
    const robots = await readFile(new URL('../public/robots.txt', import.meta.url), 'utf8');
    const sitemap = await readFile(new URL('../public/sitemap.xml', import.meta.url), 'utf8');
    expect(robots).toContain('Sitemap: https://debt-saver-public-test.pages.dev/sitemap.xml');
    for (const [slug] of pages) expect(sitemap).toContain(`/${slug}/`);
  });
});
