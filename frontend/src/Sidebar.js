// Sidebar.js
import React from "react";
import { NavLink } from "react-router-dom";
import { useUIStore } from "./uiStore";


export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  const menuItems = [
    { path: "/", label: "💬 AI Chat" },
    { path: "/code", label: "⚡ Code Assistant" },
    { path: "/content", label: "📝 Content Generator" },
    { path: "/projects", label: "📂 Projects" },
    { path: "/menu", label: "📑 Menu" },
    { path: "/settings", label: "⚙️ Settings" },
  ];

  return (
    <div
      className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}
      style={{
        width: sidebarCollapsed ? "60px" : "240px",
        backgroundColor: "#161b22",
        borderRight: "1px solid #30363d",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        transition: "width 0.3s ease",
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: "20px",
          fontSize: "20px",
          fontWeight: "bold",
          color: "#58a6ff",
          textAlign: sidebarCollapsed ? "center" : "left",
        }}
      >
        AI SaaS
      </div>

      {/* Menu */}
      <ul style={{ listStyle: "none", padding: "0 10px" }}>
        {menuItems.map((item, index) => (
          <li key={index} style={{ margin: "12px 0" }}>
            <NavLink
              to={item.path}
              style={({ isActive }) => ({
                display: "block",
                padding: "10px",
                borderRadius: "6px",
                color: isActive ? "#58a6ff" : "#c9d1d9",
                textDecoration: "none",
                backgroundColor: isActive ? "#21262d" : "transparent",
                transition: "all 0.2s ease",
              })}
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>

      {/* Toggle Button */}
      <button
        onClick={toggleSidebar}
        style={{
          margin: "10px",
          padding: "10px",
          backgroundColor: "#238636",
          border: "none",
          borderRadius: "6px",
          color: "#fff",
          cursor: "pointer",
        }}
      >
        {sidebarCollapsed ? "➡️" : "⬅️"}
      </button>
    </div>
  );
}
