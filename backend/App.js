import React from "react";
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import Chat from "./Chat";
import CodeGenerator from "./CodeGenerator";
import ContentGenerator from "./ContentGenerator";

// Active link highlight
function NavItem({ to, label, icon }) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      style={{
        display: "block",
        padding: "10px 12px",
        borderRadius: "8px",
        backgroundColor: isActive ? "#21262d" : "transparent",
        color: isActive ? "#58a6ff" : "#c9d1d9",
        textDecoration: "none",
        transition: "0.2s",
      }}
    >
      {icon} {label}
    </Link>
  );
}

function App() {
  return (
    <Router>
      <div style={styles.container}>
        
        {/* Sidebar */}
        <aside style={styles.sidebar}>
          <h2 style={styles.logo}>AI Workspace</h2>

          <nav style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <NavItem to="/" label="Chat" icon="💬" />
            <NavItem to="/code" label="Code Generator" icon="⚡" />
            <NavItem to="/content" label="Content Generator" icon="📝" />
          </nav>
        </aside>

        {/* Main */}
        <div style={styles.main}>
          
          {/* Header */}
          <header style={styles.header}>
            <h1 style={styles.title}>AI Workspace Dashboard</h1>

            <div>
              <button style={styles.button}>🌙 Theme</button>
              <button style={styles.button}>🔔</button>
            </div>
          </header>

          {/* Content */}
          <main style={styles.content}>
            <Routes>
              <Route path="/" element={<Chat />} />
              <Route path="/code" element={<CodeGenerator />} />
              <Route path="/content" element={<ContentGenerator />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

// 🎨 Centralized Styles (better than scattered inline)
const styles = {
  container: {
    display: "flex",
    height: "100vh",
    backgroundColor: "#0d1117",
    color: "#fff",
    fontFamily: "Segoe UI, sans-serif",
  },

  sidebar: {
    width: "230px",
    background: "linear-gradient(180deg, #161b22, #0d1117)",
    borderRight: "1px solid #30363d",
    padding: "20px",
  },

  logo: {
    color: "#58a6ff",
    marginBottom: "25px",
    fontSize: "20px",
  },

  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },

  header: {
    padding: "15px 20px",
    backgroundColor: "#161b22",
    borderBottom: "1px solid #30363d",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  title: {
    margin: 0,
    fontSize: "20px",
    color: "#58a6ff",
  },

  button: {
    marginLeft: "10px",
    padding: "6px 10px",
    backgroundColor: "#21262d",
    border: "1px solid #30363d",
    color: "#c9d1d9",
    borderRadius: "6px",
    cursor: "pointer",
  },

  content: {
    flex: 1,
    overflowY: "auto",
    padding: "20px",
  },
};

export default App;