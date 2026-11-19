// ================================================================
// Vercel Serverless Function & Express Handler: POST /api/rerank
// Powered by: nvidia/nemotron-3.5-rerank-8b:free via OpenRouter
// Performs deep semantic re-ranking of documents / prompts for high-precision search
// ================================================================

const isValidKey = (val) =>
  val &&
  val.trim() !== "" &&
  !val.startsWith("REPLACE_WITH_") &&
  !val.includes("example.com") &&
  !val.includes("example");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ success: false, error: "Method not allowed" });

  try {
    const { query, documents } = req.body || {};
    if (!query || !query.trim()) {
      return res.status(400).json({ success: false, error: "query is required" });
    }
    if (!Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({ success: false, error: "documents must be a non-empty array" });
    }

    const rerankKey = process.env.OPENROUTER_KEY_RERANK || process.env.OPENROUTER_KEY_NEMOTRON;
    if (!isValidKey(rerankKey)) {
      return res.json({
        success: true,
        provider: "fallback",
        results: documents.map((text, index) => ({ index, text, score: 1 - index * 0.01 })),
      });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    // Primary: Nemotron 3.5 Rerank 8B (Free SOTA 8B Model)
    const response = await fetch("https://openrouter.ai/api/v1/rerank", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${rerankKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://nexuss-ai.vercel.app",
        "X-Title": "Nexuss AI Rerank",
      },
      body: JSON.stringify({
        model: "nvidia/nemotron-3.5-rerank-8b:free",
        query: query.trim(),
        documents,
        top_n: documents.length,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      const errText = await response.text();
      console.warn("[Rerank] Primary 8B failed, fallback to original order:", response.status, errText);
      return res.json({
        success: true,
        provider: "fallback",
        results: documents.map((text, index) => ({ index, text, score: 1 - index * 0.01 })),
      });
    }

    const data = await response.json();
    const rawResults = data.results || [];
    const ranked = rawResults
      .sort((a, b) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0))
      .map((r) => ({
        index: r.index,
        text: documents[r.index],
        score: r.relevance_score ?? 0,
      }));

    return res.status(200).json({
      success: true,
      provider: "openrouter",
      model: "nvidia/nemotron-3.5-rerank-8b:free",
      results: ranked,
    });
  } catch (err) {
    console.error("[Rerank] Error:", err.message);
    return res.json({
      success: true,
      provider: "fallback",
      results: (req.body?.documents || []).map((text, index) => ({ index, text, score: 1 - index * 0.01 })),
    });
  }
};
