import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import admin from "firebase-admin";
import fs from "fs";

dotenv.config();

console.log("ZAI API KEY:", process.env.ZAI_API_KEY);

// ===============================
// 🚀 EXPRESS INIT
// ===============================
const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5000;

// ===============================
// 🔐 FIREBASE INIT
// ===============================
const serviceAccount = JSON.parse(
  fs.readFileSync("./serviceAccountKey.json", "utf-8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

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
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.ZAI_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "AI Workspace",
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-001",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: message }
      ],
      max_tokens: 2000,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "ZAI API Error");
  }

  return data.choices?.[0]?.message?.content || "No response";
};

// ===============================
// 💬 CHAT API
// ===============================
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message required" });
    }

    const reply = await callZAI(message);

    try {
      await db.collection("chats").add({
        message,
        reply,
        createdAt: new Date(),
      });
    } catch (dbError) {
      console.warn("Could not save to Firebase:", dbError.message);
    }

    res.json({ success: true, reply });

  } catch (error) {
    console.error("Chat Error:", error.message);
    res.status(500).json({ success: false, error: error.message });
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
app.listen(PORT, () => {
  console.log(`🔥 Server running on http://localhost:${PORT}`);
});