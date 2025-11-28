import { ReactNode } from 'react';
import { Navigation } from 'lucide-react';
import Box3DIcon from '@/components/icons/box-3d-icon';
import PedestrianNetworkIcon from '@/components/icons/pedestrian-network-icon';

export interface ControlConfig {
  id: string;
  icon: (props: { isActive: boolean; isDarkMode: boolean; isTracking?: boolean; isMapAtUserLocation?: boolean }) => ReactNode;
  title: string;
  minZoom?: number;
  alwaysVisible?: boolean;
  exclusiveWith?: string[]; // IDs of controls that can't be active at the same time
  defaultState?: boolean;
}

export const MAP_CONTROLS: ControlConfig[] = [
  {
    id: 'indoor',
    icon: ({ isActive, isDarkMode }) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke={isActive ? '#3b82f6' : (isDarkMode ? '#9ca3af' : '#6b7280')}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>
      </svg>
    ),
    title: 'Toggle Indoor Carparks',
    minZoom: 14,
    defaultState: false,
  },
  {
    id: 'indoor-layer',
    icon: ({ isActive, isDarkMode }) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke={isActive ? '#3b82f6' : (isDarkMode ? '#9ca3af' : '#6b7280')}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="4" y="5" width="10" height="6" rx="1.5" />
        <rect x="8" y="11" width="10" height="6" rx="1.5" />
        <path d="M10 8h4M14 14h4" />
      </svg>
    ),
    title: 'Toggle Indoor 3D Layer',
    minZoom: 15,
    defaultState: false,
  },
  {
    id: 'metered',
    icon: ({ isActive, isDarkMode }) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke={isActive ? '#3b82f6' : (isDarkMode ? '#9ca3af' : '#6b7280')}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M11 15h2"/>
        <path d="M12 12v3"/>
        <path d="M12 19v3"/>
        <path d="M15.282 19a1 1 0 0 0 .948-.68l2.37-6.988a7 7 0 1 0-13.2 0l2.37 6.988a1 1 0 0 0 .948.68z"/>
        <path d="M9 9a3 3 0 1 1 6 0"/>
      </svg>
    ),
    title: 'Toggle Metered Carparks',
    minZoom: 10,
    defaultState: true,
  },
  {
    id: 'buildings',
    icon: ({ isActive, isDarkMode }) => (
      <Box3DIcon
        size={24}
        color={isActive ? '#3b82f6' : (isDarkMode ? '#9ca3af' : '#6b7280')}
      />
    ),
    title: 'Toggle 3D Buildings',
    minZoom: 16,
    exclusiveWith: ['pedestrian'],
    defaultState: false,
  },
  {
    id: 'pedestrian',
    icon: ({ isActive, isDarkMode }) => (
      <PedestrianNetworkIcon
        size={24}
        color={isActive ? '#3b82f6' : (isDarkMode ? '#9ca3af' : '#6b7280')}
      />
    ),
    title: 'Toggle Pedestrian Network',
    minZoom: 16,
    exclusiveWith: ['buildings'],
    defaultState: false,
  },
  {
    id: 'location',
    icon: ({ isActive, isDarkMode, isTracking, isMapAtUserLocation }) => (
      <Navigation
        size={24}
        color={isActive ? '#ffffff' : (isTracking ? '#3b82f6' : (isDarkMode ? '#f3f4f6' : '#111827'))}
        fill={isTracking ? (isActive ? '#ffffff' : (isMapAtUserLocation ? '#3b82f6' : 'none')) : 'none'}
      />
    ),
    title: 'My Location',
    alwaysVisible: true,
    defaultState: false,
  },
];

export function getControlConfig(id: string): ControlConfig | undefined {
  return MAP_CONTROLS.find(control => control.id === id);
}
