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
  ],
};

/**
 * Root reducer configuration - carpark selection only
 */
const rootReducer = combineReducers({
  carparkSelection: persistReducer(carparkSelectionPersistConfig, carparkSelectionReducer),
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
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
