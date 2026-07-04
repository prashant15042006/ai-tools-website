import dotenv from "dotenv";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

async function testCerebras(model) {
  const key = process.env.CEREBRAS_API_KEY;
  console.log(`\n--- Testing Cerebras with model ${model} ---`);
  try {
    const res = await fetch("https://api.cerebras.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: "Hello, respond with 'Cerebras success'" }]
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));
    console.log(`✅ Cerebras (${model}) Success:`, data.choices?.[0]?.message?.content);
  } catch (err) {
    console.error(`❌ Cerebras (${model}) Failed:`, err.message);
  }
}

async function run() {
  await testCerebras("gemma-4-31b");
  await testCerebras("zai-glm-4.7");
  await testCerebras("gpt-oss-120b");
}
run();
