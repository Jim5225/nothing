# Veltrix

> AI-powered B2B outbound sales platform

Veltrix automates the full outbound pipeline — from lead import and AI personalization to campaign execution, reply detection, and meeting booking.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15+ (App Router), TypeScript, Tailwind CSS v4, shadcn/ui |
| Auth | Supabase Auth (`@supabase/ssr`, cookie-based) |
| Database | Supabase PostgreSQL with Row Level Security |
| Storage | Supabase Storage (future phases) |
| Hosting | Vercel |
| Repository | GitHub |

---

## Product Workflow (Planned)

```
Apollo / CSV
    → Lead Import
    → Lead Cleaning & Deduplication
    → Email Verification
    → AI Personalization
    → Campaigns
    → Email Sending
    → Automated Follow-ups
    → Reply Detection
    → Meeting Booking
    → CRM / Pipeline
    → Analytics
```

**Current phase:** Foundation & Authentication only.

---

## Prerequisites

- **Node.js** 18.17 or later (`node --version`)
- **npm** 9+ or **pnpm** 8+
- **Supabase CLI** ([installation guide](https://supabase.com/docs/guides/cli))
- A **Supabase** project ([supabase.com](https://supabase.com))

---

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/your-org/veltrix.git
cd veltrix
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example file and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

> **Security rules:**
> - Never commit `.env.local`
> - Never place server secrets in `NEXT_PUBLIC_*` variables
> - Never add the `SUPABASE_SERVICE_ROLE_KEY` to client-accessible code

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Supabase Setup

### Creating a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Choose a region close to your users.
3. Wait for the project to finish provisioning.

### Get your API credentials

In the Supabase Dashboard:

1. Go to **Project Settings → API**
2. Copy your:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Anon/Public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Link the Supabase CLI

```bash
# Install Supabase CLI (if not already installed)
# See: https://supabase.com/docs/guides/cli/getting-started

# Log in to Supabase
supabase login

# Link this project to your remote Supabase project
supabase link --project-ref your-project-ref
```

### Database Migrations

All schema changes live in `supabase/migrations/`. Never modify the production database manually without a corresponding migration file committed to Git.

#### Apply migrations locally (with local Supabase)

```bash
# Start local Supabase (requires Docker)
supabase start

# Apply all migrations fresh
supabase db reset
```

#### Create a new migration

```bash
supabase migration new <name>
# e.g.
supabase migration new add_leads_table
```

Then write your SQL in the generated file under `supabase/migrations/`.

#### Push migrations to production

```bash
supabase db push
```

> ⚠️ `supabase db push` applies pending migrations to the linked remote project. Review carefully before running against production.

### Auth Configuration (Supabase Dashboard)

1. **Site URL**: Set to your production URL (e.g., `https://veltrix.app`)
2. **Redirect URLs**: Add `https://your-domain.com/auth/callback`
3. **Email confirmations**: Configure as needed (disabled locally for easier testing)
4. **Password minimum length**: 8 characters (configured in `supabase/config.toml` locally)

---

## Vercel Deployment

### 1. Connect the GitHub repository

1. Go to [vercel.com](https://vercel.com) → **New Project**
2. Import your GitHub repository
3. Vercel auto-detects Next.js — no build configuration needed

### 2. Configure environment variables in Vercel

In your Vercel project dashboard → **Settings → Environment Variables**, add:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `NEXT_PUBLIC_SITE_URL` | Your Vercel deployment URL (e.g., `https://veltrix.app`) |

> Never add `SUPABASE_SERVICE_ROLE_KEY` unless it is explicitly required by a server-only feature in a future phase.

### 3. Deploy

Vercel automatically deploys on every push to `main`. Preview deployments are created for every pull request.

---

## Architecture Rules

### Provider-Agnostic Interfaces

Email sending, email verification, AI services, and lead sources must be implemented behind interfaces/contracts. The core business logic must never depend directly on a specific vendor SDK.

Examples:
```typescript
interface EmailSendingProvider { ... }
interface EmailVerificationProvider { ... }
interface AIProvider { ... }
interface LeadSourceProvider { ... }
```

### Workspace Isolation

All business data belongs to a **workspace**, not directly to a user.

- Users access data only through verified workspace membership.
- Workspace membership is always verified server-side and at the database (RLS) level.
- Client-supplied workspace IDs are never trusted without server-side membership validation.

### Row Level Security

Every user-owned or application table **must** have RLS enabled. Permissive policies (`USING (true)`) are never used without a documented security reason.

### No Secrets in Client Code

- Never place secrets in `NEXT_PUBLIC_*` variables.
- Never use `SUPABASE_SERVICE_ROLE_KEY` in client-side code or middleware accessible by the browser.
- The service-role key bypasses all RLS policies and is highly privileged.

### Migration-First Database Changes

- All schema changes must be stored as SQL files under `supabase/migrations/`.
- Never modify the production schema via the Supabase Dashboard SQL editor without a corresponding migration file.
- Migrations are applied to production via `supabase db push`.

### No Fake Production Functionality

- Never hardcode fake metrics that look like real production data.
- Zero-state values (e.g., Leads: 0) must reflect actual database state.
- Features that don't exist yet must be clearly labeled as unavailable/coming soon.

---

## Available Scripts

```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run start      # Start production server (after build)
npm run lint       # Run ESLint via Next.js
npm run typecheck  # Run TypeScript type checking (tsc --noEmit)
```

---

## Project Structure

```
app/
├── (auth)/             # Auth route group (unauthenticated)
│   ├── layout.tsx      # Centered auth layout
│   ├── login/          # Login page
│   └── signup/         # Signup page
├── auth/
│   ├── actions.ts      # Server Actions: login, signup, signout
│   └── callback/       # Auth code exchange route handler
├── dashboard/          # Protected dashboard (requires auth)
│   ├── layout.tsx      # Sidebar + TopNav layout with server-side auth guard
│   ├── page.tsx        # Dashboard overview (zero-state metrics)
│   ├── loading.tsx     # Loading skeleton
│   └── error.tsx       # Error boundary
├── settings/           # Protected settings (requires auth)
│   └── page.tsx
├── layout.tsx          # Root layout (Geist font, metadata)
├── page.tsx            # Root route (redirect or landing)
├── error.tsx           # Global error boundary
├── not-found.tsx       # 404 handler
└── globals.css         # Tailwind CSS + CSS variables

components/
├── ui/                 # shadcn/ui primitives (added as needed)
└── layout/
    ├── sidebar.tsx     # Application navigation sidebar
    ├── top-nav.tsx     # Top navigation bar
    └── user-menu.tsx   # User avatar and dropdown (incl. signout)

lib/
├── supabase/
│   ├── client.ts       # Browser client (createBrowserClient)
│   ├── server.ts       # Server client (createServerClient + cookies)
│   └── middleware.ts   # Session refresh + routing middleware helper
└── utils.ts            # cn() utility (clsx + tailwind-merge)

supabase/
├── config.toml         # Supabase CLI local configuration
└── migrations/
    └── 20260818000000_initial_schema.sql

middleware.ts           # Next.js root middleware
.env.example            # Environment variable template
```

---

## Database Schema

### Tables

| Table | Description |
|---|---|
| `public.profiles` | Extended user profile. One row per `auth.users` record. |
| `public.workspaces` | Tenant workspace. All business data belongs to a workspace. |
| `public.workspace_members` | Maps users to workspaces with a role (`owner`, `admin`, `member`). |

### Triggers

| Trigger | Description |
|---|---|
| `on_auth_user_created` | Auto-creates a `profiles` record on signup. |
| `on_auth_user_created_workspace` | Auto-creates a default workspace and owner membership on signup. |

### Helper Functions

| Function | Description |
|---|---|
| `is_workspace_member(uuid)` | Returns TRUE if current user is a member of the workspace. Used in RLS. |
| `has_workspace_role(uuid, role)` | Returns TRUE if current user has at least the given role. |

---

## Phase Roadmap

| Phase | Feature | Status |
|---|---|---|
| Phase 1 | Foundation & Auth | ✅ Current |
| Phase 2 | Lead Import & Cleaning | ⏳ Upcoming |
| Phase 3 | Email Verification | ⏳ Upcoming |
| Phase 4 | AI Personalization | ⏳ Upcoming |
| Phase 5 | Campaigns & Sending | ⏳ Upcoming |
| Phase 6 | Reply Detection & CRM | ⏳ Upcoming |
| Phase 7 | Analytics & Reporting | ⏳ Upcoming |
