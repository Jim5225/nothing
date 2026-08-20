import { ImportClient } from "./import-client";

export const metadata = {
  title: "Import Leads | Veltrix",
};

export default function ImportLeadsPage() {
  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import Leads</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload a CSV file from Apollo or another source to import your contacts.
        </p>
      </div>

      <ImportClient />
    </div>
  );
}
