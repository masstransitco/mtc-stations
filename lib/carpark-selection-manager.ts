import { store } from "@/store/store";
import type { CarparkUnion, CarparkType } from "@/store/carparkSlice";
import {
  selectCarparkStep,
  selectCarpark,
  clearCarparkSelection,
  setBottomSheetView,
  setBottomSheetOpen,
  advanceCarparkStep,
  goBack,
  clearSearchLocation,
  saveCameraPosition,
  setIsAnimating,
  selectBottomSheetView,
  selectNearbyCarparks,
  selectSearchLocation,
} from "@/store/carparkSlice";
import { toast } from "react-hot-toast";

// NOTE: We're NOT importing from mtc-app-src/store/bookingSlice here
// because this is a different app with a different booking flow.
// However, IF you want to integrate with a booking system in the future,
// you would import and dispatch booking actions here.

// Note: Camera animations are handled by the map component directly
// The advanced cameraAnimationManager from mtc-app-src is not compatible with this directory structure

/**
 * CarparkSelectionManager - Singleton pattern for managing carpark selection
 *
 * This manager centralizes all carpark selection logic, similar to StationSelectionManager.
 * It provides a clean API for selecting carparks, navigating back, and managing the UI state.
 *
 * Key features:
 * - Batched Redux updates to minimize re-renders
 * - Integrated camera animations
 * - Smart back navigation based on current view
 * - Type-safe carpark selection
 *
 * Usage:
 *   import carparkManager from '@/lib/carparkSelectionManager';
 *   carparkManager.selectCarpark(carparkId, 'indoor', carparkData);
 */
class CarparkSelectionManager {
  // Singleton implementation
  private static instance: CarparkSelectionManager;

  private constructor() {}

  public static getInstance(): CarparkSelectionManager {
    if (!CarparkSelectionManager.instance) {
      CarparkSelectionManager.instance = new CarparkSelectionManager();
    }
    return CarparkSelectionManager.instance;
  }

  /**
   * Gets the current carpark selection step from the store
   */
  public getCurrentStep(): number {
    return store.getState().carparkSelection.step;
  }

  /**
   * Gets the current bottom sheet view
   */
  public getCurrentView(): string {
    return store.getState().carparkSelection.bottomSheetView;
  }

  /**
   * Extract coordinates from different carpark types
   */
  private getCarparkCoordinates(carpark: CarparkUnion): { lat: number; lng: number } | null {
    if ('latitude' in carpark && 'longitude' in carpark) {
      return {
        lat: carpark.latitude,
        lng: carpark.longitude,
      };
    }
    return null;
  }

  /**
   * Get carpark ID from different carpark types
   */
  private getCarparkId(carpark: CarparkUnion, type: CarparkType): string {
    switch (type) {
      case 'indoor':
        return 'park_id' in carpark ? carpark.park_id : '';
      case 'metered':
        return 'carpark_id' in carpark ? carpark.carpark_id : '';
      case 'connected':
        return 'park_id' in carpark ? carpark.park_id : '';
      case 'dispatch':
        return 'id' in carpark ? carpark.id : '';
      default:
        return '';
    }
  }

  /**
   * Get carpark name from different carpark types
   */
  private getCarparkName(carpark: CarparkUnion): string {
    if ('name' in carpark) {
      return carpark.name;
    }
    return 'Unknown Carpark';
  }

  /**
   * Select a carpark and update the Redux state with batched updates
   *
   * @param carparkId The carpark ID to select
   * @param carparkType The type of carpark (indoor, metered, connected, dispatch)
   * @param carparkData The full carpark data object
   * @param disableAnimation Whether to skip camera animation (default: false)
   */
  public selectCarpark(
    carparkId: string,
    carparkType: CarparkType,
    carparkData: CarparkUnion,
    disableAnimation = false
  ): void {
    // Import batch from react-redux to batch multiple updates together
    const { batch } = require('react-redux');

    const state = store.getState();
    const currentStep = state.carparkSelection.step;

    console.log(`[carparkSelectionManager] Selecting ${carparkType} carpark: ${carparkId}`);

    // Save current camera position before selecting (for back navigation)
    if (!disableAnimation) {
      const currentMap = (window as any).map;
      if (currentMap && currentMap.getCenter && currentMap.getZoom) {
        const center = currentMap.getCenter();
        const zoom = currentMap.getZoom();

        batch(() => {
          store.dispatch(saveCameraPosition({
            lat: center.lat(),
            lng: center.lng(),
            zoom: zoom,
          }));
        });
      }
    }

    // OPTIMIZATION: Batch all Redux updates to reduce re-renders
    batch(() => {
      // Select the carpark (this also sets the view and advances to step 2)
      store.dispatch(selectCarpark({
        id: carparkId,
        type: carparkType,
        data: carparkData,
      }));

      // Open the bottom sheet
      store.dispatch(setBottomSheetOpen(true));

      // Advance to step 2 (carpark selected)
      store.dispatch(advanceCarparkStep(2));
    });

    // Skip camera animation if disabled
    if (disableAnimation) {
      console.log('[carparkSelectionManager] Camera animation disabled for this carpark selection');
      return;
    }

    // Camera animation is handled by the map component's useEffect
    // No need to manually trigger animation here

    // Show success toast
    const carparkName = this.getCarparkName(carparkData);
    toast.success(`Selected: ${carparkName}`);
  }

  /**
   * Clear the current carpark selection and return to browsing state
   *
   * @param skipToast Whether to skip showing the toast notification (default: false)
   */
  public clearSelection(skipToast = false): void {
    const { batch } = require('react-redux');

    const state = store.getState().carparkSelection;
    const currentView = state.bottomSheetView;

    console.log('[carparkSelectionManager] Clearing carpark selection');

    // OPTIMIZATION: Batch all Redux updates
    batch(() => {
      store.dispatch(clearCarparkSelection());
      store.dispatch(advanceCarparkStep(1));

      // Reset to home view
      store.dispatch(setBottomSheetView('home'));
    });

    // Camera restoration is handled by the map component
    // No manual camera control needed here

    if (!skipToast) {
      toast.success('Selection cleared');
    }
  }

  /**
   * Navigate back intelligently based on current view
   * This uses the goBack action which has smart navigation logic
   *
   * IMPORTANT: When going back from a carpark detail view, we need to:
   * 1. Clear the selection state (so markers return to normal)
   * 2. Update the view
   * 3. Reset the step to 1 (browsing)
   */
  public navigateBack(): void {
    const { batch } = require('react-redux');

    const state = store.getState().carparkSelection;
    const currentView = state.bottomSheetView;
    const nearbyCarparks = state.nearbyCarparks;
    const currentStep = state.step;

    console.log(`[carparkSelectionManager] Navigating back from view: ${currentView}, step: ${currentStep}`);

    if (
      currentView === 'station' ||
      currentView === 'metered-carpark' ||
      currentView === 'connected-carpark' ||
      currentView === 'dispatch-carpark'
    ) {
      // Going back from a selected carpark (step 2 → step 1)
      const targetView = nearbyCarparks.length > 0 ? 'nearby' : 'home';

      batch(() => {
        // Use goBack action which handles clearing selection AND changing view
        store.dispatch(goBack());

        // Also explicitly ensure we're back to step 1
        store.dispatch(advanceCarparkStep(1));

        if (targetView === 'home') {
          store.dispatch(clearSearchLocation());
        }
      });

      // Camera position restoration handled by map component

      toast.success('Back to search');
    } else if (currentView === 'nearby') {
      // Going back from nearby list to home
      batch(() => {
        store.dispatch(goBack());
      });

      toast.success('Back to home');
    } else if (currentView === 'home') {
      // Already at home, do nothing
      console.log('[carparkSelectionManager] Already at home view');
    }
  }

  /**
   * Handle marker click - convenience method for map marker interactions
   *
   * @param carparkData The carpark data from the marker
   * @param carparkType The type of carpark
   */
  public handleMarkerClick(carparkData: CarparkUnion, carparkType: CarparkType): void {
    const carparkId = this.getCarparkId(carparkData, carparkType);
    this.selectCarpark(carparkId, carparkType, carparkData);
  }

  /**
   * Handle list item click - convenience method for list interactions
   * May have different animation behavior than marker clicks
   *
   * @param carparkData The carpark data from the list
   * @param carparkType The type of carpark
   */
  public handleListClick(carparkData: CarparkUnion, carparkType: CarparkType): void {
    const carparkId = this.getCarparkId(carparkData, carparkType);
    this.selectCarpark(carparkId, carparkType, carparkData);
  }

  /**
   * Reset the entire carpark selection state to initial values
   * Use sparingly - typically only needed on logout or app reset
   */
  public reset(): void {
    const { batch } = require('react-redux');

    console.log('[carparkSelectionManager] Resetting entire carpark selection state');

    batch(() => {
      store.dispatch(clearCarparkSelection());
      store.dispatch(setBottomSheetView('home'));
      store.dispatch(setBottomSheetOpen(false));
      store.dispatch(clearSearchLocation());
      store.dispatch(advanceCarparkStep(1));
    });

    // Camera reset handled by map component
  }

  /**
   * Set animation state (useful for preventing interactions during animations)
   *
   * @param isAnimating Whether an animation is currently in progress
   */
  public setAnimating(isAnimating: boolean): void {
    store.dispatch(setIsAnimating(isAnimating));
  }
}

// Export singleton instance
export default CarparkSelectionManager.getInstance();

/**
 * Lazy-load helper for async imports
 * Usage: const manager = await getCarparkManager();
 */
export const getCarparkManager = async (): Promise<CarparkSelectionManager> => {
  return CarparkSelectionManager.getInstance();
};
