const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:5001";
// Ensure there is no trailing slash
const CLEAN_API_URL = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;

if (typeof window !== "undefined" && window.location.hostname !== "localhost" && CLEAN_API_URL.includes("localhost")) {
  console.error("🚨 CRITICAL ERROR: REACT_APP_BACKEND_URL is not set! The frontend is trying to connect to localhost from production. AI responses will fail. Please set this environment variable in Vercel.");
}

export default CLEAN_API_URL;
