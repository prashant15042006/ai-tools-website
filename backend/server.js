import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import admin from "firebase-admin";
import fs from "fs";
import killPort from "kill-port";

// Simple fallback when no external model is available
const fallbackResponse = (message) => {
  // You can customize this static reply as needed
  return `🤖 (fallback) I couldn't reach any AI provider, but here's a simple echo of your query: ${message}`;
};

const writeFallbackSSE = (res, message) => {
  if (res.writableEnded) return;
  res.write(`data: ${JSON.stringify({ content: fallbackResponse(message) })}\n\n`);
  res.write("data: [DONE]\n\n");
  res.end();
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = 15000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
};

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to load .env from the current directory (backend/)
dotenv.config({ path: path.join(__dirname, ".env") });

// Fallback to root .env if not found
dotenv.config();

// Helper to check if API key is present and not a placeholder
const isValidKey = (val) => {
  return val && val.trim() !== "" && !val.startsWith("REPLACE_WITH_") && !val.includes("example.com") && !val.includes("example");
};

// Google Gemini API key disabled by user


if (!isValidKey(process.env.OPENROUTER_KEY_NEMOTRON)) {
  console.warn("⚠️ WARNING: OPENROUTER_KEY_NEMOTRON is not set. Add it in .env");
} else {
  console.log("✅ OpenRouter Nemotron Key detected (ends with ...", process.env.OPENROUTER_KEY_NEMOTRON.slice(-5), ")");
}

if (!isValidKey(process.env.OPENROUTER_KEY_GEMMA)) {
  console.warn("⚠️ WARNING: OPENROUTER_KEY_GEMMA is not set. Add it in .env");
} else {
  console.log("✅ OpenRouter Gemma Key detected (ends with ...", process.env.OPENROUTER_KEY_GEMMA.slice(-5), ")");
}

if (!isValidKey(process.env.OPENROUTER_KEY_EMBED)) {
  console.warn("⚠️ WARNING: OPENROUTER_KEY_EMBED is not set. Embeddings will fallback to Nemotron key.");
} else {
  console.log("✅ OpenRouter Embed Key (llama-nemotron-embed-vl-1b-v2) detected (ends with ...", process.env.OPENROUTER_KEY_EMBED.slice(-5), ")");
}

if (!isValidKey(process.env.OPENROUTER_KEY_RERANK)) {
  console.warn("⚠️ WARNING: OPENROUTER_KEY_RERANK is not set. Reranking will be unavailable.");
} else {
  console.log("✅ OpenRouter Rerank Key (llama-nemotron-rerank-vl-1b-v2) detected (ends with ...", process.env.OPENROUTER_KEY_RERANK.slice(-5), ")");
}

// Helper to pre-process uploaded images using OpenRouter vision models
const describeImageWithEmbeddingKey = async (image, userPrompt = "Analyze this image and describe what is visible in detail.") => {
  // Use OPENROUTER_KEY_NEMOTRON or OPENROUTER_KEY_GEMMA for vision
  const embeddingKey = process.env.OPENROUTER_KEY_NEMOTRON || process.env.OPENROUTER_KEY_GEMMA;
  if (!isValidKey(embeddingKey)) {
    console.warn("No OpenRouter keys found, cannot describe image.");
    return "";
  }

  // Vision models to try in sequence (using our configured models)
  const visionModels = [
    "nvidia/nemotron-nano-12b-v2-vl:free",
    "google/gemma-4-26b-a4b-it:free",
  ];

  let lastError = null;

  for (const model of visionModels) {
    try {
      console.log(`🖼️ [IMAGE PRE-PROCESS] Attempting description using OpenRouter model: ${model}`);
      
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
        console.error(`❌ [IMAGE PRE-PROCESS] OpenRouter Model ${model} failed:`, errText);
        lastError = errText;
        continue;
      }

      const data = await response.json();
      const description = data.choices?.[0]?.message?.content || data.choices?.[0]?.text;
      if (description) {
        console.log(`✅ [IMAGE PRE-PROCESS] Image described successfully using OpenRouter model ${model}. Length: ${description.length}`);
        return description;
      }
    } catch (err) {
      console.error(`❌ [IMAGE PRE-PROCESS] Exception with OpenRouter ${model}:`, err.message);
      lastError = err.message;
    }
  }

  throw new Error(`All vision models failed to describe image: ${lastError || "Unknown error"}`);
};


// ===============================
// 🚀 EXPRESS INIT
// ===============================
const app = express();

// Configure CORS for production
app.use(cors({
  origin: "*", // Allows access from any domain (including Vercel)
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: '15mb' }));

// Handle invalid JSON bodies gracefully instead of crashing
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('❌ Invalid JSON payload:', err.message);
    return res.status(400).json({ success: false, error: 'Invalid JSON payload. Please send proper JSON.' });
  }
  next(err);
});

// Expose public uploads folder
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
  console.log("📁 Created uploads directory at:", uploadsDir);
}
app.use("/uploads", express.static(uploadsDir));
// GET diagnostics endpoint
app.get("/api/diag", (req, res) => {
  res.json({
    success: true,
    message: "Nexuss AI Backend is online.",
    environment: {
      OPENROUTER_KEY_NEMOTRON: isValidKey(process.env.OPENROUTER_KEY_NEMOTRON) ? "CONFIGURED (Ends with: ..." + process.env.OPENROUTER_KEY_NEMOTRON.slice(-5) + ")" : "MISSING",
      OPENROUTER_KEY_GEMMA: isValidKey(process.env.OPENROUTER_KEY_GEMMA) ? "CONFIGURED (Ends with: ..." + process.env.OPENROUTER_KEY_GEMMA.slice(-5) + ")" : "MISSING",
      OPENROUTER_KEY_EMBED: isValidKey(process.env.OPENROUTER_KEY_EMBED) ? "CONFIGURED (Ends with: ..." + process.env.OPENROUTER_KEY_EMBED.slice(-5) + ")" : "MISSING",
      OPENROUTER_KEY_RERANK: isValidKey(process.env.OPENROUTER_KEY_RERANK) ? "CONFIGURED (Ends with: ..." + process.env.OPENROUTER_KEY_RERANK.slice(-5) + ")" : "MISSING"
    }
  });
});


// POST upload endpoint — uploads image to Pollinations media storage
// Returns a permanent media.pollinations.ai URL usable as the `image` parameter
app.post("/api/upload", async (req, res) => {
  try {
    const { image } = req.body; // base64 data URL string
    if (!image) {
      return res.status(400).json({ success: false, error: "No image data provided" });
    }

    // Parse the data URL: data:image/png;base64,...
    const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ success: false, error: "Invalid base64 image format. Must be a valid data URL." });
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const imageBuffer = Buffer.from(base64Data, "base64");
    const extension = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "png";
    const filename = `nexuss_upload_${Date.now()}.${extension}`;

    // ── Upload to Pollinations media storage (no API key needed) ──────────
    // Returns a permanent https://media.pollinations.ai/<hash> URL
    const formData = new FormData();
    const blob = new Blob([imageBuffer], { type: mimeType });
    formData.append("file", blob, filename);

    const uploadRes = await fetch("https://gen.pollinations.ai/upload", {
      method: "POST",
      body: formData,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error("❌ Pollinations upload failed:", uploadRes.status, errText);
      throw new Error(`Pollinations upload failed: ${uploadRes.status}`);
    }

    const uploadData = await uploadRes.json();
    // Pollinations returns { url: "https://media.pollinations.ai/<hash>" }
    const publicUrl = uploadData.url || uploadData.media_url || uploadData.link;

    if (!publicUrl) {
      console.error("❌ Pollinations upload response had no URL:", JSON.stringify(uploadData));
      throw new Error("Could not get URL from Pollinations upload response");
    }

    console.log(`📤 Image uploaded to Pollinations media store. URL: ${publicUrl}`);
    return res.json({ success: true, url: publicUrl });

  } catch (err) {
    console.error("❌ Upload error:", err.message);
    return res.status(500).json({ success: false, error: err.message || "Internal upload error" });
  }
});

// Use Render's PORT or default to 5001
const PORT = process.env.PORT || 5001;

// ===============================
// 🔐 FIREBASE INIT
// ===============================
let db;
try {
  let serviceAccount;
  const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");

  // 1. Try to load from env var (for Render / cloud deployments where the file is gitignored)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      console.log("✅ Loaded Firebase service account from FIREBASE_SERVICE_ACCOUNT env var.");
    } catch (parseErr) {
      console.error("❌ Failed to parse FIREBASE_SERVICE_ACCOUNT env var:", parseErr.message);
    }
  }

  // 2. Fall back to local file (for local development)
  if (!serviceAccount && fs.existsSync(serviceAccountPath)) {
    serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"));
    console.log("✅ Loaded Firebase service account from local serviceAccountKey.json");
  }

  if (!serviceAccount) {
    throw new Error("No Firebase credentials found. Set FIREBASE_SERVICE_ACCOUNT env var on Render, or add serviceAccountKey.json for local dev.");
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  db = admin.firestore();
  console.log("✅ Firebase initialized successfully using service account:", serviceAccount.project_id);
} catch (err) {
  console.error("❌ Firebase Initialization Error:", err.message);
  console.warn("Server will continue without database persistence.");
}


// ===============================
// 🔥 COMMON AI FUNCTION
// ===============================
const SYSTEM_PROMPT = (userName = "User") => `You are **Nexuss AI**, an intelligent AI companion for **${userName}**.
- **Identity**: You are a smart and cool friend. Never say you are an AI model or trained by Google/OpenAI.
- **Tone**: Warm, human-like, and supportive. Use a mix of Hindi and English (Hinglish) naturally.
- **Style**: Keep responses concise and friendly unless technical details are needed. Address ${userName} personally.
- **Tables**: When asked for schedules, routines, lists, comparisons, or tabular data, ALWAYS respond using proper markdown table format with pipes (|) and dashes for separators. Example: | Time | Activity | Details |\\n|---|---|---|\\n| 6:00 AM | Wake up | Start your day |
- **Capabilities**: When ${userName} asks what you can do, what are your features, or what tasks you support, ALWAYS respond with this full list:
  ✅ **Chat** – Friendly conversation, Q&A, and general knowledge in Hindi, English, or Hinglish.
  ✅ **Code** – Write, debug, and explain code in any programming language (Python, JS, Java, C++, etc.).
  ✅ **Content Writing** – Blogs, essays, captions, emails, scripts, stories, and more.
  ✅ **Prompt Engineering** – Help craft and optimize AI prompts for any use case.
  ✅ **Image Generation** – Generate AI images from text prompts using the Image Generator section. You can specify ratios like 16:9, 9:16, 4:3, or 1:1 in your prompt.
  (All these features are available inside the Nexuss AI platform!)`;


const ENHANCED_TABLE_SYSTEM_PROMPT = (userName = "User", userMessage = "") => {
  let prompt = SYSTEM_PROMPT(userName);
  const isTableRequest = /table|तालिका|tabular|format|list|सूची|दैनिक|daily|schedule|routine|расписание|時間表/i.test(userMessage);
  
  if (isTableRequest) {
    prompt += `\n- **IMPORTANT**: The user is asking for table/list format. ALWAYS respond with a properly formatted markdown table using pipes and dashes. Make sure every requested item is in table rows.`;
  }
  
  return prompt;
};

// ===============================
// 🧹 Strip unwanted safety labels injected by some AI models
// e.g. "User Safety: safe\nResponse Safety: safe"
// ===============================
const cleanAIResponse = (text) => {
  if (!text) return text;
  return text
    // Remove full lines like "User Safety: safe", "Response Safety: safe"
    .replace(/^(User Safety|Response Safety|Content Safety|Safety Rating|Input Safety|Output Safety)\s*:\s*.+$/gim, "")
    // Remove JSON-style safety objects e.g. {"safety":"safe"}
    .replace(/\{?\s*"?(user_safety|response_safety|content_filter|safety_rating)"?\s*:\s*"?\w+"?\s*\}?,?/gi, "")
    // Remove lines that are ONLY whitespace after removal
    .replace(/^\s*[\r\n]/gm, "")
    // Clean leading/trailing blank lines
    .trim();
};


// ===============================
// 🔑 OpenRouter Key Pool (Two-key setup)
// OPENROUTER_KEY_NEMOTRON → nvidia/nemotron-3-ultra-550b-a55b:free
// OPENROUTER_KEY_GEMMA    → google/gemma-4-26b-a4b-it:free
// ===============================
const getOpenRouterKeyPool = () => {
  const keys = [];
  if (isValidKey(process.env.OPENROUTER_KEY_NEMOTRON))
    keys.push({ name: "NEMOTRON", key: process.env.OPENROUTER_KEY_NEMOTRON });
  if (isValidKey(process.env.OPENROUTER_KEY_GEMMA))
    keys.push({ name: "GEMMA", key: process.env.OPENROUTER_KEY_GEMMA });
  return keys;
};

// Models available per key (verified via OpenRouter API)
const NEMOTRON_MODELS = [
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
];
const GEMMA_MODELS = [
  "google/gemma-4-26b-a4b-it:free",
  "google/gemma-4-31b-it:free",
  "google/gemma-3-27b-it",
];

const getModelsForKey = (keyName, isVision = false) => {
  if (keyName === "NEMOTRON") return NEMOTRON_MODELS;
  if (keyName === "GEMMA") return GEMMA_MODELS;
  return [];
};

const callZAI = async (message, userName = "User", image = null) => {
  const keyPool = getOpenRouterKeyPool();
  if (keyPool.length === 0) throw new Error("No OpenRouter keys configured");

  const userContent = image
    ? [
        { type: "text", text: message },
        { type: "image_url", image_url: { url: image } }
      ]
    : message;

  let lastError = null;

  // Try each key × its models for maximum availability
  for (const { name, key } of keyPool) {
    const models = getModelsForKey(name, !!image);
    for (const model of models) {
      try {
        console.log(`🚀 [${name}] Requesting model: ${model}`);
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://nexuss-ai.io",
            "X-Title": "Nexuss Workspace",
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: "system", content: SYSTEM_PROMPT(userName) },
              { role: "user", content: userContent }
            ],
            max_tokens: 1024,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          let errorMsg = data.error?.message || `Status ${response.status}`;
          // If rate-limited (429) or credits exhausted (402), try next key immediately
          if (response.status === 429 || response.status === 402 || (errorMsg && errorMsg.toLowerCase().includes("credit"))) {
            console.warn(`⚠️ [${name}] Key rate-limited/exhausted (${response.status}), switching key...`);
            break; // break inner loop → try next key
          }
          console.error(`❌ [${name}] ${model} failed:`, errorMsg);
          lastError = errorMsg;
          continue;
        }

        if (data.choices?.[0]?.message?.content || data.choices?.[0]?.text) {
          return data.choices[0].message?.content || data.choices[0].text;
        }

        continue;
      } catch (err) {
        lastError = err.message;
      }
    }
  }

  throw new Error(lastError || "All OpenRouter keys and models failed.");
};


// ===============================
// 🌟 DIRECT GOOGLE GEMINI CALLERS (LIGHTNING FAST)
// ===============================
const formatHistoryForGemini = (history, currentMessage) => {
  const contents = [];
  if (history && Array.isArray(history)) {
    for (const h of history) {
      contents.push({
        role: h.role === "assistant" ? "model" : "user",
        parts: [{ text: h.content }]
      });
    }
  }
  contents.push({
    role: "user",
    parts: [{ text: currentMessage }]
  });
  return contents;
};

const saveChatMetadata = async ({ question, userName, userEmail, model, provider }) => {
  if (!db) return;
  try {
    const chatData = {
      question,
      userName,
      userEmail,
      model,
      provider,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    };
    await db.collection("chats").add(chatData);
  } catch (err) {
    console.warn("Failed to save chat metadata to Firestore:", err.message);
  }
};

// callGeminiDirect and callGeminiDirectStream removed — Gemini API disabled by user

const callZAIStream = async (message, res, userName = "User", userEmail = "", history = [], image = null) => {
  const keyPool = getOpenRouterKeyPool();
  if (keyPool.length === 0) throw new Error("No OpenRouter keys configured");

  // If there's an image, construct the multimodal content format
  const userContent = image
    ? [
        { type: "text", text: message },
        { type: "image_url", image_url: { url: image } }
      ]
    : message;

  let lastError = null;

  for (const { name, key } of keyPool) {
    const models = getModelsForKey(name, !!image);
    for (const model of models) {
      try {
        console.log(`🚀 [STREAM] [${name}] Attempting model: ${model}`);
        const apiMessages = [
          { role: "system", content: ENHANCED_TABLE_SYSTEM_PROMPT(userName, message) },
          ...history,
          { role: "user", content: userContent }
        ];
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://nexuss-ai.io",
            "X-Title": "Nexuss Workspace",
          },
          body: JSON.stringify({
            model: model,
            stream: true,
            messages: apiMessages,
            max_tokens: 1024,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error(`❌ [STREAM] [${name}] ${model} failed:`, errText);
          
          // Switch keys immediately if rate-limited (429) or credits exhausted (402)
          if (
            response.status === 429 ||
            response.status === 402 ||
            errText.toLowerCase().includes("credit") ||
            errText.toLowerCase().includes("rate limit") ||
            errText.toLowerCase().includes("afford")
          ) {
            console.warn(`⚠️ [STREAM] [${name}] Key exhausted (status ${response.status}), switching key...`);
            break; // break inner model loop -> next key
          }
          lastError = errText;
          continue;
        }

        let buffer = "";
        let fullReply = "";
        let streamStarted = false;

        return new Promise((resolve, reject) => {
          response.body.on("data", (chunk) => {
            buffer += chunk.toString();
            let lines = buffer.split("\n");
            buffer = lines.pop();

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data: ")) continue;
              
              const dataStr = trimmed.slice(6);
              if (dataStr === "[DONE]") {
                res.write("data: [DONE]\n\n");
                continue;
              }
              
              try {
                const data = JSON.parse(dataStr);
                const content = data.choices?.[0]?.delta?.content || "";
                if (content) {
                  streamStarted = true;
                  fullReply += content;
                  res.write(`data: ${JSON.stringify({ content })}\n\n`);
                }
              } catch (e) {
                // Fragmented JSON
              }
            }
          });

          response.body.on("end", async () => {
            // If the full reply contains safety labels, send a correction to the client
            const cleanedReply = cleanAIResponse(fullReply);
            if (cleanedReply !== fullReply && cleanedReply.length > 0) {
              // Send a special replace signal so the client can swap the full reply
              res.write(`data: ${JSON.stringify({ replace: cleanedReply })}\n\n`);
            }
            console.log(`✅ [STREAM] Finished with ${model}. Reply length: ${fullReply.length}`);
            
            // Save metadata only, without AI reply text
            await saveChatMetadata({
              question: message,
              userName,
              userEmail,
              model: model,
              provider: "OpenRouter"
            });
            
            res.end();
            resolve();
          });

          response.body.on("error", (err) => {
            console.error("❌ [STREAM] Body error:", err.message);
            err.streamStarted = streamStarted;
            reject(err);
          });
        });

      } catch (err) {
        console.error(`❌ [STREAM] [${name}] Exception with ${model}:`, err.message);
        if (err?.streamStarted) {
          throw err;
        }
        lastError = err.message;
      }
    }
  }

  throw new Error(`OpenRouter stream exhausted all keys/models. Last error: ${lastError}`);
};


// Stubs for removed providers
const callGroq = async () => { throw new Error("Groq removed — use OpenRouter"); };
const callGroqStream = async (message, res, userName, userEmail, history) => {
  // Groq removed — passthrough to ZAI stream
  return callZAIStream(message, res, userName, userEmail, history);
};
const callHuggingFace = async () => { throw new Error("HuggingFace removed — use OpenRouter"); };


// ===============================
// 💬 CHAT API (STREAMING)
// ===============================
app.post("/api/chat", async (req, res) => {
  try {
    const { message, userName, userEmail, history, image } = req.body;
    if (!message) return res.status(400).json({ error: "Message required" });

    let dynamicMessage = message;
    let dynamicImage = image;

    if (image) {
      try {
        console.log("📸 Image attached to streaming chat. Pre-processing with vision model...");
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

    // Set headers for SSE (Server-Sent Events)
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const tryStreamProvider = async (label, runner) => {
      try {
        return await runner();
      } catch (err) {
        console.error(`${label} stream failed, falling back:`, err.message || err);
        if (err?.streamStarted) {
          throw err;
        }
        return null;
      }
    };

    // Use OpenRouter only (NEMOTRON + GEMMA keys)
    if (getOpenRouterKeyPool().length > 0) {
      const reply = await tryStreamProvider("OpenRouter", async () => {
        await callZAIStream(dynamicMessage, res, userName, userEmail, history, dynamicImage);
        return true;
      });
      if (reply) return;
    }

    // No valid providers completed successfully
    if (!res.headersSent) {
      res.statusCode = 503;
      res.setHeader("Content-Type", "application/json");
      return res.json({ success: false, error: "No AI providers succeeded" });
    } else {
      res.write("data: [DONE]\n\n");
      res.end();
    }

  } catch (error) {
    console.error("Chat Error:", error.message);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.json({ success: false, error: error.message });
    } else if (!res.writableEnded) {
      res.write("data: [DONE]\n\n");
      res.end();
    }
  }
});


// ===============================
// 💬 CHAT API (COMPLETE - non-streaming)
// Uses Nemotron by default if configured (fast replies). Falls back to OpenRouter/ZAI.
// Body: { message, userName, history }
// ===============================
app.post("/api/chat/complete", async (req, res) => {
  try {
    const { message, userName, userEmail, history, image } = req.body;
    if (!message) return res.status(400).json({ error: "Message required" });

    let dynamicMessage = message;
    let dynamicImage = image;

    if (image) {
      try {
        console.log("📸 Image attached to chat/complete. Pre-processing with vision model...");
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

    // Use OpenRouter only (NEMOTRON + GEMMA keys)
    if (getOpenRouterKeyPool().length > 0) {
      try {
        const reply = await callZAI(dynamicMessage, userName, dynamicImage);
        await saveChatMetadata({ question: message, userName, userEmail, model: "openrouter", provider: "OpenRouter" });
        return res.json({ success: true, model: 'openrouter', reply });
      } catch (err) {
        console.error('OpenRouter call failed:', err.message);
      }
    }

    return res.status(503).json({ success: false, error: "No AI providers succeeded" });

  } catch (error) {
    console.error('Chat Complete Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});


// ===============================
// ⚡ CODE GENERATOR
// ===============================
app.post("/api/code", async (req, res) => {
  try {
    const { prompt, userName, image } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt required" });
    }

    let dynamicPrompt = prompt;
    let dynamicImage = image;

    if (image) {
      try {
        console.log("📸 Image attached to /api/code. Pre-processing with vision model...");
        const description = await describeImageWithEmbeddingKey(image, prompt);
        if (description) {
          dynamicPrompt = `[IMAGE ANALYSIS: The user has uploaded an image. Below is a highly detailed description and analysis of the image content:\n${description}]\n\nUser Prompt: ${prompt}`;
          dynamicImage = null; // Clear image so text-only models can answer
          console.log("📸 Image pre-processing complete. Appended description to prompt text.");
        }
      } catch (err) {
        console.error("⚠️ Image pre-processing failed, falling back to original image payload:", err.message);
      }
    }

    // Use OpenRouter only (NEMOTRON + GEMMA keys)
    if (getOpenRouterKeyPool().length > 0) {
      try {
        const result = await callZAI(`Generate clean code for: ${dynamicPrompt}`, userName, dynamicImage);
        return res.json({ success: true, provider: 'openrouter', result });
      } catch (err) {
        console.warn('OpenRouter code generation failed:', err.message);
      }
    }

    return res.status(503).json({ success: false, error: "No API Key configured." });

  } catch (error) {
    console.error("Code Error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});


// ===============================
// 📝 CONTENT GENERATOR
// ===============================
app.post("/api/content", async (req, res) => {
  try {
    const { prompt, userName, image } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt required" });
    }

    let dynamicPrompt = prompt;
    let dynamicImage = image;

    if (image) {
      try {
        console.log("📸 Image attached to /api/content. Pre-processing with vision model...");
        const description = await describeImageWithEmbeddingKey(image, prompt);
        if (description) {
          dynamicPrompt = `[IMAGE ANALYSIS: The user has uploaded an image. Below is a highly detailed description and analysis of the image content:\n${description}]\n\nUser Prompt: ${prompt}`;
          dynamicImage = null; // Clear image so text-only models can answer
          console.log("📸 Image pre-processing complete. Appended description to prompt text.");
        }
      } catch (err) {
        console.error("⚠️ Image pre-processing failed, falling back to original image payload:", err.message);
      }
    }

    // Use OpenRouter only (NEMOTRON + GEMMA keys)
    if (getOpenRouterKeyPool().length > 0) {
      try {
        const result = await callZAI(`Write detailed content about: ${dynamicPrompt}`, userName, dynamicImage);
        return res.json({ success: true, provider: 'openrouter', result });
      } catch (err) {
        console.warn('OpenRouter content generation failed:', err.message);
      }
    }

    return res.status(503).json({ success: false, error: "No API Key configured." });

  } catch (error) {
    console.error("Content Error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});


// ===============================
// 🧬 EMBEDDING API
// Generates text/vision embeddings using nvidia/llama-nemotron-embed-vl-1b-v2:free
// Body: { text: string } — returns { embedding: number[] }
// ===============================
app.post("/api/embed", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "text field required" });

    // Priority: dedicated EMBED key → fallback to NEMOTRON key
    const embedKey = process.env.OPENROUTER_KEY_EMBED || process.env.OPENROUTER_KEY_NEMOTRON || process.env.OPENROUTER_KEY_GEMMA;
    if (!isValidKey(embedKey)) {
      return res.status(503).json({ success: false, error: "No embedding key configured. Set OPENROUTER_KEY_EMBED in .env" });
    }

    // Try dedicated Nemotron embed model first, then fallback
    const embedModels = [
      "nvidia/llama-nemotron-embed-vl-1b-v2:free",
      "openai/text-embedding-ada-002",
    ];

    let lastError = null;
    for (const model of embedModels) {
      try {
        console.log(`🧬 [EMBED] Trying model: ${model}`);
        const response = await fetchWithTimeout("https://openrouter.ai/api/v1/embeddings", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${embedKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://nexuss-ai.io",
            "X-Title": "Nexuss Workspace",
          },
          body: JSON.stringify({ model, input: text }),
        }, 12000);
        const data = await response.json();
        if (!response.ok) {
          lastError = data.error?.message || `Status ${response.status}`;
          console.warn(`⚠️ [EMBED] ${model} failed:`, lastError);
          continue;
        }
        const embedding = data.data?.[0]?.embedding;
        if (!embedding) { lastError = "Empty embedding"; continue; }
        console.log(`✅ [EMBED] Success with ${model}. Dims: ${embedding.length}`);
        return res.json({ success: true, provider: "openrouter", model, embedding });
      } catch (err) {
        lastError = err.message;
        console.warn(`⚠️ [EMBED] Exception with ${model}:`, err.message);
      }
    }

    return res.status(503).json({ success: false, error: lastError || "All embedding models failed." });

  } catch (error) {
    console.error("Embed Error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});


// ===============================
// 🔀 RERANK API
// Semantically reranks a list of documents given a query.
// Uses nvidia/llama-nemotron-rerank-vl-1b-v2:free via OpenRouter
// Body: { query: string, documents: string[] }
// Returns: { results: [{ index, text, score }] } sorted by relevance
// Used by: Prompt Manager smart search, Chat history search
// ===============================
app.post("/api/rerank", async (req, res) => {
  try {
    const { query, documents } = req.body;
    if (!query) return res.status(400).json({ success: false, error: "query is required" });
    if (!Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({ success: false, error: "documents must be a non-empty array" });
    }

    const rerankKey = process.env.OPENROUTER_KEY_RERANK;
    if (!isValidKey(rerankKey)) {
      // Graceful fallback: return documents in original order with dummy scores
      console.warn("⚠️ [RERANK] OPENROUTER_KEY_RERANK not configured. Returning original order.");
      return res.json({
        success: true,
        provider: "fallback",
        results: documents.map((text, index) => ({ index, text, score: 1 - index * 0.01 }))
      });
    }

    console.log(`🔀 [RERANK] Query: "${query.slice(0, 60)}..." | Documents: ${documents.length}`);

    try {
      const response = await fetchWithTimeout("https://openrouter.ai/api/v1/rerank", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${rerankKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://nexuss-ai.io",
          "X-Title": "Nexuss Workspace",
        },
        body: JSON.stringify({
          model: "nvidia/llama-nemotron-rerank-vl-1b-v2:free",
          query,
          documents,
          top_n: documents.length, // return all, sorted by relevance
        }),
      }, 15000);

      const data = await response.json();

      if (!response.ok) {
        const errMsg = data.error?.message || `Status ${response.status}`;
        console.error(`❌ [RERANK] OpenRouter rerank failed:`, errMsg);
        // Graceful fallback
        return res.json({
          success: true,
          provider: "fallback",
          results: documents.map((text, index) => ({ index, text, score: 1 - index * 0.01 }))
        });
      }

      // OpenRouter rerank response: { results: [{ index, relevance_score }] }
      const rawResults = data.results || [];
      const ranked = rawResults
        .sort((a, b) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0))
        .map(r => ({
          index: r.index,
          text: documents[r.index],
          score: r.relevance_score ?? 0
        }));

      console.log(`✅ [RERANK] Reranking complete. Top result index: ${ranked[0]?.index}`);
      return res.json({ success: true, provider: "openrouter", model: "nvidia/llama-nemotron-rerank-vl-1b-v2:free", results: ranked });

    } catch (err) {
      console.error("❌ [RERANK] Exception:", err.message);
      // Graceful fallback
      return res.json({
        success: true,
        provider: "fallback",
        results: documents.map((text, index) => ({ index, text, score: 1 - index * 0.01 }))
      });
    }

  } catch (error) {
    console.error("Rerank Error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});


// ===============================
// 📋 TASK APIs
// ===============================
app.get("/api/tasks", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: "Database not available" });
    const snapshot = await db.collection("tasks").get();

    const tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(tasks);

  } catch {
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

app.post("/api/tasks", async (req, res) => {
  try {
    const { text } = req.body;
    if (!db) return res.status(503).json({ error: "Database not available" });

    if (!text) {
      return res.status(400).json({ error: "Task text required" });
    }

    const newTask = await db.collection("tasks").add({
      text,
      completed: false,
      createdAt: new Date(),
    });

    res.json({ id: newTask.id, text, completed: false });

  } catch {
    res.status(500).json({ error: "Failed to add task" });
  }
});

app.put("/api/tasks/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!db) return res.status(503).json({ error: "Database not available" });

    const taskRef = db.collection("tasks").doc(id);
    const doc = await taskRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Task not found" });
    }

    await taskRef.update({
      completed: !doc.data().completed,
    });

    res.json({ success: true });

  } catch {
    res.status(500).json({ error: "Update failed" });
  }
});

app.delete("/api/tasks/:id", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: "Database not available" });
    await db.collection("tasks").doc(req.params.id).delete();
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Delete failed" });
  }
});

// ===============================
// 📂 PROJECTS APIs (EMAIL SCOPED)
// ===============================
const projectsFilePath = path.join(__dirname, "projects.json");

const getLocalProjects = () => {
  try {
    if (fs.existsSync(projectsFilePath)) {
      return JSON.parse(fs.readFileSync(projectsFilePath, "utf8"));
    }
  } catch (err) {
    console.error("Error reading local projects:", err.message);
  }
  return [];
};

const saveLocalProjects = (projects) => {
  try {
    fs.writeFileSync(projectsFilePath, JSON.stringify(projects, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error("Error saving local projects:", err.message);
    return false;
  }
};

app.get("/api/projects", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    if (db) {
      try {
        const snapshot = await db.collection("projects").where("email", "==", email).get();
        const projects = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        return res.json(projects);
      } catch (dbErr) {
        console.warn("Firestore projects fetch failed, using local fallback:", dbErr.message);
      }
    }

    // Fallback to local projects.json file
    const localProjects = getLocalProjects();
    const userProjects = localProjects.filter(p => p.email === email);
    res.json(userProjects);
  } catch (err) {
    console.error("GET /api/projects error:", err.message);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

app.post("/api/projects", async (req, res) => {
  try {
    const { email, name, desc } = req.body;
    if (!email || !name) {
      return res.status(400).json({ error: "Email and Name are required" });
    }

    const newProject = {
      email,
      name,
      desc: desc || "New workspace project",
      notes: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (db) {
      try {
        const docRef = await db.collection("projects").add(newProject);
        return res.json({ id: docRef.id, ...newProject });
      } catch (dbErr) {
        console.warn("Firestore project add failed, using local fallback:", dbErr.message);
      }
    }

    // Fallback to local projects.json file
    const id = Date.now().toString();
    const localProjects = getLocalProjects();
    const savedProject = { id, ...newProject };
    localProjects.push(savedProject);
    saveLocalProjects(localProjects);

    res.json(savedProject);
  } catch (err) {
    console.error("POST /api/projects error:", err.message);
    res.status(500).json({ error: "Failed to create project" });
  }
});

app.put("/api/projects/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, desc, notes } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (desc !== undefined) updates.desc = desc;
    if (notes !== undefined) updates.notes = notes;
    updates.updatedAt = new Date().toISOString();

    if (db) {
      try {
        const docRef = db.collection("projects").doc(id);
        const doc = await docRef.get();
        if (doc.exists) {
          await docRef.update(updates);
          return res.json({ success: true, id, ...updates });
        }
      } catch (dbErr) {
        console.warn("Firestore project update failed, trying local fallback:", dbErr.message);
      }
    }

    // Fallback to local projects.json file
    const localProjects = getLocalProjects();
    const index = localProjects.findIndex(p => p.id === id);
    if (index !== -1) {
      localProjects[index] = { ...localProjects[index], ...updates };
      saveLocalProjects(localProjects);
      return res.json({ success: true, id, ...localProjects[index] });
    }

    res.status(404).json({ error: "Project not found" });
  } catch (err) {
    console.error("PUT /api/projects error:", err.message);
    res.status(500).json({ error: "Failed to update project" });
  }
});

app.delete("/api/projects/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (db) {
      try {
        const docRef = db.collection("projects").doc(id);
        const doc = await docRef.get();
        if (doc.exists) {
          await docRef.delete();
          return res.json({ success: true });
        }
      } catch (dbErr) {
        console.warn("Firestore project delete failed, trying local fallback:", dbErr.message);
      }
    }

    // Fallback to local projects.json file
    const localProjects = getLocalProjects();
    const filtered = localProjects.filter(p => p.id !== id);
    if (filtered.length !== localProjects.length) {
      saveLocalProjects(filtered);
      return res.json({ success: true });
    }

    res.status(404).json({ error: "Project not found" });
  } catch (err) {
    console.error("DELETE /api/projects error:", err.message);
    res.status(500).json({ error: "Failed to delete project" });
  }
});

// ===============================
// ❤️ HEALTH CHECK
// ===============================
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "AI Workspace running 🚀" });
});

// Images feature removed from backend

// ===============================
// 🚀 START SERVER
// ===============================
// ===============================
// 🔊 TTS / Nemotron Support
// - POST /api/tts/config  -> save NEMOTRON_API_KEY and optional NEMOTRON_API_URL to backend .env
// - POST /api/tts/synthesize -> proxy text to configured Nemotron API and return audio (base64) or provider response
// ===============================

// Helper: Upsert an env var in backend .env
const envFilePath = path.join(__dirname, ".env");
const upsertEnvVar = (key, value) => {
  try {
    let content = "";
    if (fs.existsSync(envFilePath)) {
      content = fs.readFileSync(envFilePath, "utf8");
    }

    const lines = content.split(/\r?\n/).filter(Boolean);
    const prefix = `${key}=`;
    let found = false;
    const newLines = lines.map(line => {
      if (line.startsWith(prefix)) {
        found = true;
        return `${key}=${value}`;
      }
      return line;
    });

    if (!found) newLines.push(`${key}=${value}`);

    fs.writeFileSync(envFilePath, newLines.join("\n") + "\n", "utf8");

    // Also update process.env in-memory for immediate effect
    process.env[key] = value;
    return true;
  } catch (err) {
    console.error("Failed to write .env:", err.message || err);
    return false;
  }
};

// TTS config: deprecated (OpenRouter keys set via .env only now)
app.post("/api/tts/config", (req, res) => {
  try {
    const { apiKey } = req.body || {};
    if (!apiKey) return res.status(400).json({ success: false, error: "apiKey is required" });
    // Store as OPENROUTER_KEY_NEMOTRON for compatibility
    const ok = upsertEnvVar("OPENROUTER_KEY_NEMOTRON", apiKey);
    if (!ok) return res.status(500).json({ success: false, error: "Failed to persist config" });
    return res.json({ success: true, message: "OpenRouter Nemotron key saved" });
  } catch (err) {
    console.error("TTS Config Error:", err.message || err);
    return res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

// Synthesize text using configured Nemotron endpoint.
// Expectation: provider accepts POST JSON with { text, voice } and returns audio as base64 or a URL.
app.post("/api/tts/synthesize", async (req, res) => {
  try {
    const { text, voice } = req.body || {};
    if (!text) return res.status(400).json({ success: false, error: "text is required" });

    const apiKey = req.body.apiKey || process.env.OPENROUTER_KEY_NEMOTRON;
    const apiUrl = req.body.apiUrl || null; // TTS URL must be provided in request body

    if (!apiKey || !apiUrl) {
      return res.status(503).json({ success: false, error: "Nemotron API key or URL not configured. Use /api/tts/config or include apiKey/apiUrl in body." });
    }

    // Build a generic request body that many TTS providers accept. If your Nemotron expects a different schema, update accordingly.
    const body = {
      input: text,
      voice: voice || "alloy",
      format: "wav"
    };

    const providerResp = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const contentType = providerResp.headers.get("content-type") || "";

    if (!providerResp.ok) {
      const errText = await providerResp.text();
      console.error("Nemotron provider error:", errText);
      return res.status(502).json({ success: false, error: errText || `Status ${providerResp.status}` });
    }

    // If provider returned JSON with base64 audio or URL, pass through
    if (contentType.includes("application/json")) {
      const data = await providerResp.json();
      return res.json({ success: true, data });
    }

    // Otherwise assume binary audio stream; convert to base64 and return
    const arrayBuffer = await providerResp.arrayBuffer();
    const b64 = Buffer.from(arrayBuffer).toString('base64');
    return res.json({ success: true, data: { b64 } });

  } catch (err) {
    console.error("TTS Synthesize Error:", err.message || err);
    return res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

// Google Translate TTS Proxy (supports reliable multi-device movie-grade voice streaming)
app.get("/api/tts/google", async (req, res) => {
  try {
    const { text, lang = "hi" } = req.query;
    if (!text) return res.status(400).json({ error: "text is required" });

    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(lang)}&client=tw-ob&q=${encodeURIComponent(text)}`;
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    if (!response.ok) {
      throw new Error(`Google TTS proxy request failed with status ${response.status}`);
    }

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Access-Control-Allow-Origin", "*");
    response.body.pipe(res);
  } catch (err) {
    console.error("Google TTS Proxy Error:", err.message || err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

const startServer = async () => {
  try {
    // Attempt to kill the port before starting the server
    await killPort(PORT, 'tcp');
    console.log(`🧹 Automatically cleared port ${PORT}`);
  } catch (err) {
    // Port might not be in use, ignore error
  }

  const server = app.listen(PORT, () => {
    console.log(`🔥 Server running on http://localhost:${PORT}`);
  }).on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`\n❌ Error: Port ${PORT} is already in use.`);
      console.error(`💡 FIX: Type 'npx kill-port ${PORT}' in your terminal and try again.\n`);
      process.exit(1);
    } else {
      console.error("❌ Server Error:", err.message);
    }
  });
};

startServer();   