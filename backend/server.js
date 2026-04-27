import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import admin from "firebase-admin";
import fs from "fs";

dotenv.config();

// dotenv.config() is handled above


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
  // We'll try the primary model first, then a fallback if it fails
  const models = ["google/gemini-2.0-flash-001", "google/gemini-flash-1.5"];
  let lastError = null;

  for (const model of models) {
    try {
      console.log(`🚀 Attempting AI call with model: ${model}`);
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.ZAI_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3000", // Standard for local development
          "X-Title": "Nexus AI Workspace",
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: message }
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error(`❌ ${model} failed:`, data.error?.message || response.status);
        lastError = data.error?.message || `API Error: ${response.status}`;
        continue; // Try next model
      }

      if (!data.choices || data.choices.length === 0) {
        console.error(`❌ ${model} returned no choices`);
        lastError = "No response choices returned from AI provider.";
        continue;
      }

      return data.choices[0].message.content;
    } catch (err) {
      console.error(`❌ Exception with ${model}:`, err.message);
      lastError = err.message;
    }
  }

  throw new Error(lastError || "All AI models failed to respond. Please check your OpenRouter credits.");
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

    if (db) {
      try {
        await db.collection("chats").add({
          message,
          reply,
          createdAt: new Date(),
        });
      } catch (dbError) {
        console.warn("Could not save to Firebase:", dbError.message);
      }
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
app.listen(PORT, () => {
  console.log(`🔥 Server running on http://localhost:${PORT}`);
});