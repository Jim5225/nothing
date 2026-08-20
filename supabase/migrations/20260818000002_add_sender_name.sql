-- Migration: Add sender_name to campaigns

ALTER TABLE public.campaigns 
ADD COLUMN sender_name TEXT;
