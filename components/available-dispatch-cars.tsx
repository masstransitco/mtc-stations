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
}

export default function AvailableDispatchCars() {
  const { isDarkMode } = useTheme();
  const [vehicles, setVehicles] = useState<VehicleSpecs[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        setLoading(true);
        setError(false);
        const response = await fetch('/api/noah/vehicles?timePeriod=30d');
        const data = await response.json();

        // Filter only available vehicles and limit to 6
        const availableVehicles = data.vehicles
          ?.filter((v: any) => v.currentStatus === 'available')
          .slice(0, 6)
          .map((v: any) => ({
            make: v.make,
            model: v.model,
            year: v.year,
            type: v.type || 'Vehicle',
            fuelType: v.fuelType || 'N/A',
            transmission: v.transmission || 'Automatic',
            seats: v.seats || 5,
            plate: v.plate,
            imageUrl: v.imageUrl
          })) || [];

        setVehicles(availableVehicles);
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

  return (
    <div style={{
      padding: '16px',
      backgroundColor: isDarkMode ? '#065f4620' : '#d1fae540',
      borderRadius: '12px',
      border: `2px solid ${isDarkMode ? '#047857' : '#065f46'}`,
    }}>
      {/* Header */}
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
          Available Dispatch Cars ({vehicles.length})
        </span>
      </div>

      {/* Vehicle Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '12px'
      }}>
        {vehicles.map((vehicle, index) => (
          <div
            key={`${vehicle.plate}-${index}`}
            style={{
              backgroundColor: isDarkMode ? '#1f293780' : '#ffffff',
              borderRadius: '10px',
              padding: '12px',
              border: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
              transition: 'all 0.2s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = isDarkMode
                ? '0 4px 12px rgba(0,0,0,0.3)'
                : '0 4px 12px rgba(0,0,0,0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {/* Vehicle Image */}
            <div style={{
              width: '100%',
              height: '80px',
              backgroundColor: isDarkMode ? '#111827' : '#f3f4f6',
              borderRadius: '8px',
              marginBottom: '10px',
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
                <Car size={32} style={{ color: isDarkMode ? '#4b5563' : '#9ca3af' }} />
              )}
              {/* Fuel Type Badge */}
              {vehicle.fuelType && (
                <div style={{
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '9px',
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
            <div style={{
              fontSize: '13px',
              fontWeight: 600,
              color: isDarkMode ? '#f3f4f6' : '#111827',
              marginBottom: '4px',
              lineHeight: 1.2
            }}>
              {vehicle.make} {vehicle.model}
            </div>

            <div style={{
              fontSize: '11px',
              color: isDarkMode ? '#9ca3af' : '#6b7280',
              marginBottom: '8px'
            }}>
              {vehicle.year} • {vehicle.plate}
            </div>

            {/* Specs Row */}
            <div style={{
              display: 'flex',
              gap: '8px',
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
        ))}
      </div>

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
