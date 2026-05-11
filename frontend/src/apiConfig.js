const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:5001";
const CLEAN_API_URL = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;

const IS_PROD = typeof window !== "undefined" && window.location.hostname !== "localhost";
const IS_MISCONFIGURED = IS_PROD && CLEAN_API_URL.includes("localhost");

if (IS_MISCONFIGURED) {
  console.error("🚨 BACKEND NOT CONFIGURED: Frontend is in production but backend is still set to localhost.");
}

export { CLEAN_API_URL as default, IS_MISCONFIGURED };
