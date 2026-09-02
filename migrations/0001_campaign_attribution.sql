CREATE TABLE funnel_events_campaign_attribution (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event TEXT NOT NULL CHECK (event IN (
    'LANDING_VISIT',
    'VISITOR',
    'ADDRESS_SUBMITTED',
    'DEBT_FOUND',
    'QUOTE_READY',
    'QUOTE_VIEWED',
    'REVIEW_REQUESTED'
  )),
  scope TEXT NOT NULL CHECK (scope IN ('live', 'demo', 'smoke')),
  day TEXT NOT NULL,
  session_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

INSERT INTO funnel_events_campaign_attribution (id, event, scope, day, session_hash, created_at)
SELECT id, event, scope, day, session_hash, created_at FROM funnel_events;

DROP TABLE funnel_events;
ALTER TABLE funnel_events_campaign_attribution RENAME TO funnel_events;

CREATE UNIQUE INDEX funnel_unique_session_stage
ON funnel_events (scope, event, session_hash);

CREATE INDEX funnel_by_scope_event
ON funnel_events (scope, event);

CREATE TABLE funnel_attribution_campaign (
  event TEXT NOT NULL,
  scope TEXT NOT NULL,
  source TEXT NOT NULL,
  landing_intent TEXT NOT NULL DEFAULT 'main',
  medium TEXT NOT NULL DEFAULT 'none',
  campaign TEXT NOT NULL DEFAULT 'none',
  day TEXT NOT NULL,
  session_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(scope, event, session_hash)
);

INSERT OR IGNORE INTO funnel_attribution_campaign
  (event, scope, source, day, session_hash, created_at)
SELECT event, scope, source, day, session_hash, created_at
FROM funnel_attribution
ORDER BY created_at;

DROP TABLE funnel_attribution;
ALTER TABLE funnel_attribution_campaign RENAME TO funnel_attribution;

CREATE INDEX funnel_attribution_by_scope_campaign
ON funnel_attribution (scope, source, campaign, event);
