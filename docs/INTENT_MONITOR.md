# Intent Monitor

The read-only monitor follows:

`DEMAND_DISCOVERY → INTENT_CLASSIFY → CHANNEL_RULE_CHECK → LANDING_MATCH → PUBLIC_REPLY_ELIGIBLE → RESPONSE_DRAFT/POST_IF_ALLOWED → VISIT/ADDRESS_SUBMITTED attribution`

It reads public search results, forums, and public GitHub issues/discussions without login. It does not bypass CAPTCHA, collect private data, identify wallet owners, or perform bulk outreach.

## Reply policy

A reply is eligible only when there is an explicit public reply entry, the channel rules clearly allow a relevant tool link, the match is high relevance, and no login is required. Any uncertainty becomes `record_only`. At most two replies may be published in a run, but the normal outcome is zero.

The initial read-only sample is in `intent-monitor/demand-signals.json`. It contains URLs and demand classifications only; no usernames, profiles, wallet addresses, IP addresses, cookies, or private data.

## Landing match and attribution

- `aave_high_borrow_rate` → `/aave-borrow-rate/` → `utm_source=intent_aave_borrow_rate`
- `morpho_aave_refinance` → `/morpho-vs-aave/` → `utm_source=intent_morpho_vs_aave`
- `compound_spark_refinance` → `/morpho-vs-aave/` → `utm_source=intent_morpho_vs_aave`
- `liquidation_health_factor` → `/defi-liquidation-risk/` → `utm_source=intent_liquidation_risk`
- `repay_migrate_debt` → `/defi-liquidation-risk/` → `utm_source=intent_liquidation_risk`

Landing visits and address submissions store only stage, scope, fixed source label, day, timestamp, and a hash of a random browser-session ID. They do not store the submitted address, IP address, cookie, or personal profile.
