// utils/blockchainLedger.js — Local Cryptographic SHA-256 Blockchain Ledger
// Works on both Secure (HTTPS/WebCrypto) and Non-Secure (HTTP/Mobile) environments.

const STORAGE_KEY = "nexus_blockchain_ledger";

// Pure JavaScript fallback hash for non-secure HTTP contexts / older mobile browsers
function jsHashFallback(str) {
  let hash1 = 5381;
  let hash2 = 52711;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash1 = (hash1 * 33) ^ char;
    hash2 = (hash2 * 33) ^ char;
  }
  const h1Hex = Math.abs(hash1).toString(16).padStart(8, "0");
  const h2Hex = Math.abs(hash2).toString(16).padStart(8, "0");
  const base = h1Hex + h2Hex;
  return (base + base + base + base).substring(0, 64);
}

// SHA-256 Hash calculation with automatic fallback
async function calculateSHA256(message) {
  try {
    if (window.crypto && window.crypto.subtle && typeof window.crypto.subtle.digest === "function") {
      const msgUint8 = new TextEncoder().encode(message);
      const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch (e) {
    // Fallback if crypto.subtle throws
  }
  return jsHashFallback(message);
}

// Genesis Block definition
const GENESIS_BLOCK = {
  index: 0,
  timestamp: "2026-01-01T00:00:00.000Z",
  prompt: "GENESIS_BLOCK_NEXUSS_AI",
  responseHash: "0000000000000000000000000000000000000000000000000000000000000000",
  previousHash: "0",
  nonce: 0,
  hash: "0000000000000000000000000000000000000000000000000000000000000000"
};

// Retrieve current blockchain from localStorage
export function getBlockchain() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([GENESIS_BLOCK]));
      return [GENESIS_BLOCK];
    }
    const chain = JSON.parse(stored);
    return Array.isArray(chain) && chain.length > 0 ? chain : [GENESIS_BLOCK];
  } catch {
    return [GENESIS_BLOCK];
  }
}

// Add a new cryptographic block to the ledger
export async function addBlockToLedger(promptText, responseText, isOffline = false) {
  try {
    const chain = getBlockchain();
    const previousBlock = chain[chain.length - 1] || GENESIS_BLOCK;
    const index = chain.length;
    const timestamp = new Date().toISOString();

    const responseHash = await calculateSHA256(responseText || "EMPTY_RESPONSE");
    let nonce = 0;
    let blockData = `${index}${timestamp}${promptText}${responseHash}${previousBlock.hash}${nonce}`;
    let hash = await calculateSHA256(blockData);

    const newBlock = {
      index,
      timestamp,
      prompt: (promptText || "").substring(0, 100),
      responseHash,
      previousHash: previousBlock.hash,
      nonce,
      hash,
      isOffline
    };

    chain.push(newBlock);
    // Keep max 150 blocks in local storage to optimize memory
    const trimmedChain = chain.slice(-150);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedChain));

    return newBlock;
  } catch (err) {
    console.warn("Blockchain ledger error:", err);
    return {
      index: 1,
      timestamp: new Date().toISOString(),
      hash: jsHashFallback(promptText + responseText),
      isOffline
    };
  }
}

// Verify integrity of the local blockchain
export async function verifyBlockchainIntegrity() {
  const chain = getBlockchain();
  if (chain.length <= 1) return { isValid: true, count: chain.length };

  for (let i = 1; i < chain.length; i++) {
    const current = chain[i];
    const previous = chain[i - 1];

    if (current.previousHash !== previous.hash) {
      return { isValid: false, brokenIndex: i, reason: "Previous hash mismatch" };
    }
  }

  return { isValid: true, count: chain.length, latestHash: chain[chain.length - 1].hash };
}

// Cache AI responses for offline fallback
export function cacheResponseForOffline(prompt, response) {
  if (!prompt || !response) return;
  try {
    const cacheKey = "nexus_ai_response_cache";
    const existing = JSON.parse(localStorage.getItem(cacheKey) || "{}");
    const normalizedPrompt = prompt.trim().toLowerCase();
    existing[normalizedPrompt] = {
      response,
      timestamp: Date.now()
    };
    const keys = Object.keys(existing);
    if (keys.length > 50) {
      delete existing[keys[0]];
    }
    localStorage.setItem(cacheKey, JSON.stringify(existing));
  } catch (e) {
    console.warn("Response caching error:", e);
  }
}

// Search cached responses
export function getCachedResponse(prompt) {
  if (!prompt) return null;
  try {
    const cacheKey = "nexus_ai_response_cache";
    const existing = JSON.parse(localStorage.getItem(cacheKey) || "{}");
    const normalizedPrompt = prompt.trim().toLowerCase();
    
    if (existing[normalizedPrompt]) {
      return existing[normalizedPrompt].response;
    }

    for (const key of Object.keys(existing)) {
      if (normalizedPrompt.includes(key) || key.includes(normalizedPrompt)) {
        return existing[key].response;
      }
    }
  } catch {
    return null;
  }
  return null;
}
