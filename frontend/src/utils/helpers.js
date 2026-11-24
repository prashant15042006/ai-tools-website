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
 * Formats and normalizes markdown text to ensure proper paragraph,
 * heading, and list item spacing so points never merge onto the same line.
 */
export function formatStructuredMarkdown(text) {
  if (!text) return text;
  let s = text.replace(/\r\n/g, "\n");

  // 1. Normalize non-standard unicode bullets to markdown dash list marker
  s = s.replace(/^[ \t]*[•◦▪▫‣⁃]\s+/gm, "- ");

  // 2. Break inline numbered points or bullets chained on the same line after punctuation
  // e.g. "Sentence complete. 1. Next point" -> "Sentence complete.\n\n1. Next point"
  s = s.replace(/([.:!?।])\s+([0-9]+\.\s+)/g, "$1\n\n$2");
  s = s.replace(/([.:!?।])\s+([-*•]\s+)/g, "$1\n\n$2");
  s = s.replace(/([.:!?।])\s+(\*{1,2}[0-9]+\.\*{0,2}\s+)/g, "$1\n\n$2");
  s = s.replace(/([.:!?।])\s+(\*{1,2}[-*•]\*{0,2}\s+)/g, "$1\n\n$2");

  // 3. Break inline bold headers starting after punctuation (e.g. "Intro text. **Key Point:** Details")
  s = s.replace(/([.:!?।])\s+(\*\*[A-Z\u0900-\u097F][^:\n*]{1,40}\*\*[:-]\s*)/g, "$1\n\n$2");

  // 4. Ensure an empty line before lists start after a normal text line
  s = s.replace(/([^\n])\n([0-9]+\.\s+)/g, "$1\n\n$2");
  s = s.replace(/([^\n])\n([-*]\s+)/g, "$1\n\n$2");

  // 5. Ensure empty line before and after markdown headers (#, ##, ###, ####)
  s = s.replace(/([^\n])\n(#{1,6}\s+)/g, "$1\n\n$2");
  s = s.replace(/(#{1,6}[^\n]+)\n([^\n#])/g, "$1\n\n$2");

  // 6. Ensure clean spacing around blockquotes
  s = s.replace(/([^\n])\n(>\s*)/g, "$1\n\n$2");

  // 7. Clean up excessive blank lines (more than 2 consecutive newlines)
  s = s.replace(/\n{3,}/g, "\n\n");

  return s;
}

/**
 * Strips safety-rating labels and thinking tags, while preserving
 * proper paragraph and point layout structure.
 */
export function cleanFrontendResponse(text) {
  if (!text) return text;
  const stripped = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*/gi, "")
    .replace(/^(User Safety|Response Safety|Content Safety|Safety Rating|Input Safety|Output Safety)\s*:\s*.+$/gim, "")
    .replace(/\{?\s*"?(user_safety|response_safety|content_filter|safety_rating)"?\s*:\s*"?\w+"?\s*\}?,?/gi, "");

  return formatStructuredMarkdown(stripped).trim();
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
