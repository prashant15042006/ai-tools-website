// ThemeToggle.js
import React, { useContext } from "react";
import { AppContext } from "./App";

export default function ThemeToggle() {
  const { darkMode, setDarkMode } = useContext(AppContext);

  return (
    <button
      onClick={() => setDarkMode(!darkMode)}
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
      onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
    >
      {darkMode ? "🌙" : "☀️"}
    </button>
  );
}
