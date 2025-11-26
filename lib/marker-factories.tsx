/**
 * Marker factory functions for creating optimized marker DOM elements
 */

import type { CarparkWithVacancy } from '@/types/indoor-carpark';
import type { MeteredCarpark } from '@/types/metered-carpark';
import type { ConnectedCarpark } from '@/types/connected-carpark';
import type { DispatchCarpark } from '@/types/dispatch-carpark';
import type { ParkingSpace } from '@/types/parking-space';

// Shared animation injection - only inject once per page load
let animationsInjected = false;

function injectMarkerAnimations(): void {
  if (animationsInjected) return;

  const style = document.createElement('style');
  style.id = 'marker-animations';
  style.textContent = `
    @keyframes breathe {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.15); opacity: 0.9; }
    }
    @keyframes breatheRing {
      0%, 100% { transform: scale(1); opacity: 0.6; }
      50% { transform: scale(1.3); opacity: 0.3; }
    }
  `;
  document.head.appendChild(style);
  animationsInjected = true;
}

// Indoor Carpark Marker - Secondary hierarchy, calm blue design
export function createIndoorCarparkMarker(
  carpark: CarparkWithVacancy,
  getMarkerColor: (vacancy: number) => string,
  onClick: (carpark: CarparkWithVacancy) => void,
  isSelected: boolean = false
): HTMLElement {
  const container = document.createElement('div');
  const baseSize = 23;
  const scale = isSelected ? 1.05 : 1;
  const size = `${baseSize * scale}px`;

  // Calm blue color system - secondary to MTC stations
  const calmBlue = 'rgba(8, 145, 210, 0.9)'; // #0891D2 at 0.9 opacity
  const borderBlue = 'rgba(3, 105, 161, 0.9)'; // #0369A1 at 0.9 opacity
  const selectedGlow = 'rgba(8, 145, 210, 0.7)'; // For selected state outer ring

  container.style.width = size;
  container.style.height = size;
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'center';
  container.style.cursor = 'pointer';
  container.style.position = 'relative';
  container.style.transition = 'all 200ms ease-out';

  // Outer glow ring (only visible when selected)
  if (isSelected) {
    const glowRing = document.createElement('div');
    glowRing.style.position = 'absolute';
    glowRing.style.width = 'calc(100% + 6px)';
    glowRing.style.height = 'calc(100% + 6px)';
    glowRing.style.borderRadius = '8px';
    glowRing.style.border = `2.5px solid ${selectedGlow}`;
    glowRing.style.boxSizing = 'border-box';
    glowRing.style.pointerEvents = 'none';
    container.appendChild(glowRing);
  }

  // Main rounded square
  const square = document.createElement('div');
  square.style.width = '100%';
  square.style.height = '100%';
  square.style.borderRadius = '6px'; // Softer corners
  square.style.backgroundColor = calmBlue;
  square.style.border = isSelected
    ? `2px solid ${borderBlue}`
    : `1px solid ${borderBlue}`;
  square.style.boxShadow = '0 0 3px rgba(0, 0, 0, 0.35)'; // Tight halo
  square.style.display = 'flex';
  square.style.alignItems = 'center';
  square.style.justifyContent = 'center';
  square.style.transition = 'all 200ms ease-out';
  square.style.boxSizing = 'border-box';

  // "P" icon/glyph
  const icon = document.createElement('span');
  icon.textContent = 'P';
  icon.style.fontFamily = 'Helvetica, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  icon.style.fontSize = '12px';
  icon.style.fontWeight = '500'; // Medium weight
  icon.style.color = 'rgba(255, 255, 255, 0.95)';
  icon.style.lineHeight = '1';
  icon.style.userSelect = 'none';
  icon.style.pointerEvents = 'none';

  square.appendChild(icon);
  container.appendChild(square);

  // Hover state
  container.addEventListener('mouseenter', () => {
    if (!isSelected) {
      square.style.border = `2px solid ${borderBlue}`;
      square.style.transform = 'scale(1.05)';
    }
  });

  container.addEventListener('mouseleave', () => {
    if (!isSelected) {
      square.style.border = `1px solid ${borderBlue}`;
      square.style.transform = 'scale(1)';
    }
  });

  container.addEventListener('click', () => onClick(carpark));

  return container;
}

// Selected Indoor Carpark Marker (with breathing animation)
export function createSelectedCarparkMarker(
  carpark: CarparkWithVacancy,
  getMarkerColor: (vacancy: number) => string
): HTMLElement {
  const container = document.createElement('div');
  container.style.width = '50px';
  container.style.height = '50px';
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'center';
  container.style.cursor = 'pointer';
  container.style.position = 'relative';

  const color = getMarkerColor(carpark.vacancy);

  // Inject animations
  injectMarkerAnimations();

  // Outer breathing ring
  const outerRing = document.createElement('div');
  outerRing.style.position = 'absolute';
  outerRing.style.width = '100%';
  outerRing.style.height = '100%';
  outerRing.style.borderRadius = '50%';
  outerRing.style.background = `${color}30`;
  outerRing.style.animation = 'breatheRing 2s ease-in-out infinite';

  // Middle glassmorphic ring
  const middleRing = document.createElement('div');
  middleRing.style.position = 'absolute';
  middleRing.style.width = '100%';
  middleRing.style.height = '100%';
  middleRing.style.borderRadius = '50%';
  middleRing.style.background = `${color}20`;
  middleRing.style.backdropFilter = 'blur(8px)';
  middleRing.style.border = `3px solid ${color}`;
  middleRing.style.boxShadow = `0 4px 16px ${color}60, 0 0 0 1px ${color}30`;
  middleRing.style.animation = 'breathe 2s ease-in-out infinite';

  // Inner circle
  const innerCircle = document.createElement('div');
  innerCircle.style.position = 'relative';
  innerCircle.style.width = '34px';
  innerCircle.style.height = '34px';
  innerCircle.style.borderRadius = '50%';
  innerCircle.style.background = color;
  innerCircle.style.display = 'flex';
  innerCircle.style.alignItems = 'center';
  innerCircle.style.justifyContent = 'center';
  innerCircle.style.boxShadow = `0 3px 12px ${color}70`;
  innerCircle.style.animation = 'breathe 2s ease-in-out infinite';

  innerCircle.innerHTML = `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>
    </svg>
  `;

  container.appendChild(outerRing);
  container.appendChild(middleRing);
  container.appendChild(innerCircle);

  return container;
}

// Metered Carpark Marker - Minimal, neutral design secondary to MTC stations
export function createMeteredCarparkMarker(
  carpark: MeteredCarpark,
  getMarkerColor: (vacancy: number) => string,
  onClick: (carpark: MeteredCarpark) => void,
  isSelected: boolean = false
): HTMLElement {
  const container = document.createElement('div');
  const baseSize = 24;
  const scale = isSelected ? 1.05 : 1;
  const size = `${baseSize * scale}px`;

  // Brand accent color for selected state
  const brandAccent = '#3b82f6';

  container.style.width = size;
  container.style.height = size;
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'center';
  container.style.cursor = 'pointer';
  container.style.position = 'relative';
  container.style.transition = 'all 200ms ease-out';

  // Outer accent ring (only visible when selected)
  if (isSelected) {
    const accentRing = document.createElement('div');
    accentRing.style.position = 'absolute';
    accentRing.style.width = '100%';
    accentRing.style.height = '100%';
    accentRing.style.borderRadius = '50%';
    accentRing.style.border = `2.5px solid ${brandAccent}`;
    accentRing.style.boxSizing = 'border-box';
    accentRing.style.pointerEvents = 'none';
    container.appendChild(accentRing);
  }

  // Main circle
  const circle = document.createElement('div');
  circle.style.width = '100%';
  circle.style.height = '100%';
  circle.style.borderRadius = '50%';
  circle.style.backgroundColor = 'rgba(255, 255, 255, 0.94)'; // #FFFFFF at ~0.94 opacity
  circle.style.border = isSelected
    ? `2px solid ${brandAccent}`
    : '1px solid rgba(203, 213, 225, 0.8)'; // #CBD5E1 at 0.8 opacity
  circle.style.boxShadow = '0 0 3px rgba(0, 0, 0, 0.28)'; // Halo for visibility
  circle.style.display = 'flex';
  circle.style.alignItems = 'center';
  circle.style.justifyContent = 'center';
  circle.style.transition = 'all 200ms ease-out';
  circle.style.boxSizing = 'border-box';

  // Parking meter icon
  const iconSize = 14;
  circle.innerHTML = `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="${iconSize}"
      height="${iconSize}"
      viewBox="0 0 24 24"
      fill="none"
      stroke="rgba(17, 24, 39, 0.85)"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      style="display: block; pointer-events: none;"
    >
      <path d="M11 15h2"/>
      <path d="M12 12v3"/>
      <path d="M12 19v3"/>
      <path d="M15.282 19a1 1 0 0 0 .948-.68l2.37-6.988a7 7 0 1 0-13.2 0l2.37 6.988a1 1 0 0 0 .948.68z"/>
      <path d="M9 9a3 3 0 1 1 6 0"/>
    </svg>
  `;
  container.appendChild(circle);

  // Hover state
  container.addEventListener('mouseenter', () => {
    if (!isSelected) {
      circle.style.border = `2px solid ${brandAccent}`;
      circle.style.transform = 'scale(1.05)';
    }
  });

  container.addEventListener('mouseleave', () => {
    if (!isSelected) {
      circle.style.border = '1px solid rgba(203, 213, 225, 0.8)';
      circle.style.transform = 'scale(1)';
    }
  });

  container.addEventListener('click', () => onClick(carpark));

  return container;
}

// Connected Carpark Marker (MTC Station) - Primary hierarchy, call-to-action design
export function createConnectedCarparkMarker(
  carpark: ConnectedCarpark,
  onClick: (carpark: ConnectedCarpark) => void,
  isSelected: boolean = false
): HTMLElement {
  const container = document.createElement('div');
  const baseSize = 30;
  const scale = isSelected ? 1.08 : 1;
  const size = `${baseSize * scale}px`;

  // Brand accent color for interactions
  const brandAccent = '#0891D2';
  const brandGlow = 'rgba(8, 145, 210, 0.75)';

  container.style.width = size;
  container.style.height = size;
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'center';
  container.style.cursor = 'pointer';
  container.style.position = 'relative';
  container.style.transition = 'all 180ms ease-out';
  container.style.zIndex = isSelected ? '1000' : '100'; // Highest when selected

  // Outer halo ring (only visible when selected)
  if (isSelected) {
    const haloRing = document.createElement('div');
    haloRing.style.position = 'absolute';
    haloRing.style.width = 'calc(100% + 8px)';
    haloRing.style.height = 'calc(100% + 8px)';
    haloRing.style.borderRadius = '10px';
    haloRing.style.boxShadow = `0 0 8px ${brandGlow}`;
    haloRing.style.border = `3px solid ${brandGlow}`;
    haloRing.style.boxSizing = 'border-box';
    haloRing.style.pointerEvents = 'none';
    container.appendChild(haloRing);
  }

  // Main white squircle
  const square = document.createElement('div');
  square.style.width = '100%';
  square.style.height = '100%';
  square.style.borderRadius = '8px'; // Softer corners
  square.style.backgroundColor = 'rgba(255, 255, 255, 0.98)'; // Pure white at 98%
  square.style.border = isSelected
    ? `2px solid ${brandAccent}`
    : '1px solid #E5E7EB'; // Light gray border
  square.style.boxShadow = '0 0 4px rgba(0, 0, 0, 0.35)'; // Subtle halo
  square.style.display = 'flex';
  square.style.alignItems = 'center';
  square.style.justifyContent = 'center';
  square.style.transition = 'all 180ms ease-out';
  square.style.boxSizing = 'border-box';

  // "mtc" logotype
  const logo = document.createElement('span');
  logo.textContent = 'mtc';
  logo.style.fontFamily = 'Helvetica, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  logo.style.fontSize = '11px';
  logo.style.fontWeight = '500'; // Medium weight
  logo.style.color = 'rgba(17, 24, 39, 0.9)'; // Near-black at 90%
  logo.style.lineHeight = '1';
  logo.style.userSelect = 'none';
  logo.style.pointerEvents = 'none';
  logo.style.letterSpacing = '-0.02em'; // Tighter tracking for "mtc"

  square.appendChild(logo);
  container.appendChild(square);

  // Hover state
  container.addEventListener('mouseenter', () => {
    if (!isSelected) {
      square.style.border = `2px solid ${brandAccent}`;
      square.style.transform = 'scale(1.06)';
    }
  });

  container.addEventListener('mouseleave', () => {
    if (!isSelected) {
      square.style.border = '1px solid #E5E7EB';
      square.style.transform = 'scale(1)';
    }
  });

  container.addEventListener('click', () => onClick(carpark));

  return container;
}

// Dispatch Carpark Marker - Identical to MTC Station, green when selected
export function createDispatchCarparkMarker(
  carpark: DispatchCarpark,
  onClick: (carpark: DispatchCarpark) => void,
  isSelected: boolean = false
): HTMLElement {
  const container = document.createElement('div');
  const baseSize = 30;
  const scale = isSelected ? 1.08 : 1;
  const size = `${baseSize * scale}px`;

  // Brand accent for hover (blue), green for selected state
  const brandAccent = '#0891D2';
  const greenAccent = '#10b981'; // Green-500
  const greenGlow = 'rgba(16, 185, 129, 0.75)';

  // Use green when selected, blue for hover
  const accentColor = isSelected ? greenAccent : brandAccent;

  container.style.width = size;
  container.style.height = size;
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'center';
  container.style.cursor = 'pointer';
  container.style.position = 'relative';
  container.style.transition = 'all 180ms ease-out';
  container.style.zIndex = isSelected ? '1000' : '100'; // Highest when selected

  // Outer halo ring (only visible when selected) - GREEN
  if (isSelected) {
    const haloRing = document.createElement('div');
    haloRing.style.position = 'absolute';
    haloRing.style.width = 'calc(100% + 8px)';
    haloRing.style.height = 'calc(100% + 8px)';
    haloRing.style.borderRadius = '10px';
    haloRing.style.boxShadow = `0 0 8px ${greenGlow}`;
    haloRing.style.border = `3px solid ${greenGlow}`;
    haloRing.style.boxSizing = 'border-box';
    haloRing.style.pointerEvents = 'none';
    container.appendChild(haloRing);
  }

  // Main white squircle
  const square = document.createElement('div');
  square.style.width = '100%';
  square.style.height = '100%';
  square.style.borderRadius = '8px'; // Softer corners
  square.style.backgroundColor = 'rgba(255, 255, 255, 0.98)'; // Pure white at 98%
  square.style.border = isSelected
    ? `2px solid ${greenAccent}`
    : '1px solid #E5E7EB'; // Light gray border
  square.style.boxShadow = '0 0 4px rgba(0, 0, 0, 0.35)'; // Subtle halo
  square.style.display = 'flex';
  square.style.alignItems = 'center';
  square.style.justifyContent = 'center';
  square.style.transition = 'all 180ms ease-out';
  square.style.boxSizing = 'border-box';

  // "mtc" logotype - identical to MTC station
  const logo = document.createElement('span');
  logo.textContent = 'mtc';
  logo.style.fontFamily = 'Helvetica, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  logo.style.fontSize = '11px';
  logo.style.fontWeight = '500'; // Medium weight
  logo.style.color = 'rgba(17, 24, 39, 0.9)'; // Near-black at 90%
  logo.style.lineHeight = '1';
  logo.style.userSelect = 'none';
  logo.style.pointerEvents = 'none';
  logo.style.letterSpacing = '-0.02em'; // Tighter tracking for "mtc"

  square.appendChild(logo);
  container.appendChild(square);

  // Hover state - still uses blue brand accent
  container.addEventListener('mouseenter', () => {
    if (!isSelected) {
      square.style.border = `2px solid ${brandAccent}`;
      square.style.transform = 'scale(1.06)';
    }
  });

  container.addEventListener('mouseleave', () => {
    if (!isSelected) {
      square.style.border = '1px solid #E5E7EB';
      square.style.transform = 'scale(1)';
    }
  });

  container.addEventListener('click', () => onClick(carpark));

  return container;
}

// Vehicle type color scheme (matching badge colors in metered-carpark-details)
const VEHICLE_TYPE_COLORS: Record<string, string> = {
  'A': '#3b82f6',  // Blue - Private Car
  'G': '#f59e0b',  // Amber - Goods Vehicle
  'C': '#8b5cf6',  // Purple - Coach/Bus
};

// Metered Space Marker - Ring style with vehicle type color border and vacancy fill
export interface MeteredSpaceDetail {
  parking_space_id: string;
  latitude: number;
  longitude: number;
  vehicle_type: string;
  is_vacant: boolean | null;
  has_real_time_tracking: boolean;
}

export function createMeteredSpaceMarker(space: MeteredSpaceDetail): HTMLElement {
  const container = document.createElement('div');
  const size = 16;

  // Vehicle type determines ring color
  const vehicleColor = VEHICLE_TYPE_COLORS[space.vehicle_type] || VEHICLE_TYPE_COLORS['A'];

  // Vacancy determines fill color
  const fillColor = space.is_vacant === true
    ? '#22c55e'   // Green - vacant
    : space.is_vacant === false
      ? '#ef4444' // Red - occupied
      : '#9ca3af'; // Gray - unknown/no tracking

  container.style.width = `${size}px`;
  container.style.height = `${size}px`;
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'center';
  container.style.pointerEvents = 'none'; // No interaction

  // Main circle with colored ring and fill
  const circle = document.createElement('div');
  circle.style.width = '100%';
  circle.style.height = '100%';
  circle.style.borderRadius = '50%';
  circle.style.backgroundColor = fillColor;
  circle.style.border = `3px solid ${vehicleColor}`;
  circle.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.3)';
  circle.style.boxSizing = 'border-box';

  container.appendChild(circle);

  return container;
}

// Parking Space Marker
export function createParkingSpaceMarker(
  space: ParkingSpace,
  onClick: (space: ParkingSpace) => void
): HTMLElement {
  const container = document.createElement('div');
  container.style.width = '28px';
  container.style.height = '28px';
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'center';
  container.style.cursor = 'pointer';

  const square = document.createElement('div');
  square.style.width = '24px';
  square.style.height = '24px';
  square.style.borderRadius = '4px';
  square.style.background = space.is_vacant ? '#10b981' : '#ef4444';
  square.style.border = '2px solid white';
  square.style.display = 'flex';
  square.style.alignItems = 'center';
  square.style.justifyContent = 'center';
  square.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.3)';

  const text = document.createElement('span');
  text.style.fontSize = '10px';
  text.style.fontWeight = 'bold';
  text.style.color = 'white';
  text.textContent = space.vehicle_type;

  square.appendChild(text);
  container.appendChild(square);

  container.addEventListener('click', () => onClick(space));

  return container;
}
