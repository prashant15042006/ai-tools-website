// utils/responseCache.js — Offline AI Response Cache
// Provides local cache persistence for seamless offline fallback.

const CACHE_KEY = "nexus_ai_response_cache";

// Cache AI responses for offline fallback
export function cacheResponseForOffline(prompt, response) {
  if (!prompt || !response) return;
  try {
    const existing = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    const normalizedPrompt = prompt.trim().toLowerCase();
    existing[normalizedPrompt] = {
      response,
      timestamp: Date.now()
    };
    const keys = Object.keys(existing);
    if (keys.length > 50) {
      delete existing[keys[0]];
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(existing));
  } catch (e) {
    console.warn("Response caching error:", e);
  }
}

// Search cached responses
export function getCachedResponse(prompt) {
  if (!prompt) return null;
  try {
    const existing = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    const normalizedPrompt = prompt.trim().toLowerCase();

    if (existing[normalizedPrompt]) {
      return existing[normalizedPrompt].response;
    }

    for (const key of Object.keys(existing)) {
      if (normalizedPrompt.includes(key) || key.includes(normalizedPrompt)) {
        return existing[key].response;
      }
    }
  } catch {
    return null;
  }
  return null;
}
