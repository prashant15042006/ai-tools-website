// ================================================================
// Vercel Serverless Function: /api/image-analyze
// Analyzes uploaded images using OpenRouter vision models,
// generates recreation prompts (Image-to-Prompt) and edit prompts
// ================================================================

const isValidKey = (val) =>
  val &&
  val.trim() !== "" &&
  !val.startsWith("REPLACE_WITH_") &&
  !val.includes("example.com") &&
  !val.includes("example");

const getOpenRouterKeyPool = () => {
  const keys = [];
  if (isValidKey(process.env.OPENROUTER_KEY_NEMOTRON))
    keys.push({ name: "NEMOTRON", key: process.env.OPENROUTER_KEY_NEMOTRON });
  if (isValidKey(process.env.OPENROUTER_KEY_GEMMA))
    keys.push({ name: "GEMMA", key: process.env.OPENROUTER_KEY_GEMMA });
  if (isValidKey(process.env.OPENROUTER_KEY_EMBED))
    keys.push({ name: "EMBED", key: process.env.OPENROUTER_KEY_EMBED });
  if (isValidKey(process.env.OPENROUTER_API_KEY))
    keys.push({ name: "OPENROUTER", key: process.env.OPENROUTER_API_KEY });
  return keys;
};

const OPENROUTER_VISION_MODELS = [
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "openrouter/free",
  "inclusionai/ling-3.0-flash-vl:free",
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
];

async function describeImage(image, userPrompt = "Analyze this image in detail.") {
  const keyPool = getOpenRouterKeyPool();
  if (keyPool.length === 0) throw new Error("No OpenRouter keys configured");

  let lastError = null;
  for (const { key } of keyPool) {
    for (const model of OPENROUTER_VISION_MODELS) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 25000);
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://nexuss-ai.io",
            "X-Title": "Nexuss Workspace",
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "system",
                content: "You are an expert vision assistant. Analyze this image comprehensively. Describe the main subject, artistic medium/style (e.g. photorealistic, digital art, anime, oil painting, 3D render), lighting, colors, background details, mood, and camera composition."
              },
              {
                role: "user",
                content: [
                  { type: "text", text: userPrompt || "Describe this image in detail." },
                  { type: "image_url", image_url: { url: image } }
                ]
              }
            ],
            max_tokens: 2048,
          }),
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!res.ok) {
          const errText = await res.text();
          lastError = errText;
          continue;
        }
        const data = await res.json();
        const desc = data.choices?.[0]?.message?.content || data.choices?.[0]?.text;
        if (desc && desc.trim()) return desc.trim();
      } catch (e) {
        lastError = e.message;
      }
    }
  }
  throw new Error(`Vision models failed: ${lastError || "Unknown error"}`);
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { image, mode = "analyze", userPrompt = "" } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, error: "image is required" });
    }

    const description = await describeImage(image, userPrompt);
    const suggestedPrompt = description.slice(0, 200).replace(/\n+/g, " ") + ", photorealistic, 8k resolution, cinematic lighting, sharp focus";
    let editedPrompt = null;
    if (userPrompt && userPrompt.trim()) {
      editedPrompt = `${userPrompt.trim()}, styled like ${description.slice(0, 120).replace(/\n+/g, " ")}, highly detailed, 8k resolution, masterpiece`;
    }

    return res.status(200).json({
      success: true,
      description,
      suggestedPrompt,
      editedPrompt,
    });
  } catch (error) {
    console.error("Image analyze error:", error.message);
    return res.status(500).json({ success: false, error: error.message || "Failed to analyze image" });
  }
};
