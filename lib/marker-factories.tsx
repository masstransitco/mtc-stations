/**
 * Marker factory functions for creating optimized marker DOM elements
 */

import type { CarparkWithVacancy } from '@/types/indoor-carpark';
import type { MeteredCarpark } from '@/types/metered-carpark';
import type { ConnectedCarpark } from '@/types/connected-carpark';
import type { DispatchCarpark } from '@/types/dispatch-carpark';
import type { ParkingSpace } from '@/types/parking-space';

// Indoor Carpark Marker
export function createIndoorCarparkMarker(
  carpark: CarparkWithVacancy,
  getMarkerColor: (vacancy: number) => string,
  onClick: (carpark: CarparkWithVacancy) => void,
  isSelected: boolean = false
): HTMLElement {
  // Add animations to document if not already present and marker is selected
  if (isSelected && !document.getElementById('marker-animations')) {
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
  }

  const container = document.createElement('div');
  const size = isSelected ? '50px' : '40px';
  const innerSize = isSelected ? '34px' : '28px';
  const iconSize = isSelected ? '18' : '16';

  container.style.width = size;
  container.style.height = size;
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'center';
  container.style.cursor = 'pointer';
  container.style.position = 'relative';

  const color = getMarkerColor(carpark.vacancy);

  // Outer breathing ring (only visible when selected)
  if (isSelected) {
    const breathingRing = document.createElement('div');
    breathingRing.style.position = 'absolute';
    breathingRing.style.width = '100%';
    breathingRing.style.height = '100%';
    breathingRing.style.borderRadius = '8px';
    breathingRing.style.background = `${color}30`;
    breathingRing.style.animation = 'breatheRing 2s ease-in-out infinite';
    container.appendChild(breathingRing);
  }

  // Glassmorphic outer ring
  const outerRing = document.createElement('div');
  outerRing.style.position = 'absolute';
  outerRing.style.width = '100%';
  outerRing.style.height = '100%';
  outerRing.style.borderRadius = '8px';
  outerRing.style.background = `${color}20`;
  outerRing.style.backdropFilter = 'blur(8px)';
  outerRing.style.border = isSelected ? `3px solid ${color}` : `2px solid ${color}`;
  outerRing.style.boxShadow = isSelected
    ? `0 4px 16px ${color}60, 0 0 0 1px ${color}30`
    : `0 4px 12px ${color}40, 0 0 0 1px ${color}20`;
  if (isSelected) {
    outerRing.style.animation = 'breathe 2s ease-in-out infinite';
  }

  // Inner rounded square
  const innerSquare = document.createElement('div');
  innerSquare.style.position = 'relative';
  innerSquare.style.width = innerSize;
  innerSquare.style.height = innerSize;
  innerSquare.style.borderRadius = '6px';
  innerSquare.style.background = color;
  innerSquare.style.display = 'flex';
  innerSquare.style.alignItems = 'center';
  innerSquare.style.justifyContent = 'center';
  innerSquare.style.boxShadow = isSelected
    ? `0 3px 12px ${color}70`
    : `0 2px 8px ${color}60`;
  if (isSelected) {
    innerSquare.style.animation = 'breathe 2s ease-in-out infinite';
  }

  // Parking icon SVG
  innerSquare.innerHTML = `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="${iconSize}"
      height="${iconSize}"
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
  container.appendChild(innerSquare);

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

  // Add animations to document if not already present
  if (!document.getElementById('marker-animations')) {
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
  }

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

// Metered Carpark Marker
export function createMeteredCarparkMarker(
  carpark: MeteredCarpark,
  getMarkerColor: (vacancy: number) => string,
  onClick: (carpark: MeteredCarpark) => void,
  isSelected: boolean = false
): HTMLElement {
  // Add animations if selected and not already present
  if (isSelected && !document.getElementById('marker-animations')) {
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
  }

  const container = document.createElement('div');
  const size = isSelected ? '54px' : '44px';
  const innerSize = isSelected ? '38px' : '32px';
  const iconSize = isSelected ? '20' : '18';

  container.style.width = size;
  container.style.height = size;
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'center';
  container.style.cursor = 'pointer';
  container.style.position = 'relative';

  const color = getMarkerColor(carpark.vacant_spaces);

  // Outer breathing ring (only visible when selected)
  if (isSelected) {
    const breathingRing = document.createElement('div');
    breathingRing.style.position = 'absolute';
    breathingRing.style.width = '100%';
    breathingRing.style.height = '100%';
    breathingRing.style.borderRadius = '50%';
    breathingRing.style.background = `${color}30`;
    breathingRing.style.animation = 'breatheRing 2s ease-in-out infinite';
    container.appendChild(breathingRing);
  }

  // Glassmorphic outer ring - circle
  const outerRing = document.createElement('div');
  outerRing.style.position = 'absolute';
  outerRing.style.width = '100%';
  outerRing.style.height = '100%';
  outerRing.style.borderRadius = '50%';
  outerRing.style.background = `${color}20`;
  outerRing.style.backdropFilter = 'blur(8px)';
  outerRing.style.border = isSelected ? `3px solid ${color}` : `2px solid ${color}`;
  outerRing.style.boxShadow = isSelected
    ? `0 4px 16px ${color}60, 0 0 0 1px ${color}30`
    : `0 4px 12px ${color}40, 0 0 0 1px ${color}20`;
  if (isSelected) {
    outerRing.style.animation = 'breathe 2s ease-in-out infinite';
  }

  // Inner circle with parking meter icon
  const innerCircle = document.createElement('div');
  innerCircle.style.position = 'relative';
  innerCircle.style.width = innerSize;
  innerCircle.style.height = innerSize;
  innerCircle.style.borderRadius = '50%';
  innerCircle.style.background = color;
  innerCircle.style.display = 'flex';
  innerCircle.style.alignItems = 'center';
  innerCircle.style.justifyContent = 'center';
  innerCircle.style.boxShadow = isSelected
    ? `0 3px 12px ${color}70`
    : `0 2px 8px ${color}60`;
  if (isSelected) {
    innerCircle.style.animation = 'breathe 2s ease-in-out infinite';
  }

  // Parking meter SVG icon
  innerCircle.innerHTML = `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="${iconSize}"
      height="${iconSize}"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M11 15h2"/>
      <path d="M12 12v3"/>
      <path d="M12 19v3"/>
      <path d="M15.282 19a1 1 0 0 0 .948-.68l2.37-6.988a7 7 0 1 0-13.2 0l2.37 6.988a1 1 0 0 0 .948.68z"/>
      <path d="M9 9a3 3 0 1 1 6 0"/>
    </svg>
  `;

  // Badge with vacancy count (top-right)
  const badge = document.createElement('div');
  badge.style.position = 'absolute';
  badge.style.top = '-2px';
  badge.style.right = '-2px';
  badge.style.minWidth = '18px';
  badge.style.height = '18px';
  badge.style.borderRadius = '9px';
  badge.style.background = 'white';
  badge.style.border = '2px solid white';
  badge.style.display = 'flex';
  badge.style.alignItems = 'center';
  badge.style.justifyContent = 'center';
  badge.style.padding = '0 4px';
  badge.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';

  const badgeText = document.createElement('span');
  badgeText.style.fontSize = '10px';
  badgeText.style.fontWeight = 'bold';
  badgeText.style.color = '#1a1a1a';
  badgeText.style.lineHeight = '1';
  badgeText.textContent = carpark.vacant_spaces.toString();

  badge.appendChild(badgeText);
  container.appendChild(outerRing);
  container.appendChild(innerCircle);
  container.appendChild(badge);

  container.addEventListener('click', () => onClick(carpark));

  return container;
}

// Connected Carpark Marker (EV Charging)
export function createConnectedCarparkMarker(
  carpark: ConnectedCarpark,
  isDarkMode: boolean,
  onClick: (carpark: ConnectedCarpark) => void,
  isSelected: boolean = false
): HTMLElement {
  // Add animations if selected and not already present
  if (isSelected && !document.getElementById('marker-animations')) {
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
  }

  const container = document.createElement('div');
  const size = isSelected ? '50px' : '40px';
  const innerSize = isSelected ? '34px' : '28px';
  const logoSize = isSelected ? 20 : 18;

  container.style.width = size;
  container.style.height = size;
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'center';
  container.style.cursor = 'pointer';
  container.style.position = 'relative';

  const evColor = isDarkMode ? '#f3f4f6' : '#1f2937';

  // Outer breathing ring (only visible when selected)
  if (isSelected) {
    const breathingRing = document.createElement('div');
    breathingRing.style.position = 'absolute';
    breathingRing.style.width = '100%';
    breathingRing.style.height = '100%';
    breathingRing.style.borderRadius = '8px';
    breathingRing.style.background = `${evColor}30`;
    breathingRing.style.animation = 'breatheRing 2s ease-in-out infinite';
    container.appendChild(breathingRing);
  }

  // Glassmorphic outer ring
  const outerRing = document.createElement('div');
  outerRing.style.position = 'absolute';
  outerRing.style.width = '100%';
  outerRing.style.height = '100%';
  outerRing.style.borderRadius = '8px';
  outerRing.style.background = `${evColor}20`;
  outerRing.style.backdropFilter = 'blur(8px)';
  outerRing.style.border = isSelected ? `3px solid ${evColor}` : `2px solid ${evColor}`;
  outerRing.style.boxShadow = isSelected
    ? `0 4px 16px ${evColor}60, 0 0 0 1px ${evColor}30`
    : `0 4px 12px ${evColor}40, 0 0 0 1px ${evColor}20`;
  if (isSelected) {
    outerRing.style.animation = 'breathe 2s ease-in-out infinite';
  }

  // Inner rounded square
  const innerSquare = document.createElement('div');
  innerSquare.style.position = 'relative';
  innerSquare.style.width = innerSize;
  innerSquare.style.height = innerSize;
  innerSquare.style.borderRadius = '6px';
  innerSquare.style.background = evColor;
  innerSquare.style.display = 'flex';
  innerSquare.style.alignItems = 'center';
  innerSquare.style.justifyContent = 'center';
  innerSquare.style.boxShadow = isSelected
    ? `0 3px 12px ${evColor}70`
    : `0 2px 8px ${evColor}60`;
  if (isSelected) {
    innerSquare.style.animation = 'breathe 2s ease-in-out infinite';
  }

  // Logo image
  const logo = document.createElement('img');
  logo.src = '/logos/mtc-logo-2025.svg';
  logo.alt = 'EV Charging';
  logo.width = logoSize;
  logo.height = logoSize;
  logo.style.filter = isDarkMode ? 'brightness(0)' : 'brightness(0) invert(1)';

  innerSquare.appendChild(logo);
  container.appendChild(outerRing);
  container.appendChild(innerSquare);

  container.addEventListener('click', () => onClick(carpark));

  return container;
}

// Dispatch Carpark Marker
export function createDispatchCarparkMarker(
  carpark: DispatchCarpark,
  onClick: (carpark: DispatchCarpark) => void,
  isSelected: boolean = false
): HTMLElement {
  // Inject animations if needed
  if (isSelected && !document.getElementById('marker-animations')) {
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
  }

  const size = isSelected ? '50px' : '40px';
  const innerSize = isSelected ? '34px' : '28px';
  const logoSize = isSelected ? 22 : 18;

  const container = document.createElement('div');
  container.style.width = size;
  container.style.height = size;
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'center';
  container.style.cursor = 'pointer';
  container.style.position = 'relative';

  const dispatchColor = '#065f46';

  // Outer breathing ring (only when selected)
  if (isSelected) {
    const breathingRing = document.createElement('div');
    breathingRing.style.position = 'absolute';
    breathingRing.style.width = '120%';
    breathingRing.style.height = '120%';
    breathingRing.style.borderRadius = '10px';
    breathingRing.style.background = `${dispatchColor}15`;
    breathingRing.style.border = `2px solid ${dispatchColor}60`;
    breathingRing.style.animation = 'breatheRing 2s ease-in-out infinite';
    breathingRing.style.pointerEvents = 'none';
    container.appendChild(breathingRing);
  }

  // Glassmorphic outer ring
  const outerRing = document.createElement('div');
  outerRing.style.position = 'absolute';
  outerRing.style.width = '100%';
  outerRing.style.height = '100%';
  outerRing.style.borderRadius = '8px';
  outerRing.style.background = `${dispatchColor}20`;
  outerRing.style.backdropFilter = 'blur(8px)';
  outerRing.style.border = isSelected ? `3px solid ${dispatchColor}` : `2px solid ${dispatchColor}`;
  outerRing.style.boxShadow = isSelected
    ? `0 6px 20px ${dispatchColor}60, 0 0 0 2px ${dispatchColor}30`
    : `0 4px 12px ${dispatchColor}40, 0 0 0 1px ${dispatchColor}20`;

  // Inner rounded square
  const innerSquare = document.createElement('div');
  innerSquare.style.position = 'relative';
  innerSquare.style.width = innerSize;
  innerSquare.style.height = innerSize;
  innerSquare.style.borderRadius = '6px';
  innerSquare.style.background = dispatchColor;
  innerSquare.style.display = 'flex';
  innerSquare.style.alignItems = 'center';
  innerSquare.style.justifyContent = 'center';
  innerSquare.style.boxShadow = `0 2px 8px ${dispatchColor}60`;

  // Logo image
  const logo = document.createElement('img');
  logo.src = '/logos/noah-logo.svg';
  logo.alt = 'Dispatch Carpark';
  logo.width = logoSize;
  logo.height = logoSize;
  logo.style.filter = 'brightness(0) invert(1)';

  // Apply animations to rings when selected
  if (isSelected) {
    outerRing.style.animation = 'breathe 2s ease-in-out infinite';
    innerSquare.style.animation = 'breathe 2s ease-in-out infinite';
  }

  innerSquare.appendChild(logo);
  container.appendChild(outerRing);
  container.appendChild(innerSquare);

  container.addEventListener('click', () => onClick(carpark));

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
