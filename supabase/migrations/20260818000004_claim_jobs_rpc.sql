-- Migration: RPC for atomic job claiming in Phase 6

CREATE OR REPLACE FUNCTION public.claim_email_jobs(batch_size INT)
RETURNS SETOF public.email_jobs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  claimed_job_ids UUID[];
BEGIN
  -- Select jobs that are queued and scheduled, locking them to prevent concurrent claims
  WITH selected_jobs AS (
    SELECT id
    FROM public.email_jobs
    WHERE status = 'queued'
      AND scheduled_at <= NOW()
    ORDER BY scheduled_at ASC, created_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.email_jobs
  SET 
    status = 'processing',
    started_at = NOW(),
    updated_at = NOW(),
    attempt_count = attempt_count + 1
  WHERE id IN (SELECT id FROM selected_jobs)
  RETURNING id INTO claimed_job_ids;

  -- Return the claimed jobs fully
  RETURN QUERY
  SELECT *
  FROM public.email_jobs
  WHERE id = ANY(claimed_job_ids);
END;
$$;
