import { useState, useCallback, useMemo } from 'react';
import { ControlConfig } from '@/components/map-controls/controls-config';

export interface MapControlsState {
  activeControls: Set<string>;
  toggleControl: (id: string) => void;
  isControlActive: (id: string) => boolean;
  isControlVisible: (control: ControlConfig, zoom: number) => boolean;
  getVisibleControls: (zoom: number) => ControlConfig[];
}

export function useMapControls(controls: ControlConfig[]): MapControlsState {
  // Initialize with default states from config
  const initialActiveControls = useMemo(() => {
    const active = new Set<string>();
    controls.forEach(control => {
      if (control.defaultState) {
        active.add(control.id);
      }
    });
    return active;
  }, [controls]);

  const [activeControls, setActiveControls] = useState<Set<string>>(initialActiveControls);

  // Toggle a control on/off
  const toggleControl = useCallback((id: string) => {
    setActiveControls(prev => {
      const next = new Set(prev);
      const control = controls.find(c => c.id === id);

      if (!control) return prev;

      if (next.has(id)) {
        // Turning OFF
        next.delete(id);
      } else {
        // Turning ON
        next.add(id);

        // Disable any exclusive controls
        if (control.exclusiveWith) {
          control.exclusiveWith.forEach(exclusiveId => {
            next.delete(exclusiveId);
          });
        }
      }

      return next;
    });
  }, [controls]);

  // Check if a control is currently active
  const isControlActive = useCallback((id: string) => {
    return activeControls.has(id);
  }, [activeControls]);

  // Check if a control should be visible based on zoom and exclusivity
  const isControlVisible = useCallback((control: ControlConfig, zoom: number) => {
    // Always visible controls
    if (control.alwaysVisible) return true;

    // Check zoom requirement
    if (control.minZoom !== undefined && zoom < control.minZoom) {
      return false;
    }

    // Check exclusivity - hide if an exclusive control is active
    if (control.exclusiveWith) {
      for (const exclusiveId of control.exclusiveWith) {
        if (activeControls.has(exclusiveId)) {
          return false;
        }
      }
    }

    return true;
  }, [activeControls]);

  // Get list of visible controls for current zoom level
  const getVisibleControls = useCallback((zoom: number) => {
    return controls.filter(control => isControlVisible(control, zoom));
  }, [controls, isControlVisible]);

  return {
    activeControls,
    toggleControl,
    isControlActive,
    isControlVisible,
    getVisibleControls,
  };
}
