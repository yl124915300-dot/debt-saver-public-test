---
name: debt-saver-direct-sales
description: Run consent-respecting intent discovery and evidence-backed DeFi debt-refinance outreach while keeping every wallet action user-controlled.
---

# Debt Saver Direct Sales

Use this workflow only for public, read-only borrower discovery and evidence-backed outreach. A demand signal is not permission to contact a person, and a historical opportunity is not a live quote.

## Intent Monitor layer

Run intent-first discovery before any wallet-first candidate work:

`DEMAND_DISCOVERY → INTENT_CLASSIFY → CHANNEL_RULE_CHECK → LANDING_MATCH → PUBLIC_REPLY_ELIGIBLE → RESPONSE_DRAFT/POST_IF_ALLOWED → VISIT/ADDRESS_SUBMITTED attribution`

Read only public web search results, public forums, and public GitHub issues/discussions. Never log in for monitoring, bypass CAPTCHA, scrape private or gated data, infer a person's identity from a wallet, or collect usernames/wallets for outreach.

Classify at least these intents:

- Aave borrow rate / high APY;
- Morpho vs Aave migration or refinance;
- Compound or Spark refinance;
- liquidation risk or health factor;
- repay or migrate debt.

Record source URL, observation timestamp, published timestamp when available, intent, protocol, urgency, reply eligibility and reason, and matched landing page. Do not record private data, wallet addresses, IP addresses, cookies, or personal profiles.

`PUBLIC_REPLY_ELIGIBLE` requires an explicit public reply entry, clearly permissive channel rules for a relevant tool link, high relevance, and no login requirement. If any rule is uncertain, if login is required, or if promotion is prohibited, do not draft or post; record the demand signal only. Post at most two replies in a run and never send DMs or bulk replies.

Landing attribution may use fixed `utm_source` labels and an anonymous random-session hash. It must not contain the source user's identity or the submitted wallet address.

## Required states

Record only evidence-backed states:

`TARGET_IDENTIFIED → PUBLIC_CONTACT_VERIFIED → LIVE_QUOTE_READY → OUTREACH_SENT → REPLY_RECEIVED → INTEREST_CONFIRMED`

States are candidate-specific. Never infer a later state from an earlier one. A public identity without a suitable public business-contact channel does not qualify for `PUBLIC_CONTACT_VERIFIED`. A sent message does not imply a reply or interest.

Partner distribution remains separate. Existing Rabby and Zerion `PARTNER_REACHED` events stay valid, but direct sales does not wait for them.

## Candidate selection

1. Rank strict, same-chain, same-loan-asset routes by borrower net saving, then transparent fee value.
2. Review the Top 100 first and deduplicate by borrower entity.
3. Use only voluntary public association: ENS records/profile, verified Farcaster or Lens address association, an official DAO/project treasury page, official website, or official GitHub repository.
4. Do not use brokers, leaks, reverse-email services, private social engineering, inferred names, or wallet-cluster guesses.
5. For an individual with only a social profile and no clear business-contact invitation, stop without outreach.

## Public contact verification

`PUBLIC_CONTACT_VERIFIED` requires both a reproducible public association and an official public business-contact route whose stated purpose reasonably permits the message. Do not substitute a similarly named company, misuse a generic form, or treat a social profile as commercial permission. Skip login, CAPTCHA, verification, or access barriers.

## Live quote gate

Re-read the current debt and destination market from public sources. Recompute debt, current and destination APY, gross saving, gas, flash-liquidity fee, slippage, protocol costs, success fee, borrower net saving, and break-even days.

Fail closed if any source is stale or unavailable, liquidity/LTV/caps are unsupported, post-trade impact is missing, route assets differ, or net saving is not clearly positive. Never produce broadcastable calldata.

## Outreach message

Send at most one concise message per entity and at most five in one run. State the public association, live route assumptions, modeled saving and costs, transparent fee, expiry, and read-only/non-custodial/no-prepayment boundary. Invite a reply, not a wallet connection or signature.

## Authority boundary

Do not connect a wallet, request or collect a signature, provide broadcastable calldata, deploy a contract, broadcast a transaction, or spend gas. After an explicit interested reply, return to a fresh quote and production-deployment review gate.
