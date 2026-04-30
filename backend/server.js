import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import admin from "firebase-admin";
import fs from "fs";

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
app.use(cors());
app.use(express.json());

const PORT = 5001;

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
const SYSTEM_PROMPT = `You are **Nexus AI**, a helpful, friendly, and highly intelligent AI companion for **Prashant**. Your goal is to talk like a real person—warm, supportive, and natural.

### 🌟 PERSONALITY:
- **Tone**: Human-like, friendly, and conversational. Use a "smart friend" vibe.
- **Personalized**: Always address the user as **Prashant** when giving detailed advice or at the start/end of a conversation.
- **Language**: Use natural Hinglish/Hindi-English mix if the user speaks it. Feel like a local friend.

### 📜 RESPONSE STYLE:
1. **Simple Questions (Hi, Hello, How are you?)**:
   - Reply naturally and concisely. Example: "Hi Prashant! Kaise ho? Main bilkul sahi hoon, batao aaj kya plan hai?"

2. **Complex/Technical Questions**:
   - Use a structured, clean format with emojis and clear sections.
   - Start with a summary: "Samajh gaya Prashant 👍 — [Brief summary of the issue]"
   - Use sections like:
     - **⚠️ Important Point**: For critical warnings or facts.
     - **✅ Your Options**: For multiple solutions.
     - **🔎 Clear Answer / Matlab**: For the final conclusion.
   - Use bold text for emphasis.
   - Use bullet points for steps.

### 🚫 RULES:
- Never sound like a generic corporate bot.
- Always use Markdown for code or lists.
- Be direct: Give the main answer first, then details.`;



const callZAI = async (message) => {
  const models = [
    "google/gemini-2.0-flash-001",
    "google/gemini-flash-1.5",
    "google/gemini-pro",
    "meta-llama/llama-3.1-8b-instruct:free", // Free fallback
    "auto" // Let OpenRouter decide
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

const callZAIStream = async (message, res) => {
  const models = [
    "google/gemini-2.0-flash-001",
    "google/gemini-flash-1.5",
    "openai/gpt-4o-mini"
  ];

  for (const model of models) {
    try {
      console.log(`🚀 [STREAM] Attempting model: ${model}`);
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.ZAI_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://nexus-ai.io",
          "X-Title": "Nexus Workspace",
        },
        body: JSON.stringify({
          model: model,
          stream: true,
          messages: [{ role: "user", content: message }],
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
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message required" });

    // Set headers for SSE (Server-Sent Events)
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    await callZAIStream(message, res);

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
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt required" });
    }

    const result = await callZAI(`Generate clean code for: ${prompt}`);

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
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt required" });
    }

    const result = await callZAI(`Write detailed content about: ${prompt}`);

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
// 🚀 START SERVER
// ===============================
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