// ============================================================
// utils/helpers.js — Shared utility functions
// ============================================================

/**
 * Detects aspect ratio keywords from a prompt string.
 * Used by both Chat.js (inline image gen) and ImageGeneratorPro.js.
 */
export function detectRatioFromPrompt(promptText) {
  const p = promptText.toLowerCase();
  if (/\b16[:\sx]9\b/.test(p) || /\blandscape\s*ratio\b/.test(p) || /\bwidescreen\b/.test(p)) return "16:9";
  if (/\b9[:\sx]16\b/.test(p) || /\bportrait\s*ratio\b/.test(p) || /\bvertical\s*ratio\b/.test(p)) return "9:16";
  if (/\b4[:\sx]3\b/.test(p) || /\bclassic\s*ratio\b/.test(p)) return "4:3";
  if (/\b1[:\sx]1\b/.test(p) || /\bsquare\s*ratio\b/.test(p)) return "1:1";
  if (/\b(16x9|16[/]9)\b/.test(p)) return "16:9";
  if (/\b(9x16|9[/]16)\b/.test(p)) return "9:16";
  if (/\b(4x3|4[/]3)\b/.test(p)) return "4:3";
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
