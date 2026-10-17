// ================================================================
// Vercel Serverless Function: /api/pdf-parse
// Robust server-side PDF text extraction using pdf-parse
// ================================================================

const { PDFParse } = require("pdf-parse");

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  try {
    const { fileData, fileName = "document.pdf" } = req.body || {};
    if (!fileData) {
      return res.status(400).json({ success: false, error: "No fileData provided" });
    }

    // Clean base64 string if data URL prefix is included
    const cleanBase64 = fileData.replace(/^data:application\/pdf;base64,/, "").replace(/^data:.*;base64,/, "");
    const buffer = Buffer.from(cleanBase64, "base64");

    if (buffer.length === 0) {
      return res.status(400).json({ success: false, error: "Empty file buffer" });
    }

    const parser = new PDFParse(new Uint8Array(buffer));
    const result = await parser.getText();

    let extractedText = "";
    if (result && typeof result.text === "string") {
      extractedText = result.text.trim();
    } else if (result && Array.isArray(result.pages)) {
      extractedText = result.pages.map((p, i) => `--- Page ${p.num || i + 1} ---\n${p.text}`).join("\n\n").trim();
    }

    if (!extractedText) {
      return res.json({
        success: true,
        text: "[PDF appears to contain no extractable text. It may be scanned or image-based.]",
        pageCount: result?.total || result?.numpages || 1,
        charCount: 0
      });
    }

    return res.json({
      success: true,
      text: extractedText,
      pageCount: result?.total || result?.numpages || 1,
      charCount: extractedText.length
    });
  } catch (err) {
    console.error("Server PDF parse error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to parse PDF document"
    });
  }
};
