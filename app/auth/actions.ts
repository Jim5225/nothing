"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// ─── Login ────────────────────────────────────────────────────────────────────

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    redirect("/login?error=Email+and+password+are+required");
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Do not expose the raw Supabase error message to the user.
    // Log the real error server-side and show a generic message.
    console.error("[auth/login]", error.message);
    redirect("/login?error=Invalid+email+or+password");
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

// ─── Signup ───────────────────────────────────────────────────────────────────

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!email || !password) {
    redirect("/signup?error=Email+and+password+are+required");
  }

  if (password !== confirmPassword) {
    redirect("/signup?error=Passwords+do+not+match");
  }

  if (password.length < 8) {
    redirect("/signup?error=Password+must+be+at+least+8+characters");
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // After email confirmation, redirect to the auth callback handler
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });

  if (error) {
    console.error("[auth/signup]", error.message);

    // Avoid leaking whether an email is already registered
    if (error.message.toLowerCase().includes("already registered")) {
      redirect("/signup?error=An+account+with+this+email+already+exists");
    }

    redirect("/signup?error=Could+not+create+account.+Please+try+again");
  }

  // Supabase may require email confirmation depending on project settings.
  // If email confirmation is disabled, the user is signed in immediately.
  redirect("/signup?message=Check+your+email+to+confirm+your+account");
}

// ─── Sign Out ─────────────────────────────────────────────────────────────────

export async function signOut() {
  const supabase = await createClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("[auth/signOut]", error.message);
  }

  revalidatePath("/", "layout");
  redirect("/login");
}


