// ================================================================
// Vercel Serverless Function & Express Handler: POST /api/decider
// Powered by: perplexity/pplx-decider-v1.3:free via OpenRouter Decisions API
// Fast, probabilistic classification for auto-routing, aspect ratios, and visual genres
// ================================================================

const isValidKey = (val) =>
  val &&
  val.trim() !== "" &&
  !val.startsWith("REPLACE_WITH_") &&
  !val.includes("example.com") &&
  !val.includes("example");

const RATIO_PRESETS = {
  "16:9": { width: 1024, height: 576, label: "16:9 Widescreen", icon: "🌅" },
  "9:16": { width: 576, height: 1024, label: "9:16 Portrait / Story", icon: "📱" },
  "4:3": { width: 1024, height: 768, label: "4:3 Classic Photo", icon: "📺" },
  "1:1": { width: 1024, height: 1024, label: "1:1 Square", icon: "⏹️" },
};

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ success: false, error: "Method not allowed" });

  try {
    const { text, prompt, mode = "image", questions } = req.body || {};
    const inputState = (text || prompt || "").trim();

    if (!inputState) {
      return res.status(400).json({ success: false, error: "text or prompt is required" });
    }

    const apiKey = process.env.OPENROUTER_KEY_PPLX || process.env.OPENROUTER_KEY_NEMOTRON;
    if (!isValidKey(apiKey)) {
      if (mode === "image") {
        return res.json({
          success: true,
          mode: "image",
          ratio: "1:1",
          ratioConfig: RATIO_PRESETS["1:1"],
          genre: "photorealistic",
          source: "heuristic_fallback"
        });
      }
      return res.json({
        success: true,
        mode: "intent",
        intent: "general_chat",
        source: "heuristic_fallback"
      });
    }

    let queryQuestions = questions;

    if (!queryQuestions) {
      if (mode === "image") {
        queryQuestions = {
          ratio: {
            type: "choice",
            criteria: {
              "16:9": "Widescreen, landscape, banner, desktop wallpaper, horizontal view, 16:9",
              "9:16": "Mobile portrait, vertical, story, reel, phone wallpaper, full body, 9:16",
              "4:3": "Standard photo, classic television, landscape photo, 4:3",
              "1:1": "Square, avatar, icon, profile picture, logo, centered portrait, default 1:1"
            }
          },
          genre: {
            type: "choice",
            criteria: {
              "photorealistic": "Real life photo, camera shot, human portrait, realistic nature, DSLR, 8k",
              "anime": "Anime, manga, Japanese animation, cartoon, cel shaded, Studio Ghibli",
              "vector_logo": "Logo, icon, flat vector, branding, sticker, minimalist graphic",
              "cgi_3d": "3D render, digital sculpture, blender, octane render, unreal engine",
              "artistic": "General concept art, oil painting, fantasy illustration, surreal artwork"
            }
          }
        };
      } else if (mode === "intent") {
        queryQuestions = {
          intent: {
            type: "choice",
            criteria: {
              "image_generation": "User wants to generate, draw, create, or render an image, picture, photo, artwork, or logo",
              "voice_audio": "User wants to speak, hear speech, text-to-speech, convert text to audio or voice narration",
              "code_programming": "User wants to write, debug, explain, or fix computer software code or programming script",
              "general_chat": "General conversation, informational queries, writing assistance, analysis, or advice"
            }
          }
        };
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const payload = {
      model: "perplexity/pplx-decider-v1.3:free",
      state: inputState,
      questions: queryQuestions,
    };

    const response = await fetch("https://openrouter.ai/api/alpha/decisions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://nexuss-ai.vercel.app",
        "X-Title": "Nexuss AI Decider",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      const errText = await response.text();
      console.warn("[PPLX Decider] API error:", response.status, errText);
      return res.status(response.status).json({ success: false, error: errText });
    }

    const data = await response.json();
    const answers = data?.answers || {};

    let result = {
      success: true,
      mode,
      model: "perplexity/pplx-decider-v1.3:free",
      answers,
      provider: "Perplexity"
    };

    if (mode === "image" && answers.ratio && answers.genre) {
      const selectedRatio = answers.ratio.choice || "1:1";
      const config = RATIO_PRESETS[selectedRatio] || RATIO_PRESETS["1:1"];
      result.ratio = selectedRatio;
      result.ratioConfig = config;
      result.genre = answers.genre.choice || "photorealistic";
      result.ratioConfidence = answers.ratio.confidence;
      result.genreConfidence = answers.genre.confidence;
    } else if (mode === "intent" && answers.intent) {
      result.intent = answers.intent.choice || "general_chat";
      result.confidence = answers.intent.confidence;
    }

    return res.status(200).json(result);

  } catch (err) {
    console.error("[PPLX Decider] Error:", err.message);
    return res.status(500).json({ success: false, error: err.message || "Decider internal error" });
  }
};
