CREATE TABLE IF NOT EXISTS tableu_kv (
  namespace VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  kv_key VARBINARY(512) NOT NULL,
  value LONGTEXT NOT NULL,
  value_encoding VARCHAR(8) NOT NULL DEFAULT 'utf8',
  metadata LONGTEXT NULL,
  expires_at BIGINT NULL,
  PRIMARY KEY (namespace, kv_key),
  KEY tableu_kv_expiry (expires_at)
);
CREATE TABLE IF NOT EXISTS tableu_reading_jobs (
  id VARCHAR(128) COLLATE utf8mb4_bin PRIMARY KEY,
  state_json LONGTEXT NOT NULL,
  revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL,
  lease_owner VARCHAR(64) NULL,
  lease_expires_at BIGINT NULL,
  delete_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  INDEX tableu_reading_jobs_delete_at (delete_at)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
