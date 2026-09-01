# Debt Saver — read-only public test

> Enter your wallet address to check whether your DeFi debt can be refinanced cheaper.

Debt Saver is a deliberately narrow public test for Ethereum Morpho Blue borrowers. It reads public indexed debt data, shows whether supported debt was found, and fails closed when a reviewed live comparison quote is unavailable.

## Safety boundary

This public build is **READ-ONLY / TEST MODE**:

- no wallet connector;
- no approvals, delegation, or signature requests;
- no transaction or broadcastable calldata generation;
- no mainnet contract deployment;
- no gas spending;
- no fee or revenue claims;
- no live quote when the reviewed comparison source is unavailable.

The Top 1 Morpho → Aave example is a clearly labeled, expired, reviewed fixed-block snapshot. It is a demo, not current pricing.

## Live behavior

Public wallet address → server-side Morpho public API read → supported debt found / not found

If Morpho's public data source times out, rejects the query, or returns an error, the API returns a fail-closed error and creates no quote. Real-address scans currently stop at DEBT_FOUND; they do not emit QUOTE_READY because the public Aave comparison source is intentionally unavailable.

## Minimal anonymous funnel

Only these stage names may be recorded:

VISITOR, ADDRESS_SUBMITTED, WALLET_CONNECTED, DEBT_FOUND, QUOTE_READY, QUOTE_VIEWED, REVIEW_REQUESTED

The public build stores only event stage, live / demo / smoke scope, date, timestamp, and a SHA-256 hash of a random session ID. It does not store submitted wallet addresses, IP addresses, cookies, signatures, private keys, seed phrases, calldata, or personal profiles.

GET /api/funnel returns aggregate counts only. Production smoke tests use ?smoke=1 so they do not inflate real visitor data.

## Local verification

Requires Node.js 24+.

    npm install
    npm test
    npm run typecheck
    npm run build
    npm run start

Open http://127.0.0.1:4174.

## Cloudflare Pages deployment

The zero-cost deployment target is Cloudflare Pages Functions plus D1:

1. Create a D1 database named debt-saver-public-test-analytics.
2. Apply schema.sql.
3. Replace the placeholder D1 database_id in wrangler.toml.
4. Create a Pages project named debt-saver-public-test.
5. Build with npm run build, output directory dist, and bind D1 as DB.
6. Deploy, then verify /api/health, /api/funnel, live debt, no-debt, invalid-address, demo, preview, security headers, desktop, and mobile.

Cloudflare Pages Functions keep the Morpho request server-side. No private RPC credential is required or exposed.

## Scope and source

- Live source: Morpho's public GraphQL API, Ethereum only.
- Live protocol: Morpho Blue only.
- Live target quote: unavailable / fail-closed.
- Demo: expired reviewed fixed-block snapshot at block 25,881,978.
- Public issues: https://github.com/yl124915300-dot/debt-saver-public-test/issues

Not financial advice. Do not submit private keys, seed phrases, signatures, or personal information.
