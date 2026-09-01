# Live borrower evaluations

Production read-only evaluations against `https://debt-saver-public-test.pages.dev/api/evaluate`, recorded 2026-09-01 16:03 UTC. These are public-chain addresses and are never written to Debt Saver analytics. All three used the live Morpho index plus fixed-block Aave V3 Ethereum contract reads; no historical snapshot was used as current data.

| Borrower | Aave block | Current debt | Morpho APY | Aave variable APY | 90d gross | Costs | Borrower net | Break-even | Post HF | Result |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| `0x56eCBF8844bD7a64dc661EC41D52005D4E224adc` | 25,883,503 | $36,039,965.96 | 4.662167% | 4.083480% | $49,793.67 | $4,979.87 | $44,813.79 | 9.00d | 1.6660 | `LIVE_QUOTE_READY` |
| `0x5130985cE6A0e54f369712Cd6f2fDEC084026E54` | 25,883,504 | $20,280,518.21 | 4.662167% | 4.083478% | $28,020.10 | $2,802.51 | $25,217.59 | 9.00d | 2.0117 | `LIVE_QUOTE_READY` |
| `0x4a4C63984e57832728Ad2Fa7cFAc844246Cb3dE2` | 25,883,505 | $4,090,046.43 | 4.662167% | 4.083478% | $5,650.92 | $565.58 | $5,085.33 | 9.01d | 1.5931 | `LIVE_QUOTE_READY` |

Each quote verified sufficient Morpho singleton USDC balance and therefore used the free-flash path with $0 premium. Modeled gas was $0.49–$0.50, same-asset slippage and extra protocol fee were $0, and the remaining cost was the disclosed 10%-of-gross service-fee model. No fee was charged.

The historical Top 1 address remains covered by the expired fixed-block demo regression and independently passed the new live path. The live API result, rather than the historical values, is the current quote.

Negative production checks: malformed address → HTTP 400 `FAIL_CLOSED`; `0x0000000000000000000000000000000000000001` → `NO_SUPPORTED_DEBT`; security headers and the non-broadcastable boundary passed.
