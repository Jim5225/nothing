import Link from "next/link";
import { Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-gray-100">
          <Search className="w-7 h-7 text-gray-400" />
        </div>
        <div>
          <h1 className="text-4xl font-bold text-gray-900">404</h1>
          <h2 className="mt-1 text-lg font-semibold text-gray-700">
            Page not found
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            The page you&apos;re looking for doesn&apos;t exist or has been
            moved.
          </p>
        </div>
        <Link
          href="/"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Home className="w-4 h-4" />
          Back to home
        </Link>
      </div>
    </div>
  );
}
