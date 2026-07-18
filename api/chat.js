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
- **Tables**: When asked for schedules, routines, lists, comparisons, or tabular data, ALWAYS respond using proper markdown table format with pipes (|) and dashes for separators.
- **Capabilities**: When ${userName} asks what you can do, what are your features, or what tasks you support, ALWAYS respond with this full list:
  ✅ **Chat** – Friendly conversation, Q&A, and general knowledge in Hindi, English, or Hinglish.
  ✅ **Code** – Write, debug, and explain code in any programming language (Python, JS, Java, C++, etc.).
  ✅ **Content Writing** – Blogs, essays, captions, emails, scripts, stories, and more.
  ✅ **Prompt Engineering** – Help craft and optimize AI prompts for any use case.
  ✅ **Image Generation** – Generate AI images from text prompts using the Image Generator section. You can specify ratios like 16:9, 9:16, 4:3, or 1:1 in your prompt.
  (All these features are available inside the Nexuss AI platform!)`;


const isValidKey = (val) =>
  val &&
  val.trim() !== "" &&
  !val.startsWith("REPLACE_WITH_") &&
  !val.includes("example.com") &&
  !val.includes("example");

// Helper to pre-process uploaded images using EMBEDDING_API_KEY with OpenRouter vision models
async function describeImageWithEmbeddingKey(image, userPrompt = "Analyze this image and describe what is visible in detail.") {
  // Gemini API disabled by user


  // 2. OpenRouter vision models using EMBEDDING_API_KEY or ZAI_API_KEY
  const embeddingKey = process.env.EMBEDDING_API_KEY || process.env.ZAI_API_KEY;
  if (!isValidKey(embeddingKey)) {
    console.warn("No EMBEDDING_API_KEY or ZAI_API_KEY found, cannot describe image.");
    return "";
  }

  // Vision models to try in sequence - putting fastest and free chat-vision models first
  const visionModels = [
    "google/gemini-2.5-flash:free",
    "meta-llama/llama-3.2-11b-vision-instruct:free",
    "google/gemma-3-27b-it:free",
    "google/gemini-2.5-flash",
    "openai/gpt-4o-mini",
    "nvidia/llama-nemotron-embed-vl-1b-v2:free", // Last fallback as it is an embedding model
  ];

  let lastError = null;

  for (const model of visionModels) {
    try {
      console.log(`🖼️ [IMAGE PRE-PROCESS VERCEL] Attempting description using OpenRouter model: ${model}`);
      
      const payload = {
        model: model,
        messages: [
          {
            role: "system",
            content: "You are a vision-language assistant. Analyze the image carefully. Provide a highly detailed description of what is in the image, including any text, tables, charts, or visual elements. Keep the description clear, structured, and informative."
          },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt || "Describe this image in detail." },
              { type: "image_url", image_url: { url: image } }
            ]
          }
        ],
        max_tokens: 1024,
      };

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${embeddingKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://nexuss-ai.io",
          "X-Title": "Nexuss Workspace",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`❌ [IMAGE PRE-PROCESS VERCEL] OpenRouter Model ${model} failed:`, errText);
        lastError = errText;
        continue;
      }

      const data = await response.json();
      const description = data.choices?.[0]?.message?.content || data.choices?.[0]?.text;
      if (description) {
        console.log(`✅ [IMAGE PRE-PROCESS VERCEL] Image described successfully using OpenRouter model ${model}. Length: ${description.length}`);
        return description;
      }
    } catch (err) {
      console.error(`❌ [IMAGE PRE-PROCESS VERCEL] Exception with OpenRouter ${model}:`, err.message);
      lastError = err.message;
    }
  }

  throw new Error(`All vision models failed to describe image: ${lastError || "Unknown error"}`);
}

// callGemini removed — Gemini API disabled by user


const OPENROUTER_VISION_MODELS = [
  "openrouter/free",
  "openai/gpt-4o-mini",
  "google/gemini-2.5-flash",
  "meta-llama/llama-3.2-11b-vision-instruct:free",
  "google/gemma-3-27b-it:free",
  "mistralai/mistral-small-3.2-24b-instruct:free",
];

const OPENROUTER_TEXT_MODELS = [
  "openrouter/free",
  "openai/gpt-4o-mini",
  "google/gemini-2.5-flash",
  "meta-llama/llama-3.3-70b-instruct:free",
  "liquid/lfm-2.5-1.2b-instruct:free",
  "poolside/laguna-xs-2.1:free",
  "cohere/north-mini-code:free",
  "openai/gpt-oss-120b:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "google/gemma-4-31b-it:free",
  "qwen/qwen3-coder:free"
];

// ===============================
// 🔑 OpenRouter Key Pool (Load Distribution)
// Returns all available OpenRouter API keys for round-robin load balancing.
// ===============================
const getOpenRouterKeyPool = () => {
  const keys = [];
  if (isValidKey(process.env.ZAI_API_KEY))
    keys.push({ name: "ZAI", key: process.env.ZAI_API_KEY });
  if (isValidKey(process.env.EMBEDDING_API_KEY))
    keys.push({ name: "EMBEDDING", key: process.env.EMBEDDING_API_KEY });
  if (isValidKey(process.env['LLAMA-NEMOTRON_API_KEY']))
    keys.push({ name: "LLAMA-NEMOTRON", key: process.env['LLAMA-NEMOTRON_API_KEY'] });
  // Use NEMOTRON_API_KEY as OpenRouter key only if NEMOTRON_API_URL is not a valid endpoint
  if (isValidKey(process.env.NEMOTRON_API_KEY) && !isValidKey(process.env.NEMOTRON_API_URL))
    keys.push({ name: "NEMOTRON_OR", key: process.env.NEMOTRON_API_KEY });
  return keys;
};

async function callOpenRouter(message, userName, history = [], image = null) {
  const keyPool = getOpenRouterKeyPool();
  if (keyPool.length === 0) throw new Error("No OpenRouter keys configured");

  const models = image ? OPENROUTER_VISION_MODELS : OPENROUTER_TEXT_MODELS;

  // Build user content — multimodal if image provided
  const userContent = image
    ? [
        { type: "text", text: message },
        { type: "image_url", image_url: { url: image } }
      ]
    : message;

  const messages = [
    { role: "system", content: SYSTEM_PROMPT(userName) },
    ...(Array.isArray(history) ? history : []),
    { role: "user", content: userContent },
  ];

  let lastErr = "Unknown error";

  for (const { name, key } of keyPool) {
    for (const model of models) {
      try {
        console.log(`🚀 [${name}] Attempting model: ${model}`);
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
          body: JSON.stringify({ model, messages, max_tokens: 1024 }),
          signal: controller.signal,
        });
        clearTimeout(timer);
        const data = await res.json();
        if (!res.ok) {
          lastErr = data.error?.message || `${res.status}`;
          // Switch keys if rate-limited or credits exhausted
          if (res.status === 429 || lastErr.toLowerCase().includes("credit") || lastErr.toLowerCase().includes("rate limit")) {
            console.warn(`⚠️ [${name}] Key rate-limited/exhausted, switching key...`);
            break; // break inner model loop -> next key
          }
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
  }
  throw new Error(`OpenRouter all models/keys failed. Last error: ${lastErr}`);
}

// ──────────────────────────────────────────────
// 3. Cerebras
// ──────────────────────────────────────────────
async function callCerebras(message, userName) {
  const key = process.env.CEREBRAS_API_KEY;
  if (!isValidKey(key)) throw new Error("Cerebras key not configured");

  const models = ["gemma-4-31b", "zai-glm-4.7", "gpt-oss-120b"];
  let lastErr = "Unknown error";

  for (const model of models) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const res = await fetch("https://api.cerebras.ai/v1/chat/completions", {
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
      if (!res.ok) {
        lastErr = data.error?.message || `${res.status}`;
        continue;
      }
      const text = data.choices?.[0]?.message?.content;
      if (!text) { lastErr = "Empty response"; continue; }
      return text;
    } catch(e) {
      lastErr = e.message;
    }
  }
  throw new Error(`Cerebras all models failed: ${lastErr}`);
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
module.exports = async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { message, userName = "User", history = [], image } = req.body || {};
  if (!message) return res.status(400).json({ error: "message is required" });

  let dynamicMessage = message;
  let dynamicImage = image;

  if (image) {
    try {
      console.log("📸 Image attached to Vercel chat. Pre-processing with vision model...");
      const description = await describeImageWithEmbeddingKey(image, message);
      if (description) {
        dynamicMessage = `[IMAGE ANALYSIS: The user has uploaded an image. Below is a highly detailed description and analysis of the image content:\n${description}]\n\nUser Message: ${message}`;
        dynamicImage = null; // Clear image so text-only models can answer
        console.log("📸 Image pre-processing complete. Appended description to message text.");
      }
    } catch (err) {
      console.error("⚠️ Image pre-processing failed, falling back to original image payload:", err.message);
    }
  }

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let reply = null;
  let usedProvider = "";

  // 1. Try OpenRouter (ZAI) first — supports vision via multimodal content & load balanced pool
  if (getOpenRouterKeyPool().length > 0) {
    try {
      reply = await callOpenRouter(dynamicMessage, userName, history, dynamicImage);
      usedProvider = "OpenRouter";
    } catch (e) {
      console.warn("OpenRouter failed:", e.message);
    }
  }

  // 2. Try Cerebras second as a fallback — but SKIP if image is attached (Cerebras has no vision support)
  if (!reply && !dynamicImage && isValidKey(process.env.CEREBRAS_API_KEY)) {
    try {
      reply = await callCerebras(dynamicMessage, userName);
      usedProvider = "Cerebras";
    } catch (e) {
      console.warn("Cerebras failed:", e.message);
    }
  }

  // Gemini disabled by user

  // 4. Static fallback — always respond
  if (!reply) {
    reply = fallbackReply(dynamicMessage);
    usedProvider = "fallback";
  }

  console.log(`✅ /api/chat responded via ${usedProvider}`);
  sseWrite(res, { content: reply });
  res.write("data: [DONE]\n\n");
  res.end();
}
