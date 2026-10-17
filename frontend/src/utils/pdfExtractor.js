/**
 * PDF Text Extractor — Browser-side using PDF.js loaded from CDN
 *
 * Strategy: Load PDF.js dynamically from CDN as a global script,
 * avoiding webpack/CRA build conflicts with ESM-only pdfjs-dist v6.
 */

const PDFJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs";
const WORKER_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";

let pdfjsLibPromise = null;

/**
 * Dynamically loads PDF.js from CDN (cached after first call).
 */
const loadPdfjsLib = () => {
  if (pdfjsLibPromise) return pdfjsLibPromise;

  pdfjsLibPromise = import(/* webpackIgnore: true */ PDFJS_CDN).then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = WORKER_CDN;
    return pdfjs;
  });

  return pdfjsLibPromise;
};

/**
 * Extracts plain text content from a PDF File/Blob object.
 *
 * @param {File} file - The PDF File object from input[type=file]
 * @returns {Promise<string>} - Extracted text content
 */
export const extractTextFromPDF = async (file) => {
  let pdfjsLib;
  try {
    pdfjsLib = await loadPdfjsLib();
  } catch (loadErr) {
    console.error("Failed to load PDF.js from CDN:", loadErr);
    throw new Error("PDF.js library could not be loaded. Please check your internet connection.");
  }

  // Read file as ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();

  // Load the PDF
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;

  const numPages = pdf.numPages;
  const maxPages = Math.min(numPages, 60);
  let fullText = "";

  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Reconstruct page text preserving line breaks
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

  if (numPages > maxPages) {
    fullText += `\n[Note: PDF has ${numPages} total pages. First ${maxPages} pages extracted.]\n`;
  }

  const result = fullText.trim();
  if (!result) {
    return "[PDF appears to contain no extractable text — it may be a scanned/image-based PDF. Please describe the PDF content manually or use an OCR tool first.]";
  }

  return result;
};
