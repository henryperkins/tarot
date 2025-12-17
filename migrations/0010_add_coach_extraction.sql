-- Migration: 0010_add_coach_extraction
-- Purpose: Add columns for pre-computed coach suggestion data (AI-extracted steps + embeddings)
--
-- This enables semantic clustering of recurring themes across readings without
-- running AI inference on every journal page load. Steps and embeddings are
-- extracted once when a reading is saved, then assembled client-side.
--
-- Backward compatible: NULL for entries created before this migration

-- ============================================================================
-- Add extracted_steps column
-- ============================================================================
-- JSON array of actionable next steps extracted from the narrative by AI
-- Example: ["Set a boundary around my time", "Practice clear communication"]

ALTER TABLE journal_entries ADD COLUMN extracted_steps TEXT;

-- ============================================================================
-- Add step_embeddings column
-- ============================================================================
-- JSON array of 768-dimensional embedding vectors (one per step)
-- Used for cosine similarity clustering on the client

ALTER TABLE journal_entries ADD COLUMN step_embeddings TEXT;

-- ============================================================================
-- Add extraction metadata column
-- ============================================================================
-- Tracks extraction version for schema evolution and re-extraction triggers
-- Example: "v1" or "v1:llama-3-8b"

ALTER TABLE journal_entries ADD COLUMN extraction_version TEXT;

-- ============================================================================
-- Migration Complete
-- ============================================================================
