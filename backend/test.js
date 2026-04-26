import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const ZAI_API_KEY = process.env.ZAI_API_KEY;

async function testChat() {
  const response = await fetch("https://api.z-ai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${ZAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "glm-4.5-air",   // 👈 Z.ai model
      messages: [{ role: "user", content: "Hello AI" }],
      max_tokens: 50,
    }),
  });

  const data = await response.json();
  console.log(data.choices[0].message.content);
}

testChat();
