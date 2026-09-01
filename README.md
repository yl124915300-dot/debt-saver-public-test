# Debt Saver — read-only public test

> Enter your wallet address to check whether your DeFi debt can be refinanced cheaper.

**Public test:** https://debt-saver-public-test.pages.dev/

Intent entry points:

- https://debt-saver-public-test.pages.dev/aave-borrow-rate/
- https://debt-saver-public-test.pages.dev/morpho-vs-aave/
- https://debt-saver-public-test.pages.dev/defi-liquidation-risk/

Intent classification, channel rules, and reply gates are documented in `docs/INTENT_MONITOR.md`.

Debt Saver is a deliberately narrow public test for Ethereum Morpho Blue borrowers. It compares a live Morpho Blue position with Aave V3 Ethereum and returns a five-minute, read-only preflight only when every source, feasibility, safety, and economics gate passes.

## Safety boundary

This public build is **READ-ONLY / TEST MODE**:

- no wallet connector;
- no approvals, delegation, or signature requests;
- no transaction or broadcastable calldata generation;
- no mainnet contract deployment;
- no gas spending;
- no fee or revenue claims;
- no quote when any critical source, freshness, reserve, cap, liquidity, health-factor, or economics check fails.

The Top 1 Morpho → Aave example is a clearly labeled, expired, reviewed fixed-block snapshot. It is a demo, not current pricing.

## Live behavior

Public wallet address → Morpho official API position → Aave V3 Ethereum fixed-block contract reads → feasibility and economics gates → `LIVE_QUOTE_READY` or fail closed.

Aave data comes from the Ethereum PoolAddressesProvider, ProtocolDataProvider, Oracle, Pool, token balance reads, and live gas price. The configured Pool and Oracle addresses are verified against the provider on every evaluation. Two public RPC heads are compared when both are available, then all contract values are read at one fixed block. Morpho data may be at most five minutes old; the Ethereum block at most three minutes old; the Morpho index may trail by at most 50 blocks.

The 90-day economics include the current debt, Morpho borrow APY, Aave variable borrow APY, gross interest difference, verified Morpho free-flash liquidity (or Aave premium fallback), a conservative 1,200,000-gas model at live gas price, zero slippage only for same-asset routes, zero extra protocol fee, and a disclosed test service-fee policy of 10% of gross savings capped at $5,000. No fee is charged by this read-only site.

## Minimal anonymous funnel

Only these stage names may be recorded:

VISITOR, ADDRESS_SUBMITTED, DEBT_FOUND, QUOTE_READY, QUOTE_VIEWED, REVIEW_REQUESTED

The public build stores only event stage, live / demo / smoke scope, a fixed non-personal source label, date, timestamp, and a SHA-256 hash of a random session ID. It does not store submitted wallet addresses, IP addresses, cookies, signatures, private keys, seed phrases, calldata, usernames, or personal profiles.

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

The public test is deployed at no cost on Cloudflare Pages Functions plus D1:

- Pages project: `debt-saver-public-test`
- D1 database: `debt-saver-public-test-analytics`
- Production branch: `main`
- Public URL: https://debt-saver-public-test.pages.dev/

The launch deployment was verified against `/api/health`, `/api/funnel`, live debt, no-debt, invalid-address, demo, preview, security headers, desktop, and a 390×844 mobile viewport. Operator checks use the isolated `smoke` scope.

Cloudflare Pages Functions keep the Morpho request server-side. No private RPC credential is required or exposed.

## Scope and source

- Live source: Morpho official GraphQL API plus Aave V3 Ethereum on-chain contracts through public read-only RPC.
- Live route: Morpho Blue → Aave V3 Ethereum only.
- Live target quote: five-minute read-only preflight; fail-closed when a required check fails.
- Demo: expired reviewed fixed-block snapshot at block 25,881,978.
- Public issues: https://github.com/yl124915300-dot/debt-saver-public-test/issues

Not financial advice. Do not submit private keys, seed phrases, signatures, or personal information.
