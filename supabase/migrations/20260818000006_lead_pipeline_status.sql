-- Migration: Add status to leads for Pipeline tracking

ALTER TABLE public.leads
  ADD COLUMN status TEXT NOT NULL DEFAULT 'new';
