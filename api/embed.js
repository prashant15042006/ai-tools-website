// ================================================================
// Vercel Serverless Function: /api/embed
// Generates text embeddings for RAG / semantic search workflows.
// Primary: Google Gemini text-embedding-004 (free, 768-dim)
// Fallback: OpenRouter openai/text-embedding-ada-002
// Body: { text: string }
// Returns: { success: boolean, provider: string, embedding: number[] }
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
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: "text field is required" });

  // 1. Google Gemini text-embedding-004 (preferred — free & fast)
  const geminiKey = process.env.GEMINI_API_KEY;
  if (isValidKey(geminiKey)) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: { parts: [{ text }] } }),
          signal: controller.signal,
        }
      );
      clearTimeout(timer);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error?.message || `Gemini ${r.status}`);
      const embedding = data.embedding?.values;
      if (!embedding) throw new Error("Empty embedding from Gemini");
      return res.status(200).json({ success: true, provider: "gemini", embedding });
    } catch (e) {
      console.warn("Gemini embedding failed:", e.message);
    }
  }

  // 2. OpenRouter embeddings (fallback)
  const openrouterKey = process.env.EMBEDDING_API_KEY || process.env.ZAI_API_KEY;
  if (isValidKey(openrouterKey)) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const r = await fetch("https://openrouter.ai/api/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openrouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://nexuss-ai.io",
          "X-Title": "Nexuss Workspace",
        },
        body: JSON.stringify({
          model: "openai/text-embedding-ada-002",
          input: text,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error?.message || `OpenRouter ${r.status}`);
      const embedding = data.data?.[0]?.embedding;
      if (!embedding) throw new Error("Empty embedding from OpenRouter");
      return res.status(200).json({ success: true, provider: "openrouter", embedding });
    } catch (e) {
      console.error("OpenRouter embedding failed:", e.message);
    }
  }

  return res.status(503).json({ success: false, error: "No embedding provider configured." });
};
