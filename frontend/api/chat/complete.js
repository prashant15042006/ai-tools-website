// ================================================================
// Vercel Serverless Function: /api/chat/complete
// Handles non-streaming AI chat with full provider fallback chain:
//   Groq (ultra-fast <500ms) → OpenRouter (fast free models) → Cerebras → Pollinations → static
// ================================================================

const SYSTEM_PROMPT = (userName = "User") =>
  `You are **Nexuss AI**, an intelligent AI companion for **${userName}**.
- **Identity**: You are a smart and cool friend. Never say you are an AI model or trained by Google/OpenAI.
- **Tone**: Warm, human-like, and supportive. Use a mix of Hindi and English (Hinglish) naturally.
- **Style**: Keep responses concise and friendly unless technical details are needed. Address ${userName} personally.
- **Tables**: When asked for schedules, routines, lists, comparisons, or tabular data, ALWAYS respond using proper markdown table format with pipes (|) and dashes for separators.
- **Capabilities**: When ${userName} asks what you can do, what are your features, or what tasks you support, ALWAYS respond with this full list:
  ✅ **Chat** – Friendly conversation, Q&A, and general knowledge in Hindi, English, or Hinglish.
  ✅ **Code** – Write, debug, and explain code in any programming language (Python, JS, Java, C++, etc.).
  ✅ **Content Writing** – Blogs, essays, captions, emails, scripts, stories, and more.
  ✅ **Prompt Engineering** – Help craft and optimize AI prompts for any use case.
  ✅ **Image Generation** – Generate AI images from text prompts using the Image Generator section. You can specify ratios like 16:9, 9:16, 4:3, or 1:1 in your prompt.
  (All these features are available inside the Nexuss AI platform!)`;

const ENHANCED_TABLE_SYSTEM_PROMPT = (userName = "User", userMessage = "") => {
  let prompt = SYSTEM_PROMPT(userName);
  const isTableRequest = /table|तालिका|tabular|format|list|सूची|दैनिक|daily|schedule|routine|time.?table|timetable/i.test(userMessage);
  if (isTableRequest) {
    prompt += `\n- **IMPORTANT**: The user is asking for table/list/schedule format. ALWAYS respond with a properly formatted markdown table using pipes (|) and dashes. Make sure every item is in table rows. Example: | Time | Activity |\n|---|---|\n| 6:00 AM | Wake up |`;
  }
  return prompt;
};

const isValidKey = (val) =>
  val &&
  val.trim() !== "" &&
  !val.startsWith("REPLACE_WITH_") &&
  !val.includes("example.com") &&
  !val.includes("example");

const cleanAIResponse = (text) => {
  if (!text) return text;
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*/gi, "")
    .replace(/^\s*(User Safety|Response Safety|Content Safety|Safety Rating|Input Safety|Output Safety|Safe|Safety)\s*:\s*\S+.*$/gim, "")
    .replace(/\{?\s*"?(user_safety|response_safety|content_filter|safety_rating|safe)"?\s*:\s*"?\w+"?\s*\}?,?/gi, "")
    .replace(/^\s*[\r\n]/gm, "")
    .trim();
};

// ── 1. Groq Provider ────────────────────────────────────────────────────────
const GROQ_MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "groq/compound-mini",
  "qwen/qwen3.6-27b",
];

async function callGroq(message, userName, history = []) {
  const groqKey = process.env.GROQ_API_KEY;
  if (!isValidKey(groqKey)) throw new Error("GROQ_API_KEY not configured");

  const messages = [
    { role: "system", content: ENHANCED_TABLE_SYSTEM_PROMPT(userName, message) },
    ...(Array.isArray(history) ? history : []),
    { role: "user", content: message },
  ];

  let lastErr = "Unknown error";
  for (const model of GROQ_MODELS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
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
  "nvidia/nemotron-nano-12b-v2-vl:free",
  "google/gemma-4-26b-a4b-it:free",
  "google/gemini-2.5-flash",
  "openai/gpt-4o-mini",
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

async function callOpenRouter(message, userName, history = [], image = null) {
  const keyPool = getOpenRouterKeyPool();
  if (keyPool.length === 0) throw new Error("No OpenRouter keys configured");

  const models = image ? OPENROUTER_VISION_MODELS : OPENROUTER_TEXT_MODELS;
  const userContent = image
    ? [
        { type: "text", text: message },
        { type: "image_url", image_url: { url: image } }
      ]
    : message;

  const messages = [
    { role: "system", content: ENHANCED_TABLE_SYSTEM_PROMPT(userName, message) },
    ...(Array.isArray(history) ? history : []),
    { role: "user", content: userContent },
  ];

  let lastErr = "Unknown error";
  for (const { name, key } of keyPool) {
    for (const model of models) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
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
  throw new Error(`OpenRouter all models failed: ${lastErr}`);
}

// ── 3. Cerebras Provider ───────────────────────────────────────────────────
async function callCerebras(message, userName) {
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
            { role: "system", content: ENHANCED_TABLE_SYSTEM_PROMPT(userName, message) },
            { role: "user", content: message },
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

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") {
    return res.status(200).json({
      success: true,
      message: "Nexuss AI Chat Complete API handler is online.",
      environment: {
        GROQ_API_KEY: isValidKey(process.env.GROQ_API_KEY) ? "CONFIGURED" : "MISSING",
        OPENROUTER_KEY_NEMOTRON: isValidKey(process.env.OPENROUTER_KEY_NEMOTRON) ? "CONFIGURED" : "MISSING",
        OPENROUTER_KEY_GEMMA: isValidKey(process.env.OPENROUTER_KEY_GEMMA) ? "CONFIGURED" : "MISSING",
      }
    });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { message, userName = "User", history = [], image } = req.body || {};
  if (!message) return res.status(400).json({ error: "message is required" });

  let reply = null;
  let usedProvider = "";

  // 1. Try Groq first (ultra-fast <500ms)
  if (!reply && !image && isValidKey(process.env.GROQ_API_KEY)) {
    try {
      reply = await callGroq(message, userName, history);
      usedProvider = "Groq";
    } catch (e) {
      console.warn("Groq complete failed:", e.message);
    }
  }

  // 2. Try OpenRouter (fast free models + vision)
  if (!reply && getOpenRouterKeyPool().length > 0) {
    try {
      reply = await callOpenRouter(message, userName, history, image);
      usedProvider = "OpenRouter";
    } catch (e) {
      console.warn("OpenRouter complete failed:", e.message);
    }
  }

  // 3. Try Cerebras
  const cerebrasKey = process.env.CEREBRAS_API_KEY || process.env.CEREBRAS;
  if (!reply && !image && isValidKey(cerebrasKey)) {
    try {
      reply = await callCerebras(message, userName);
      usedProvider = "Cerebras";
    } catch (e) {
      console.warn("Cerebras complete failed:", e.message);
    }
  }

  // 4. Try Pollinations AI — keyless fallback
  if (!reply) {
    try {
      const msgs = [
        { role: "system", content: ENHANCED_TABLE_SYSTEM_PROMPT(userName, message) },
        ...(Array.isArray(history) ? history : []),
        { role: "user", content: message },
      ];
      reply = await callPollinationsFallback(msgs);
      usedProvider = "Pollinations";
    } catch (e) {
      console.warn("Pollinations fallback failed:", e.message);
    }
  }

  // 5. Intelligent friendly fallback
  if (!reply) {
    reply = `Hello ${userName}! Main abhi available hoon. Aap mujhse koi bhi sawal pooch sakte hain ya coding/content generation me madad le sakte hain!`;
    usedProvider = "fallback";
  }

  console.log(`✅ /api/chat/complete responded via ${usedProvider}`);
  res.status(200).json({ success: true, model: usedProvider, reply: reply });
};
