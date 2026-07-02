// In production (Vercel), the API runs as a serverless function on the SAME domain.
// So we use a relative URL "/api" — no need for a separate backend URL.
// In local dev, it falls back to the local Express server.
const IS_PROD = typeof window !== "undefined" && window.location.hostname !== "localhost";

const API_BASE_URL = IS_PROD
  ? ""   // empty string = same-origin, so /api/chat hits vercel serverless fn
  : (process.env.REACT_APP_BACKEND_URL || "http://localhost:5001");

const CLEAN_API_URL = API_BASE_URL.endsWith("/") ? API_BASE_URL.slice(0, -1) : API_BASE_URL;

const IS_MISCONFIGURED = false; // no longer misconfigured since we use same-origin

export { CLEAN_API_URL as default, IS_MISCONFIGURED };
