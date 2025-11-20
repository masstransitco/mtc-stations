"use client";

import { useTheme } from "@/components/theme-provider";
import { Car } from "lucide-react";
import { useEffect, useState } from "react";

interface VehicleSpecs {
  make: string;
  model: string;
  year: number;
  type: string;
  fuelType: string;
  transmission: string;
  seats: number;
  plate: string;
  imageUrl?: string | null;
  returnDate?: string;
  daysUntilAvailable?: number;
  nextBooking?: {
    pickupDate: string;
    returnDate: string;
    bookingNumber: string;
  } | null;
}

export default function AvailableDispatchCars() {
  const { isDarkMode } = useTheme();
  const [vehicles, setVehicles] = useState<VehicleSpecs[]>([]);
  const [upcomingVehicles, setUpcomingVehicles] = useState<VehicleSpecs[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        setLoading(true);
        setError(false);

        // Get today's date and 7 days from now
        const today = new Date();
        const sevenDaysLater = new Date();
        sevenDaysLater.setDate(today.getDate() + 7);

        const pickupDate = today.toISOString().split('T')[0];
        const dropoffDate = sevenDaysLater.toISOString().split('T')[0];

        const response = await fetch('/api/noah/vehicles/availability', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pickupDate,
            dropoffDate
          })
        });

        const data = await response.json();

        // Map available vehicles (currently available)
        const availableVehicles = data.availableVehicles
          ?.slice(0, 6)
          .map((v: any) => ({
            make: v.make,
            model: v.model,
            year: v.year,
            type: v.type || 'Vehicle',
            fuelType: v.fuelType || 'N/A',
            transmission: v.transmission || 'Automatic',
            seats: v.seats || 5,
            plate: v.plate,
            imageUrl: v.imageUrl,
            nextBooking: v.nextBooking
          })) || [];

        // Process upcoming available vehicles (from unavailable list)
        const upcomingList: VehicleSpecs[] = [];
        data.unavailableVehicles?.forEach((vehicle: any) => {
          if (vehicle.conflictingBooking?.returnDate) {
            const returnDate = new Date(vehicle.conflictingBooking.returnDate);
            const daysUntilAvailable = Math.ceil((returnDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            // Only include vehicles returning within the next 7 days
            if (daysUntilAvailable >= 0 && daysUntilAvailable <= 7) {
              upcomingList.push({
                make: vehicle.make,
                model: vehicle.model,
                year: vehicle.year,
                type: vehicle.type || 'Vehicle',
                fuelType: vehicle.fuelType || 'N/A',
                transmission: vehicle.transmission || 'Automatic',
                seats: vehicle.seats || 5,
                plate: vehicle.plate,
                imageUrl: vehicle.imageUrl,
                returnDate: vehicle.conflictingBooking.returnDate.split('T')[0],
                daysUntilAvailable,
                nextBooking: vehicle.nextBooking
              });
            }
          }
        });

        // Sort by days until available and limit to 6
        upcomingList.sort((a, b) => (a.daysUntilAvailable || 0) - (b.daysUntilAvailable || 0));

        setVehicles(availableVehicles);
        setUpcomingVehicles(upcomingList.slice(0, 6));
      } catch (err) {
        console.error('Failed to fetch vehicles:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchVehicles();
  }, []);

  if (loading) {
    return (
      <div style={{
        padding: '16px',
        backgroundColor: isDarkMode ? '#065f4620' : '#d1fae540',
        borderRadius: '12px',
        border: `2px solid ${isDarkMode ? '#047857' : '#065f46'}`,
      }}>
        <div style={{
          textAlign: 'center',
          color: isDarkMode ? '#9ca3af' : '#6b7280',
          fontSize: '14px'
        }}>
          Loading available vehicles...
        </div>
      </div>
    );
  }

  if (error || vehicles.length === 0) {
    return (
      <div style={{
        padding: '16px',
        backgroundColor: isDarkMode ? '#065f4620' : '#d1fae540',
        borderRadius: '12px',
        border: `2px solid ${isDarkMode ? '#047857' : '#065f46'}`,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Car size={24} color="white" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: '16px',
              fontWeight: 600,
              color: isDarkMode ? '#f3f4f6' : '#111827',
              marginBottom: '4px'
            }}>
              Noah Dispatch Available
            </div>
            <div style={{
              fontSize: '13px',
              color: isDarkMode ? '#9ca3af' : '#6b7280'
            }}>
              Contact Noah for vehicle availability
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderVehicleCard = (vehicle: VehicleSpecs, index: number) => (
    <div
      key={`${vehicle.plate}-${index}`}
      style={{
        backgroundColor: isDarkMode ? '#1f293780' : '#ffffff',
        borderRadius: '10px',
        padding: '10px',
        border: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        display: 'flex',
        gap: '12px',
        alignItems: 'center'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateX(2px)';
        e.currentTarget.style.boxShadow = isDarkMode
          ? '0 2px 8px rgba(0,0,0,0.3)'
          : '0 2px 8px rgba(0,0,0,0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateX(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Vehicle Image */}
      <div style={{
        width: '90px',
        height: '65px',
        flexShrink: 0,
        backgroundColor: isDarkMode ? '#111827' : '#f3f4f6',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {vehicle.imageUrl ? (
          <img
            src={vehicle.imageUrl}
            alt={`${vehicle.make} ${vehicle.model}`}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
        ) : (
          <Car size={28} style={{ color: isDarkMode ? '#4b5563' : '#9ca3af' }} />
        )}
        {/* Fuel Type Badge */}
        {vehicle.fuelType && (
          <div style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            padding: '2px 5px',
            borderRadius: '3px',
            fontSize: '8px',
            fontWeight: 600,
            backgroundColor: vehicle.fuelType === 'Electric'
              ? (isDarkMode ? '#065f46' : '#10b981')
              : (isDarkMode ? '#1f2937' : '#6b7280'),
            color: 'white'
          }}>
            {vehicle.fuelType}
          </div>
        )}
      </div>

      {/* Vehicle Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '13px',
          fontWeight: 600,
          color: isDarkMode ? '#f3f4f6' : '#111827',
          marginBottom: '3px',
          lineHeight: 1.2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {vehicle.make} {vehicle.model}
        </div>

        <div style={{
          fontSize: '11px',
          color: isDarkMode ? '#9ca3af' : '#6b7280',
          marginBottom: '6px'
        }}>
          {vehicle.year} • {vehicle.plate}
          {vehicle.daysUntilAvailable !== undefined && (
            <span style={{
              marginLeft: '6px',
              padding: '2px 6px',
              backgroundColor: isDarkMode ? '#065f46' : '#d1fae5',
              color: isDarkMode ? '#6ee7b7' : '#065f46',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 600
            }}>
              {vehicle.daysUntilAvailable === 0 ? 'Today' :
               vehicle.daysUntilAvailable === 1 ? 'Tomorrow' :
               `${vehicle.daysUntilAvailable} days`}
            </span>
          )}
        </div>

        {/* Next Booking Info */}
        {vehicle.nextBooking && (
          <div style={{
            fontSize: '10px',
            color: isDarkMode ? '#fbbf24' : '#d97706',
            marginBottom: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span>📅</span>
            <span>
              Next: {new Date(vehicle.nextBooking.pickupDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        )}

        {/* Specs Row */}
        <div style={{
          display: 'flex',
          gap: '6px',
          fontSize: '10px',
          color: isDarkMode ? '#9ca3af' : '#6b7280'
        }}>
          <span style={{
            padding: '3px 6px',
            backgroundColor: isDarkMode ? '#374151' : '#f3f4f6',
            borderRadius: '4px'
          }}>
            {vehicle.seats} seats
          </span>
          <span style={{
            padding: '3px 6px',
            backgroundColor: isDarkMode ? '#374151' : '#f3f4f6',
            borderRadius: '4px'
          }}>
            {vehicle.transmission}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{
      padding: '16px',
      backgroundColor: isDarkMode ? '#065f4620' : '#d1fae540',
      borderRadius: '12px',
      border: `2px solid ${isDarkMode ? '#047857' : '#065f46'}`,
    }}>
      {/* Available Now Section */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '16px',
        paddingBottom: '12px',
        borderBottom: `1px solid ${isDarkMode ? '#04785750' : '#065f4650'}`
      }}>
        <Car size={18} style={{ color: isDarkMode ? '#6ee7b7' : '#065f46' }} />
        <span style={{
          fontSize: '14px',
          fontWeight: 600,
          color: isDarkMode ? '#f3f4f6' : '#111827',
        }}>
          Available Now ({vehicles.length})
        </span>
      </div>

      {/* Available Vehicles List */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        {vehicles.map((vehicle, index) => renderVehicleCard(vehicle, index))}
      </div>

      {/* Upcoming Available Section */}
      {upcomingVehicles.length > 0 && (
        <>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '20px',
            marginBottom: '16px',
            paddingBottom: '12px',
            borderBottom: `1px solid ${isDarkMode ? '#04785750' : '#065f4650'}`
          }}>
            <Car size={18} style={{ color: isDarkMode ? '#6ee7b7' : '#065f46' }} />
            <span style={{
              fontSize: '14px',
              fontWeight: 600,
              color: isDarkMode ? '#f3f4f6' : '#111827',
            }}>
              Upcoming Available ({upcomingVehicles.length})
            </span>
          </div>

          {/* Upcoming Vehicles List */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            {upcomingVehicles.map((vehicle, index) => renderVehicleCard(vehicle, index))}
          </div>
        </>
      )}

      {/* Footer Note */}
      <div style={{
        marginTop: '12px',
        paddingTop: '12px',
        borderTop: `1px solid ${isDarkMode ? '#04785750' : '#065f4650'}`,
        fontSize: '11px',
        color: isDarkMode ? '#9ca3af' : '#6b7280',
        textAlign: 'center'
      }}>
        Contact Noah for booking and pricing
      </div>
    </div>
  );
}
