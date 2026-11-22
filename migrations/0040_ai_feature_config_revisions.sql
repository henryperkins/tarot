CREATE TABLE ai_feature_config_revisions (
  id INTEGER PRIMARY KEY,
  environment TEXT NOT NULL,
  feature_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  catalog_version TEXT NOT NULL,
  policy_json TEXT NOT NULL,
  diff_json TEXT NOT NULL,
  issued_token TEXT NOT NULL,
  mutation_id TEXT NOT NULL,
  request_digest TEXT NOT NULL,
  request_id TEXT NOT NULL,
  actor TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(environment, feature_id, revision),
  UNIQUE(environment, feature_id, mutation_id)
);
CREATE INDEX ai_feature_config_history ON ai_feature_config_revisions(environment, id DESC);
