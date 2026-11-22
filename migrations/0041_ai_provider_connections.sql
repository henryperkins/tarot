CREATE TABLE ai_provider_connections (
  environment TEXT NOT NULL CHECK (environment IN ('local', 'preview', 'production')),
  provider_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  source TEXT NOT NULL CHECK (source IN ('deployment', 'portal', 'disconnected')),
  iv TEXT,
  ciphertext TEXT,
  PRIMARY KEY (environment, provider_id),
  CHECK (
    (source = 'portal' AND iv IS NOT NULL AND ciphertext IS NOT NULL) OR
    (source <> 'portal' AND iv IS NULL AND ciphertext IS NULL)
  )
);
