// store/uiStore.js — Zustand global UI store
// Connected to App.js for sidebar collapse state
import { create } from "zustand";

export const useUIStore = create((set) => ({
  // 📂 Sidebar Collapse — synced with localStorage
  sidebarCollapsed: (() => {
    try {
      return JSON.parse(localStorage.getItem("sidebarCollapsed") || "false");
    } catch {
      return false;
    }
  })(),
  toggleSidebar: () =>
    set((state) => {
      const newCollapsed = !state.sidebarCollapsed;
      localStorage.setItem("sidebarCollapsed", JSON.stringify(newCollapsed));
      return { sidebarCollapsed: newCollapsed };
    }),
  setSidebarCollapsed: (val) => {
    localStorage.setItem("sidebarCollapsed", JSON.stringify(val));
    set({ sidebarCollapsed: val });
  },

  // 🔔 Notifications
  notifications: [],
  addNotification: (msg) =>
    set((state) => ({
      notifications: [
        { id: Date.now(), message: msg, ts: new Date().toISOString() },
        ...state.notifications,
      ].slice(0, 20), // keep last 20
    })),
  clearNotifications: () => set({ notifications: [] }),
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  // 🗂 Active Tab
  activeTab: "chat",
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
