import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pickupDate, dropoffDate } = body;

    if (!pickupDate || !dropoffDate) {
      return NextResponse.json(
        { error: 'pickupDate and dropoffDate are required' },
        { status: 400 }
      );
    }

    // Fetch availability data
    const availabilityResponse = await fetch(
      'https://noah.air.city/api/vehicles/availability',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pickupDate,
          dropoffDate
        }),
        cache: 'no-store',
      }
    );

    if (!availabilityResponse.ok) {
      throw new Error(`Noah API responded with status: ${availabilityResponse.status}`);
    }

    const availabilityData = await availabilityResponse.json();

    // Fetch vehicle details with images
    const statusResponse = await fetch(
      'https://noah.air.city/api/vehicles/status?timePeriod=30d',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    );

    if (!statusResponse.ok) {
      // If status endpoint fails, return availability data without images
      return NextResponse.json(availabilityData);
    }

    const statusData = await statusResponse.json();

    // Fetch future bookings
    const futureBookingsResponse = await fetch(
      'https://noah.air.city/api/vehicles/future-bookings',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    );

    let futureBookingsMap = new Map();
    if (futureBookingsResponse.ok) {
      const futureBookingsData = await futureBookingsResponse.json();
      futureBookingsData.vehicles?.forEach((vehicle: any) => {
        if (vehicle.id && vehicle.futureBookings && vehicle.futureBookings.length > 0) {
          futureBookingsMap.set(vehicle.id, vehicle.futureBookings);
        }
      });
    }

    // Create a map of vehicle IDs to image URLs
    const vehicleImageMap = new Map();
    statusData.vehicles?.forEach((vehicle: any) => {
      if (vehicle.id && vehicle.imageUrl) {
        vehicleImageMap.set(vehicle.id, vehicle.imageUrl);
      }
    });

    // Merge image URLs and future bookings into available vehicles
    const enhancedAvailableVehicles = availabilityData.availableVehicles?.map((vehicle: any) => {
      const futureBookings = futureBookingsMap.get(vehicle.id) || [];
      const nextBooking = futureBookings.length > 0 ? futureBookings[0] : null;

      return {
        ...vehicle,
        imageUrl: vehicleImageMap.get(vehicle.id) || vehicle.imageUrl,
        nextBooking: nextBooking ? {
          pickupDate: nextBooking.pickupDate,
          returnDate: nextBooking.returnDate,
          bookingNumber: nextBooking.bookingNumber
        } : null
      };
    }) || [];

    // Merge image URLs and future bookings into unavailable vehicles
    const enhancedUnavailableVehicles = availabilityData.unavailableVehicles?.map((vehicle: any) => {
      const futureBookings = futureBookingsMap.get(vehicle.id) || [];
      // Find the first booking after the current conflicting booking
      const currentReturnDate = vehicle.conflictingBooking?.returnDate
        ? new Date(vehicle.conflictingBooking.returnDate)
        : null;

      const nextBooking = futureBookings.find((booking: any) => {
        if (!currentReturnDate) return true;
        const bookingPickupDate = new Date(booking.pickupDate);
        return bookingPickupDate > currentReturnDate;
      });

      return {
        ...vehicle,
        imageUrl: vehicleImageMap.get(vehicle.id) || vehicle.imageUrl,
        nextBooking: nextBooking ? {
          pickupDate: nextBooking.pickupDate,
          returnDate: nextBooking.returnDate,
          bookingNumber: nextBooking.bookingNumber
        } : null
      };
    }) || [];

    // Return enhanced data
    return NextResponse.json({
      ...availabilityData,
      availableVehicles: enhancedAvailableVehicles,
      unavailableVehicles: enhancedUnavailableVehicles
    });

  } catch (error) {
    console.error('Error fetching availability from Noah API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vehicle availability from Noah API' },
      { status: 500 }
    );
  }
}
