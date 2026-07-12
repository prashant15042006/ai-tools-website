// API Configuration
// In production:
//   - If REACT_APP_BACKEND_URL is set (Render backend), use that
//   - Otherwise fall back to Vercel same-origin /api (Vercel serverless)
// In local dev: always use localhost:5001

const IS_PROD = typeof window !== "undefined" && window.location.hostname !== "localhost";

// REACT_APP_BACKEND_URL is set to your Render backend URL in Vercel dashboard env vars
const API_BASE_URL = IS_PROD
  ? (process.env.REACT_APP_BACKEND_URL || "https://ai-tools-website-80u7.onrender.com") // Fallback to Render if Vercel env variable not set
  : (process.env.REACT_APP_BACKEND_URL || "http://localhost:5001");

const CLEAN_API_URL = API_BASE_URL.endsWith("/") ? API_BASE_URL.slice(0, -1) : API_BASE_URL;

const IS_MISCONFIGURED = false;

export { CLEAN_API_URL as default, IS_MISCONFIGURED };

