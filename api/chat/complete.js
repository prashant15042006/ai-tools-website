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

// Keys
const ZAI_KEY = process.env.ZAI_API_KEY || "";
const CEREBRAS_KEY = process.env.CEREBRAS_API_KEY || "";
// Google Gemini API disabled by user

// 2. Cerebras
async function callCerebras(message, userName) {
  const key = CEREBRAS_KEY;
  if (!isValidKey(key)) throw new Error("Cerebras key not configured");

  const models = ["gpt-oss-120b", "gemma-4-31b", "zai-glm-4.7"];
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

const OPENROUTER_VISION_MODELS = [
  "google/gemini-2.5-flash:free",
  "meta-llama/llama-3.2-11b-vision-instruct:free",
  "openai/gpt-4o-mini",
  "google/gemini-2.5-flash",
  "google/gemma-3-27b-it:free",
  "mistralai/mistral-small-3.2-24b-instruct:free",
];

const OPENROUTER_TEXT_MODELS = [
  "google/gemini-2.5-flash:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-4-31b-it:free",
  "qwen/qwen3-coder:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "liquid/lfm-2.5-1.2b-instruct:free",
  "openai/gpt-4o-mini",
  "google/gemini-2.5-flash",
];

async function callOpenRouter(message, userName, history = [], image = null) {
  const key = ZAI_KEY;
  if (!isValidKey(key)) throw new Error("OpenRouter key not configured");

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
  for (const model of models) {
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
        body: JSON.stringify({ model, messages, max_tokens: 1024 }),
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

function fallbackReply(message) {
  return `Mujhe abhi AI providers se connect karne mein problem aa rahi hai, lekin main yahan hoon! Aapne kaha: "${message}". Thodi der baad try karein ya admin se contact karein.`;
}

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { message, userName = "User", history = [], image } = req.body || {};
  if (!message) return res.status(400).json({ error: "message is required" });

  let reply = null;
  let usedProvider = "";

  // 1. Try Cerebras first (skip if image is present)
  if (!image) {
    try {
      reply = await callCerebras(message, userName);
      usedProvider = "Cerebras";
    } catch (e) {
      console.warn("Cerebras failed:", e.message);
    }
  }

  // 2. Try OpenRouter (ZAI) second
  if (!reply) {
    try {
      reply = await callOpenRouter(message, userName, history, image);
      usedProvider = "OpenRouter";
    } catch (e) {
      console.warn("OpenRouter failed:", e.message);
    }
  }

  // Gemini disabled by user


  // 4. Static fallback — always respond
  if (!reply) {
    reply = fallbackReply(message);
    usedProvider = "fallback";
  }

  console.log(`✅ /api/chat/complete responded via ${usedProvider}`);
  res.status(200).json({ success: true, model: usedProvider, reply: reply });
};
