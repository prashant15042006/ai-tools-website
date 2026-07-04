import dotenv from "dotenv";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

async function testCerebrasStream() {
  const apiKey = process.env.CEREBRAS_API_KEY;
  try {
    const res = await fetch("https://api.cerebras.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemma-4-31b",
        messages: [{ role: "user", content: "Hi" }],
        stream: true
      }),
    });
    console.log("Cerebras stream status:", res.status);
    if (!res.ok) {
      console.log(await res.text());
      return;
    }
    let buffer = "";
    res.body.on("data", chunk => {
      buffer += chunk.toString();
    });
    res.body.on("end", () => {
      console.log("Stream data received:", buffer.slice(0, 500));
    });
  } catch (err) {
    console.error("Cerebras stream error:", err.message);
  }
}
testCerebrasStream();
