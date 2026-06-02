// Navbar.js
import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";
import { AppContext } from "./App";

export default function Navbar() {
  const { user } = useContext(AppContext);
  const navigate = useNavigate();

  const displayName = user?.displayName || (user?.email ? user.email.split('@')[0] : "User");
  const initial = (displayName && displayName.charAt(0)) ? displayName.charAt(0).toUpperCase() : "U";

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, maxWidth: 400 }}>
        {/* Left avatar (click opens settings) */}
        <div
          title={`Open settings (${displayName})`}
          onClick={() => navigate('/settings')}
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            backgroundColor: "#21262d",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "#58a6ff",
            fontSize: "16px",
            fontWeight: 700,
            userSelect: 'none'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#30363d")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#21262d")}
        >
          {initial}
        </div>

        {/* Search Bar */}
        <input
          type="text"
          placeholder="Search anything..."
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid #30363d",
            backgroundColor: "#0d1117",
            color: "#fff",
            outline: "none",
          }}
        />
      </div>

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
