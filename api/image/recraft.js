// ================================================================
// Vercel Serverless Function: POST /api/image/recraft
// Recraft Image Generation via OpenRouter — recraft/recraft-v4.1-flash-v2:free
// Body: { prompt: string, width?: number, height?: number }
// Returns: { success: true, imageUrl, b64, dataUrl, prompt, model }
// ================================================================

const isValidKey = (val) =>
  val &&
  val.trim() !== "" &&
  !val.startsWith("REPLACE_WITH_") &&
  !val.includes("example.com") &&
  !val.includes("example");

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ success: false, error: "Method not allowed" });

  try {
    const { prompt, width = 1024, height = 1024, n = 1 } = req.body || {};

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ success: false, error: "prompt is required" });
    }

    const apiKey = process.env.OPENROUTER_KEY_RECRAFT;
    if (!isValidKey(apiKey)) {
      return res.status(503).json({
        success: false,
        error: "Recraft API key not configured. Set OPENROUTER_KEY_RECRAFT in Vercel environment variables.",
      });
    }

    console.log(`[Recraft] Generating: "${prompt.slice(0, 60)}..." (${width}x${height})`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);

    const payload = {
      model: "recraft/recraft-v4.1-flash-v2:free",
      prompt: prompt.trim(),
      n,
      size: `${width}x${height}`,
      response_format: "url",
    };

    const response = await fetch("https://openrouter.ai/api/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://nexuss-ai.vercel.app",
        "X-Title": "Nexuss AI Image Studio",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      const errText = await response.text();
      console.error("[Recraft] OpenRouter error:", response.status, errText);
      return res.status(502).json({
        success: false,
        error: `Recraft generation failed (${response.status}): ${errText}`,
      });
    }

    const data = await response.json();
    const images = data?.data || [];
    if (!images.length) {
      return res.status(502).json({
        success: false,
        error: "Recraft returned no images",
        raw: data,
      });
    }

    const firstImage = images[0];
    const imageUrl = firstImage?.url || null;
    const b64 = firstImage?.b64_json || null;

    return res.status(200).json({
      success: true,
      imageUrl,
      b64,
      dataUrl: b64 ? `data:image/png;base64,${b64}` : null,
      prompt: prompt.trim(),
      model: "recraft/recraft-v4.1-flash-v2:free",
      width,
      height,
    });

  } catch (err) {
    if (err.name === "AbortError") {
      return res.status(504).json({ success: false, error: "Recraft request timed out (60s)" });
    }
    console.error("[Recraft] Error:", err.message);
    return res.status(500).json({ success: false, error: err.message || "Internal server error" });
  }
};
