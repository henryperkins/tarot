-- Scope keys bind a preference to its environment and subscription owner.
-- A new local link or a different hosted gateway starts with its own default.
CREATE TABLE personal_reading_models (
  scope_key TEXT PRIMARY KEY NOT NULL,
  model_id TEXT,
  revision INTEGER NOT NULL CHECK (revision > 0)
);
