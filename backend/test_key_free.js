import dotenv from "dotenv";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

async function testOpenRouter(keyName, key, model) {
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
        messages: [{ role: "user", content: "Hello, reply with 'test success'" }]
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));
    console.log(`✅ OpenRouter (${keyName}) Success:`, data.choices?.[0]?.message?.content);
  } catch (err) {
    console.error(`❌ OpenRouter (${keyName}) Failed:`, err.message);
  }
}

async function run() {
  await testOpenRouter("ZAI_API_KEY", process.env.ZAI_API_KEY, "meta-llama/llama-3.3-70b-instruct:free");
  await testOpenRouter("NEMOTRON_API_KEY", process.env.NEMOTRON_API_KEY, "meta-llama/llama-3.3-70b-instruct:free");
}
run();
