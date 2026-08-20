export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand mark */}
        <div className="mb-8 text-center">
          <span className="text-2xl font-semibold tracking-tight text-gray-900">
            Veltrix
          </span>
          <p className="mt-1 text-sm text-gray-500">
            AI-powered outbound sales
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
