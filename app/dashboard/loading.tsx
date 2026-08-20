export default function DashboardLoading() {
  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-pulse">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-7 w-64 bg-gray-200 rounded-lg" />
        <div className="h-4 w-80 bg-gray-100 rounded-lg" />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-gray-200 p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 bg-gray-100 rounded" />
              <div className="h-8 w-8 bg-gray-100 rounded-lg" />
            </div>
            <div className="h-8 w-16 bg-gray-200 rounded" />
            <div className="h-3 w-36 bg-gray-100 rounded" />
          </div>
        ))}
      </div>

      {/* Roadmap skeleton */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="h-5 w-36 bg-gray-200 rounded" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-5 w-20 bg-gray-100 rounded-full" />
            <div className="flex-1 h-4 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
