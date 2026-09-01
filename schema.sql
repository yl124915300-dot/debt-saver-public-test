CREATE TABLE IF NOT EXISTS funnel_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event TEXT NOT NULL CHECK (event IN (
    'VISITOR',
    'ADDRESS_SUBMITTED',
    'WALLET_CONNECTED',
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

CREATE UNIQUE INDEX IF NOT EXISTS funnel_unique_session_stage
ON funnel_events (scope, event, session_hash);

CREATE INDEX IF NOT EXISTS funnel_by_scope_event
ON funnel_events (scope, event);

CREATE TABLE IF NOT EXISTS rate_windows (
  session_hash TEXT NOT NULL,
  window_id INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (session_hash, window_id)
);
