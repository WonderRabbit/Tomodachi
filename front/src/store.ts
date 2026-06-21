import { create } from "zustand";

interface UiState {
  sidebarCollapsed: boolean;
  detailRailOpen: boolean;
  toggleSidebar: () => void;
  toggleDetailRail: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  detailRailOpen: true,
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  toggleDetailRail: () =>
    set((state) => ({ detailRailOpen: !state.detailRailOpen })),
}));
