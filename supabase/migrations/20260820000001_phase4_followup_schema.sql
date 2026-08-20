-- ============================================================
-- Veltrix Schema Migration
-- Phase 4: Follow-ups and Analytics
-- ============================================================

-- Add thread tracking and follow-up states to campaign_recipients
ALTER TABLE public.campaign_recipients 
  ADD COLUMN IF NOT EXISTS provider_thread_id TEXT,
  ADD COLUMN IF NOT EXISTS follow_up_step INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS follow_up_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_detail TEXT;

-- Add job type to email_jobs to differentiate initial vs follow-up
ALTER TABLE public.email_jobs
  ADD COLUMN IF NOT EXISTS job_type TEXT NOT NULL DEFAULT 'initial';

-- Add follow-up configuration to campaigns
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS follow_up_1_template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS follow_up_1_delay_days INT,
  ADD COLUMN IF NOT EXISTS follow_up_2_template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS follow_up_2_delay_days INT;

-- Index for fast thread lookups during inbox sync
CREATE INDEX IF NOT EXISTS campaign_recipients_thread_idx ON public.campaign_recipients(provider_thread_id);

-- Index for email jobs by provider message ID
CREATE INDEX IF NOT EXISTS email_jobs_provider_message_idx ON public.email_jobs(provider_message_id);
