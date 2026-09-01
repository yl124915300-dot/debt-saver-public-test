# Public test audit

Status: `LIVE_QUOTE_PUBLIC` at https://debt-saver-public-test.pages.dev/.

## Checklist result

- READ-ONLY / TEST MODE banner: pass.
- Wallet connector, signing, approvals, broadcast, calldata, deployment, gas spend: absent.
- Morpho Blue → Aave V3 Ethereum only: pass.
- Live fixed-block Aave source with address-provider verification: pass.
- Morpho freshness ≤5 minutes, Ethereum block freshness ≤3 minutes, index lag ≤50 blocks: pass.
- Reserve activity/freeze, oracle, liquidity, borrow cap, supply cap, isolation, silo, eMode, existing Aave account, and health-factor gates: pass/fail-closed.
- Economics: current debt, both APYs, gross saving, free-flash/fallback premium, modeled gas, same-asset slippage, protocol cost, transparent service fee, net saving, break-even, and post-migration health factor: pass.
- Anonymous funnel: stage/scope/day/random-session hash only; no wallet address, IP, cookie, signature, or personal profile: pass.
- Tests: 12/12.
- Typecheck: pass.
- Production build: pass.
- Local and production desktop smoke: pass.
- Local and production 390×844 mobile smoke: pass, no horizontal overflow.
- Browser console warnings/errors: 0.
- Homepage and all three existing intent pages: HTTP 200.
- Invalid address: HTTP 400 `FAIL_CLOSED`.
- No-debt address: `NO_SUPPORTED_DEBT`.
- Live quote responses: `broadcastable: false`; no simulation or transaction payload.

Production deployment: `4c515af0.debt-saver-public-test.pages.dev`, promoted to the stable project URL above.

See `LIVE_QUOTE.md` for source and formula details and `LIVE_EVALUATIONS.md` for the timestamped real-address smoke evidence.
