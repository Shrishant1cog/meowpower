import { create } from "zustand"

interface UiState {
  sidebarCollapsed: boolean
  youtubeUrl: string
  localFileName: string | null
  localFileSize: number | null
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setYoutubeUrl: (url: string) => void
  setLocalFile: (file: { name: string; size: number } | null) => void
  clearSource: () => void
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  youtubeUrl: "",
  localFileName: null,
  localFileSize: null,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setYoutubeUrl: (youtubeUrl) => set({ youtubeUrl }),
  setLocalFile: (file) =>
    set({
      localFileName: file?.name ?? null,
      localFileSize: file?.size ?? null,
    }),
  clearSource: () => set({ youtubeUrl: "", localFileName: null, localFileSize: null }),
}))
