# Autter source map and dependency audit

Primary upstream: https://github.com/Autter-dev/agentic-sales-skills

- audited commit: `ed5191cb340be3100c9c7f33ed54584eea1f7823`;
- maintenance snapshot: 3 commits in repository history; latest commit `Update Agentic Skills for Sales Processes` dated 2026-04-27. This is a small, low-history source rather than a versioned runtime package;
- license: MIT, copyright 2026 Autter.dev; the required license text is preserved in `LICENSE`;
- repository shape: five numbered sales-stage directories plus `general`; skills and conversational agents are Markdown `SKILL.md` files;
- runtime dependencies for the selected material: none. The source skills mention optional web, CRM, email, and calendar integrations, but the adapted Revenue Agent does not require or invoke them;
- update approach: no whole-repository copy and no source runtime. Only the decision rules listed below were adapted into the unified skill and typed evaluator.

## Selected mapping

| Upstream source | Debt Saver adaptation |
| --- | --- |
| `02-prospecting-and-outreach/research/skills/intent-signal-monitor/SKILL.md` | Explicit borrower intent, signal strength, source freshness, and signal decay |
| `02-prospecting-and-outreach/research/skills/lead-scoring/SKILL.md` | Transparent opportunity score from stage, intent, verified economics, and missing-data risk |
| `02-prospecting-and-outreach/agents/sdr-agent/SKILL.md` | One prioritized next action; lead/prospect becomes borrower/opportunity; autonomous outreach removed |
| `03-meetings-and-demos/skills/objection-handler/SKILL.md` | LAER structure specialized to security, trust, fee, timing, and no-edge objections |
| `02-prospecting-and-outreach/outreach/skills/follow-up-cadence/SKILL.md` | Value-adding recommendation/draft only after opt-in and quote engagement; all sending removed |
| `04-proposals-and-close/skills/deal-risk-analyzer/SKILL.md` | Evidence-backed risk reasons and a single de-risking action; meeting/proposal/close mapped to quote/review/execution/fee |

## Reference-only comparison

The older “Meshpilot” reference currently resolves on GitHub to https://github.com/Nuraveda-Labs/ai-sales-agent (audited commit `e87c79471cdc09765e070fe634c04f50997930b7`, 2026-05-27, MIT). Its human-in-the-loop draft approval pattern supports the decision to keep all follow-up output draft-only. None of its Python service, database, email, Discord, Resend, or scheduling dependencies were copied or added.
