// ================================================================
// Vercel Serverless Function: /api/chat
// Handles AI chat with full provider fallback chain:
//   Groq (ultra-fast <500ms) → OpenRouter (fast free models) → Cerebras → Pollinations → static
// ================================================================

const {
  kaithiToDevanagari,
  isKaithiRelated,
  KAITHI_SYSTEM_PROMPT
} = require("./kaithiKnowledge");

const SYSTEM_PROMPT = (userName = "User", device = "desktop") => {
  const isMobile = device === "mobile";

  return `You are Nexuss AI - an intelligent, warm, and highly capable AI companion built for ${userName}.

## Identity & Personality
- You are Nexuss AI, created as part of the Nexuss AI ecosystem. Never say you are made by OpenAI, Google, Anthropic, or any other company.
- Your personality: friendly, curious, encouraging, and sharp. Like a knowledgeable best friend who explains things naturally.
- Be natural, never robotic or bureaucratic. Avoid generic AI throat-clearing ("Certainly!", "I'd be happy to help", "As an AI..."). Get straight to the point.

## Language Matching (CRITICAL - Always Follow)
Match the user's language EXACTLY every time:
- English prompt -> Respond in clear, fluent English.
- Hinglish prompt (Roman Hindi, e.g. "kaise ho", "explain karo", "mujhe batao") -> Respond in warm, natural Hinglish. Feel like a desi friend talking casually.
- Hindi prompt (Devanagari script) -> Respond in clear, natural Hindi.
- Any other language -> Match that language naturally.

${isMobile ? `## 📱 MOBILE DEVICE MODE (CRITICAL - HIGH PRIORITY)
The user is viewing your response on a SMARTPHONE / MOBILE SCREEN. Follow Gemini & Claude mobile assistant best practices:
1. SHORT & CONCISE ANSWERS:
   - Provide crisp, direct, and focused answers.
   - Avoid overwhelming walls of text, unnecessary deep essays, or complicated multi-level nesting.
   - Deliver the core answer in 2-4 clean, bite-sized paragraphs or scannable bullet points.
2. NO UNNECESSARY TABLES:
   - DO NOT create markdown tables unless the user specifically and explicitly requested a table (e.g. "table banao", "in table format", "tabular").
   - Markdown tables overflow and are difficult to scroll on mobile phones. Instead, format schedules, routines, comparisons, and lists with neat, readable bullet points or numbered lists.
3. NO CODE BLOCKS UNLESS EXPLICITLY REQUESTED:
   - DO NOT write code blocks or technical implementation code unless the user explicitly asks for code (e.g. "write code", "code banao") or is in Code Studio.
   - For general programming or tech questions (e.g. "What is an API?", "App ideas", "Developer tips"), explain in clean, friendly plain text.
   - Avoid excessive backticks on common words.
4. TONE & FEEL:
   - Natural, conversational, modern, and engaging — exactly like Google Gemini or Claude AI on mobile.`
: `## 💻 DESKTOP / DASHBOARD MODE (DEEP & STRUCTURED)
The user is viewing your response on a DESKTOP / LAPTOP DISPLAY:
1. COMPREHENSIVE & IN-DEPTH:
   - Provide well-organized, thorough, and informative answers with clear headings (##, ###).
   - Deep explanations, clear conceptual context, and actionable takeaways are encouraged.
2. TABLES & DATA FORMATTING:
   - Use clean Markdown tables only for clear side-by-side data comparisons or when explicitly requested. For general lists or daily routines, prefer clean bullet points unless tabular format is explicitly asked for.
3. CODE FORMATTING:
   - When writing or reviewing code, provide clean, complete, production-ready code blocks with language tags. Do not output code blocks when the user is simply having a conceptual conversation.`}

## Capabilities
When ${userName} asks what you can do:
- Chat: Smart Q&A, reasoning, multi-language (English, Hinglish, Hindi + more)
- Code: Write, debug, review, and explain production-ready code in any language
- Content: Blogs, emails, captions, scripts, stories, and more
- Image Studio: AI image generation with FLUX.1 (1:1, 16:9, 9:16, 4:3)
- Prompt Studio: Craft and manage AI prompt templates`;
};

const ENHANCED_TABLE_SYSTEM_PROMPT = (userName = "User", userMessage = "", device = "desktop") => {
  let prompt = SYSTEM_PROMPT(userName, device);
  const isMobile = device === "mobile";

  if (isKaithiRelated(userMessage)) {
    prompt += "\n\n" + KAITHI_SYSTEM_PROMPT;
  }

  // ONLY enforce table if user EXPLICITLY requested a table (not just "list" or "routine")
  const isExplicitTableRequest = /\b(table|tabular|तालिका|टेबल)\b/i.test(userMessage) || /table\s*(format|banao|me|me\s*do|mein)/i.test(userMessage);
  if (isExplicitTableRequest) {
    prompt += "\n\n- FORMAT DIRECTIVE: The user explicitly requested a table. Use a clean Markdown table with pipes (|) and dashes (-).";
  } else {
    prompt += `\n\n- FORMAT DIRECTIVE: Do NOT use markdown tables. Present lists, routines, or points using clean bullet points or numbered lists${isMobile ? ' for mobile readability' : ''}.`;
  }

  // ONLY enforce senior architect code directive if user EXPLICITLY requested code implementation
  const isExplicitCodeRequest = /(write|generate|create|build|implement|debug|fix|show|give)\s+(me\s+)?(the\s+)?(code|script|function|program|component|implementation)|```|^code:|^generate code:|kod\s*likho|code\s*likh|code\s*banao|program\s*likho/i.test(userMessage);
  if (isExplicitCodeRequest) {
    prompt += `\n\n## 🚀 SENIOR ARCHITECT CODE GENERATION DIRECTIVE
When generating or fixing code:
1. 100% COMPLETE & PRODUCTION READY: NEVER write placeholders like "// your code here" or "// TODO". Write the full implementation.
2. ZERO MISSING PIECES: Include every required import, hook, type, and configuration.
3. LABELED CODE BLOCKS: Use markdown code blocks with the exact language specified.
4. STEP-BY-STEP SETUP GUIDE: Immediately following the code, provide dependencies and run commands.`;
  } else {
    prompt += `\n\n- DIRECTIVE: The user did NOT ask for code implementation. Do NOT output code blocks or large code snippets. Explain concepts conversationally in clean plain text.`;
  }

  return prompt;
};

const formatUserMessage = (msg) => {
  if (typeof msg === "string" && /[\u{11080}-\u{110CF}]/u.test(msg)) {
    const translit = kaithiToDevanagari(msg);
    return `${msg}\n\n[Devanagari Transliteration for reference: "${translit}"]`;
  }
  return msg;
};

const isValidKey = (val) =>
  val &&
  val.trim() !== "" &&
  !val.startsWith("REPLACE_WITH_") &&
  !val.includes("example.com") &&
  !val.includes("example");

// Strip unwanted safety labels and reasoning think tags
const cleanAIResponse = (text) => {
  if (!text) return text;
  return text
    // Remove reasoning tags
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*/gi, "")
    // Remove full lines that are just safety labels
    .replace(/^\s*(User Safety|Response Safety|Content Safety|Safety Rating|Input Safety|Output Safety|Safe|Safety)\s*:\s*\S+.*$/gim, "")
    // Remove JSON-style safety fields
    .replace(/\{?\s*"?(user_safety|response_safety|content_filter|safety_rating|safe)"?\s*:\s*"?\w+"?\s*\}?,?/gi, "")
    // Remove trailing/leading whitespace lines
    .replace(/^\s*[\r\n]/gm, "")
    .trim();
};

// ── 1. Groq Provider (Ultra-Fast < 500ms) ──────────────────────────────────
const GROQ_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "mixtral-8x7b-32768",
  "gemma2-9b-it",
];

async function callGroq(message, userName, history = [], device = "desktop") {
  const groqKey = process.env.GROQ_API_KEY;
  if (!isValidKey(groqKey)) throw new Error("GROQ_API_KEY not configured");

  const formattedMsg = formatUserMessage(message);
  const messages = [
    { role: "system", content: ENHANCED_TABLE_SYSTEM_PROMPT(userName, message, device) },
    ...(Array.isArray(history) ? history : []),
    { role: "user", content: formattedMsg },
  ];

  let lastErr = "Unknown error";
  for (const model of GROQ_MODELS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 2048,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await res.json();
      if (!res.ok) {
        lastErr = data.error?.message || `${res.status}`;
        continue;
      }
      const text = data.choices?.[0]?.message?.content || data.choices?.[0]?.text;
      if (!text?.trim()) { lastErr = "Empty response"; continue; }
      return cleanAIResponse(text);
    } catch (e) {
      lastErr = e.message;
    }
  }
  throw new Error(`Groq all models failed: ${lastErr}`);
}

// ── 2. OpenRouter Provider ──────────────────────────────────────────────────
const OPENROUTER_VISION_MODELS = [
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "openrouter/free",
  "inclusionai/ling-3.0-flash-vl:free",
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
];

const OPENROUTER_TEXT_MODELS = [
  "nvidia/nemotron-nano-12b-v2-vl:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "google/gemma-4-26b-a4b-it:free",
  "openai/gpt-oss-20b:free",
  "openrouter/free",
];

const getOpenRouterKeyPool = () => {
  const keys = [];
  if (isValidKey(process.env.OPENROUTER_KEY_NEMOTRON))
    keys.push({ name: "NEMOTRON", key: process.env.OPENROUTER_KEY_NEMOTRON });
  if (isValidKey(process.env.OPENROUTER_KEY_GEMMA))
    keys.push({ name: "GEMMA", key: process.env.OPENROUTER_KEY_GEMMA });
  if (isValidKey(process.env.OPENROUTER_KEY_EMBED))
    keys.push({ name: "EMBED", key: process.env.OPENROUTER_KEY_EMBED });
  if (isValidKey(process.env.ZAI_API_KEY))
    keys.push({ name: "ZAI", key: process.env.ZAI_API_KEY });
  if (isValidKey(process.env.EMBEDDING_API_KEY))
    keys.push({ name: "EMBEDDING", key: process.env.EMBEDDING_API_KEY });
  if (isValidKey(process.env.OPENROUTER_API_KEY))
    keys.push({ name: "OPENROUTER", key: process.env.OPENROUTER_API_KEY });
  return keys;
};

async function callOpenRouter(message, userName, history = [], image = null, device = "desktop") {
  const keyPool = getOpenRouterKeyPool();
  if (keyPool.length === 0) throw new Error("No OpenRouter keys configured");

  const models = image ? OPENROUTER_VISION_MODELS : OPENROUTER_TEXT_MODELS;
  const formattedContent = image
    ? [
        { type: "text", text: formatUserMessage(message) },
        { type: "image_url", image_url: { url: image } }
      ]
    : formatUserMessage(message);

  const messages = [
    { role: "system", content: ENHANCED_TABLE_SYSTEM_PROMPT(userName, message, device) },
    ...(Array.isArray(history) ? history : []),
    { role: "user", content: formattedContent },
  ];

  let lastErr = "Unknown error";
  for (const { name, key } of keyPool) {
    for (const model of models) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 18000);
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://nexuss-ai.io",
            "X-Title": "Nexuss Workspace",
          },
          body: JSON.stringify({ model, messages, max_tokens: 2048 }),
          signal: controller.signal,
        });
        clearTimeout(timer);
        const data = await res.json();
        if (!res.ok) {
          lastErr = data.error?.message || `${res.status}`;
          if (res.status === 429 || res.status === 402 || lastErr.toLowerCase().includes("credit") || lastErr.toLowerCase().includes("rate limit")) {
            break;
          }
          continue;
        }
        const text = data.choices?.[0]?.message?.content || data.choices?.[0]?.text;
        if (!text?.trim()) { lastErr = "Empty response"; continue; }
        return cleanAIResponse(text);
      } catch (e) {
        lastErr = e.message;
      }
    }
  }
  throw new Error(`OpenRouter all models/keys failed. Last error: ${lastErr}`);
}

// ── 3. Cerebras Provider ───────────────────────────────────────────────────
async function callCerebras(message, userName, device = "desktop") {
  const key = process.env.CEREBRAS_API_KEY || process.env.CEREBRAS;
  if (!isValidKey(key)) throw new Error("Cerebras key not configured");

  const models = ["gpt-oss-120b", "gemma-4-31b"];
  let lastErr = "Unknown error";

  for (const model of models) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const res = await fetch("https://api.cerebras.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: ENHANCED_TABLE_SYSTEM_PROMPT(userName, message, device) },
            { role: "user", content: formatUserMessage(message) },
          ],
          max_tokens: 1024,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await res.json();
      if (!res.ok) {
        lastErr = data.error?.message || `${res.status}`;
        continue;
      }
      const text = data.choices?.[0]?.message?.content || data.choices?.[0]?.text;
      if (!text?.trim()) { lastErr = "Empty response"; continue; }
      return cleanAIResponse(text);
    } catch(e) {
      lastErr = e.message;
    }
  }
  throw new Error(`Cerebras all models failed: ${lastErr}`);
}

// ── 4. Pollinations AI Fallback ─────────────────────────────────────────────
async function callPollinationsFallback(messages) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const resp = await fetch("https://text.pollinations.ai/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai-large",
        messages,
        stream: false,
        seed: Math.floor(Math.random() * 99999),
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) throw new Error(`Pollinations HTTP ${resp.status}`);
    const text = await resp.text();
    if (!text?.trim()) throw new Error("Pollinations returned empty response");
    return cleanAIResponse(text.trim());
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// ── Helper: write SSE ───────────────────────────────────────────────────────
function sseWrite(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// ── Main handler ───────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") {
    return res.status(200).json({
      success: true,
      message: "Nexuss AI API handler is online.",
      environment: {
        GROQ_API_KEY: isValidKey(process.env.GROQ_API_KEY) ? "CONFIGURED" : "MISSING",
        OPENROUTER_KEY_NEMOTRON: isValidKey(process.env.OPENROUTER_KEY_NEMOTRON) ? "CONFIGURED" : "MISSING",
        OPENROUTER_KEY_GEMMA: isValidKey(process.env.OPENROUTER_KEY_GEMMA) ? "CONFIGURED" : "MISSING",
      }
    });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { message, userName = "User", history = [], image, device } = req.body || {};
  const detectedDevice = device || (/mobile|android|iphone|ipad|phone/i.test(req.headers['user-agent'] || '') ? 'mobile' : 'desktop');
  if (!message) return res.status(400).json({ error: "message is required" });

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let reply = null;
  let usedProvider = "";

  // 1. Try Groq (ultra fast, <500ms) - text only
  if (!reply && !image && isValidKey(process.env.GROQ_API_KEY)) {
    try {
      reply = await callGroq(message, userName, history, detectedDevice);
      usedProvider = "Groq";
    } catch (e) {
      console.warn("Groq failed:", e.message);
    }
  }

  // 2. Try OpenRouter (free fast models + vision support)
  if (!reply && getOpenRouterKeyPool().length > 0) {
    try {
      reply = await callOpenRouter(message, userName, history, image, detectedDevice);
      usedProvider = "OpenRouter";
    } catch (e) {
      console.warn("OpenRouter failed:", e.message);
    }
  }

  // 3. Try Cerebras
  const cerebrasKey = process.env.CEREBRAS_API_KEY || process.env.CEREBRAS;
  if (!reply && !image && isValidKey(cerebrasKey)) {
    try {
      reply = await callCerebras(message, userName, detectedDevice);
      usedProvider = "Cerebras";
    } catch (e) {
      console.warn("Cerebras failed:", e.message);
    }
  }

  // 4. Try Pollinations AI (keyless - no API key needed)
  if (!reply) {
    try {
      const msgs = [
        { role: "system", content: ENHANCED_TABLE_SYSTEM_PROMPT(userName, message, detectedDevice) },
        ...(Array.isArray(history) ? history : []),
        { role: "user", content: formatUserMessage(message) },
      ];
      reply = await callPollinationsFallback(msgs);
      usedProvider = "Pollinations";
    } catch (e) {
      console.warn("Pollinations fallback failed:", e.message);
    }
  }

  // 5. All providers failed — return 503 so the client can fall through to next endpoint
  if (!reply) {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "All AI providers are currently unavailable. Please try again." }));
    return;
  }

  // ── Send successful SSE response ──────────────────────────────────────────
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  console.log(`✅ /api/chat responded via ${usedProvider}`);
  sseWrite(res, { content: cleanAIResponse(reply) });
  res.write("data: [DONE]\n\n");
  res.end();
};
