import dotenv from "dotenv";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

async function testOpenRouter(model) {
  const key = process.env.ZAI_API_KEY;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: "Hi" }]
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));
    console.log(`✅ Success (${model}):`, data.choices?.[0]?.message?.content?.slice(0, 50));
    return true;
  } catch (err) {
    console.error(`❌ Failed (${model}):`, err.message);
    return false;
  }
}

async function run() {
  const models = [
    "meta-llama/llama-3.2-3b-instruct:free",
    "google/gemma-4-31b-it:free",
    "qwen/qwen3-coder:free",
    "liquid/lfm-2.5-1.2b-instruct:free",
    "poolside/laguna-xs-2.1:free",
    "cohere/north-mini-code:free",
    "openai/gpt-oss-120b:free",
    "cognitivecomputations/dolphin-mistral-24b-venice-edition:free"
  ];
  for (const m of models) {
    await testOpenRouter(m);
    await new Promise(r => setTimeout(r, 1000));
  }
}
run();
