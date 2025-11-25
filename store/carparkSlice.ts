"use client";

import { createSlice, PayloadAction, createSelector } from "@reduxjs/toolkit";
import type { RootState } from "./store";
import { CarparkWithVacancy, CarparkWithDistance } from "@/types/indoor-carpark";
import { MeteredCarpark } from "@/types/metered-carpark";
import { ConnectedCarpark } from "@/types/connected-carpark";
import { DispatchCarpark } from "@/types/dispatch-carpark";

/**
 * Bottom sheet view states for carpark navigation
 */
export type BottomSheetView =
  | 'home'
  | 'nearby'
  | 'station'
  | 'metered-carpark'
  | 'connected-carpark'
  | 'dispatch-carpark';

/**
 * Carpark type discriminator
 */
export type CarparkType = 'indoor' | 'metered' | 'connected' | 'dispatch';

/**
 * Trending tab type for the home view
 */
export type TrendingTab = 'indoor' | 'metered';

/**
 * Union type for all carpark types
 */
export type CarparkUnion = CarparkWithVacancy | MeteredCarpark | ConnectedCarpark | DispatchCarpark;

/**
 * Search location interface
 */
interface SearchLocation {
  lat: number;
  lng: number;
  address: string;
}

/**
 * Camera position for restoration
 */
interface CameraPosition {
  lat: number;
  lng: number;
  zoom: number;
  tilt?: number;
}

/**
 * Filter options for carpark display
 */
interface FilterOptions {
  showIndoor: boolean;
  showMetered: boolean;
  showConnected: boolean;
  showDispatch: boolean;
  maxDistance?: number;
}

/**
 * Carpark selection state interface
 * Follows the pattern from bookingSlice with step-based navigation
 */
export interface CarparkSelectionState {
  // Step navigation (similar to booking)
  step: number; // 1 = browsing, 2 = carpark selected, 3 = detail view (future)
  stepName: string;

  // Selected carpark data
  selectedCarparkId: string | null;
  selectedCarparkType: CarparkType | null;
  selectedCarpark: CarparkUnion | null;

  // Navigation state
  previousView: BottomSheetView | null;
  bottomSheetView: BottomSheetView;
  bottomSheetHeight: number; // Height in pixels for current sheet state
  isBottomSheetOpen: boolean;

  // Search/filter state
  searchLocation: SearchLocation | null;
  nearbyCarparks: CarparkWithDistance[];
  filterOptions: FilterOptions;

  // Camera position (for restoration on back)
  lastCameraPosition: CameraPosition | null;

  // Animation state
  isAnimating: boolean;

  // Trending tab selection (persists across navigation)
  trendingTab: TrendingTab;
}

/**
 * Initial state with sensible defaults
 */
const initialState: CarparkSelectionState = {
  step: 1,
  stepName: "browsing_carparks",

  selectedCarparkId: null,
  selectedCarparkType: null,
  selectedCarpark: null,

  previousView: null,
  bottomSheetView: 'home',
  bottomSheetHeight: 100, // Minimized state
  isBottomSheetOpen: false,

  searchLocation: null,
  nearbyCarparks: [],
  filterOptions: {
    showIndoor: true,
    showMetered: true,
    showConnected: true,
    showDispatch: true,
    maxDistance: undefined,
  },

  lastCameraPosition: null,
  isAnimating: false,
  trendingTab: 'indoor',
};

/**
 * Carpark selection slice
 * Manages all carpark selection state similar to how bookingSlice manages station booking
 */
const carparkSlice = createSlice({
  name: "carparkSelection",
  initialState,
  reducers: {
    /**
     * Select a carpark and advance to step 2
     */
    selectCarpark: (
      state,
      action: PayloadAction<{
        id: string;
        type: CarparkType;
        data: CarparkUnion;
      }>
    ) => {
      state.selectedCarparkId = action.payload.id;
      state.selectedCarparkType = action.payload.type;
      state.selectedCarpark = action.payload.data;
      state.step = 2;
      state.stepName = "carpark_selected";

      // Set appropriate view based on carpark type
      switch (action.payload.type) {
        case 'indoor':
          state.bottomSheetView = 'station';
          break;
        case 'metered':
          state.bottomSheetView = 'metered-carpark';
          break;
        case 'connected':
          state.bottomSheetView = 'connected-carpark';
          break;
        case 'dispatch':
          state.bottomSheetView = 'dispatch-carpark';
          break;
      }
    },

    /**
     * Clear carpark selection and return to step 1
     */
    clearCarparkSelection: (state) => {
      state.selectedCarparkId = null;
      state.selectedCarparkType = null;
      state.selectedCarpark = null;
      state.step = 1;
      state.stepName = "browsing_carparks";
    },

    /**
     * Set bottom sheet view with history tracking
     */
    setBottomSheetView: (state, action: PayloadAction<BottomSheetView>) => {
      state.previousView = state.bottomSheetView;
      state.bottomSheetView = action.payload;
    },

    /**
     * Set bottom sheet open state
     */
    setBottomSheetOpen: (state, action: PayloadAction<boolean>) => {
      state.isBottomSheetOpen = action.payload;
    },

    /**
     * Set bottom sheet height
     */
    setBottomSheetHeight: (state, action: PayloadAction<number>) => {
      state.bottomSheetHeight = action.payload;
    },

    /**
     * Navigate back intelligently based on current view
     */
    goBack: (state) => {
      if (state.bottomSheetView === 'station' ||
          state.bottomSheetView === 'metered-carpark' ||
          state.bottomSheetView === 'connected-carpark' ||
          state.bottomSheetView === 'dispatch-carpark') {
        // Go back to nearby if we have nearby carparks, otherwise home
        state.bottomSheetView = state.nearbyCarparks.length > 0 ? 'nearby' : 'home';
        state.selectedCarparkId = null;
        state.selectedCarparkType = null;
        state.selectedCarpark = null;
        state.step = 1;
        state.stepName = "browsing_carparks";
      } else if (state.bottomSheetView === 'nearby') {
        // From nearby to home
        state.bottomSheetView = 'home';
        state.searchLocation = null;
        state.nearbyCarparks = [];
      } else if (state.bottomSheetView === 'home') {
        // Already at home, do nothing
        return;
      }
    },

    /**
     * Advance to a specific step
     */
    advanceCarparkStep: (state, action: PayloadAction<number>) => {
      const newStep = action.payload;

      // Prevent skipping steps
      if (newStep > state.step + 1 && newStep !== state.step) {
        console.warn(`Cannot advance from step ${state.step} to ${newStep}`);
        return;
      }

      state.step = newStep;

      // Update step name based on step
      switch (newStep) {
        case 1:
          state.stepName = "browsing_carparks";
          break;
        case 2:
          state.stepName = "carpark_selected";
          break;
        case 3:
          state.stepName = "carpark_action"; // For future booking/navigation
          break;
      }
    },

    /**
     * Update search location
     */
    setSearchLocation: (state, action: PayloadAction<SearchLocation | null>) => {
      state.searchLocation = action.payload;
    },

    /**
     * Clear search location
     */
    clearSearchLocation: (state) => {
      state.searchLocation = null;
      state.nearbyCarparks = [];
    },

    /**
     * Set nearby carparks
     */
    setNearbyCarparks: (state, action: PayloadAction<CarparkWithDistance[]>) => {
      state.nearbyCarparks = action.payload;
    },

    /**
     * Update filter options
     */
    setFilterOptions: (state, action: PayloadAction<Partial<FilterOptions>>) => {
      state.filterOptions = {
        ...state.filterOptions,
        ...action.payload,
      };
    },

    /**
     * Save current camera position for restoration
     */
    saveCameraPosition: (state, action: PayloadAction<CameraPosition>) => {
      state.lastCameraPosition = action.payload;
    },

    /**
     * Clear camera position
     */
    clearCameraPosition: (state) => {
      state.lastCameraPosition = null;
    },

    /**
     * Set animation state
     */
    setIsAnimating: (state, action: PayloadAction<boolean>) => {
      state.isAnimating = action.payload;
    },

    /**
     * Set trending tab selection
     */
    setTrendingTab: (state, action: PayloadAction<TrendingTab>) => {
      state.trendingTab = action.payload;
    },

    /**
     * Reset entire carpark selection state
     */
    resetCarparkSelection: (state) => {
      Object.assign(state, initialState);
    },
  },
});

// ============================================================================
// ACTIONS
// ============================================================================

export const {
  selectCarpark,
  clearCarparkSelection,
  setBottomSheetView,
  setBottomSheetOpen,
  setBottomSheetHeight,
  goBack,
  advanceCarparkStep,
  setSearchLocation,
  clearSearchLocation,
  setNearbyCarparks,
  setFilterOptions,
  saveCameraPosition,
  clearCameraPosition,
  setIsAnimating,
  setTrendingTab,
  resetCarparkSelection,
} = carparkSlice.actions;

// ============================================================================
// SELECTORS
// ============================================================================

/**
 * Base selectors
 */
export const selectCarparkSelectionState = (state: RootState) => state.carparkSelection;
export const selectCarparkStep = (state: RootState) => state.carparkSelection.step;
export const selectCarparkStepName = (state: RootState) => state.carparkSelection.stepName;
export const selectSelectedCarparkId = (state: RootState) => state.carparkSelection.selectedCarparkId;
export const selectSelectedCarparkType = (state: RootState) => state.carparkSelection.selectedCarparkType;
export const selectSelectedCarpark = (state: RootState) => state.carparkSelection.selectedCarpark;
export const selectBottomSheetView = (state: RootState) => state.carparkSelection.bottomSheetView;
export const selectPreviousView = (state: RootState) => state.carparkSelection.previousView;
export const selectBottomSheetHeight = (state: RootState) => state.carparkSelection.bottomSheetHeight;
export const selectIsBottomSheetOpen = (state: RootState) => state.carparkSelection.isBottomSheetOpen;
export const selectSearchLocation = (state: RootState) => state.carparkSelection.searchLocation;
export const selectNearbyCarparks = (state: RootState) => state.carparkSelection.nearbyCarparks;
export const selectFilterOptions = (state: RootState) => state.carparkSelection.filterOptions;
export const selectLastCameraPosition = (state: RootState) => state.carparkSelection.lastCameraPosition;
export const selectIsAnimating = (state: RootState) => state.carparkSelection.isAnimating;
export const selectTrendingTab = (state: RootState) => state.carparkSelection.trendingTab;

/**
 * Memoized selectors
 */

/**
 * Check if back button should be shown
 */
export const selectShowBackButton = createSelector(
  [selectBottomSheetView],
  (view) => view !== 'home'
);

/**
 * Get bottom sheet title based on current view
 */
export const selectBottomSheetTitle = createSelector(
  [selectBottomSheetView],
  (view) => {
    switch (view) {
      case 'station':
        return 'Indoor Carpark';
      case 'metered-carpark':
        return 'Metered Carpark';
      case 'connected-carpark':
        return 'Connected Carpark';
      case 'dispatch-carpark':
        return 'Dispatch Carpark';
      case 'nearby':
        return 'Nearby Carparks';
      case 'home':
      default:
        return 'Search Carparks';
    }
  }
);

/**
 * Check if a carpark is currently selected
 */
export const selectHasSelectedCarpark = createSelector(
  [selectSelectedCarparkId],
  (id) => id !== null
);

/**
 * Get selected carpark coordinates (if available)
 */
export const selectSelectedCarparkCoords = createSelector(
  [selectSelectedCarpark, selectSelectedCarparkType],
  (carpark, type) => {
    if (!carpark) return null;

    // Handle different carpark type coordinate structures
    if ('latitude' in carpark && 'longitude' in carpark) {
      return {
        lat: carpark.latitude,
        lng: carpark.longitude,
      };
    }

    return null;
  }
);

/**
 * Check if currently in browsing state (step 1)
 */
export const selectIsBrowsing = createSelector(
  [selectCarparkStep],
  (step) => step === 1
);

/**
 * Check if currently in selected state (step 2)
 */
export const selectIsCarparkSelected = createSelector(
  [selectCarparkStep],
  (step) => step === 2
);

// ============================================================================
// REDUCER
// ============================================================================

export default carparkSlice.reducer;
