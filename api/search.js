// ================================================================
// Vercel Serverless Function: /api/search
// Free Web Search using DuckDuckGo Instant Answer API
// No API key required! Works for real-time/factual queries.
// ================================================================

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const query = req.method === "POST"
    ? (req.body?.query || req.body?.q || "")
    : (req.query?.q || req.query?.query || "");

  if (!query?.trim()) {
    return res.status(400).json({ success: false, error: "query is required" });
  }

  try {
    const results = await webSearch(query.trim());
    return res.status(200).json({ success: true, query, results });
  } catch (err) {
    console.error("[Search] Error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ── Core web search function (also exported for use in chat.js) ─────────────
async function webSearch(query) {
  const results = [];

  // ── 1. DuckDuckGo Instant Answer API (free, no key) ─────────────────────
  try {
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1&no_redirect=1`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const resp = await fetch(ddgUrl, { signal: controller.signal });
    clearTimeout(timer);

    if (resp.ok) {
      const data = await resp.json();

      // Abstract (Wikipedia-like summary)
      if (data.AbstractText) {
        results.push({
          type: "abstract",
          title: data.Heading || query,
          snippet: data.AbstractText,
          url: data.AbstractURL || data.AbstractSource || "",
          source: data.AbstractSource || "DuckDuckGo",
        });
      }

      // Answer (direct fact: e.g. "1 + 1 = 2", "Capital of France = Paris")
      if (data.Answer) {
        results.push({
          type: "answer",
          title: "Direct Answer",
          snippet: data.Answer,
          url: "",
          source: "DuckDuckGo",
        });
      }

      // Definition
      if (data.Definition) {
        results.push({
          type: "definition",
          title: data.DefinitionSource || "Definition",
          snippet: data.Definition,
          url: data.DefinitionURL || "",
          source: data.DefinitionSource || "DuckDuckGo",
        });
      }

      // Related topics (top 5)
      if (Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics.slice(0, 5)) {
          if (topic.Text && topic.FirstURL) {
            results.push({
              type: "related",
              title: topic.Text.split(" - ")[0] || topic.Text.substring(0, 60),
              snippet: topic.Text,
              url: topic.FirstURL,
              source: "DuckDuckGo",
            });
          }
        }
      }

      // Infobox entries (e.g. person details, movie info)
      if (data.Infobox?.content?.length > 0) {
        const infoSnippet = data.Infobox.content
          .slice(0, 5)
          .map(item => `${item.label}: ${item.value}`)
          .join(" | ");
        if (infoSnippet) {
          results.push({
            type: "infobox",
            title: data.Heading || query,
            snippet: infoSnippet,
            url: data.AbstractURL || "",
            source: "DuckDuckGo Infobox",
          });
        }
      }
    }
  } catch (e) {
    console.warn("[Search] DuckDuckGo failed:", e.message);
  }

  // ── 2. Fallback: Pollinations AI web-enabled search ──────────────────────
  if (results.length === 0) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const resp = await fetch("https://text.pollinations.ai/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "searchgpt",
          messages: [
            {
              role: "user",
              content: `Search the web and answer: ${query}. Provide a concise factual answer with key facts.`,
            },
          ],
          stream: false,
          seed: Math.floor(Math.random() * 99999),
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (resp.ok) {
        const text = await resp.text();
        if (text?.trim()) {
          results.push({
            type: "ai_search",
            title: "Web Search Result",
            snippet: text.trim().substring(0, 1500),
            url: "",
            source: "SearchGPT",
          });
        }
      }
    } catch (e) {
      console.warn("[Search] Pollinations SearchGPT failed:", e.message);
    }
  }

  return results;
}

module.exports.webSearch = webSearch;
