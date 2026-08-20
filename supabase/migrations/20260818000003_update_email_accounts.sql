-- Migration: Update email_accounts table for Phase 4 Gmail integration

ALTER TABLE public.email_accounts
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN display_name TEXT,
  ADD COLUMN provider_account_id TEXT,
  ADD COLUMN access_token TEXT,
  ADD COLUMN refresh_token TEXT,
  DROP COLUMN IF EXISTS access_token_encrypted,
  DROP COLUMN IF EXISTS refresh_token_encrypted,
  DROP COLUMN IF EXISTS token_expires_at,
  ADD COLUMN token_expires_at BIGINT;

-- Remove the old JSONB credentials column as per Phase 4 strict schema
ALTER TABLE public.email_accounts DROP COLUMN IF EXISTS credentials;
