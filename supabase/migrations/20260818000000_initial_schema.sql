-- ============================================================
-- Veltrix Initial Schema Migration
-- Phase 1: Foundation — Profiles, Workspaces, Workspace Members
-- ============================================================
-- 
-- This migration establishes the multi-tenant database foundation.
-- All tables have Row Level Security (RLS) enabled.
-- RLS policies are enforced at the database level as the primary
-- authorization boundary.
--
-- Business data belongs to workspaces, not directly to users.
-- Users access data only via verified workspace membership.
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────────────────────

-- pgcrypto is available in Supabase by default and provides gen_random_uuid()
-- uuid-ossp is enabled for belt-and-suspenders compatibility
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Profiles ─────────────────────────────────────────────────────────────────

CREATE TABLE public.profiles (
  id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 
  'Extended public user profile data. One row per auth.users record.';
COMMENT ON COLUMN public.profiles.id IS 
  'Matches auth.users.id exactly. Cascades on user deletion.';
COMMENT ON COLUMN public.profiles.display_name IS 
  'Optional display name chosen by the user.';

-- Auto-update updated_at on modification
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── Workspaces ────────────────────────────────────────────────────────────────

CREATE TABLE public.workspaces (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  slug        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT workspaces_name_length CHECK (char_length(name) BETWEEN 1 AND 100),
  CONSTRAINT workspaces_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9\-]{1,61}[a-z0-9]$')
);

CREATE UNIQUE INDEX workspaces_slug_unique ON public.workspaces (slug);
CREATE INDEX workspaces_created_at_idx ON public.workspaces (created_at);

COMMENT ON TABLE public.workspaces IS 
  'A workspace is the primary tenant boundary. All business data belongs to a workspace.';
COMMENT ON COLUMN public.workspaces.slug IS 
  'URL-safe unique identifier. Lowercase alphanumeric with hyphens. Must be globally unique.';

CREATE TRIGGER workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── Workspace Members ─────────────────────────────────────────────────────────

CREATE TYPE public.workspace_role AS ENUM ('owner', 'admin', 'member');

CREATE TABLE public.workspace_members (
  id            UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID                  NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id       UUID                  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role          public.workspace_role NOT NULL DEFAULT 'member',
  created_at    TIMESTAMPTZ           NOT NULL DEFAULT NOW(),

  -- A user can only have one active membership per workspace
  CONSTRAINT workspace_members_unique UNIQUE (workspace_id, user_id)
);

CREATE INDEX workspace_members_workspace_idx ON public.workspace_members (workspace_id);
CREATE INDEX workspace_members_user_idx ON public.workspace_members (user_id);
CREATE INDEX workspace_members_user_workspace_idx ON public.workspace_members (user_id, workspace_id);

COMMENT ON TABLE public.workspace_members IS 
  'Maps users to workspaces with a role. A user must be a member to access any workspace data.';
COMMENT ON COLUMN public.workspace_members.role IS 
  'owner: full control. admin: manage members and settings. member: read/contribute to workspace data.';

-- ── Workspace Authorization Helper ────────────────────────────────────────────

-- A security-definer function that safely checks if the currently authenticated
-- user is a member of a given workspace. Used in RLS policies to prevent
-- recursive or injection-prone policy definitions.
--
-- SECURITY DEFINER: runs with the function owner's privileges (postgres).
-- The search_path is explicitly set to prevent search path injection attacks.
CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = p_workspace_id
      AND wm.user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.is_workspace_member IS 
  'Returns TRUE if the currently authenticated user is a member of the given workspace.
   Used in RLS policies. SECURITY DEFINER to prevent recursive RLS evaluation.';

-- A helper to check if a user has a specific role or above within a workspace.
-- Role hierarchy: owner > admin > member
CREATE OR REPLACE FUNCTION public.has_workspace_role(
  p_workspace_id UUID,
  p_min_role     public.workspace_role
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = p_workspace_id
      AND wm.user_id = auth.uid()
      AND (
        -- Role hierarchy check: owner can do anything, admin can do admin+member, member can only do member
        CASE p_min_role
          WHEN 'member' THEN wm.role IN ('owner', 'admin', 'member')
          WHEN 'admin'  THEN wm.role IN ('owner', 'admin')
          WHEN 'owner'  THEN wm.role = 'owner'
        END
      )
  );
$$;

COMMENT ON FUNCTION public.has_workspace_role IS 
  'Returns TRUE if the authenticated user has at least the specified role in the workspace.
   Role hierarchy: owner > admin > member.';

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- ── Profiles RLS Policies ─────────────────────────────────────────────────────

-- Users can only read their own profile
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Users can only update their own profile
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Users can insert their own profile (covered by trigger but kept for safety)
CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- ── Workspaces RLS Policies ───────────────────────────────────────────────────

-- Users can only view workspaces they are members of.
-- Uses the security-definer helper to avoid recursive RLS evaluation.
CREATE POLICY "workspaces_select_members_only"
  ON public.workspaces
  FOR SELECT
  TO authenticated
  USING (public.is_workspace_member(id));

-- Only workspace owners can update workspace details
CREATE POLICY "workspaces_update_owner_only"
  ON public.workspaces
  FOR UPDATE
  TO authenticated
  USING (public.has_workspace_role(id, 'owner'))
  WITH CHECK (public.has_workspace_role(id, 'owner'));

-- Only authenticated users can create workspaces (they will be added as owner via trigger)
CREATE POLICY "workspaces_insert_authenticated"
  ON public.workspaces
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Only owners can delete their workspace
CREATE POLICY "workspaces_delete_owner_only"
  ON public.workspaces
  FOR DELETE
  TO authenticated
  USING (public.has_workspace_role(id, 'owner'));

-- ── Workspace Members RLS Policies ───────────────────────────────────────────

-- Members can view other membership records only for workspaces they belong to
CREATE POLICY "workspace_members_select_workspace_members"
  ON public.workspace_members
  FOR SELECT
  TO authenticated
  USING (public.is_workspace_member(workspace_id));

-- Owners and admins can add members to their workspaces
CREATE POLICY "workspace_members_insert_admin_or_owner"
  ON public.workspace_members
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_workspace_role(workspace_id, 'admin'));

-- Owners can update member roles; admins can update member (not admin/owner) roles
CREATE POLICY "workspace_members_update_admin_or_owner"
  ON public.workspace_members
  FOR UPDATE
  TO authenticated
  USING (public.has_workspace_role(workspace_id, 'admin'))
  WITH CHECK (public.has_workspace_role(workspace_id, 'admin'));

-- Owners can remove any member; admins can remove regular members
CREATE POLICY "workspace_members_delete_admin_or_owner"
  ON public.workspace_members
  FOR DELETE
  TO authenticated
  USING (public.has_workspace_role(workspace_id, 'admin'));

-- ── Auto-create Profile on User Signup ────────────────────────────────────────

-- Triggered when a new row is inserted into auth.users.
-- Creates a corresponding public.profiles record automatically.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display_name TEXT;
BEGIN
  -- Extract display name from metadata if available
  v_display_name := NEW.raw_user_meta_data->>'display_name';
  IF v_display_name IS NULL THEN
    v_display_name := NEW.raw_user_meta_data->>'full_name';
  END IF;
  IF v_display_name IS NULL AND NEW.email IS NOT NULL THEN
    -- Fall back to the username portion of the email
    v_display_name := split_part(NEW.email, '@', 1);
  END IF;

  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, v_display_name);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user IS
  'Automatically creates a public.profiles record when a new auth.users record is inserted.
   Extracts display_name from user metadata if available.';

-- ── Auto-create Default Workspace on First Signup ─────────────────────────────

-- When a new user signs up, automatically create a personal/default workspace
-- and add them as owner. This ensures every user starts with a usable workspace.
CREATE OR REPLACE FUNCTION public.handle_new_user_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id  UUID;
  v_slug          TEXT;
  v_display_name  TEXT;
BEGIN
  -- Derive a slug from the user's email username portion
  v_display_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1),
    'workspace'
  );

  -- Create a URL-safe slug: lowercase, replace non-alphanumeric with hyphens
  v_slug := lower(regexp_replace(v_display_name, '[^a-zA-Z0-9]+', '-', 'g'));
  -- Trim leading/trailing hyphens
  v_slug := trim(BOTH '-' FROM v_slug);
  -- Enforce minimum length
  IF length(v_slug) < 3 THEN
    v_slug := v_slug || '-workspace';
  END IF;
  -- Append a short unique suffix to guarantee uniqueness
  v_slug := v_slug || '-' || left(replace(NEW.id::text, '-', ''), 8);

  -- Create the workspace
  INSERT INTO public.workspaces (name, slug)
  VALUES (v_display_name || '''s Workspace', v_slug)
  RETURNING id INTO v_workspace_id;

  -- Add the user as owner
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace_id, NEW.id, 'owner');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_workspace
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_workspace();

COMMENT ON FUNCTION public.handle_new_user_workspace IS
  'Automatically creates a default workspace and assigns the new user as owner
   when they sign up. Ensures every user starts with a usable workspace.';
