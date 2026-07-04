import dotenv from "dotenv";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

async function testOpenRouterPaid(model) {
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
  await testOpenRouterPaid("google/gemini-2.0-flash-001");
  await testOpenRouterPaid("openai/gpt-4o-mini");
}
run();
