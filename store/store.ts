import { configureStore, combineReducers } from "@reduxjs/toolkit";
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist";
import storage from "redux-persist/lib/storage";
import carparkSelectionReducer from "./carparkSlice";
import userReducer from "./userSlice";

/**
 * Carpark selection persist config for maintaining selection state across sessions
 */
const carparkSelectionPersistConfig = {
  key: "carparkSelection",
  storage,
  whitelist: [
    "step",
    "stepName",
    "selectedCarparkId",
    "selectedCarparkType",
    "selectedCarpark",
    "bottomSheetView",
    "isBottomSheetOpen",
    "searchLocation",
    "nearbyCarparks",
    "filterOptions",
    "lastCameraPosition",
    "recentSearches",
  ],
};

/**
 * User persist config - only persist non-sensitive UI state
 * Auth state is managed by Supabase session cookies
 */
const userPersistConfig = {
  key: "user",
  storage,
  whitelist: [
    // Only persist UI preferences, not auth state
    // Auth state is restored from Supabase session on page load
  ],
};

/**
 * Root reducer configuration
 */
const rootReducer = combineReducers({
  carparkSelection: persistReducer(carparkSelectionPersistConfig, carparkSelectionReducer),
  user: userReducer, // User auth state managed by Supabase, not persisted to localStorage
});

/**
 * Store configuration
 */
export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        // Ignore these paths for serialization check (Supabase objects)
        ignoredPaths: ["user.session"],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
