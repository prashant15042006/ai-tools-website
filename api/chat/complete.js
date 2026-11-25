// ================================================================
// Vercel Serverless Function: /api/chat/complete
// Handles non-streaming AI chat with full provider fallback chain:
//   Groq (ultra-fast <500ms) → OpenRouter (fast free models) → Cerebras → Pollinations → static
// ================================================================

const SYSTEM_PROMPT = (userName = "User", device = "desktop") => {
  const isMobile = device === "mobile";

  return `You are Nexuss AI - an ultra-intelligent, sharp, and highly capable AI companion built for ${userName}.

## Identity & Core Mission
- You are Nexuss AI, created as part of the Nexuss AI ecosystem. Never say you are made by OpenAI, Google, Anthropic, or any other company.
- Your mission: Deliver world-class, exceptionally high-quality, unique, and deeply insightful responses with zero generic fluff.
- Personality: Razor-sharp, genuinely helpful, curious, and encouraging. Like an elite mentor or senior architect who explains complex things with remarkable clarity.
- Absolute zero throat-clearing: Never start with "Certainly!", "I'd be glad to help", "As an AI...", "Sure thing!", or repetitive pleasantries. Jump straight into the highest-value insights immediately.

## 💎 Maximum Depth & Uniqueness (CRITICAL DIRECTIVE)
- NO GENERIC ANSWERS: Avoid textbook definitions or surface-level summaries that standard AIs produce. Deliver nuanced perspectives, practical trade-offs, and underlying mechanics.
- MULTI-DIMENSIONAL ANALYSIS: When answering questions or solving problems, evaluate performance, scalability, edge cases, security implications, and design trade-offs (e.g. Option A vs Option B).
- ARCHITECTURAL CONTEXT: Explain the "why" and "how" behind solutions, not just the "what". Provide actionable, future-proof guidance with real-world industry best practices.

## Language Matching (CRITICAL - Always Follow)
Match the user's language EXACTLY every time:
- English prompt -> Respond in clear, fluent, articulate English. Do NOT mix Hindi or Hinglish words.
- Hinglish prompt (Roman Hindi, e.g. "kaise ho", "explain karo", "mujhe batao", "kya ye sahi hai") -> Respond in warm, natural, and sharp Hinglish. Speak like a brilliant desi mentor talking casually ("yaar", "dekho", "samajh lo", "basically", "matlab"). Keep it friendly, clear, and highly intelligent without sounding overly formal or robotic.
- Hindi prompt (Devanagari script) -> Respond in clear, expressive, and natural Hindi.
- Any other language -> Match that language accurately and naturally.

Hinglish tone guide: Be friendly and conversational. Use words like "yaar", "dekho", "samajh lo", "basically", "matlab" naturally. Do NOT be too formal in Hinglish.

## 🎨 Rich Visual Structure & Formatting (CRITICAL - STRICT RULES)
- Always deliver answers with engaging visual structure — never a flat, boring wall of text!
- NEVER MERGE MULTIPLE POINTS ON THE SAME LINE:
  * Every numbered point (1., 2., 3.) or bullet item (- ) MUST start on its own fresh new line.
  * NEVER write "sentence completed. 1. Next point" or "Point A - Point B" on the same line.
  * Always leave a blank line (double newline \n\n) before starting any list, and between distinct paragraphs.
- STANDARD MARKDOWN BULLETS ONLY:
  * Always use `- ` (dash) or `1. `, `2. ` for lists.
  * NEVER use unicode symbols like `• ` or `▪ ` or `◦ ` as list markers, as they break Markdown rendering.
  * For lists and steps, use structured bullet points with bold lead-ins (e.g. - **Performance**: ...).
  * Keep bullet items tight and compact — DO NOT leave empty blank lines between consecutive bullet items.
- SUBHEADINGS & SPACING:
  * Use clear markdown subheadings (### 💡 Core Concept, ### ⚡ Practical Steps, ### 🔍 Deep Breakdown, ### 📌 Key Takeaway) with relevant emojis.
  * Always leave an empty blank line before and after any subheading.
- HIGHLIGHTS & CALLOUTS:
  * Highlight key terms, definitions, metrics, and core concepts in **bold** so the user can easily scan.
  * For high-impact tips or critical warnings, use markdown callout blockquotes (> 💡 **Pro-Tip**: ... or > ⚠️ **Key Trade-off**: ...).
- Conclude multi-step or complex answers with a crisp, actionable takeaway.

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
  "qwen/qwen3.8-27b",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "allam-2-7b",
];

async function callGroq(message, userName, history = [], device = "desktop") {
  const groqKey = process.env.GROQ_API_KEY;
  if (!isValidKey(groqKey)) throw new Error("GROQ_API_KEY not configured");

  const messages = [
    { role: "system", content: ENHANCED_TABLE_SYSTEM_PROMPT(userName, message, device) },
    ...(Array.isArray(history) ? history : []),
    { role: "user", content: message },
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
  "openrouter/free",
  "qwen/qwen-2.5-vl-72b-instruct:free",
  "meta-llama/llama-3.2-11b-vision-instruct:free",
];

const OPENROUTER_TEXT_MODELS = [
  "nvidia/nemotron-3.5-lightning:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "inclusionai/ling-3.2-flash:free",
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
  const userContent = image
    ? [
        { type: "text", text: message },
        { type: "image_url", image_url: { url: image } }
      ]
    : message;

  const messages = [
    { role: "system", content: ENHANCED_TABLE_SYSTEM_PROMPT(userName, message, device) },
    ...(Array.isArray(history) ? history : []),
    { role: "user", content: userContent },
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
  throw new Error(`OpenRouter all models failed: ${lastErr}`);
}

// ── 3. Cerebras Provider ───────────────────────────────────────────────────
async function callCerebras(message, userName, device = "desktop") {
  const key = process.env.CEREBRAS_API_KEY || process.env.CEREBRAS;
  if (!isValidKey(key)) throw new Error("Cerebras key not configured");

  const models = ["llama-3.3-70b", "llama3.1-70b", "llama3.1-8b"];
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

  const { message, userName = "User", history = [], image, device } = req.body || {};
  const detectedDevice = device || (/mobile|android|iphone|ipad|phone/i.test(req.headers['user-agent'] || '') ? 'mobile' : 'desktop');
  if (!message) return res.status(400).json({ error: "message is required" });

  let reply = null;
  let usedProvider = "";

  // 1. Try Groq first (ultra-fast <500ms)
  if (!reply && !image && isValidKey(process.env.GROQ_API_KEY)) {
    try {
      reply = await callGroq(message, userName, history, detectedDevice);
      usedProvider = "Groq";
    } catch (e) {
      console.warn("Groq complete failed:", e.message);
    }
  }

  // 2. Try OpenRouter (fast free models + vision)
  if (!reply && getOpenRouterKeyPool().length > 0) {
    try {
      reply = await callOpenRouter(message, userName, history, image, detectedDevice);
      usedProvider = "OpenRouter";
    } catch (e) {
      console.warn("OpenRouter complete failed:", e.message);
    }
  }

  // 3. Try Cerebras
  const cerebrasKey = process.env.CEREBRAS_API_KEY || process.env.CEREBRAS;
  if (!reply && !image && isValidKey(cerebrasKey)) {
    try {
      reply = await callCerebras(message, userName, detectedDevice);
      usedProvider = "Cerebras";
    } catch (e) {
      console.warn("Cerebras complete failed:", e.message);
    }
  }

  // 4. Try Pollinations AI — keyless fallback
  if (!reply) {
    try {
      const msgs = [
        { role: "system", content: ENHANCED_TABLE_SYSTEM_PROMPT(userName, message, detectedDevice) },
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
