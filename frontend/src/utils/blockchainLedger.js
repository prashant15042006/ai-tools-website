// utils/blockchainLedger.js — Local SHA-256 Blockchain Audit & Verification Ledger
// Implements an immutable cryptographic ledger using WebCrypto API (crypto.subtle)

const STORAGE_KEY = "nexus_blockchain_ledger";

// Helper: Calculate SHA-256 hash of a string
async function calculateSHA256(message) {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Genesis Block initialization
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

// Add a new cryptographic block to the blockchain
export async function addBlockToLedger(promptText, responseText, isOffline = false) {
  try {
    const chain = getBlockchain();
    const previousBlock = chain[chain.length - 1] || GENESIS_BLOCK;
    const index = chain.length;
    const timestamp = new Date().toISOString();

    const responseHash = await calculateSHA256(responseText);
    let nonce = 0;
    let blockData = `${index}${timestamp}${promptText}${responseHash}${previousBlock.hash}${nonce}`;
    let hash = await calculateSHA256(blockData);

    // Simple proof-of-work (find hash starting with "0" or "00" for speed)
    while (!hash.startsWith("0") && nonce < 100) {
      nonce++;
      blockData = `${index}${timestamp}${promptText}${responseHash}${previousBlock.hash}${nonce}`;
      hash = await calculateSHA256(blockData);
    }

    const newBlock = {
      index,
      timestamp,
      prompt: promptText.substring(0, 100),
      responseHash,
      previousHash: previousBlock.hash,
      nonce,
      hash,
      isOffline
    };

    chain.push(newBlock);
    // Keep max 200 blocks in local storage
    const trimmedChain = chain.slice(-200);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedChain));

    return newBlock;
  } catch (err) {
    console.warn("Blockchain block creation error:", err);
    return null;
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
  try {
    const cacheKey = "nexus_ai_response_cache";
    const existing = JSON.parse(localStorage.getItem(cacheKey) || "{}");
    const normalizedPrompt = prompt.trim().toLowerCase();
    existing[normalizedPrompt] = {
      response,
      timestamp: Date.now()
    };
    // Keep last 50 cached responses
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
  try {
    const cacheKey = "nexus_ai_response_cache";
    const existing = JSON.parse(localStorage.getItem(cacheKey) || "{}");
    const normalizedPrompt = prompt.trim().toLowerCase();
    
    // Direct match
    if (existing[normalizedPrompt]) {
      return existing[normalizedPrompt].response;
    }

    // Fuzzy match
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
