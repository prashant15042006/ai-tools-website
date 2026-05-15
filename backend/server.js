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
// ⚡ CODE GENERATOR
// ===============================
app.post("/api/code", async (req, res) => {
  try {
    const { prompt, userName } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt required" });
    }

    const result = await callZAI(`Generate clean code for: ${prompt}`, userName);

    res.json({ success: true, result });

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

    const result = await callZAI(`Write detailed content about: ${prompt}`, userName);

    res.json({ success: true, result });

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

// ===============================
// 🖼️ IMAGE GENERATION
// POST /api/generate-image
// Body: { prompt: string, size?: string }
// Uses OpenAI Images API when OPENAI_API_KEY is present. Returns { success: true, data: { b64_json } }
// NOTE: This endpoint expects a valid OPENAI_API_KEY in environment variables.
app.post("/api/generate-image", async (req, res) => {
  try {
    const { prompt, size = "1024x1024" } = req.body || {};
    if (!prompt) return res.status(400).json({ success: false, error: "Prompt required" });

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ success: false, error: "Image API key not configured on server." });
    }

    // Call OpenAI Images (DALL·E) endpoint and request base64 JSON
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        prompt,
        n: 1,
        size,
        response_format: "b64_json",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Image API error:", data);
      return res.status(502).json({ success: false, error: data.error || data });
    }

    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) return res.status(500).json({ success: false, error: "No image returned from provider" });

    res.json({ success: true, data: { b64_json: b64 } });
  } catch (err) {
    console.error("Generate Image Error:", err.message || err);
    res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

// ===============================
// 🚀 START SERVER
// ===============================
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

