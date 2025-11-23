import { MapControlButton } from './map-control-button';
import { MAP_CONTROLS } from './controls-config';
import { useMapControls } from '@/hooks/use-map-controls';

interface MapControlsProps {
  currentZoom: number;
  isDarkMode: boolean;
  onControlChange: (id: string, enabled: boolean) => void;
  // Props for location button special behavior
  isTracking?: boolean;
  isCameraLocked?: boolean;
  isMapAtUserLocation?: boolean;
}

export function MapControls({
  currentZoom,
  isDarkMode,
  onControlChange,
  isTracking = false,
  isCameraLocked = false,
  isMapAtUserLocation = false,
}: MapControlsProps) {
  const controls = useMapControls(MAP_CONTROLS);
  const visibleControls = controls.getVisibleControls(currentZoom);

  const handleControlClick = (id: string) => {
    const wasActive = controls.isControlActive(id);
    controls.toggleControl(id);
    onControlChange(id, !wasActive);
  };

  return (
    <>
      {visibleControls.map((control, index) => {
        const isActive = controls.isControlActive(control.id);

        // Special handling for location button (uses isCameraLocked for isActive state)
        const effectiveIsActive = control.id === 'location' ? isCameraLocked : isActive;

        return (
          <MapControlButton
            key={control.id}
            icon={control.icon({
              isActive: effectiveIsActive,
              isDarkMode,
              isTracking,
              isMapAtUserLocation
            })}
            onClick={() => handleControlClick(control.id)}
            isActive={effectiveIsActive}
            title={control.title}
            isDarkMode={isDarkMode}
            position={index}
          />
        );
      })}
    </>
  );
}
