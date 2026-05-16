import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import admin from "firebase-admin";
import fs from "fs";
import killPort from "kill-port";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to load .env from the current directory (backend/)
dotenv.config({ path: path.join(__dirname, ".env") });

// Fallback to root .env if not found
dotenv.config();

if (!process.env.ZAI_API_KEY) {
  console.error("❌ CRITICAL: ZAI_API_KEY is not defined in .env file!");
} else {
  console.log("✅ API Key detected (ends with ...", process.env.ZAI_API_KEY.slice(-5), ")");
}


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

app.use(express.json());

// Use Render's PORT or default to 5001
const PORT = process.env.PORT || 5001;

// ===============================
// 🔐 FIREBASE INIT
// ===============================
let db;
try {
  const serviceAccount = JSON.parse(
    fs.readFileSync("./serviceAccountKey.json", "utf-8")
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  db = admin.firestore();
  console.log("✅ Firebase initialized successfully");
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
- **Style**: Keep responses concise and friendly unless technical details are needed. Address ${userName} personally.`;



const callZAI = async (message, userName = "User") => {
  const models = [
    "google/gemini-2.0-flash-001",
    "google/gemini-2.0-flash-lite-preview-02-05:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemini-flash-1.5",
    "openai/gpt-4o-mini",
    "auto"
  ];
  let lastError = null;

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
            { role: "user", content: message }
          ],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        let errorMsg = data.error?.message || `Status ${response.status}`;
        console.error(`❌ ${model} failed:`, errorMsg);
        
        if (errorMsg.toLowerCase().includes("balance") || errorMsg.toLowerCase().includes("credit")) {
           throw new Error("INSUFFICIENT_BALANCE: Your OpenRouter account is empty. Please add credits.");
        }
        
        lastError = errorMsg;
        continue;
      }

      if (data.choices?.[0]?.message?.content) {
        return data.choices[0].message.content;
      }
      
      continue;
    } catch (err) {
      if (err.message.startsWith("INSUFFICIENT_BALANCE")) throw err;
      lastError = err.message;
    }
  }

  throw new Error(lastError || "All models failed. Please verify your API key and credits at openrouter.ai");
};

// ===============================
// Nemotron caller (generic, tolerant to multiple response shapes)
// If `NEMOTRON_API_KEY` and `NEMOTRON_API_URL` are set, this will be used as a fast default provider.
// The function attempts to extract text from a variety of common response shapes.
const callNemotron = async (message, userName = "User") => {
  const apiKey = process.env.NEMOTRON_API_KEY;
  const apiUrl = process.env.NEMOTRON_API_URL;
  if (!apiKey || !apiUrl) throw new Error("Nemotron not configured");

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

const callZAIStream = async (message, res, userName = "User", history = []) => {
  const models = [
    "google/gemini-2.0-flash-001",
    "google/gemini-2.0-flash-lite-preview-02-05:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemini-flash-1.5",
    "openai/gpt-4o-mini"
  ];

  // Format messages for OpenRouter
  const apiMessages = [
    { role: "system", content: SYSTEM_PROMPT(userName) },
    ...history,
    { role: "user", content: message }
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
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`❌ [STREAM] ${model} failed:`, errText);
        continue;
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
            if (dataStr === "[DONE]") {
              res.write("data: [DONE]\n\n");
              continue;
            }
            
            try {
              const data = JSON.parse(dataStr);
              const content = data.choices?.[0]?.delta?.content || "";
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
          console.log(`✅ [STREAM] Finished with ${model}. Reply length: ${fullReply.length}`);
          
          // Save to database if available
          if (db && fullReply) {
            try {
              await db.collection("chats").add({
                message,
                reply: fullReply,
                createdAt: new Date(),
                model: model
              });
            } catch (dbErr) {
              console.warn("DB Save error:", dbErr.message);
            }
          }
          
          res.end();
          resolve();
        });

        response.body.on("error", (err) => {
          console.error("❌ [STREAM] Body error:", err.message);
          reject(err);
        });
      });

    } catch (err) {
      console.error(`❌ [STREAM] Exception with ${model}:`, err.message);
    }
  }
  
  if (!res.writableEnded) {
    res.write(`data: ${JSON.stringify({ error: "All AI models failed to respond. Please check your connection and OpenRouter balance." })}\n\n`);
    res.end();
  }
};



// ===============================
// 💬 CHAT API (STREAMING)
// ===============================
app.post("/api/chat", async (req, res) => {
  try {
    const { message, userName, history } = req.body;
    if (!message) return res.status(400).json({ error: "Message required" });

    // Set headers for SSE (Server-Sent Events)
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // If Nemotron is configured (fast provider), use it for a single non-streaming reply
    if (process.env.NEMOTRON_API_KEY && process.env.NEMOTRON_API_URL) {
      try {
        const reply = await callNemotron(message, userName);

        // Send as a single SSE message and mark done
        res.write(`data: ${JSON.stringify({ content: reply })}\n\n`);
        res.write("data: [DONE]\n\n");

        // Save to DB if available
        if (db && reply) {
          try {
            await db.collection("chats").add({ message, reply, createdAt: new Date(), model: "nemotron" });
          } catch (dbErr) {
            console.warn("DB Save error:", dbErr.message);
          }
        }

        res.end();
        return;
      } catch (err) {
        console.error('Nemotron streaming fallback failed, continuing to OpenRouter stream:', err.message || err);
        // fallthrough to streaming fallback
      }
    }

    // Default: stream from OpenRouter / ZAI
    await callZAIStream(message, res, userName, history);

  } catch (error) {
    console.error("Chat Error:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
});


// ===============================
// 💬 CHAT API (COMPLETE - non-streaming)
// Uses Nemotron by default if configured (fast replies). Falls back to OpenRouter/ZAI.
// Body: { message, userName, history }
app.post("/api/chat/complete", async (req, res) => {
  try {
    const { message, userName, history } = req.body;
    if (!message) return res.status(400).json({ error: "Message required" });

    // Prefer Nemotron when available
    if (process.env.NEMOTRON_API_KEY && process.env.NEMOTRON_API_URL) {
      try {
        const reply = await callNemotron(message, userName);
        // Save to DB if available
        if (db && reply) {
          try {
            await db.collection("chats").add({ message, reply, createdAt: new Date(), model: "nemotron" });
          } catch (e) { console.warn('DB save failed:', e.message); }
        }
        return res.json({ success: true, model: 'nemotron', reply });
      } catch (err) {
        console.error('Nemotron call failed, falling back:', err.message);
      }
    }

    // Fallback to existing ZAI (non-streaming)
    const reply = await callZAI(message, userName);
    return res.json({ success: true, model: 'zai', reply });

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
    const { prompt, userName } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt required" });
    }

    // Prefer Nemotron if configured
    if (process.env.NEMOTRON_API_KEY && process.env.NEMOTRON_API_URL) {
      try {
        const reply = await callNemotron(`Generate clean code for: ${prompt}`, userName);
        return res.json({ success: true, provider: 'nemotron', result: reply });
      } catch (err) {
        console.warn('Nemotron code generation failed, falling back:', err.message);
      }
    }

    const result = await callZAI(`Generate clean code for: ${prompt}`, userName);
    res.json({ success: true, provider: 'zai', result });

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
    const { prompt, userName } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt required" });
    }

    // Prefer Nemotron if configured
    if (process.env.NEMOTRON_API_KEY && process.env.NEMOTRON_API_URL) {
      try {
        const reply = await callNemotron(`Write detailed content about: ${prompt}`, userName);
        return res.json({ success: true, provider: 'nemotron', result: reply });
      } catch (err) {
        console.warn('Nemotron content generation failed, falling back:', err.message);
      }
    }

    const result = await callZAI(`Write detailed content about: ${prompt}`, userName);
    res.json({ success: true, provider: 'zai', result });

  } catch (error) {
    console.error("Content Error:", error.message);
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

