"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service in the future
    console.error("[Dashboard Error]", error.message);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-50">
        <AlertTriangle className="w-6 h-6 text-red-500" />
      </div>
      <div className="text-center">
        <h2 className="text-base font-semibold text-gray-900">
          Something went wrong
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          An error occurred while loading the dashboard. Please try again.
        </p>
        {error.digest && (
          <p className="mt-1 text-xs text-gray-400">
            Error ID: {error.digest}
          </p>
        )}
      </div>
      <button
        onClick={reset}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        <RefreshCcw className="w-4 h-4" />
        Try again
      </button>
    </div>
  );
}
