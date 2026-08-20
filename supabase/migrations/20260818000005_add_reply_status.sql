-- Migration: Add is_read and is_interested to replies

ALTER TABLE public.replies
  ADD COLUMN is_read BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN is_interested BOOLEAN NOT NULL DEFAULT FALSE;
