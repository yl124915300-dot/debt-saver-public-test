# Public test audit

Status before deployment: deployment-ready, external account authorization pending.

## Checklist result

- READ-ONLY / TEST MODE banner: pass.
- Wallet connector, signing, approvals, broadcast, calldata, deployment, gas: absent.
- Real address live read: pass for Ethereum Morpho Blue through server-side public API.
- Live comparison quote: unavailable and fail-closed; real scans cannot emit QUOTE_READY.
- Demo: expired reviewed snapshot, block and historical labels visible.
- Anonymous funnel: D1 aggregate stages only; no wallet address or IP stored.
- Request size limit: 4 KiB.
- Anonymous-session rate limit: 12 evaluations per 10-minute window.
- Security headers: CSP, frame denial, MIME sniffing denial, referrer policy, permissions policy.
- Abuse/security contact: public GitHub issue tracker; warning not to include secrets or personal data.
- Tests: 10/10.
- Typecheck: pass.
- Production build: pass.
- Local desktop smoke: pass.
- Local mobile smoke at 390 × 844: pass, no horizontal overflow.
- Live debt scenario: pass.
- No supported debt scenario: pass.
- Invalid address scenario: pass/fail-closed.
- Reviewed demo and preview: pass; preview returns null calldata, signer request, and transaction.
- Browser console warnings/errors: 0.

## Production smoke protocol

Use ?smoke=1 so operator checks remain separate from the live and demo visitor funnels. Verify:

1. GET /api/health.
2. GET /api/funnel.
3. Real Morpho debt address.
4. Address with no supported debt.
5. Invalid address.
6. Reviewed snapshot and read-only preview.
7. Security headers.
8. Desktop and 390 × 844 mobile layout.
9. No console warnings/errors.

Production smoke records only smoke-scope events. It must not be reported as borrower traffic or revenue.
