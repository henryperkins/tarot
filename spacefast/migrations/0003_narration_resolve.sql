CREATE TRIGGER tableu_narration_resolve AFTER UPDATE ON narration_requests
FOR EACH ROW
BEGIN
  IF OLD.state = 'reserved' AND NEW.state IN ('settled', 'released') THEN
    UPDATE narration_monthly_usage SET reserved = reserved - 1,
      used = used + CASE WHEN NEW.state = 'settled' THEN 1 ELSE 0 END
      WHERE identity = NEW.identity AND month = NEW.month;
    IF NEW.state = 'settled' AND NEW.user_id IS NOT NULL THEN
      INSERT INTO usage_tracking (user_id, month, tts_count, created_at, updated_at)
      VALUES (NEW.user_id, NEW.month, 1, NEW.updated_at, NEW.updated_at)
      ON DUPLICATE KEY UPDATE tts_count = tts_count + 1, updated_at = VALUES(updated_at);
    END IF;
  END IF;
END
