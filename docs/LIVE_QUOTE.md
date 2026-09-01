# Live quote specification

Scope: Morpho Blue → Aave V3 Ethereum only. The public site remains read-only and never creates approvals, signatures, calldata, transactions, deployments, or gas spend.

## Verified sources

- Morpho official GraphQL API: exact borrow/collateral amounts, current market borrow APY, indexed block and timestamp.
- Aave V3 Ethereum PoolAddressesProvider: verifies the configured Pool and Oracle on each evaluation.
- Aave ProtocolDataProvider at one fixed Ethereum block: current variable borrow rate, reserve configuration, LTV, liquidation threshold, reserve totals, borrow/supply caps, isolation and silo flags.
- Aave Oracle at the same block: debt, collateral, and WETH/USD prices.
- Aave Pool and ERC-20 reads at the same block: Aave fallback flash premium and Morpho singleton asset balance for free-flash feasibility.
- `eth_gasPrice` plus a conservative 1,200,000-gas model. No transaction or calldata is constructed to obtain this estimate.

Deployment addresses are pinned from the Aave DAO address book, then the Pool and Oracle are dynamically verified through the official provider. PublicNode is primary RPC and LlamaNodes is fallback/head witness.

## Fail-closed gates

The API does not return `LIVE_QUOTE_READY` if data is stale or invalid; RPC heads disagree; the index lags by more than 50 blocks; Aave reserves are inactive, frozen, unsupported, isolated, or siloed; liquidity/cap headroom is insufficient; same-asset flash liquidity is insufficient; post-migration health factor is below 1.10; Aave APY is not lower; or modeled net saving is non-positive within 90 days.

## Economics

Gross saving is the difference between 90-day effective debt growth at the live Morpho APY and live Aave APY. Aave's on-chain variable APR (ray) is converted to an effective annual APY with `expm1(APR)`. Costs are flash premium, modeled gas, same-asset slippage ($0), extra protocol fee ($0), and the transparent service-fee policy. Break-even is total modeled cost divided by modeled daily gross saving. Post-migration health factor uses the Aave oracle collateral value and liquidation threshold.

All live responses carry source, block, and timestamp. Quotes expire five minutes after the fixed Aave block, or sooner when requested near the freshness boundary.
