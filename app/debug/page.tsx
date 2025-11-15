"use client";

import { useEffect, useState } from "react";

export default function DebugPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/carparks")
      .then(res => res.json())
      .then(data => {
        console.log("Fetched data:", data.length, "items");
        setData(data);
      })
      .catch(err => {
        console.error("Fetch error:", err);
        setError(err.message);
      });
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Debug Page</h1>

      <div className="mb-4">
        <h2 className="text-xl font-semibold">Environment Variables:</h2>
        <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded">
          API_KEY: {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.substring(0, 10)}...
          {"\n"}API_KEY_LENGTH: {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.length}
          {"\n"}MAP_ID: {process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID}
          {"\n"}MAP_ID_LENGTH: {process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?.length}
          {"\n"}MAP_ID_TRIMMED: {process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim()}
          {"\n"}MAP_ID_TRIMMED_LENGTH: {process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim().length}
        </pre>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 dark:bg-red-900 rounded">
          <h2 className="text-xl font-semibold">Error:</h2>
          <p>{error}</p>
        </div>
      )}

      {data && (
        <div className="mb-4">
          <h2 className="text-xl font-semibold">API Data:</h2>
          <p className="mb-2">Total carparks: {data.length}</p>
          <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded overflow-auto max-h-96">
            {JSON.stringify(data.slice(0, 3), null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
