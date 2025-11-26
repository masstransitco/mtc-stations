"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { shallowEqual } from "react-redux";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { toast } from "react-hot-toast";
import {
  selectCarparkStep,
  selectSelectedCarparkId,
  selectSelectedCarparkType,
  selectSelectedCarpark,
  selectBottomSheetView,
  selectIsBottomSheetOpen,
  selectBottomSheetHeight,
  selectSearchLocation,
  selectNearbyCarparks,
  selectFilterOptions,
  selectIsAnimating,
  selectBottomSheetTitle,
  selectShowBackButton,
  selectSelectedCarparkCoords,
  selectRecentSearches,
  setBottomSheetView,
  setBottomSheetOpen,
  setBottomSheetHeight,
  setSearchLocation,
  setNearbyCarparks,
  setFilterOptions,
  addRecentSearch,
  removeRecentSearch,
} from "@/store/carparkSlice";
import type { RecentSearch } from "@/store/carparkSlice";
import type { CarparkUnion, CarparkType, BottomSheetView } from "@/store/carparkSlice";

// Reference to the CarparkSelectionManager instance
let carparkManagerPromise: Promise<any> | null = null;

// Helper function to get the CarparkSelectionManager
const getCarparkManager = () => {
  if (!carparkManagerPromise) {
    carparkManagerPromise = import("@/lib/carpark-selection-manager").then(module => module.default);
  }
  return carparkManagerPromise;
};

/**
 * Hook to handle carpark selection actions
 *
 * This hook provides:
 * - Access to all carpark selection state from Redux
 * - Handlers for selecting/clearing carparks
 * - Back navigation logic
 * - Bottom sheet management
 * - Search and filter functionality
 *
 * Usage:
 *   const {
 *     selectedCarpark,
 *     handleSelectCarpark,
 *     handleClearSelection,
 *     handleBack,
 *   } = useCarparkActions();
 */
export function useCarparkActions() {
  const dispatch = useAppDispatch();
  const carparkManagerRef = useRef<any>(null);

  // Load the CarparkSelectionManager on mount
  useEffect(() => {
    getCarparkManager().then(manager => {
      carparkManagerRef.current = manager;
    });
  }, []);

  // Get all necessary state in a single selector call to reduce re-renders
  const {
    step,
    selectedCarparkId,
    selectedCarparkType,
    selectedCarpark,
    bottomSheetView,
    isBottomSheetOpen,
    bottomSheetHeight,
    searchLocation,
    nearbyCarparks,
    filterOptions,
    isAnimating,
    recentSearches,
  } = useAppSelector(
    state => ({
      step: selectCarparkStep(state),
      selectedCarparkId: selectSelectedCarparkId(state),
      selectedCarparkType: selectSelectedCarparkType(state),
      selectedCarpark: selectSelectedCarpark(state),
      bottomSheetView: selectBottomSheetView(state),
      isBottomSheetOpen: selectIsBottomSheetOpen(state),
      bottomSheetHeight: selectBottomSheetHeight(state),
      searchLocation: selectSearchLocation(state),
      nearbyCarparks: selectNearbyCarparks(state),
      filterOptions: selectFilterOptions(state),
      isAnimating: selectIsAnimating(state),
      recentSearches: selectRecentSearches(state),
    }),
    shallowEqual
  );

  // Derived state using memoized selectors
  const bottomSheetTitle = useAppSelector(selectBottomSheetTitle);
  const showBackButton = useAppSelector(selectShowBackButton);
  const selectedCarparkCoords = useAppSelector(selectSelectedCarparkCoords);

  // Derived state for checking if we have a selected carpark
  const hasSelectedCarpark = useMemo(
    () => selectedCarparkId !== null,
    [selectedCarparkId]
  );

  /**
   * Handler to select a carpark
   */
  const handleSelectCarpark = useCallback(
    async (carparkData: CarparkUnion, carparkType: CarparkType, disableAnimation = false) => {
      if (isAnimating && !disableAnimation) {
        toast.success("Please wait for animation to complete");
        return;
      }

      const manager = await getCarparkManager();

      // Extract carpark ID based on type
      let carparkId = '';
      switch (carparkType) {
        case 'indoor':
          carparkId = 'park_id' in carparkData ? carparkData.park_id : '';
          break;
        case 'metered':
          carparkId = 'carpark_id' in carparkData ? carparkData.carpark_id : '';
          break;
        case 'connected':
          carparkId = 'park_id' in carparkData ? carparkData.park_id : '';
          break;
        case 'dispatch':
          carparkId = 'id' in carparkData ? carparkData.id : '';
          break;
      }

      manager.selectCarpark(carparkId, carparkType, carparkData, disableAnimation);
    },
    [isAnimating]
  );

  /**
   * Handler to clear carpark selection
   */
  const handleClearSelection = useCallback(async () => {
    if (isAnimating) {
      toast.success("Please wait for animation to complete");
      return;
    }

    const manager = await getCarparkManager();
    manager.clearSelection();
  }, [isAnimating]);

  /**
   * Handler for back button navigation
   */
  const handleBack = useCallback(async () => {
    const manager = await getCarparkManager();
    manager.navigateBack();
  }, []);

  /**
   * Handler for marker click
   */
  const handleMarkerClick = useCallback(
    async (carparkData: CarparkUnion, carparkType: CarparkType) => {
      const manager = await getCarparkManager();
      manager.handleMarkerClick(carparkData, carparkType);
    },
    []
  );

  /**
   * Handler for list item click
   */
  const handleListClick = useCallback(
    async (carparkData: CarparkUnion, carparkType: CarparkType) => {
      const manager = await getCarparkManager();
      manager.handleListClick(carparkData, carparkType);
    },
    []
  );

  /**
   * Handler to update bottom sheet view
   */
  const handleSetBottomSheetView = useCallback(
    (view: BottomSheetView) => {
      dispatch(setBottomSheetView(view));
    },
    [dispatch]
  );

  /**
   * Handler to update bottom sheet open state
   */
  const handleSetBottomSheetOpen = useCallback(
    (isOpen: boolean) => {
      dispatch(setBottomSheetOpen(isOpen));
    },
    [dispatch]
  );

  /**
   * Handler to update bottom sheet height
   */
  const handleSetBottomSheetHeight = useCallback(
    (height: number) => {
      dispatch(setBottomSheetHeight(height));
    },
    [dispatch]
  );

  /**
   * Handler to update search location
   */
  const handleSetSearchLocation = useCallback(
    (location: { lat: number; lng: number; address: string } | null) => {
      dispatch(setSearchLocation(location));
    },
    [dispatch]
  );

  /**
   * Handler to update nearby carparks
   */
  const handleSetNearbyCarparks = useCallback(
    (carparks: any[]) => {
      dispatch(setNearbyCarparks(carparks));
    },
    [dispatch]
  );

  /**
   * Handler to update filter options
   */
  const handleSetFilterOptions = useCallback(
    (options: Partial<typeof filterOptions>) => {
      dispatch(setFilterOptions(options));
    },
    [dispatch, filterOptions]
  );

  /**
   * Handler to add a recent search
   */
  const handleAddRecentSearch = useCallback(
    (search: RecentSearch) => {
      dispatch(addRecentSearch(search));
    },
    [dispatch]
  );

  /**
   * Handler to remove a recent search
   */
  const handleRemoveRecentSearch = useCallback(
    (placeId: string) => {
      dispatch(removeRecentSearch(placeId));
    },
    [dispatch]
  );

  /**
   * Handler to reset entire carpark selection state
   */
  const handleReset = useCallback(async () => {
    const manager = await getCarparkManager();
    manager.reset();
  }, []);

  return {
    // State
    step,
    selectedCarparkId,
    selectedCarparkType,
    selectedCarpark,
    bottomSheetView,
    isBottomSheetOpen,
    bottomSheetHeight,
    searchLocation,
    nearbyCarparks,
    filterOptions,
    isAnimating,
    recentSearches,

    // Derived state
    bottomSheetTitle,
    showBackButton,
    selectedCarparkCoords,
    hasSelectedCarpark,

    // Handlers
    handleSelectCarpark,
    handleClearSelection,
    handleBack,
    handleMarkerClick,
    handleListClick,
    handleSetBottomSheetView,
    handleSetBottomSheetOpen,
    handleSetBottomSheetHeight,
    handleSetSearchLocation,
    handleSetNearbyCarparks,
    handleSetFilterOptions,
    handleAddRecentSearch,
    handleRemoveRecentSearch,
    handleReset,
  };
}

/**
 * Export the getCarparkManager helper for use in other components
 */
export { getCarparkManager };
