"use client";

import { APIProvider, Map, AdvancedMarker } from "@vis.gl/react-google-maps";
import { useEffect, useState } from "react";

export default function MapTestPage() {
  const [mounted, setMounted] = useState(false);
  const [carparks, setCarparks] = useState<any[]>([]);

  const apiKey = (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "").trim();
  const mapId = (process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "").trim();

  // Hong Kong center
  const center = { lat: 22.3193, lng: 114.1694 };

  useEffect(() => {
    setMounted(true);
    console.log("Map page mounted", { apiKey: apiKey.substring(0, 10) + "...", mapId });
  }, []);

  useEffect(() => {
    if (!mounted) return;

    fetch("/api/carparks")
      .then(res => res.json())
      .then(data => {
        console.log("Fetched", data.length, "carparks");
        setCarparks(data);
      })
      .catch(err => console.error("Fetch error:", err));
  }, [mounted]);

  if (!mounted) {
    return <div className="p-8">Loading...</div>;
  }

  if (!apiKey) {
    return <div className="p-8 text-red-500">Missing API Key</div>;
  }

  return (
    <div className="w-screen h-screen bg-gray-200">
      <div className="p-4 bg-white border-b">
        <h1 className="text-xl font-bold">Fresh Map Test</h1>
        <p className="text-sm text-gray-600">
          API Key: {apiKey.substring(0, 15)}... | Map ID: {mapId} | Carparks: {carparks.length}
        </p>
      </div>

      <div style={{ width: "100%", height: "calc(100vh - 80px)" }}>
        <APIProvider apiKey={apiKey}>
          <Map
            defaultCenter={center}
            defaultZoom={11}
            mapId={mapId}
            style={{ width: "100%", height: "100%" }}
            onCameraChanged={(ev) => console.log("Camera:", ev.detail.center, "Zoom:", ev.detail.zoom)}
          >
            {carparks.slice(0, 10).map((carpark) => (
              <AdvancedMarker
                key={carpark.park_id}
                position={{ lat: carpark.latitude, lng: carpark.longitude }}
              >
                <div style={{
                  background: "red",
                  color: "white",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  fontSize: "12px",
                  fontWeight: "bold"
                }}>
                  {carpark.vacancy}
                </div>
              </AdvancedMarker>
            ))}
          </Map>
        </APIProvider>
      </div>
    </div>
  );
}
