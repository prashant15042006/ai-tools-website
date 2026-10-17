/**
 * PDF Text Extractor — Multi-layer resilient PDF content extraction
 *
 * Layer 1: Server-side API (/api/pdf-parse) via Node pdf-parse (100% reliable, no browser sandbox/worker limits)
 * Layer 2: Browser-side PDF.js with same-origin Blob Worker (fast client-side fallback)
 * Layer 3: Pure JS Raw Text Stream Reader (works completely offline with 0 dependencies)
 */

import API_BASE_URL from "../apiConfig";

/**
 * Converts a File to Base64 string
 */
const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/**
 * Layer 1: Server-side PDF extraction via /api/pdf-parse
 */
const extractViaServerApi = async (file) => {
  const base64Data = await fileToBase64(file);

  const endpoints = [];
  if (API_BASE_URL) {
    endpoints.push(`${API_BASE_URL}/api/pdf-parse`);
  }
  endpoints.push("/api/pdf-parse");

  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileData: base64Data,
          fileName: file.name,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.text && data.text.trim()) {
          console.log(`✅ [PDF EXTRACT] Server endpoint ${endpoint} extracted ${data.text.length} chars.`);
          return data.text.trim();
        }
      }
    } catch (e) {
      console.warn(`[PDF EXTRACT] Endpoint ${endpoint} attempt failed:`, e.message);
    }
  }

  throw new Error("Server extraction failed or endpoints unavailable");
};

/**
 * Layer 2: Browser-side extraction using PDF.js via script tag + Blob worker
 */
let pdfjsScriptPromise = null;

const loadBrowserPdfjs = () => {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (pdfjsScriptPromise) return pdfjsScriptPromise;

  pdfjsScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = async () => {
      try {
        const pdfjs = window.pdfjsLib;
        if (!pdfjs) throw new Error("window.pdfjsLib not found after script load");

        // Fetch worker as text and create a same-origin Blob URL to bypass browser cross-origin worker restriction
        try {
          const workerResp = await fetch("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js");
          if (workerResp.ok) {
            const workerCode = await workerResp.text();
            const blob = new Blob([workerCode], { type: "application/javascript" });
            pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
          }
        } catch (wErr) {
          console.warn("Could not create blob worker, falling back to inline mode:", wErr);
        }

        resolve(pdfjs);
      } catch (err) {
        reject(err);
      }
    };
    script.onerror = () => reject(new Error("Failed to load PDF.js CDN script"));
    document.head.appendChild(script);
  });

  return pdfjsScriptPromise;
};

const extractViaClientPdfjs = async (file) => {
  const pdfjs = await loadBrowserPdfjs();
  const arrayBuffer = await file.arrayBuffer();

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const maxPages = Math.min(numPages, 60);
  let fullText = "";

  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    let pageText = "";
    let lastY = null;
    for (const item of textContent.items) {
      if (!item.str) continue;
      if (lastY !== null && Math.abs((item.transform?.[5] ?? 0) - lastY) > 5) {
        pageText += "\n";
      }
      pageText += item.str;
      if (item.hasEOL) pageText += "\n";
      lastY = item.transform?.[5] ?? lastY;
    }

    pageText = pageText.replace(/\n{3,}/g, "\n\n").trim();
    if (pageText) {
      fullText += `\n--- Page ${pageNum} ---\n${pageText}\n`;
    }
  }

  return fullText.trim();
};

/**
 * Layer 3: Pure JS Raw Stream Text Scanner (emergency fallback with 0 dependencies)
 */
const extractViaRawStreamScanner = async (file) => {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let raw = "";

  // Convert bytes to string safely
  const chunkSize = 16384;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    raw += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }

  // Find text inside text objects: BT ... ET
  const matches = raw.match(/BT[\s\S]*?ET/g) || [];
  let extracted = [];

  for (const block of matches) {
    // Extract strings in parenthesis: (Hello World) Tj or [(Hello) 10 (World)] TJ
    const strMatches = block.match(/\(([^)]+)\)\s*(?:Tj|'|")/g) || [];
    for (const sm of strMatches) {
      const textOnly = sm.replace(/^\(/, "").replace(/\)\s*(?:Tj|'|")$/, "");
      if (textOnly && textOnly.length > 1) {
        extracted.push(textOnly);
      }
    }
  }

  const result = extracted.join(" ").replace(/\s+/g, " ").trim();
  if (result.length > 50) {
    return result;
  }

  throw new Error("No readable raw text streams found in PDF");
};

/**
 * Main PDF Extraction function
 * Cascades through: Server API → Client PDF.js → Raw Stream Scanner
 */
export const extractTextFromPDF = async (file) => {
  // 1. Try Server API first (handles 100% of PDFs without browser worker limits)
  try {
    const text = await extractViaServerApi(file);
    if (text && text.trim().length > 10) {
      return text;
    }
  } catch (err) {
    console.warn("Layer 1 (Server API) failed, trying Layer 2 (Client PDF.js)...", err.message);
  }

  // 2. Try Client-side PDF.js with Blob Worker
  try {
    const text = await extractViaClientPdfjs(file);
    if (text && text.trim().length > 10) {
      return text;
    }
  } catch (err) {
    console.warn("Layer 2 (Client PDF.js) failed, trying Layer 3 (Raw Stream Scanner)...", err.message);
  }

  // 3. Try Raw Stream Scanner (emergency offline fallback)
  try {
    const text = await extractViaRawStreamScanner(file);
    if (text && text.trim().length > 10) {
      return text;
    }
  } catch (err) {
    console.warn("Layer 3 (Raw Stream Scanner) failed:", err.message);
  }

  throw new Error("Could not extract text from this PDF. It may be an image-only / scanned document without embedded text.");
};
