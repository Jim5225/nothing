import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Zap, ArrowRight } from "lucide-react";

/**
 * Root landing page.
 * - If authenticated: redirect to /dashboard immediately.
 * - If unauthenticated: show a minimal product landing with login/signup CTA.
 */
export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex flex-col min-h-screen bg-white">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 h-16 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-blue-600">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-gray-900">
            Veltrix
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero section */}
      <section className="flex flex-col items-center justify-center flex-1 px-6 py-20 text-center">
        <div className="max-w-3xl space-y-6">
          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
            Early access
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 leading-tight">
            AI-powered outbound sales,{" "}
            <span className="text-blue-600">built to scale</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Veltrix automates your B2B outbound pipeline — from lead import and
            AI personalization to campaign execution, reply detection, and
            meeting booking.
          </p>
          <div className="flex items-center justify-center gap-4 pt-2">
            <Link
              href="/signup"
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors text-sm"
            >
              Start for free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="px-6 py-3 border border-gray-200 text-gray-700 font-medium rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-colors text-sm"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-6 border-t border-gray-100 text-center">
        <p className="text-xs text-gray-400">
          © {new Date().getFullYear()} Veltrix. All rights reserved.
        </p>
      </footer>
    </main>
  );
}
