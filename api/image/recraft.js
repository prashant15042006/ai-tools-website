// ================================================================
// Vercel Serverless Function: POST /api/image/recraft & /api/image/generate
// Multi-Tier Beast Engine:
// Tier 1: Recraft V4.1 Flash (via OpenRouter Free)
// Tier 2: Pollinations FLUX Smart Router (flux-realism / flux-anime / flux-3d with enhance=false)
// Tier 3: Direct CDN fallback
// ================================================================

const isValidKey = (val) =>
  val &&
  val.trim() !== "" &&
  !val.startsWith("REPLACE_WITH_") &&
  !val.includes("example.com") &&
  !val.includes("example");

function selectFluxModel(promptText = "") {
  const p = promptText.toLowerCase();
  if (/\b(anime|manga|chibi|ghibli|waifu|shinkai|kawaii|comic|illustration)\b/.test(p)) {
    return "flux-anime";
  }
  if (/\b(3d|render|blender|octane|cgi|unreal|pixar|sculpture|isometric)\b/.test(p)) {
    return "flux-3d";
  }
  if (/\b(photo|portrait|realistic|realism|hyperrealistic|dslr|cinematic|camera|face|person|man|woman|nature|landscape)\b/.test(p)) {
    return "flux-realism";
  }
  return "flux";
}

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ success: false, error: "Method not allowed" });

  try {
    const { prompt, width = 1024, height = 1024, genre, n = 1 } = req.body || {};

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ success: false, error: "prompt is required" });
    }

    const cleanPrompt = prompt.trim();
    const apiKey = process.env.OPENROUTER_KEY_RECRAFT;

    // ── Tier 1: OpenRouter Recraft V4.1 Flash ──
    if (isValidKey(apiKey)) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 45000);

        const payload = {
          model: "recraft/recraft-v4.1-flash-v2:free",
          prompt: cleanPrompt,
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

        if (response.ok) {
          const data = await response.json();
          const images = data?.data || [];
          if (images.length > 0) {
            const firstImage = images[0];
            const imageUrl = firstImage?.url || null;
            const b64 = firstImage?.b64_json || null;

            return res.status(200).json({
              success: true,
              engine: "Recraft V4.1 Flash",
              model: "recraft/recraft-v4.1-flash-v2:free",
              imageUrl,
              b64,
              dataUrl: b64 ? `data:image/webp;base64,${b64}` : imageUrl,
              prompt: cleanPrompt,
              width,
              height,
            });
          }
        }
      } catch (tier1Err) {
        console.warn("[Vercel ImageGen Tier 1] Recraft failed, cascading to Tier 2:", tier1Err.message);
      }
    }

    // ── Tier 2: Pollinations FLUX Smart Router (enhance=false) ──
    try {
      let chosenModel = "flux";
      if (genre === "anime") chosenModel = "flux-anime";
      else if (genre === "cgi_3d") chosenModel = "flux-3d";
      else if (genre === "photorealistic") chosenModel = "flux-realism";
      else chosenModel = selectFluxModel(cleanPrompt);

      const seed = Math.floor(Math.random() * 999999);
      const enhancedQuery = `${cleanPrompt}, 8k uhd, highly detailed, professional masterpiece`;
      const fluxUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedQuery)}?width=${width}&height=${height}&model=${chosenModel}&seed=${seed}&nologo=true&enhance=false`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      const imgResp = await fetch(fluxUrl, { signal: controller.signal });
      clearTimeout(timer);

      if (imgResp.ok) {
        const arrayBuf = await imgResp.arrayBuffer();
        const b64 = Buffer.from(arrayBuf).toString("base64");
        const mime = imgResp.headers.get("content-type") || "image/jpeg";

        return res.status(200).json({
          success: true,
          engine: `FLUX Smart Router (${chosenModel})`,
          model: chosenModel,
          imageUrl: fluxUrl,
          b64,
          dataUrl: `data:${mime};base64,${b64}`,
          prompt: cleanPrompt,
          width,
          height,
        });
      }
    } catch (tier2Err) {
      console.warn("[Vercel ImageGen Tier 2] FLUX failed, cascading to Tier 3:", tier2Err.message);
    }

    // ── Tier 3: Direct FLUX CDN URL Fallback ──
    const fallbackSeed = Math.floor(Math.random() * 999999);
    const directUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?width=${width}&height=${height}&model=flux&seed=${fallbackSeed}&nologo=true&enhance=false`;

    return res.status(200).json({
      success: true,
      engine: "FLUX Ultra Direct",
      model: "flux",
      imageUrl: directUrl,
      dataUrl: directUrl,
      prompt: cleanPrompt,
      width,
      height,
    });

  } catch (err) {
    console.error("[ImageGen] Fatal error:", err.message);
    return res.status(500).json({ success: false, error: err.message || "Internal server error" });
  }
};
