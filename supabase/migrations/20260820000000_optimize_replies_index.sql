-- ============================================================
-- Veltrix Schema Migration
-- Phase 3: Optimizations
-- ============================================================

-- Add index on provider_message_id to prevent full table scans during reply syncing
CREATE INDEX IF NOT EXISTS replies_provider_message_id_idx ON public.replies(provider_message_id);
