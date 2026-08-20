-- ============================================================
-- Veltrix Schema Migration
-- Phase 1: Core Business Entities
-- ============================================================

-- ── ENUMS ───────────────────────────────────────────────────────────────────

CREATE TYPE public.campaign_status AS ENUM (
  'draft', 'ready', 'approved', 'sending', 'paused', 'completed', 'cancelled'
);

CREATE TYPE public.recipient_status AS ENUM (
  'pending', 'ready', 'queued', 'sending', 'sent', 'failed', 'replied', 'stopped', 'bounced', 'unsubscribed'
);

CREATE TYPE public.email_job_status AS ENUM (
  'queued', 'processing', 'sent', 'failed', 'cancelled'
);

CREATE TYPE public.meeting_status AS ENUM (
  'scheduled', 'completed', 'cancelled', 'no_show'
);

-- ── LEADS ───────────────────────────────────────────────────────────────────

CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  email TEXT,
  normalized_email TEXT NOT NULL,
  job_title TEXT,
  company_name TEXT,
  company_domain TEXT,
  phone TEXT,
  linkedin_url TEXT,
  website_url TEXT,
  location TEXT,
  industry TEXT,
  source TEXT,
  source_record_id TEXT,
  custom_fields JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Prevent duplicate emails within the same workspace
  CONSTRAINT leads_workspace_email_unique UNIQUE (workspace_id, normalized_email)
);

CREATE INDEX leads_workspace_idx ON public.leads(workspace_id);
CREATE INDEX leads_normalized_email_idx ON public.leads(workspace_id, normalized_email);

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_workspace_access" ON public.leads
  FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

-- ── LEAD IMPORTS ────────────────────────────────────────────────────────────

CREATE TABLE public.lead_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  total_rows INT NOT NULL DEFAULT 0,
  valid_rows INT NOT NULL DEFAULT 0,
  invalid_rows INT NOT NULL DEFAULT 0,
  duplicate_rows INT NOT NULL DEFAULT 0,
  imported_rows INT NOT NULL DEFAULT 0,
  failed_rows INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processing',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX lead_imports_workspace_idx ON public.lead_imports(workspace_id);

ALTER TABLE public.lead_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_imports_workspace_access" ON public.lead_imports
  FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

-- ── LEAD SUPPRESSION ────────────────────────────────────────────────────────

CREATE TABLE public.lead_suppression (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT lead_suppression_unique UNIQUE (workspace_id, email)
);

CREATE INDEX lead_suppression_workspace_email_idx ON public.lead_suppression(workspace_id, email);

ALTER TABLE public.lead_suppression ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_suppression_workspace_access" ON public.lead_suppression
  FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

-- ── EMAIL ACCOUNTS ──────────────────────────────────────────────────────────

CREATE TABLE public.email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  email_address TEXT NOT NULL,
  display_name TEXT,
  provider_account_id TEXT,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT email_accounts_workspace_email_unique UNIQUE (workspace_id, email_address)
);

CREATE INDEX email_accounts_workspace_idx ON public.email_accounts(workspace_id);

CREATE TRIGGER email_accounts_updated_at
  BEFORE UPDATE ON public.email_accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_accounts_workspace_access" ON public.email_accounts
  FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

-- ── EMAIL TEMPLATES ─────────────────────────────────────────────────────────

CREATE TABLE public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX email_templates_workspace_idx ON public.email_templates(workspace_id);

CREATE TRIGGER email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_templates_workspace_access" ON public.email_templates
  FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

-- ── CAMPAIGNS ───────────────────────────────────────────────────────────────

CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status public.campaign_status NOT NULL DEFAULT 'draft',
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  email_account_id UUID REFERENCES public.email_accounts(id) ON DELETE SET NULL,
  booking_url TEXT,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX campaigns_workspace_idx ON public.campaigns(workspace_id);

CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaigns_workspace_access" ON public.campaigns
  FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

-- ── CAMPAIGN RECIPIENTS ─────────────────────────────────────────────────────

CREATE TABLE public.campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  status public.recipient_status NOT NULL DEFAULT 'pending',
  rendered_subject TEXT,
  rendered_body TEXT,
  approved_snapshot JSONB,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,
  stop_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT campaign_recipients_unique UNIQUE (campaign_id, lead_id)
);

CREATE INDEX campaign_recipients_campaign_idx ON public.campaign_recipients(campaign_id);
CREATE INDEX campaign_recipients_lead_idx ON public.campaign_recipients(lead_id);
CREATE INDEX campaign_recipients_workspace_idx ON public.campaign_recipients(workspace_id);

CREATE TRIGGER campaign_recipients_updated_at
  BEFORE UPDATE ON public.campaign_recipients
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaign_recipients_workspace_access" ON public.campaign_recipients
  FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

-- ── EMAIL JOBS ──────────────────────────────────────────────────────────────

CREATE TABLE public.email_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_recipient_id UUID NOT NULL REFERENCES public.campaign_recipients(id) ON DELETE CASCADE,
  status public.email_job_status NOT NULL DEFAULT 'queued',
  attempt_count INT NOT NULL DEFAULT 0,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  provider_message_id TEXT,
  last_error TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX email_jobs_workspace_idx ON public.email_jobs(workspace_id);
CREATE INDEX email_jobs_status_scheduled_idx ON public.email_jobs(status, scheduled_at);
CREATE INDEX email_jobs_recipient_idx ON public.email_jobs(campaign_recipient_id);

CREATE TRIGGER email_jobs_updated_at
  BEFORE UPDATE ON public.email_jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.email_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_jobs_workspace_access" ON public.email_jobs
  FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

-- ── EMAIL EVENTS ────────────────────────────────────────────────────────────

CREATE TABLE public.email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_recipient_id UUID NOT NULL REFERENCES public.campaign_recipients(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_event_id TEXT,
  event_type TEXT NOT NULL,
  event_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX email_events_recipient_idx ON public.email_events(campaign_recipient_id);
CREATE INDEX email_events_workspace_idx ON public.email_events(workspace_id);

ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_events_workspace_access" ON public.email_events
  FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

-- ── REPLIES ─────────────────────────────────────────────────────────────────

CREATE TABLE public.replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  campaign_recipient_id UUID REFERENCES public.campaign_recipients(id) ON DELETE SET NULL,
  provider_message_id TEXT,
  thread_id TEXT,
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX replies_workspace_idx ON public.replies(workspace_id);
CREATE INDEX replies_lead_idx ON public.replies(lead_id);
CREATE INDEX replies_campaign_idx ON public.replies(campaign_id);

ALTER TABLE public.replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "replies_workspace_access" ON public.replies
  FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

-- ── MEETINGS ────────────────────────────────────────────────────────────────

CREATE TABLE public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status public.meeting_status NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX meetings_workspace_idx ON public.meetings(workspace_id);
CREATE INDEX meetings_lead_idx ON public.meetings(lead_id);

CREATE TRIGGER meetings_updated_at
  BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meetings_workspace_access" ON public.meetings
  FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

-- ── ACTIVITY LOGS ───────────────────────────────────────────────────────────

CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX activity_logs_workspace_idx ON public.activity_logs(workspace_id);
CREATE INDEX activity_logs_created_idx ON public.activity_logs(created_at);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_logs_workspace_access" ON public.activity_logs
  FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));
