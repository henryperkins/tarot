CREATE TRIGGER tableu_narration_reserve BEFORE INSERT ON narration_requests
FOR EACH ROW
BEGIN
  DECLARE current_usage BIGINT;
  IF NEW.state = 'reserved' THEN
    SELECT used + reserved INTO current_usage FROM narration_monthly_usage
      WHERE identity = NEW.identity AND month = NEW.month FOR UPDATE;
    IF NEW.monthly_limit >= 0 AND current_usage >= NEW.monthly_limit THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'narration_monthly_limit';
    END IF;
    UPDATE narration_monthly_usage SET reserved = reserved + 1
      WHERE identity = NEW.identity AND month = NEW.month;
  END IF;
END
