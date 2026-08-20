-- Add suppressed_rows to lead_imports to distinguish from invalid_rows
ALTER TABLE public.lead_imports
ADD COLUMN suppressed_rows INT NOT NULL DEFAULT 0;
