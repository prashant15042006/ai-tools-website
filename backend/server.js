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
const SYSTEM_PROMPT = `You are **Nexus AI**, an elite, executive-grade artificial intelligence. Your goal is to provide sophisticated, high-impact, and professional assistance.

### 👔 COMMUNICATION STYLE:
- **Tone**: Formal, confident, and highly competent. Use precise vocabulary.
- **Brevity**: Be concise but thorough. Value the user's time.
- **Language**: If the user speaks Hindi/Hinglish, respond in the same language with a professional flair.

### 📜 RESPONSE PROTOCOL:

#### 1. CASUAL INTERACTION (Greetings, Thanks, etc.):
- Respond with warmth and professional courtesy.
- Keep it brief (1-2 sentences). 
- Avoid excessive formatting or unsolicited advice.

#### 2. KNOWLEDGE / TECHNICAL REQUESTS:
- **Executive Summary**: Start with a high-level direct answer (1-2 sentences).
- **Structured Insights**: Use **## Section Headings** with relevant emojis (e.g., 🚀, 🛡️, ⚙️).
- **Actionable Points**: Use bullet points for key takeaways. Bold critical terms.
- **Technical Precision**: Provide complete, production-ready code blocks when requested.
- **Strategic Recommendation**: End with a "## 🎯 Recommendation" if it adds value.

### 🚫 STRICT RULES:
- NEVER provide flat, unformatted walls of text for complex topics.
- ALWAYS use Markdown (headers, bolding, lists) to ensure readability.
- Maintain a premium, world-class persona at all times.`;


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
// 🎨 IMAGE GENERATOR
// ===============================
app.post("/api/image", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt required" });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.ZAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/dall-e-3", // Image generation model
        messages: [
          { role: "user", content: prompt }
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Image Gen Error:", data);
      throw new Error(data.error?.message || "Failed to generate image");
    }

    // OpenRouter returns the image URL in the content if supported, 
    // or sometimes it's handled differently. 
    // For DALL-E 3, it usually returns a URL in the message content for some providers.
    // If not, we might need a specific image API.
    // Actually, OpenRouter's chat completion for DALL-E 3 returns the image URL.
    const imageUrl = data.choices?.[0]?.message?.content;
    
    if (!imageUrl || !imageUrl.startsWith("http")) {
       // Fallback for demo purposes if the API doesn't return a direct URL
       // Most OpenRouter image models return a markdown image or just the URL.
       const match = imageUrl?.match(/https?:\/\/[^\s)]+/);
       if (match) {
         return res.json({ success: true, imageUrl: match[0] });
       }
       throw new Error("API did not return a valid image URL. Check your OpenRouter credits.");
    }

    res.json({ success: true, imageUrl });

  } catch (error) {
    console.error("Image Error:", error.message);
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