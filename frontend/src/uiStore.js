// store/uiStore.js
import { create } from "zustand";

export const useUIStore = create((set) => ({
  // 🌙 Dark Mode
  darkMode: true,
  toggleDarkMode: () =>
    set((state) => {
      const newMode = !state.darkMode;
      localStorage.setItem("darkMode", JSON.stringify(newMode));
      return { darkMode: newMode };
    }),

  // 📂 Sidebar Collapse
  sidebarCollapsed: false,
  toggleSidebar: () =>
    set((state) => {
      const newCollapsed = !state.sidebarCollapsed;
      localStorage.setItem("sidebarCollapsed", JSON.stringify(newCollapsed));
      return { sidebarCollapsed: newCollapsed };
    }),

  // 🔔 Notifications
  notifications: [],
  addNotification: (msg) =>
    set((state) => ({ notifications: [...state.notifications, msg] })),
  clearNotifications: () => set({ notifications: [] }),

  // 🗂 Active Tab
  activeTab: "chat",
  setActiveTab: (tab) => set({ activeTab: tab }),
}));

