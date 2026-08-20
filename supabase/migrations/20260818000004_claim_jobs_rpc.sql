-- Migration: RPC for atomic job claiming in Phase 6

CREATE OR REPLACE FUNCTION public.claim_email_jobs(batch_size INT)
RETURNS SETOF public.email_jobs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH selected_jobs AS (
    SELECT id
    FROM public.email_jobs
    WHERE status = 'queued'
      AND scheduled_at <= NOW()
    ORDER BY scheduled_at ASC, created_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.email_jobs e
  SET 
    status = 'processing',
    started_at = NOW(),
    updated_at = NOW(),
    attempt_count = e.attempt_count + 1
  FROM selected_jobs s
  WHERE e.id = s.id
  RETURNING e.*;
END;
$$;
