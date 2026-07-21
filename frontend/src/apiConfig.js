// API Configuration
// In production:
//   - If REACT_APP_BACKEND_URL is set (Render backend), use that
//   - Otherwise fall back to Vercel same-origin /api (Vercel serverless)
// In local dev: always use localhost:5001

const IS_LOCAL = typeof window !== "undefined" && (
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname.startsWith("192.168.") ||
  window.location.hostname.startsWith("10.") ||
  window.location.hostname.endsWith(".local")
);

const IS_PROD = !IS_LOCAL;

// For local testing on desktop/mobile: construct URL dynamically from the current host's IP/hostname
const getLocalBackendUrl = () => {
  if (typeof window !== "undefined") {
    return "http://" + window.location.hostname + ":5001";
  }
  return "http://localhost:5001";
};

// REACT_APP_BACKEND_URL is set to your Render backend URL in Vercel dashboard env vars
const API_BASE_URL = IS_PROD
  ? (process.env.REACT_APP_BACKEND_URL || "https://ai-tools-website-80u7.onrender.com")
  : (process.env.REACT_APP_BACKEND_URL || getLocalBackendUrl());

const CLEAN_API_URL = API_BASE_URL.endsWith("/") ? API_BASE_URL.slice(0, -1) : API_BASE_URL;

const IS_MISCONFIGURED = false;

export { CLEAN_API_URL as default, IS_MISCONFIGURED, IS_PROD };

