import { describe, expect, it } from 'vitest';
import { normalizeAttribution, recordEvent, type D1Database, type D1PreparedStatement } from '../functions/_shared.js';
import { onRequestGet as getFunnel } from '../functions/api/funnel.js';
import { parsePublicAttribution } from '../src/services/publicAnalytics.js';

class CapturingStatement implements D1PreparedStatement {
  values: unknown[] = [];
  constructor(private readonly database: CapturingDatabase, readonly query: string) {}
  bind(...values: unknown[]) { this.values = values; return this; }
  async run() { this.database.calls.push({ query: this.query, values: this.values }); return {}; }
  async all<T>() {
    this.database.calls.push({ query: this.query, values: this.values });
    if (this.query.includes('FROM funnel_events')) return { results: this.database.funnelRows as T[] };
    if (this.query.includes('FROM funnel_attribution')) return { results: this.database.attributionRows as T[] };
    return { results: [] as T[] };
  }
}

class CapturingDatabase implements D1Database {
  calls: Array<{ query: string; values: unknown[] }> = [];
  funnelRows: Record<string, unknown>[] = [];
  attributionRows: Record<string, unknown>[] = [];
  prepare(query: string) { return new CapturingStatement(this, query); }
}

describe('privacy-friendly campaign attribution', () => {
  it('retains an allowlisted X campaign and landing intent', () => {
    const result = parsePublicAttribution('?landing_intent=intent_aave_borrow_rate&utm_source=x&utm_medium=organic&utm_campaign=savings_outcome_v1');
    expect(result).toEqual({
      landing_intent: 'intent_aave_borrow_rate',
      utm_source: 'x',
      utm_medium: 'organic',
      utm_campaign: 'savings_outcome_v1',
    });
  });

  it('retains the independent rate opportunity campaign without broadening campaign input', () => {
    expect(parsePublicAttribution('?landing_intent=intent_aave_borrow_rate&utm_source=x&utm_medium=organic&utm_campaign=rate_opportunity_v1')).toEqual({
      landing_intent: 'intent_aave_borrow_rate',
      utm_source: 'x',
      utm_medium: 'organic',
      utm_campaign: 'rate_opportunity_v1',
    });
    expect(normalizeAttribution({
      landing_intent: 'intent_aave_borrow_rate', utm_source: 'x', utm_medium: 'organic', utm_campaign: 'rate_opportunity_v1',
    })).toEqual({
      landing_intent: 'intent_aave_borrow_rate',
      utm_source: 'x',
      utm_medium: 'organic',
      utm_campaign: 'rate_opportunity_v1',
    });
    expect(parsePublicAttribution('?utm_source=x&utm_medium=organic&utm_campaign=rate_opportunity_v2')).toEqual({
      landing_intent: 'main',
      utm_source: 'x',
      utm_medium: 'organic',
      utm_campaign: 'none',
    });
  });

  it('retains only the allowlisted organic search campaign', () => {
    expect(parsePublicAttribution('?landing_intent=intent_aave_borrow_rate&utm_source=search&utm_medium=organic&utm_campaign=organic_search_v1')).toEqual({
      landing_intent: 'intent_aave_borrow_rate',
      utm_source: 'search',
      utm_medium: 'organic',
      utm_campaign: 'organic_search_v1',
    });
    expect(parsePublicAttribution('?utm_source=search&utm_medium=organic&utm_campaign=organic_search_v2')).toEqual({
      landing_intent: 'main',
      utm_source: 'search',
      utm_medium: 'organic',
      utm_campaign: 'none',
    });
  });

  it('uses non-identifying defaults without UTM parameters', () => {
    expect(parsePublicAttribution('')).toEqual({
      landing_intent: 'main', utm_source: 'direct', utm_medium: 'none', utm_campaign: 'none',
    });
  });

  it('rejects unknown, free-text, and overlong values instead of truncating or storing them', () => {
    const tooLong = 'x'.repeat(500);
    expect(parsePublicAttribution(`?landing_intent=notes&utm_source=${tooLong}&utm_medium=email&utm_campaign=my_secret_campaign`)).toEqual({
      landing_intent: 'main', utm_source: 'direct', utm_medium: 'none', utm_campaign: 'none',
    });
    expect(parsePublicAttribution(`?utm_campaign=${tooLong}`)).toEqual({
      landing_intent: 'main', utm_source: 'direct', utm_medium: 'none', utm_campaign: 'none',
    });
    expect(normalizeAttribution({
      landing_intent: 'intent_morpho_vs_aave', utm_source: 'x', utm_medium: 'organic', utm_campaign: 'savings_outcome_v1',
    })).toEqual({
      landing_intent: 'intent_morpho_vs_aave', utm_source: 'x', utm_medium: 'organic', utm_campaign: 'savings_outcome_v1',
    });
  });

  it('keeps old source-only callers compatible', () => {
    expect(normalizeAttribution({ source: 'intent_liquidation_risk' })).toEqual({
      landing_intent: 'main', utm_source: 'intent_liquidation_risk', utm_medium: 'none', utm_campaign: 'none',
    });
  });

  it('stores only a session hash and allowlisted labels', async () => {
    const database = new CapturingDatabase();
    const sessionId = '12345678-1234-1234-1234-123456789abc';
    await recordEvent({ DB: database }, 'VISITOR', 'smoke', sessionId, {
      landing_intent: 'intent_aave_borrow_rate', utm_source: 'x', utm_medium: 'organic', utm_campaign: 'realtime_rate_snapshot',
      wallet: '0x1234567890abcdef', ip: '203.0.113.8', cookie: 'secret', referrer: 'https://example.com/private?q=secret', notes: 'free text',
    });
    const stored = JSON.stringify(database.calls);
    expect(stored).not.toContain(sessionId);
    expect(stored).not.toContain('0x1234567890abcdef');
    expect(stored).not.toContain('203.0.113.8');
    expect(stored).not.toContain('example.com');
    expect(stored).not.toContain('free text');
    expect(stored).toContain('realtime_rate_snapshot');
  });

  it('aggregates legacy defaults and new source/campaign rows without mixing smoke into live', async () => {
    const database = new CapturingDatabase();
    database.funnelRows = [
      { scope: 'live', event: 'VISITOR', count: 32 },
      { scope: 'smoke', event: 'LANDING_VISIT', count: 3 },
    ];
    database.attributionRows = [
      { scope: 'live', source: 'direct', landing_intent: 'main', medium: 'none', campaign: 'none', event: 'VISITOR', count: 32 },
      { scope: 'smoke', source: 'x', landing_intent: 'intent_aave_borrow_rate', medium: 'organic', campaign: 'realtime_rate_snapshot', event: 'LANDING_VISIT', count: 1 },
    ];
    const response = await getFunnel({ env: { DB: database } } as never);
    const body = await response.json() as any;
    expect(body.funnel.live.VISITOR).toBe(32);
    expect(body.funnel.live.LANDING_VISIT).toBeUndefined();
    expect(body.attribution.byCampaign.live.none.VISITOR).toBe(32);
    expect(body.attribution.byCampaign.smoke.realtime_rate_snapshot.LANDING_VISIT).toBe(1);
    expect(body.attribution.byLandingIntent.smoke.intent_aave_borrow_rate.LANDING_VISIT).toBe(1);
  });
});
