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
