import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Creates a Supabase client suitable for use in:
 *  - Server Components
 *  - Server Actions
 *  - Route Handlers
 *
 * Reads and writes cookies via the Next.js App Router `cookies()` API.
 * Never uses the service-role key — uses the public anon key only.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method is called from a Server Component.
            // Cookies can only be set from Server Actions or Route Handlers.
            // This error is expected and can be safely ignored if the session
            // is refreshed via middleware.
          }
        },
      },
    }
  );
}
