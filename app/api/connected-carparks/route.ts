import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

export const dynamic = "force-dynamic";
export const revalidate = 0; // Disable all caching

// Simple CSV parser that handles quoted fields
function parseCSV(csvContent: string): any[] {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const record: any = {};
    headers.forEach((header, index) => {
      record[header] = values[index] || '';
    });
    records.push(record);
  }

  return records;
}

function parseCSVLine(line: string): string[] {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

export async function GET() {
  try {
    // Read the connected carparks CSV file
    const csvPath = path.join(process.cwd(), "connected-carparks-formatted.csv");
    const fileContent = fs.readFileSync(csvPath, "utf-8");

    // Parse CSV
    const records = parseCSV(fileContent);

    // Transform to expected format
    const carparks = records.map((record: any) => ({
      park_id: record.park_id,
      name: record.name,
      address: record.address,
      district: record.district || "",
      latitude: parseFloat(record.latitude),
      longitude: parseFloat(record.longitude),
    }));

    return NextResponse.json(carparks, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("Error reading connected carparks:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
