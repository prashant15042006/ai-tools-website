// ================================================================
// Vercel Serverless Function: POST /api/tts/heygen
// HeyGen Voice TTS via OpenRouter — heygen/heygen-voice-1-turbo:free
// Body: { text: string, voice?: string }
// Returns: { success, dataUrl, audio_b64, mimeType } or { success, data }
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
    const { text, voice = "en-US-JennyNeural" } = req.body || {};

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, error: "text is required" });
    }
    if (text.length > 2000) {
      return res.status(400).json({ success: false, error: "Text too long. Max 2000 characters." });
    }

    const apiKey = process.env.OPENROUTER_KEY_HEYGEN;
    if (!isValidKey(apiKey)) {
      return res.status(503).json({
        success: false,
        error: "HeyGen Voice API key not configured. Set OPENROUTER_KEY_HEYGEN in Vercel environment variables.",
      });
    }

    console.log(`[HeyGen TTS] Synthesizing ${text.length} chars, voice: ${voice}`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    const response = await fetch("https://openrouter.ai/api/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://nexuss-ai.vercel.app",
        "X-Title": "Nexuss AI Voice Studio",
      },
      body: JSON.stringify({
        model: "heygen/heygen-voice-1-turbo:free",
        input: text.trim(),
        voice: voice,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      const errText = await response.text();
      console.error("[HeyGen TTS] OpenRouter error:", response.status, errText);
      return res.status(502).json({
        success: false,
        error: `HeyGen TTS failed (${response.status}): ${errText}`,
      });
    }

    const contentType = response.headers.get("content-type") || "";

    // JSON response (URL or base64 inside JSON)
    if (contentType.includes("application/json")) {
      const data = await response.json();
      return res.status(200).json({ success: true, data });
    }

    // Binary audio — convert to base64
    const arrayBuffer = await response.arrayBuffer();
    const audio_b64 = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = contentType.includes("wav") ? "audio/wav" : "audio/mpeg";

    console.log(`[HeyGen TTS] ✅ Audio ready. ${arrayBuffer.byteLength} bytes`);
    return res.status(200).json({
      success: true,
      audio_b64,
      mimeType,
      dataUrl: `data:${mimeType};base64,${audio_b64}`,
    });

  } catch (err) {
    if (err.name === "AbortError") {
      return res.status(504).json({ success: false, error: "HeyGen TTS request timed out (30s)" });
    }
    console.error("[HeyGen TTS] Error:", err.message);
    return res.status(500).json({ success: false, error: err.message || "Internal server error" });
  }
};
