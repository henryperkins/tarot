-- Migration: add hallucination metrics columns to eval_metrics
-- Supports minimal payload storage while keeping aggregate metrics available.

ALTER TABLE eval_metrics ADD COLUMN hallucinated_cards TEXT;
ALTER TABLE eval_metrics ADD COLUMN hallucination_count INTEGER;
