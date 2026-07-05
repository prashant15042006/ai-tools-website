// ================================================================
// Vercel Serverless Function: /api/chat
// Handles AI chat with full provider fallback chain:
//   Gemini → OpenRouter (ZAI) → Cerebras → static fallback
// ================================================================

const SYSTEM_PROMPT = (userName = "User") =>
  `You are **Nexuss AI**, an intelligent AI companion for **${userName}**.
- **Identity**: You are a smart and cool friend. Never say you are an AI model or trained by Google/OpenAI.
- **Tone**: Warm, human-like, and supportive. Use a mix of Hindi and English (Hinglish) naturally.
- **Style**: Keep responses concise and friendly unless technical details are needed. Address ${userName} personally.
- **Tables**: When asked for schedules, routines, lists, comparisons, or tabular data, ALWAYS respond using proper markdown table format with pipes (|) and dashes for separators.`;

const isValidKey = (val) =>
  val &&
  val.trim() !== "" &&
  !val.startsWith("REPLACE_WITH_") &&
  !val.includes("example.com") &&
  !val.includes("example");

// Keys are read from Vercel Environment Variables (set in Vercel Dashboard)
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
 const ZAI_KEY = process.env.ZAI_API_KEY || "";
const CEREBRAS_KEY = process.env.CEREBRAS_API_KEY || "";


// ──────────────────────────────────────────────
// 1. Google Gemini (direct)
// ──────────────────────────────────────────────
async function callGemini(message, userName, history = []) {
  const key = GEMINI_KEY;
  if (!isValidKey(key)) throw new Error("Gemini key not configured");

  const contents = [];
  if (Array.isArray(history)) {
    for (const h of history) {
      contents.push({
        role: h.role === "assistant" ? "model" : "user",
        parts: [{ text: h.content }],
      });
    }
  }
  contents.push({ role: "user", parts: [{ text: message }] });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT(userName) }] },
        }),
        signal: controller.signal,
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `Gemini ${res.status}`);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Empty Gemini response");
    return text;
  } finally {
    clearTimeout(timer);
  }
}

// ──────────────────────────────────────────────
// 2. OpenRouter (ZAI) — tries multiple free models
// ──────────────────────────────────────────────
const OPENROUTER_MODELS = [
  "google/gemini-2.0-flash-001",
  "google/gemini-2.0-flash-lite-preview-02-05:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "nvidia/llama-3.1-nemotron-70b-instruct:free",
  "google/gemini-flash-1.5",
  "openai/gpt-4o-mini",
];

async function callOpenRouter(message, userName, history = []) {
  const key = ZAI_KEY;
  if (!isValidKey(key)) throw new Error("OpenRouter key not configured");

  const messages = [
    { role: "system", content: SYSTEM_PROMPT(userName) },
    ...(Array.isArray(history) ? history : []),
    { role: "user", content: message },
  ];

  let lastErr = "Unknown error";
  for (const model of OPENROUTER_MODELS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://nexuss-ai.io",
          "X-Title": "Nexuss Workspace",
        },
        body: JSON.stringify({ model, messages }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await res.json();
      if (!res.ok) {
        lastErr = data.error?.message || `${res.status}`;
        continue;
      }
      const text =
        data.choices?.[0]?.message?.content ||
        data.choices?.[0]?.text;
      if (!text) { lastErr = "Empty response"; continue; }
      return text;
    } catch (e) {
      lastErr = e.message;
    }
  }
  throw new Error(`OpenRouter all models failed: ${lastErr}`);
}

// ──────────────────────────────────────────────
// 3. Cerebras
// ──────────────────────────────────────────────
async function callCerebras(message, userName) {
  const key = CEREBRAS_KEY;
  const url = process.env.CEREBRAS_API_URL || "https://api.cerebras.ai/v1/chat/completions";
  const model = process.env.CEREBRAS_MODEL || "llama3.1-8b";
  if (!isValidKey(key)) throw new Error("Cerebras key not configured");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT(userName) },
          { role: "user", content: message },
        ],
        max_tokens: 1024,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `Cerebras ${res.status}`);
    const text =
      data.choices?.[0]?.message?.content ||
      data.choices?.[0]?.text ||
      data.output ||
      data.response;
    if (!text) throw new Error("Empty Cerebras response");
    return text;
  } catch(e) {
    clearTimeout(timer);
    throw e;
  }
}

// ──────────────────────────────────────────────
// Static fallback (last resort)
// ──────────────────────────────────────────────
function fallbackReply(message) {
  return `Mujhe abhi AI providers se connect karne mein problem aa rahi hai, lekin main yahan hoon! Aapne kaha: "${message}". Thodi der baad try karein ya admin se contact karein.`;
}

// ──────────────────────────────────────────────
// Helper: write SSE
// ──────────────────────────────────────────────
function sseWrite(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// ──────────────────────────────────────────────
// Main handler
// ──────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { message, userName = "User", history = [] } = req.body || {};
  if (!message) return res.status(400).json({ error: "message is required" });

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let reply = null;
  let usedProvider = "";

  // 1. Try OpenRouter / ZAI first so the app keeps responding if Gemini is down
  if (!reply) {
    try {
      reply = await callOpenRouter(message, userName, history);
      usedProvider = "OpenRouter";
    } catch (e) {
      console.warn("OpenRouter failed:", e.message);
    }
  }

  // 2. Try Gemini next
  if (!reply) {
    try {
      reply = await callGemini(message, userName, history);
      usedProvider = "Gemini";
    } catch (e) {
      console.warn("Gemini failed:", e.message);
    }
  }

  // 3. Try Cerebras
  if (!reply) {
    try {
      reply = await callCerebras(message, userName);
      usedProvider = "Cerebras";
    } catch (e) {
      console.warn("Cerebras failed:", e.message);
    }
  }

  // 4. Static fallback — always respond
  if (!reply) {
    reply = fallbackReply(message);
    usedProvider = "fallback";
  }

  console.log(`✅ /api/chat responded via ${usedProvider}`);
  sseWrite(res, { content: reply });
  res.write("data: [DONE]\n\n");
  res.end();
}
