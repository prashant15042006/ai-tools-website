import dotenv from "dotenv";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

async function testGemini() {
  const key = process.env.GEMINI_API_KEY;
  console.log(`\n--- Testing Gemini Direct with key: ...${key?.slice(-5)} ---`);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "Hello" }] }]
        })
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));
    console.log("✅ Gemini Direct Success:", data.candidates?.[0]?.content?.parts?.[0]?.text);
  } catch (err) {
    console.error("❌ Gemini Direct Failed:", err.message);
  }
}

async function testOpenRouter(keyName, key, model = "google/gemini-2.0-flash-lite-preview-02-05:free") {
  console.log(`\n--- Testing OpenRouter (${keyName}) with key: ...${key?.slice(-5)} using model ${model} ---`);
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: "Hello" }]
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));
    console.log(`✅ OpenRouter (${keyName}) Success:`, data.choices?.[0]?.message?.content);
  } catch (err) {
    console.error(`❌ OpenRouter (${keyName}) Failed:`, err.message);
  }
}

async function testCerebras() {
  const key = process.env.CEREBRAS_API_KEY;
  console.log(`\n--- Testing Cerebras with key: ...${key?.slice(-5)} ---`);
  try {
    const res = await fetch("https://api.cerebras.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3.1-8b",
        messages: [{ role: "user", content: "Hello" }]
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));
    console.log("✅ Cerebras Success:", data.choices?.[0]?.message?.content);
  } catch (err) {
    console.error("❌ Cerebras Failed:", err.message);
  }
}

async function runAll() {
  await testGemini();
  await testOpenRouter("ZAI_API_KEY", process.env.ZAI_API_KEY);
  await testOpenRouter("NEMOTRON_API_KEY", process.env.NEMOTRON_API_KEY);
  await testCerebras();
}

runAll();
