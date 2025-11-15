export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">
          MTC Parking Vacancy API
        </h1>
        <p className="text-gray-600 mb-8">
          Hong Kong Government car park vacancy data ingestion service
        </p>
        <div className="bg-gray-100 p-6 rounded-lg max-w-2xl">
          <h2 className="text-xl font-semibold mb-4">Endpoints</h2>
          <ul className="text-left space-y-2">
            <li>
              <code className="bg-white px-2 py-1 rounded">
                GET /api/cron/carpark-vacancy
              </code>
              <p className="text-sm text-gray-600 mt-1">
                Fetch and ingest parking vacancy data (requires x-cron-secret header)
              </p>
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}
