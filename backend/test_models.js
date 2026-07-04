import dotenv from "dotenv";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

async function listFreeOpenRouterModels() {
  const key = process.env.ZAI_API_KEY;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization: `Bearer ${key}`
      }
    });
    const data = await res.json();
    const freeModels = data.data?.filter(m => m.id.endsWith(":free")).map(m => m.id);
    console.log("Free OpenRouter models:", freeModels);
  } catch (err) {
    console.error("OpenRouter models error:", err.message);
  }
}

listFreeOpenRouterModels();
