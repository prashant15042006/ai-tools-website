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

if (!isValidKey(process.env.GEMINI_API_KEY)) {
  console.warn("💡 INFO: GEMINI_API_KEY is not set or has placeholder value.");
} else {
  console.log("✅ Direct Google Gemini API Key detected (ends with ...", process.env.GEMINI_API_KEY.slice(-5), ")");
}

if (!isValidKey(process.env.ZAI_API_KEY)) {
  console.warn("⚠️ WARNING: ZAI_API_KEY (OpenRouter Key) is not set or has placeholder value.");
} else {
  console.log("✅ OpenRouter (ZAI) API Key detected (ends with ...", process.env.ZAI_API_KEY.slice(-5), ")");
}

if (!isValidKey(process.env.NEMOTRON_API_KEY)) {
  console.warn("💡 INFO: NEMOTRON_API_KEY is not set or has placeholder value.");
} else {
  console.log("✅ NEMOTRON API Key detected (ends with ...", process.env.NEMOTRON_API_KEY.slice(-5), ")");
}

if (!isValidKey(process.env.CEREBRAS_API_KEY)) {
  console.warn("💡 INFO: CEREBRAS_API_KEY is not set or has placeholder value.");
} else {
  console.log("✅ Cerebras API Key detected (ends with ...", process.env.CEREBRAS_API_KEY.slice(-5), ")");
}

const USE_CEREBRAS_MODE = process.env.MODE?.toUpperCase() === "CEREBRAS";


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
  const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");
  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(`Service account file not found at ${serviceAccountPath}`);
  }

  const serviceAccount = JSON.parse(
    fs.readFileSync(serviceAccountPath, "utf-8")
  );

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



const callZAI = async (message, userName = "User", image = null) => {
  const visionModels = [
    "openrouter/free",
    "openai/gpt-4o-mini",
    "google/gemini-2.5-flash",
    "meta-llama/llama-3.2-11b-vision-instruct:free",
    "google/gemma-3-27b-it:free",
    "mistralai/mistral-small-3.2-24b-instruct:free",
  ];
  const textModels = [
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
  const models = image ? visionModels : textModels;
  let lastError = null;

  // If there's an image, construct the multimodal content format supported by vision models
  const userContent = image
    ? [
        { type: "text", text: message },
        { type: "image_url", image_url: { url: image } }
      ]
    : message;

  for (const model of models) {
    try {
      console.log(`🚀 Requesting model: ${model}`);
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.ZAI_API_KEY}`,
          "Content-Type": "application/json",
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
        console.error(`❌ ${model} failed:`, errorMsg);
        lastError = errorMsg;
        continue;
      }

      if (data.choices?.[0]?.message?.content) {
        return data.choices[0].message.content;
      }
      
      continue;
    } catch (err) {
      lastError = err.message;
    }
  }

  throw new Error(lastError || "All models failed. Please verify your API key and credits at openrouter.ai");
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
      model,
      provider,
      createdAt: new Date()
    };
    if (userEmail) {
      chatData.userEmail = userEmail;
    }
    await db.collection("chats").add(chatData);
  } catch (dbErr) {
    console.warn("DB Save error:", dbErr.message);
  }
};

const callGeminiDirect = async (message, userName = "User", image = null) => {
  console.log(`🚀 [DIRECT GEMINI] Requesting gemini-2.0-flash`);
  
  // Use enhanced prompt for table requests
  const systemPrompt = ENHANCED_TABLE_SYSTEM_PROMPT(userName, message);

  // Build parts array — prepend image if provided (Gemini inlineData format)
  const parts = [];
  if (image) {
    const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      parts.push({ inlineData: { mimeType: matches[1], data: matches[2] } });
    }
  }
  parts.push({ text: message });
  
  const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      }
    }),
  }, 10000);

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || `Status ${response.status}`);
  }

  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!reply) throw new Error("Empty response from direct Gemini API");
  return reply;
};

const callGeminiDirectStream = async (message, res, userName = "User", userEmail = "", history = [], image = null) => {
  console.log(`🚀 [DIRECT GEMINI STREAM] Requesting gemini-2.0-flash`);
  
  // Use enhanced prompt for table requests
  const systemPrompt = ENHANCED_TABLE_SYSTEM_PROMPT(userName, message);

  // Format conversation history for Gemini
  const geminiContents = formatHistoryForGemini(history, message);

  // If image provided, override last user message parts with multimodal content
  if (image) {
    const lastMsg = geminiContents[geminiContents.length - 1];
    if (lastMsg && lastMsg.role === "user") {
      const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        lastMsg.parts = [
          { inlineData: { mimeType: matches[1], data: matches[2] } },
          { text: message }
        ];
      }
    }
  }
  
  const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: geminiContents,
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      }
    }),
  }, 10000);

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText || `Status ${response.status}`);
  }

  let buffer = "";
  let fullReply = "";

  return new Promise((resolve, reject) => {
    response.body.on("data", (chunk) => {
      buffer += chunk.toString();
      let lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;

        const dataStr = trimmed.slice(6);
        try {
          const data = JSON.parse(dataStr);
          const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (content) {
            fullReply += content;
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        } catch (e) {
          // Fragmented JSON
        }
      }
    });

    response.body.on("end", async () => {
      console.log(`✅ [DIRECT GEMINI STREAM] Finished. Reply length: ${fullReply.length}`);
      res.write("data: [DONE]\n\n");

      // Save to database if available (metadata only, no AI reply text)
      await saveChatMetadata({
        question: message,
        userName,
        userEmail,
        model: "gemini-2.0-flash-direct",
        provider: "Google Gemini"
      });

      res.end();
      resolve();
    });

    response.body.on("error", (err) => {
      console.error("❌ [DIRECT GEMINI STREAM] Body error:", err.message);
      reject(err);
    });
  });
};

// ===============================
// Nemotron caller (generic, tolerant to multiple response shapes)
// If `NEMOTRON_API_KEY` and `NEMOTRON_API_URL` are set, this will be used as a fast default provider.
// The function attempts to extract text from a variety of common response shapes.
const callNemotron = async (message, userName = "User", userEmail = "") => {
  const apiKey = process.env.NEMOTRON_API_KEY;
  const apiUrl = process.env.NEMOTRON_API_URL;
  if (!isValidKey(apiKey) || !isValidKey(apiUrl)) throw new Error("Nemotron not configured");

  // Prepare payload - many TTS/LLM endpoints accept { input } or { prompt } or chat-style messages.
  const payload = {
    prompt: message,
    system: SYSTEM_PROMPT(userName),
    max_tokens: 800,
  };

  const resp = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const contentType = (resp.headers.get("content-type") || "").toLowerCase();
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Nemotron error: ${txt}`);
  }

  if (contentType.includes("application/json")) {
    const data = await resp.json();

    // Try several common keys for returned text
    if (typeof data === "string") return data;
    if (data.output) return data.output;
    if (data.response) return data.response;
    if (data.result) return data.result;
    if (data.choices && data.choices[0]) {
      if (data.choices[0].text) return data.choices[0].text;
      if (data.choices[0].message && data.choices[0].message.content) return data.choices[0].message.content;
    }

    // Fallback: stringify
    return JSON.stringify(data);
  }

  // If response is plain text
  if (contentType.includes("text/")) {
    return await resp.text();
  }

  // If binary - return base64 as best-effort
  const buffer = await resp.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
};

const callCerebras = async (message, userName = "User", userEmail = "") => {
  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!isValidKey(apiKey)) {
    throw new Error("Cerebras not configured");
  }

  const models = ["gemma-4-31b", "zai-glm-4.7", "gpt-oss-120b"];
  let lastError = null;

  for (const model of models) {
    try {
      console.log(`🚀 [CEREBRAS] Attempting model: ${model}`);
      const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT(userName) },
            { role: "user", content: message }
          ],
          max_tokens: 1024,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const txt = await response.text();
        console.error(`❌ [CEREBRAS] ${model} failed:`, txt);
        lastError = txt;
        continue;
      }

      const data = await response.json();
      if (data.choices?.[0]?.message?.content) {
        return data.choices[0].message.content;
      }
    } catch (err) {
      console.error(`❌ [CEREBRAS] Exception with ${model}:`, err.message);
      lastError = err.message;
    }
  }

  throw new Error(`Cerebras failed all models: ${lastError}`);
};

const callCerebrasStream = async (message, res, userName = "User", userEmail = "", history = []) => {
  const models = ["gemma-4-31b", "zai-glm-4.7", "gpt-oss-120b"];
  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!isValidKey(apiKey)) {
    throw new Error("Cerebras not configured");
  }

  const apiMessages = [
    { role: "system", content: SYSTEM_PROMPT(userName) },
    ...history,
    { role: "user", content: message }
  ];

  let lastErr = "Unknown error";
  for (const model of models) {
    try {
      console.log(`🚀 [CEREBRAS STREAM] Attempting model: ${model}`);
      const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
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
        console.error(`❌ [CEREBRAS STREAM] ${model} failed:`, errText);
        lastErr = errText;
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
          console.log(`✅ [CEREBRAS STREAM] Finished with ${model}. Reply length: ${fullReply.length}`);
          await saveChatMetadata({
            question: message,
            userName,
            userEmail,
            model: model,
            provider: "Cerebras"
          });
          res.end();
          resolve(true);
        });

        response.body.on("error", (err) => {
          console.error("❌ [CEREBRAS STREAM] Body error:", err.message);
          err.streamStarted = streamStarted;
          reject(err);
        });
      });
    } catch (err) {
      console.error(`❌ [CEREBRAS STREAM] Exception with ${model}:`, err.message);
      if (err?.streamStarted) {
        throw err;
      }
      lastErr = err.message;
    }
  }

  throw new Error(`Cerebras stream failed all models: ${lastErr}`);
};

const callZAIStream = async (message, res, userName = "User", userEmail = "", history = [], image = null) => {
  // When an image is attached, only use vision-capable models.
  // Most free models do NOT support vision and will error out.
  const visionModels = [
    "openrouter/free",
    "openai/gpt-4o-mini",
    "google/gemini-2.5-flash",
    "meta-llama/llama-3.2-11b-vision-instruct:free",
    "google/gemma-3-27b-it:free",
    "mistralai/mistral-small-3.2-24b-instruct:free",
  ];
  const textModels = [
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
  const models = image ? visionModels : textModels;

  // If there's an image, construct the multimodal content format supported by vision models
  const userContent = image
    ? [
        { type: "text", text: message },
        { type: "image_url", image_url: { url: image } }
      ]
    : message;

  // Format messages for OpenRouter
  const apiMessages = [
    { role: "system", content: SYSTEM_PROMPT(userName) },
    ...history,
    { role: "user", content: userContent }
  ];

  for (const model of models) {
    try {
      console.log(`🚀 [STREAM] Attempting model: ${model}`);
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.ZAI_API_KEY}`,
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
        console.error(`❌ [STREAM] ${model} failed:`, errText);
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
      console.error(`❌ [STREAM] Exception with ${model}:`, err.message);
      if (err?.streamStarted) {
        throw err;
      }
    }
  }

  throw new Error("OpenRouter stream exhausted all models");
};



// ===============================
// 💬 CHAT API (STREAMING)
// ===============================
app.post("/api/chat", async (req, res) => {
  try {
    const { message, userName, userEmail, history, image } = req.body;
    if (!message) return res.status(400).json({ error: "Message required" });

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

    // 1. Try Cerebras first (only if no image, since Cerebras doesn't support vision)
    if (!image && isValidKey(process.env.CEREBRAS_API_KEY)) {
      const reply = await tryStreamProvider("Cerebras", async () => {
        await callCerebrasStream(message, res, userName, userEmail, history);
        return true;
      });
      if (reply) return;
    }

    // 2. Try OpenRouter / ZAI second
    if (isValidKey(process.env.ZAI_API_KEY)) {
      const reply = await tryStreamProvider("OpenRouter", async () => {
        await callZAIStream(message, res, userName, userEmail, history, image);
        return true;
      });
      if (reply) return;
    }

    // 3. Try Direct Google Gemini — supports vision natively via inlineData
    if (isValidKey(process.env.GEMINI_API_KEY)) {
      const reply = await tryStreamProvider("Direct Gemini", async () => {
        await callGeminiDirectStream(message, res, userName, userEmail, history, image);
        return true;
      });
      if (reply) return;
    }

    // 4. If Nemotron is configured (fast provider), use it for a single non-streaming reply
    if (isValidKey(process.env.NEMOTRON_API_KEY) && isValidKey(process.env.NEMOTRON_API_URL)) {
      const reply = await tryStreamProvider("Nemotron", async () => {
        const replyText = await callNemotron(message, userName, userEmail);

        // Send as a single SSE message and mark done
        res.write(`data: ${JSON.stringify({ content: replyText })}\n\n`);
        res.write("data: [DONE]\n\n");

        // Save metadata only, without AI reply text
        await saveChatMetadata({
          question: message,
          userName,
          userEmail,
          model: "nemotron",
          provider: "Nemotron"
        });

        res.end();
        return replyText;
      });
      if (reply) return;
    }

    // 5. No valid providers completed successfully
    if (!res.headersSent) {
      res.statusCode = 503;
      res.setHeader("Content-Type", "application/json");
      return res.json({ success: false, error: "No AI providers succeeded" });
    } else {
      const fallback = fallbackResponse(message);
      res.write(`data: ${JSON.stringify({ content: fallback })}\n\n`);
      res.write(`data: [DONE]\n\n`);
      res.end();
    }

  } catch (error) {
    console.error("Chat Error:", error.message);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.json({ success: false, error: error.message });
    } else if (!res.writableEnded) {
      if (error?.streamStarted) {
        res.write("data: [DONE]\n\n");
        res.end();
      } else {
        writeFallbackSSE(res, req.body?.message || "your request");
      }
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

    // 1. Prefer Cerebras if configured (only if no image, since Cerebras doesn't support vision)
    if (!image && isValidKey(process.env.CEREBRAS_API_KEY)) {
      try {
        const reply = await callCerebras(message, userName, userEmail);
        await saveChatMetadata({
          question: message,
          userName,
          userEmail,
          model: "cerebras",
          provider: "Cerebras"
        });
        return res.json({ success: true, model: 'cerebras', reply });
      } catch (err) {
        console.error('Cerebras call failed, falling back:', err.message);
      }
    }

    // 2. Prefer OpenRouter / ZAI
    if (isValidKey(process.env.ZAI_API_KEY)) {
      try {
        const reply = await callZAI(message, userName, image);
        await saveChatMetadata({
          question: message,
          userName,
          userEmail,
          model: "zai",
          provider: "OpenRouter"
        });
        return res.json({ success: true, model: 'zai', reply });
      } catch (err) {
        console.error('ZAI call failed, falling back:', err.message);
      }
    }

    // 3. Try Direct Google Gemini as last resort (commented out for now due to expired key)
    /*
    if (isValidKey(process.env.GEMINI_API_KEY)) {
      try {
        const reply = await callGeminiDirect(message, userName);
        await saveChatMetadata({
          question: message,
          userName,
          userEmail,
          model: "gemini-2.0-flash-direct",
          provider: "Google Gemini"
        });
        return res.json({ success: true, model: 'gemini-2.0-flash-direct', reply });
      } catch (err) {
        console.error('Direct Gemini call failed, falling back:', err.message);
      }
    }
    */

    // 4. Prefer Nemotron when available
    if (isValidKey(process.env.NEMOTRON_API_KEY) && isValidKey(process.env.NEMOTRON_API_URL)) {
      try {
        const reply = await callNemotron(message, userName, userEmail);
        await saveChatMetadata({
          question: message,
          userName,
          userEmail,
          model: "nemotron",
          provider: "Nemotron"
        });
        return res.json({ success: true, model: 'nemotron', reply });
      } catch (err) {
        console.error('Nemotron call failed, falling back:', err.message);
      }
    }

    const fallback = fallbackResponse(message);
    return res.json({ success: true, model: "fallback", reply: fallback });

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

    // 0. Prefer Cerebras when MODE=CEREBRAS is enabled (only if no image, since Cerebras doesn't support vision)
    if (!image && USE_CEREBRAS_MODE && isValidKey(process.env.CEREBRAS_API_KEY)) {
      try {
        const reply = await callCerebras(`Generate clean code for: ${prompt}`, userName);
        return res.json({ success: true, provider: 'cerebras', result: reply });
      } catch (err) {
        console.warn('Cerebras code generation failed, falling back:', err.message);
      }
    }

    // 1. Prefer Direct Google Gemini if configured
    if (isValidKey(process.env.GEMINI_API_KEY)) {
      try {
        const result = await callGeminiDirect(`Generate clean code for: ${prompt}`, userName, image);
        return res.json({ success: true, provider: 'gemini-direct', result });
      } catch (err) {
        console.warn('Direct Gemini code generation failed, falling back:', err.message);
      }
    }

    // 2. Prefer Cerebras if configured (and not tried yet, only if no image)
    if (!image && !USE_CEREBRAS_MODE && isValidKey(process.env.CEREBRAS_API_KEY)) {
      try {
        const reply = await callCerebras(`Generate clean code for: ${prompt}`, userName);
        return res.json({ success: true, provider: 'cerebras', result: reply });
      } catch (err) {
        console.warn('Cerebras code generation failed, falling back:', err.message);
      }
    }

    // 3. Prefer Nemotron if configured (only if no image, since Nemotron doesn't support vision)
    if (!image && isValidKey(process.env.NEMOTRON_API_KEY) && isValidKey(process.env.NEMOTRON_API_URL)) {
      try {
        const reply = await callNemotron(`Generate clean code for: ${prompt}`, userName);
        return res.json({ success: true, provider: 'nemotron', result: reply });
      } catch (err) {
        console.warn('Nemotron code generation failed, falling back:', err.message);
      }
    }

    // 4. Fallback to ZAI
    if (isValidKey(process.env.ZAI_API_KEY)) {
      const result = await callZAI(`Generate clean code for: ${prompt}`, userName, image);
      return res.json({ success: true, provider: 'zai', result });
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

    // 0. Prefer Cerebras when MODE=CEREBRAS is enabled (only if no image, Cerebras doesn't support vision)
    if (!image && USE_CEREBRAS_MODE && isValidKey(process.env.CEREBRAS_API_KEY)) {
      try {
        const reply = await callCerebras(`Write detailed content about: ${prompt}`, userName);
        return res.json({ success: true, provider: 'cerebras', result: reply });
      } catch (err) {
        console.warn('Cerebras content generation failed, falling back:', err.message);
      }
    }

    // 1. Prefer Direct Google Gemini if configured
    if (isValidKey(process.env.GEMINI_API_KEY)) {
      try {
        const result = await callGeminiDirect(`Write detailed content about: ${prompt}`, userName, image);
        return res.json({ success: true, provider: 'gemini-direct', result });
      } catch (err) {
        console.warn('Direct Gemini content generation failed, falling back:', err.message);
      }
    }

    // 2. Prefer Cerebras if configured (and not tried yet, only if no image)
    if (!image && !USE_CEREBRAS_MODE && isValidKey(process.env.CEREBRAS_API_KEY)) {
      try {
        const reply = await callCerebras(`Write detailed content about: ${prompt}`, userName);
        return res.json({ success: true, provider: 'cerebras', result: reply });
      } catch (err) {
        console.warn('Cerebras content generation failed, falling back:', err.message);
      }
    }

    // 3. Prefer Nemotron if configured (only if no image, Nemotron doesn't support vision)
    if (!image && isValidKey(process.env.NEMOTRON_API_KEY) && isValidKey(process.env.NEMOTRON_API_URL)) {
      try {
        const reply = await callNemotron(`Write detailed content about: ${prompt}`, userName);
        return res.json({ success: true, provider: 'nemotron', result: reply });
      } catch (err) {
        console.warn('Nemotron content generation failed, falling back:', err.message);
      }
    }

    // 4. Fallback to ZAI
    if (isValidKey(process.env.ZAI_API_KEY)) {
      const result = await callZAI(`Write detailed content about: ${prompt}`, userName, image);
      return res.json({ success: true, provider: 'zai', result });
    }

    return res.status(503).json({ success: false, error: "No API Key configured." });

  } catch (error) {
    console.error("Content Error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});


// ===============================
// 🧬 EMBEDDING API
// Generates text embeddings via Google Gemini text-embedding-004
// Body: { text: string } — returns { embedding: number[] }
// ===============================
app.post("/api/embed", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "text field required" });

    // 1. Prefer Google Gemini embedding model (free & fast)
    if (isValidKey(process.env.GEMINI_API_KEY)) {
      try {
        const response = await fetchWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: { parts: [{ text }] } }),
          },
          10000
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || `Status ${response.status}`);
        const embedding = data.embedding?.values;
        if (!embedding) throw new Error("Empty embedding from Gemini");
        return res.json({ success: true, provider: "gemini", embedding });
      } catch (err) {
        console.warn("Gemini embedding failed, falling back:", err.message);
      }
    }

    // 2. Fallback: OpenRouter embeddings via EMBEDDING_API_KEY
    const embeddingKey = process.env.EMBEDDING_API_KEY || process.env.ZAI_API_KEY;
    if (isValidKey(embeddingKey)) {
      try {
        const response = await fetchWithTimeout("https://openrouter.ai/api/v1/embeddings", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${embeddingKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://nexuss-ai.io",
            "X-Title": "Nexuss Workspace",
          },
          body: JSON.stringify({
            model: "openai/text-embedding-ada-002",
            input: text,
          }),
        }, 10000);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || `Status ${response.status}`);
        const embedding = data.data?.[0]?.embedding;
        if (!embedding) throw new Error("Empty embedding from OpenRouter");
        return res.json({ success: true, provider: "openrouter", embedding });
      } catch (err) {
        console.error("OpenRouter embedding failed:", err.message);
      }
    }

    return res.status(503).json({ success: false, error: "No embedding provider configured." });

  } catch (error) {
    console.error("Embed Error:", error.message);
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

// Save Nemotron API key + optional URL
app.post("/api/tts/config", (req, res) => {
  try {
    const { apiKey, apiUrl } = req.body || {};
    if (!apiKey) return res.status(400).json({ success: false, error: "apiKey is required" });

    const ok1 = upsertEnvVar("NEMOTRON_API_KEY", apiKey);
    let ok2 = true;
    if (apiUrl) ok2 = upsertEnvVar("NEMOTRON_API_URL", apiUrl);

    if (!ok1 || !ok2) return res.status(500).json({ success: false, error: "Failed to persist config" });

    return res.json({ success: true, message: "Nemotron config saved" });
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

    const apiKey = req.body.apiKey || process.env.NEMOTRON_API_KEY;
    const apiUrl = req.body.apiUrl || process.env.NEMOTRON_API_URL;

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


