-- One local application owner. Keep revisions across unlink and account removal.
CREATE TABLE owner_subscription (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL CHECK (revision >= 0),
  owner_id TEXT REFERENCES users(id),
  provider_id TEXT CHECK (provider_id IN ('codex-subscription', 'claude-code')),
  CHECK ((owner_id IS NULL) = (provider_id IS NULL))
);
INSERT INTO owner_subscription (id, revision) VALUES (1, 0);

CREATE TRIGGER unlink_subscription_before_user_deletion BEFORE DELETE ON users
BEGIN
  UPDATE owner_subscription SET owner_id = NULL, provider_id = NULL, revision = revision + 1 WHERE owner_id = OLD.id;
END;
CREATE TRIGGER unlink_subscription_on_user_deactivation AFTER UPDATE OF is_active ON users
WHEN NEW.is_active = 0
BEGIN
  UPDATE owner_subscription SET owner_id = NULL, provider_id = NULL, revision = revision + 1 WHERE owner_id = NEW.id;
END;
