import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const pages = [
  ['aave-borrow-rate', 'intent_aave_borrow_rate'],
  ['morpho-vs-aave', 'intent_morpho_vs_aave'],
  ['defi-liquidation-risk', 'intent_liquidation_risk'],
] as const;

describe('intent landing pages', () => {
  for (const [slug, source] of pages) {
    it(`${slug} is indexable, bounded, and attributed`, async () => {
      const html = await readFile(new URL(`../public/${slug}/index.html`, import.meta.url), 'utf8');
      expect(html).toMatch(new RegExp(`<title>[^<]+`));
      expect(html).toContain('name="description"');
      expect(html).toContain(`rel="canonical" href="https://debt-saver-public-test.pages.dev/${slug}/"`);
      expect(html).toContain(`utm_source=${source}`);
      expect(html).toMatch(/READ-ONLY/i);
      expect(html).toMatch(/NO WALLET CONNECTION/i);
      expect(html).toMatch(/NO SIGNING/i);
      expect(html).toMatch(/NO CUSTODY/i);
      expect(html).toMatch(/NO GAS/i);
    });
  }

  it('publishes robots and sitemap discovery', async () => {
    const robots = await readFile(new URL('../public/robots.txt', import.meta.url), 'utf8');
    const sitemap = await readFile(new URL('../public/sitemap.xml', import.meta.url), 'utf8');
    expect(robots).toContain('Sitemap: https://debt-saver-public-test.pages.dev/sitemap.xml');
    for (const [slug] of pages) expect(sitemap).toContain(`/${slug}/`);
  });
});
