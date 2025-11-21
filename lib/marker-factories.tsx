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

// Indoor Carpark Marker
export function createIndoorCarparkMarker(
  carpark: CarparkWithVacancy,
  getMarkerColor: (vacancy: number) => string,
  onClick: (carpark: CarparkWithVacancy) => void,
  isSelected: boolean = false
): HTMLElement {
  // Inject animations if marker is selected
  if (isSelected) {
    injectMarkerAnimations();
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

// Metered Carpark Marker
export function createMeteredCarparkMarker(
  carpark: MeteredCarpark,
  getMarkerColor: (vacancy: number) => string,
  onClick: (carpark: MeteredCarpark) => void,
  isSelected: boolean = false
): HTMLElement {
  // Inject animations if marker is selected
  if (isSelected) {
    injectMarkerAnimations();
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

  // Parking meter SVG icon with drop shadow for visibility
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
      style="filter: drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.4));"
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
  onClick: (carpark: ConnectedCarpark) => void,
  isSelected: boolean = false
): HTMLElement {
  // Inject animations if marker is selected
  if (isSelected) {
    injectMarkerAnimations();
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

  // Theme-agnostic colors: dark gray border with white background
  const evColor = '#1f2937'; // Dark gray - visible on both light and dark maps

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

  // Glassmorphic outer ring with dual-layer border
  const outerRing = document.createElement('div');
  outerRing.style.position = 'absolute';
  outerRing.style.width = '100%';
  outerRing.style.height = '100%';
  outerRing.style.borderRadius = '8px';
  outerRing.style.background = `${evColor}20`;
  outerRing.style.backdropFilter = 'blur(8px)';
  outerRing.style.border = isSelected ? `3px solid ${evColor}` : `2px solid ${evColor}`;
  // Dual-layer shadow: dark outline + inner light ring
  outerRing.style.boxShadow = isSelected
    ? `0 4px 16px ${evColor}60, inset 0 0 0 1px rgba(255, 255, 255, 0.3)`
    : `0 4px 12px ${evColor}40, inset 0 0 0 1px rgba(255, 255, 255, 0.2)`;
  if (isSelected) {
    outerRing.style.animation = 'breathe 2s ease-in-out infinite';
  }

  // Inner rounded square - white background for visibility on all map backgrounds
  const innerSquare = document.createElement('div');
  innerSquare.style.position = 'relative';
  innerSquare.style.width = innerSize;
  innerSquare.style.height = innerSize;
  innerSquare.style.borderRadius = '6px';
  innerSquare.style.background = '#ffffff'; // White background
  innerSquare.style.display = 'flex';
  innerSquare.style.alignItems = 'center';
  innerSquare.style.justifyContent = 'center';
  innerSquare.style.boxShadow = isSelected
    ? `0 3px 12px rgba(0, 0, 0, 0.4)`
    : `0 2px 8px rgba(0, 0, 0, 0.3)`;
  if (isSelected) {
    innerSquare.style.animation = 'breathe 2s ease-in-out infinite';
  }

  // Logo inline SVG
  const logoColor = '#1f2937'; // Dark gray logo for contrast on white background
  const logo = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  logo.setAttribute('width', logoSize.toString());
  logo.setAttribute('height', logoSize.toString());
  logo.setAttribute('viewBox', '0 0 400 210');
  logo.style.display = 'block';

  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('fill', logoColor);

  const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path1.setAttribute('d', 'M166.15,71.4c-4.28-1.67-8.81-2.19-13.38-2.23c-10.73-0.09-19.79,3.5-26.55,12.11c-1.65,2.1-1.75,2.11-3.58,0.03c-2.79-3.16-5.83-6.01-9.59-8.02c-6.89-3.67-14.25-4.62-21.92-3.81c-6.6,0.69-12.35,3.39-17.26,7.7c-1.28,1.12-2.97,3.25-4.48,4.86c0,0-0.78,0.92-1.26,0.78c-0.49-0.14-0.68-0.27-0.68-1.35v-5.74c-0.07-2.52-0.94-3.27-3.49-3.28c-5.03-0.01-10.06,0.08-15.08-0.03c-3.57-0.08-4.47,0.7-4.47,4.46v88.68c0,2.25,0.78,3.1,2.96,3.11l17.78,0c1.85-0.01,2.62-2.64,2.62-2.64v-51.16c0-4.16,0.52-8.23,2.12-12.1c1.81-4.36,4.7-7.74,9.05-9.76c3.55-1.65,7.3-1.83,11.08-1.34c1.94,0.25,3.92,0.71,5.7,1.49c4.2,1.83,6.52,5.31,7.55,9.66c0.76,3.23,0.7,6.53,0.7,9.82v52.27c0.06,2.57,1.06,3.71,3.26,3.72l17.86,0.08c2.78,0.03,3.74-0.64,3.74-3.81V114.3c0-2.86,0.2-5.75,0.71-8.55c1.22-6.79,4.48-12.49,11.84-13.8c1.91-0.34,3.72-0.48,5.5-0.42c7.8,0.26,12.81,4.31,14.92,11.2c0.88,2.88,1.13,5.86,1.12,8.86v54.39c0.07,1.75,0.9,2.59,2.68,2.71c0.48,0.03,19.2,0.03,19.57,0c2.28-0.08,2.34-1.17,2.36-2.71v-57.54c-0.01-4.79-0.4-9.56-1.66-14.21C182.97,83.46,176.73,75.52,166.15,71.4z');

  const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path2.setAttribute('d', 'M351.7,136.35l-17.05,0c-1.77-0.03-2.95,0.64-3.94,2c-0.77,1.06-1.56,2.13-2.46,3.08c-3.93,4.16-8.81,6.43-14.46,7.25c-10.47,1.53-20.1-3.09-25.19-12.41c-4.48-8.21-5.2-16.92-2.71-25.87c1.43-5.12,4.2-9.5,8.23-13c5.85-5.08,12.75-6.62,20.26-5.68c4.4,0.55,8.48,2.08,11.92,5.24c1.52,1.61,3.15,2.98,4.32,4.68c1.24,1.8,2.69,2.46,4.81,2.43l16.69-0.03c0.48,0,0.96,0.03,1.43-0.04c1.45-0.22,2.23-1.23,1.96-2.67c-0.19-1.05-0.52-2.09-0.88-3.1c-2.43-6.72-6.41-12.4-11.66-17.2c-5.63-5.15-12.19-8.6-19.6-10.41c-6.46-1.58-13.01-1.73-19.6-1.07c-5.04,0.51-9.86,1.82-14.46,3.96c-6.8,3.15-12.43,7.77-17.24,13.48c-7.27,8.63-11.13,18.6-11.82,29.8c-0.34,5.51-0.11,11.03,1.15,16.41c3.45,14.82,11.75,26.08,25.44,32.91c11.29,5.63,23.31,6.33,35.54,3.78c9.87-2.07,18.07-7.13,24.69-14.7c3.57-4.08,6.35-8.66,8.12-13.84C356.43,137.79,354.65,136.29,351.7,136.35z');

  const path3 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path3.setAttribute('d', 'M249.13,148.95c-1.97-0.04-3.95,0.04-5.92-0.02c-4.05-0.12-7.64-1.41-10.36-4.55c-2.17-2.5-3.11-5.51-3.15-8.76l-0.1-41.63c0.01-3.31,0.28-3.58,3.6-3.58l15.44-0.01c2.63-0.01,3.4-0.68,3.45-3.23l-0.01-11.48c0-0.42-0.05-0.84-0.13-1.25c-0.24-1.25-0.9-1.86-2.19-1.96c-0.71-0.06-1.44-0.03-2.15-0.03l-15.62-0.01c-1.77-0.01-2.22-0.47-2.3-2.23V42.57c0.01-3.53-1.46-3.9-3.83-3.87c-5.5,0.08-11.01,0-16.51,0c-3.72,0-4.4,0.57-4.39,4.28v27.27c-0.14,1.64-0.76,2.17-2.43,2.2l-6.46,0.02c-2.03,0.02-2.95,0.9-2.97,2.95l-0.01,11.84c0.02,2.2,0.99,3.11,3.23,3.14l6.28,0.02c1.76,0.03,2.28,0.44,2.41,2.18c0.23,2.99-1.22,47.64,1.68,56.71c3.62,11.3,12.58,18.8,24.39,19.73c6.13,0.48,12.31,0.29,18.47,0.33c1.73,0.01,2.54-0.83,2.57-2.77c0.07-4.96,0.06-9.93-0.03-14.89C252.04,149.65,251.23,148.99,249.13,148.95z');

  g.appendChild(path1);
  g.appendChild(path2);
  g.appendChild(path3);
  logo.appendChild(g);

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
  // Inject animations if marker is selected
  if (isSelected) {
    injectMarkerAnimations();
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

  // Theme-agnostic colors: dark teal border with white background
  const dispatchColor = '#065f46'; // Dark teal - visible on both light and dark maps

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

  // Glassmorphic outer ring with dual-layer border
  const outerRing = document.createElement('div');
  outerRing.style.position = 'absolute';
  outerRing.style.width = '100%';
  outerRing.style.height = '100%';
  outerRing.style.borderRadius = '8px';
  outerRing.style.background = `${dispatchColor}20`;
  outerRing.style.backdropFilter = 'blur(8px)';
  outerRing.style.border = isSelected ? `3px solid ${dispatchColor}` : `2px solid ${dispatchColor}`;
  // Dual-layer shadow: dark outline + inner light ring
  outerRing.style.boxShadow = isSelected
    ? `0 6px 20px ${dispatchColor}60, inset 0 0 0 1px rgba(255, 255, 255, 0.3)`
    : `0 4px 12px ${dispatchColor}40, inset 0 0 0 1px rgba(255, 255, 255, 0.2)`;

  // Inner rounded square - white background for visibility on all map backgrounds
  const innerSquare = document.createElement('div');
  innerSquare.style.position = 'relative';
  innerSquare.style.width = innerSize;
  innerSquare.style.height = innerSize;
  innerSquare.style.borderRadius = '6px';
  innerSquare.style.background = '#ffffff'; // White background
  innerSquare.style.display = 'flex';
  innerSquare.style.alignItems = 'center';
  innerSquare.style.justifyContent = 'center';
  innerSquare.style.boxShadow = `0 2px 8px rgba(0, 0, 0, 0.3)`;

  // Logo inline SVG (Noah logo simplified) - black for contrast on white background
  const logoColor = '#000000'; // Black
  const logo = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  logo.setAttribute('width', logoSize.toString());
  logo.setAttribute('height', logoSize.toString());
  logo.setAttribute('viewBox', '0 0 982 437');
  logo.style.display = 'block';

  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('fill', logoColor);

  // Main NOAH text paths
  const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path1.setAttribute('d', 'M233.43,295.85c-20.61-30.12-115-174.8-115-174.8c-6.6-10.3-13.6-13-24.8-10v215.4h17.6l-0.1-185.6l115.5,175c6.5,10.2,13.4,13.2,24.7,10v-215.1h-17.9V295.85z');

  const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path2.setAttribute('d', 'M372.53,108.01c-51.18,0-86.84,41.27-86.84,109.51c0,68.56,35.67,111.46,86.84,111.46c51.18,0,87.16-42.89,87.16-111.46C459.68,149.6,423.7,108.01,372.53,108.01z M372.51,312.65c-39.53,0-65.21-37.17-65.21-95.23c0-57.7,25.68-93.1,65.21-93.1s65.55,35.4,65.55,93.1C438.06,275.48,412.05,312.65,372.51,312.65z');

  const path3 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path3.setAttribute('d', 'M605.6,121.99l-152.5,204.2c19.48,0.17,18.88,0.01,26.9-9.5l136.4-181.8l0.2,150.3c-0.45,15.68-0.51,27.84-11.2,39.9c-0.43,0.49-0.74,1.49,0.4,1.5c0,0,18.4,0,27.5,0v-214.8C620.7,108.09,613,111.79,605.6,121.99z');

  const path4 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path4.setAttribute('d', 'M797.17,211.24h-122.6v-100.5c-6.1,0-11,0-16.7,0v215.7c5.7,0,10.7,0,16.8,0v-98h122.9v97.9c6.2,0,11.5,0,16.8,0v-215.8c-5.5,0-10.2,0-17.1,0L797.17,211.24z');

  g.appendChild(path1);
  g.appendChild(path2);
  g.appendChild(path3);
  g.appendChild(path4);
  logo.appendChild(g);

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
