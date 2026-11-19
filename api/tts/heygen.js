// ================================================================
// Vercel Serverless Function: POST /api/tts/heygen
// HeyGen Voice TTS via OpenRouter — heygen/heygen-voice-1-turbo:free
// Supported voices: nadine, tabitha, bram, gareth, noelle, meredith, sabrina, lucian, weston, vincent
// Body: { text: string, voice?: string }
// Returns: { success, dataUrl, audio_b64, mimeType: "audio/wav" }
// ================================================================

const HEYGEN_VOICES = ['nadine', 'tabitha', 'bram', 'gareth', 'noelle', 'meredith', 'sabrina', 'lucian', 'weston', 'vincent'];

const pcmToWav = (pcmBuffer, sampleRate = 44100, numChannels = 1, bitsPerSample = 16) => {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const wavHeader = Buffer.alloc(44);

  wavHeader.write('RIFF', 0);
  wavHeader.writeUInt32LE(36 + pcmBuffer.length, 4);
  wavHeader.write('WAVE', 8);
  wavHeader.write('fmt ', 12);
  wavHeader.writeUInt32LE(16, 16);
  wavHeader.writeUInt16LE(1, 20); // PCM format
  wavHeader.writeUInt16LE(numChannels, 22);
  wavHeader.writeUInt32LE(sampleRate, 24);
  wavHeader.writeUInt32LE(byteRate, 28);
  wavHeader.writeUInt16LE(blockAlign, 32);
  wavHeader.writeUInt16LE(bitsPerSample, 34);
  wavHeader.write('data', 36);
  wavHeader.writeUInt32LE(pcmBuffer.length, 40);

  return Buffer.concat([wavHeader, pcmBuffer]);
};

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
    const { text, voice = "nadine" } = req.body || {};

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

    let selectedVoice = (voice || "").toLowerCase().trim();
    if (!HEYGEN_VOICES.includes(selectedVoice)) {
      selectedVoice = "nadine";
    }

    console.log(`[HeyGen TTS] Synthesizing ${text.length} chars, voice: ${selectedVoice}`);

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
        voice: selectedVoice,
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

    // Convert raw PCM to browser-playable WAV
    const arrayBuffer = await response.arrayBuffer();
    const rawBuffer = Buffer.from(arrayBuffer);
    const wavBuffer = (contentType.includes("pcm") || !contentType.includes("wav")) ? pcmToWav(rawBuffer) : rawBuffer;
    const audio_b64 = wavBuffer.toString("base64");
    const mimeType = "audio/wav";

    console.log(`[HeyGen TTS] ✅ WAV Audio ready. ${wavBuffer.length} bytes`);
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
