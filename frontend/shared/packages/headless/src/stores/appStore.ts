import { createAppStore } from "./createAppStore";

export const useAppStore = createAppStore({
  portalType: "headless",
  secureStorage: true,
});

export type {
  AppStore,
  FilterState,
  PaginationState,
  SelectionState,
  LoadingState,
  UIState,
  PreferencesState,
  ContextState,
  NotificationItem,
} from "./types";
