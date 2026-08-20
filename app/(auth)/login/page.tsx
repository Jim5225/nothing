"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { login } from "@/app/auth/actions";
import { Loader2 } from "lucide-react";

// useSearchParams() must be inside a component wrapped in <Suspense>
function LoginForm() {
  const searchParams = useSearchParams();
  const errorMessage = searchParams.get("error");
  const successMessage = searchParams.get("message");

  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    await login(formData);
    // Redirect is handled server-side; pending stays true until navigation
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Welcome back</h1>
        <p className="mt-1 text-sm text-gray-500">
          Sign in to your Veltrix account
        </p>
      </div>

      {errorMessage && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm text-red-700">
            {decodeURIComponent(errorMessage)}
          </p>
        </div>
      )}

      {successMessage && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3">
          <p className="text-sm text-green-700">
            {decodeURIComponent(successMessage)}
          </p>
        </div>
      )}

      <form action={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            disabled={pending}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500 transition"
            placeholder="you@company.com"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            {/* TODO: Implement forgot password flow in a future phase */}
            <span className="text-xs text-gray-400">
              Forgot password? (coming soon)
            </span>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={pending}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500 transition"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {pending ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-medium text-blue-600 hover:text-blue-700"
        >
          Sign up for free
        </Link>
      </p>
    </div>
  );
}

// Page wraps the form in Suspense as required when using useSearchParams()
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 animate-pulse">
          <div className="h-6 w-40 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-56 bg-gray-100 rounded mb-6" />
          <div className="space-y-4">
            <div className="h-10 bg-gray-100 rounded-lg" />
            <div className="h-10 bg-gray-100 rounded-lg" />
            <div className="h-10 bg-blue-100 rounded-lg" />
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
