import dotenv from "dotenv";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

async function testCerebrasDefault() {
  const apiKey = process.env.CEREBRAS_API_KEY;
  const apiUrl = process.env.CEREBRAS_API_URL || "https://api.cerebras.net/v1/generate";
  const model = process.env.CEREBRAS_MODEL || "cerebras-gpt";

  console.log(`Cerebras test: url=${apiUrl}, model=${model}`);
  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt: `Hello`,
        max_tokens: 1024,
      }),
    });
    console.log("Cerebras response ok:", response.ok, "status:", response.status);
    const txt = await response.text();
    console.log("Response text:", txt.slice(0, 200));
  } catch (err) {
    console.error("Cerebras error:", err.message);
  }
}

testCerebrasDefault();
