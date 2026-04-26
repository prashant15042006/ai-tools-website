// ThemeToggle.js
import React from "react";
import { useUIStore } from "./uiStore";

export default function ThemeToggle() {
  const { darkMode, toggleDarkMode } = useUIStore();

  return (
    <button
      onClick={toggleDarkMode}
      style={{
        width: "36px",
        height: "36px",
        borderRadius: "50%",
        border: "none",
        cursor: "pointer",
        backgroundColor: darkMode ? "#21262d" : "#f0f6fc",
        color: darkMode ? "#f0f6fc" : "#161b22",
        fontSize: "18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.3s ease",
      }}
      onMouseEnter={(e) => (e.target.style.transform = "scale(1.1)")}
      onMouseLeave={(e) => (e.target.style.transform = "scale(1)")}
    >
      {darkMode ? "🌙" : "☀️"}
    </button>
  );
}
