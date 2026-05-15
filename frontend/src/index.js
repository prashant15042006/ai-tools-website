import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import { useUIStore } from "./uiStore";

// Root render
const root = ReactDOM.createRoot(document.getElementById("root"));

function Root() {
  const { darkMode } = useUIStore();

  return (
    <div className={darkMode ? "dark" : "light"}>
      <App />
    </div>
  );
}

root.render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);

reportWebVitals();

// ─── Register PWA Service Worker ───────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('✅ Nexuss SW registered:', registration.scope);
      })
      .catch((err) => {
        console.warn('❌ SW registration failed:', err);
      });
  });
}
