"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Global Error]", error.message);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-50">
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Something went wrong
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              An unexpected error occurred. Our team has been notified.
            </p>
            {error.digest && (
              <p className="mt-2 text-xs text-gray-400 font-mono">
                {error.digest}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={reset}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCcw className="w-4 h-4" />
              Try again
            </button>
            <Link
              href="/"
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Home className="w-4 h-4" />
              Home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
