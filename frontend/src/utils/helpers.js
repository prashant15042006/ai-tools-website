// ============================================================
// utils/helpers.js — Shared utility functions
// ============================================================

/**
 * Detects whether client is on a mobile device or desktop.
 * Returns 'mobile' or 'desktop'.
 */
export function getClientDevice() {
  if (typeof window === "undefined") return "desktop";
  const isMobileScreen = window.innerWidth <= 768;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(
    navigator.userAgent || ""
  );
  return isMobileScreen || isMobileUA ? "mobile" : "desktop";
}

/**
 * Detects aspect ratio keywords from a prompt string.
 * Used by both Chat.js (inline image gen) and ImageGeneratorPro.js.
 */
export function detectRatioFromPrompt(promptText) {
  if (!promptText) return null;
  const p = promptText.toLowerCase();

  // 16:9 Landscape / Widescreen / Banner
  if (
    /\b(16[:\sx/]9|16by9)\b/.test(p) ||
    /\b(landscape|widescreen|horizontal|desktop wallpaper|banner|youtube banner|thumbnail|cover photo)\b/.test(p)
  ) return "16:9";

  // 9:16 Portrait / Story / Reel / Mobile Wallpaper
  if (
    /\b(9[:\sx/]16|9by16)\b/.test(p) ||
    /\b(portrait|vertical|story|reel|shorts|phone wallpaper|mobile wallpaper|smartphone wallpaper|tall)\b/.test(p)
  ) return "9:16";

  // 4:3 Classic Photo
  if (
    /\b(4[:\sx/]3|4by3)\b/.test(p) ||
    /\b(classic ratio|vintage photo|standard photo)\b/.test(p)
  ) return "4:3";

  // 1:1 Square
  if (
    /\b(1[:\sx/]1|1by1|square|dp|avatar|profile picture|instagram post)\b/.test(p)
  ) return "1:1";

  return null;
}

/**
 * Strips safety-rating labels injected by some AI models into responses.
 * e.g. "User Safety: safe\nResponse Safety: safe"
 */
export function cleanFrontendResponse(text) {
  if (!text) return text;
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*/gi, "")
    .replace(/^(User Safety|Response Safety|Content Safety|Safety Rating|Input Safety|Output Safety)\s*:\s*.+$/gim, "")
    .replace(/\{?\s*"?(user_safety|response_safety|content_filter|safety_rating)"?\s*:\s*"?\w+"?\s*\}?,?/gi, "")
    .replace(/^\s*[\r\n]/gm, "")
    .trim();
}

/**
 * Truncates a string to `maxLen` characters and appends ellipsis.
 */
export function truncate(str, maxLen = 36) {
  if (!str) return "";
  return str.length > maxLen ? str.substring(0, maxLen) + "…" : str;
}

/**
 * Returns a debounce function wrapper.
 */
export function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
