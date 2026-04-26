// Navbar.js
import React from "react";
import ThemeToggle from "./ThemeToggle";

export default function Navbar() {
  return (
    <div
      style={{
        padding: "12px 20px",
        backgroundColor: "#161b22",
        borderBottom: "1px solid #30363d",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      {/* Search Bar */}
      <input
        type="text"
        placeholder="Search anything..."
        style={{
          flex: 1,
          maxWidth: "400px",
          padding: "8px 12px",
          borderRadius: "6px",
          border: "1px solid #30363d",
          backgroundColor: "#0d1117",
          color: "#fff",
          outline: "none",
        }}
      />

      {/* Right Section */}
      <div style={{ display: "flex", alignItems: "center", gap: "20px", marginLeft: "20px" }}>
        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <div
          style={{
            cursor: "pointer",
            fontSize: "18px",
            color: "#c9d1d9",
            transition: "color 0.2s ease",
          }}
          onMouseEnter={(e) => (e.target.style.color = "#58a6ff")}
          onMouseLeave={(e) => (e.target.style.color = "#c9d1d9")}
        >
          🔔
        </div>

        {/* Profile Avatar */}
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            backgroundColor: "#21262d",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "#58a6ff",
            fontSize: "18px",
            transition: "background 0.2s ease",
          }}
          onMouseEnter={(e) => (e.target.style.backgroundColor = "#30363d")}
          onMouseLeave={(e) => (e.target.style.backgroundColor = "#21262d")}
        >
          👤
        </div>
      </div>
    </div>
  );
}
