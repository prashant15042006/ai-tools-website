/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  Nexuss Voice Engine — J.A.R.V.I.S. Grade TTS               ║
 * ║                                                               ║
 * ║  Indian-accented, calm, natural, human-like AI voice.         ║
 * ║  Speaks Hindi + English fluently with auto-detection.         ║
 * ║  No robotic slowness — fast, clear, and confident.            ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

// ── Voice cache to avoid repeated lookups ────────────────────────────
let cachedVoices = [];
let voicesLoaded = false;

/**
 * Preload system voices. Call this once at app start.
 * Chrome loads voices asynchronously, so we listen for the event.
 */
export const preloadVoices = () => {
  const loadVoices = () => {
    cachedVoices = window.speechSynthesis.getVoices();
    if (cachedVoices.length > 0) voicesLoaded = true;
  };
  loadVoices();
  if (!voicesLoaded) {
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
  }
};

// Preload immediately on import
if (typeof window !== 'undefined' && window.speechSynthesis) {
  preloadVoices();
}

// ── Language Detection ───────────────────────────────────────────────
const HINDI_RANGE = /[\u0900-\u097F]/;

/**
 * Detects whether text is primarily Hindi, English, or mixed.
 * Returns the best lang code for SpeechSynthesis.
 */
const detectLanguage = (text) => {
  if (!text) return 'en-IN';
  
  const words = text.split(/\s+/);
  let hindiWords = 0;
  let englishWords = 0;
  
  for (const word of words) {
    if (HINDI_RANGE.test(word)) {
      hindiWords++;
    } else if (/[a-zA-Z]/.test(word)) {
      englishWords++;
    }
  }
  
  const total = hindiWords + englishWords;
  if (total === 0) return 'en-IN';
  
  const hindiRatio = hindiWords / total;
  
  // If mostly Hindi (>60%), use Hindi voice
  if (hindiRatio > 0.6) return 'hi-IN';
  // If mixed or mostly English, use Indian English
  return 'en-IN';
};

// ── Voice Selection Priority Lists ──────────────────────────────────

/**
 * JARVIS voice priority — Indian English voices ranked best to worst.
 * These create a clear, natural, Indian-accented tone.
 */
const JARVIS_VOICE_PRIORITY = [
  // Indian English voices (preferred for Hindi/English mixed responses)
  'Google India English Male',
  'Google India English Female',
  'Microsoft Rahul Online (Natural)',
  'Microsoft Priya Online (Natural)',
  'Microsoft Indira Online (Natural)',
  'Microsoft Priya',
  'Microsoft Rahul',
  'Google Hindi',
  // Fallback to Indian English language if exact names are not available
  'en-IN',
  // Fallback to general English voices
  'en-GB',
  'Google US English',
  'Microsoft Guy Online (Natural)',
  'Microsoft David Desktop',
  'Microsoft David',
  'Microsoft Mark',
  'Alex',                            // macOS US male
  'Fred',                            // macOS US male
];

/**
 * Hindi voice priority — natural-sounding Hindi voices.
 */
const HINDI_VOICE_PRIORITY = [
  'Google हिन्दी',
  'Microsoft Madhur Online (Natural)',
  'Microsoft Madhur',
  'Microsoft Swara Online (Natural)',
  'Microsoft Swara',
  'hi-IN',
  'hi',
];

const isArabicVoice = (voice) => {
  return voice && voice.lang && voice.lang.startsWith('ar');
};

/**
 * Allow only specific voices: US English, Indian English, or any voice
 * explicitly named 'JARVIS' (case-insensitive). This removes other
 * system voices so only the requested sounds remain.
 */
const isAllowedVoice = (voice) => {
  if (!voice) return false;
  const name = (voice.name || '').toLowerCase();
  const lang = (voice.lang || '').toLowerCase();

  if (name.includes('jarvis')) return true;
  if (lang.startsWith('en-in')) return true; // India
  if (lang.startsWith('en-us')) return true; // US
  // Also allow voices whose name mentions 'india' or 'us' (covers vendor names)
  if (name.includes('india')) return true;
  if (name.includes('us ' ) || name.includes('us-') || name.includes('usenglish') || name.includes('usenglish'.toLowerCase())) return true;

  return false;
};

/**
 * Find the best matching voice from a priority list.
 */
const findBestVoice = (priorityList, voices) => {
  // Filter out undesired languages and keep only allowed voices
  const filteredVoices = voices.filter(v => !isArabicVoice(v) && isAllowedVoice(v));
  for (const target of priorityList) {
    // Try exact name match first
    const byName = filteredVoices.find(v => v.name === target);
    if (byName) return byName;
    
    // Try partial name match
    const byPartial = filteredVoices.find(v => v.name && v.name.includes(target));
    if (byPartial) return byPartial;
    
    // Try lang match (for entries like 'en-GB', 'hi-IN')
    if (target.includes('-') && target.length <= 5) {
      const byLang = filteredVoices.find(v => v.lang === target || v.lang.startsWith(target));
      if (byLang) return byLang;
    }
  }
  return null;
};

// ── Text Cleaning ───────────────────────────────────────────────────

/**
 * Clean text for natural speech output.
 * Removes markdown, code blocks, URLs, and other non-speech content.
 */
const cleanTextForSpeech = (text) => {
  if (!text) return '';
  
  let cleaned = text;
  
  // Remove code blocks entirely (```code```)
  cleaned = cleaned.replace(/```[\s\S]*?```/g, ' code block removed ');
  
  // Remove inline code (`code`)
  cleaned = cleaned.replace(/`[^`]+`/g, '');
  
  // Remove markdown formatting
  cleaned = cleaned.replace(/[#*_~[\]>]/g, '');
  
  // Remove URLs
  cleaned = cleaned.replace(/https?:\/\/\S+/g, '');
  
  // Remove email addresses
  cleaned = cleaned.replace(/\S+@\S+\.\S+/g, '');
  
  // Collapse multiple spaces/newlines
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  // Remove leading/trailing whitespace
  cleaned = cleaned.trim();
  
  return cleaned;
};

// ── Smart Text Chunking for Long Responses ──────────────────────────

/**
 * Break long text into sentence-level chunks for smoother delivery.
 * Prevents the "buffering pause" that makes TTS sound robotic.
 */
const chunkText = (text, maxLen = 200) => {
  if (text.length <= maxLen) return [text];
  
  const chunks = [];
  // Split on sentence boundaries
  const sentences = text.split(/(?<=[.!?।])\s+/);
  let current = '';
  
  for (const sentence of sentences) {
    if ((current + ' ' + sentence).length > maxLen && current) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = current ? current + ' ' + sentence : sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  
  return chunks;
};

// ── Main Speak Function ─────────────────────────────────────────────

/**
 * Speak text with the configured voice preset.
 * 
 * @param {string} text - The text to speak
 * @param {Object} options
 * @param {string} options.voicePreset - 'default' | 'jarvis' | 'custom'
 * @param {string} options.customVoiceUrl - URL for custom TTS endpoint
 * @param {React.RefObject} options.ttsEnabledRef - Ref to check if TTS is still enabled
 * @returns {Promise<void>}
 */
export const speak = async (text, { voicePreset = 'jarvis', customVoiceUrl = '', ttsEnabledRef = null } = {}) => {
  // Guard: check if TTS is enabled
  if (ttsEnabledRef && !ttsEnabledRef.current) return;
  
  // Cancel any ongoing speech
  window.speechSynthesis.cancel();
  
  const cleaned = cleanTextForSpeech(text);
  if (!cleaned) return;
  
  // ── Custom TTS endpoint ──
  if (voicePreset === 'custom' && customVoiceUrl) {
    try {
      const encoded = encodeURIComponent(cleaned);
      const url = customVoiceUrl.includes('?') 
        ? `${customVoiceUrl}&text=${encoded}` 
        : `${customVoiceUrl}?text=${encoded}`;
      const res = await fetch(url);
      if (res.ok) {
        const blob = await res.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audio.playbackRate = 1.05; // Slightly faster for natural feel
        await audio.play();
        return;
      }
    } catch (e) {
      console.warn('[VoiceEngine] Custom TTS playback failed, falling back to browser:', e);
      // Fall through to browser TTS
    }
  }
  
  // ── Browser TTS (default + jarvis) ──
  const voices = cachedVoices.length > 0 
    ? cachedVoices 
    : window.speechSynthesis.getVoices();
  
  const lang = detectLanguage(cleaned);
  const isHindi = lang === 'hi-IN';
  
  // Chunk long text for smoother delivery
  const chunks = chunkText(cleaned);
  
  for (let i = 0; i < chunks.length; i++) {
    // Re-check if TTS is still enabled between chunks
    if (ttsEnabledRef && !ttsEnabledRef.current) {
      window.speechSynthesis.cancel();
      return;
    }
    
    const utterance = new SpeechSynthesisUtterance(chunks[i]);
    
    if (voicePreset === 'jarvis') {
      // ── J.A.R.V.I.S. Mode ──
      // Polished Indian English accent, calm and confident delivery
      // Not robotic — human-like with authority
      
      if (isHindi) {
        // For Hindi content, use best Hindi voice with JARVIS-like tuning
        const hindiVoice = findBestVoice(HINDI_VOICE_PRIORITY, voices);
        if (hindiVoice) utterance.voice = hindiVoice;
        utterance.lang = 'hi-IN';
        utterance.rate = 1.08;    // Slightly brisk — not slow AI
        utterance.pitch = 0.95;   // Slightly deep — authoritative
        utterance.volume = 1;
      } else {
        // For English content, prefer Indian English voices
        const jarvisVoice = findBestVoice(JARVIS_VOICE_PRIORITY, voices);
        if (jarvisVoice) utterance.voice = jarvisVoice;
        utterance.lang = 'en-IN';
        utterance.rate = 1.05;    // Natural pace — not slow, not rushed
        utterance.pitch = 0.88;   // Deep, confident — like JARVIS
        utterance.volume = 1;
      }
    } else if (voicePreset === 'default') {
      // ── Default Mode ──
      // Clean, natural system voice
      if (isHindi) {
        const hindiVoice = findBestVoice(HINDI_VOICE_PRIORITY, voices);
        if (hindiVoice) utterance.voice = hindiVoice;
        utterance.lang = 'hi-IN';
      } else {
        const englishVoice = findBestVoice(JARVIS_VOICE_PRIORITY, voices);
        if (englishVoice) utterance.voice = englishVoice;
        utterance.lang = 'en-IN';
      }
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1;
    } else if (voicePreset && typeof voicePreset === 'string') {
      // ── Explicit system voice by name ──
      // If voicePreset is a specific voice name (advanced), try to use it.
      const explicit = voices.find(v => v.name === voicePreset) || voices.find(v => v.name && v.name.includes(voicePreset));
      if (explicit) {
        utterance.voice = explicit;
        // Use voice's language if available, otherwise detect
        utterance.lang = explicit.lang || detectLanguage(cleaned);
      } else {
        // Fallback to default behavior
        if (isHindi) {
          utterance.lang = 'hi-IN';
        } else {
          utterance.lang = 'en-IN';
        }
      }
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1;
    } else {
      // ── Default Mode ──
      // Clean, natural system voice
      if (isHindi) {
        const hindiVoice = findBestVoice(HINDI_VOICE_PRIORITY, voices);
        if (hindiVoice) utterance.voice = hindiVoice;
        utterance.lang = 'hi-IN';
      } else {
        const englishVoice = findBestVoice(JARVIS_VOICE_PRIORITY, voices);
        if (englishVoice) utterance.voice = englishVoice;
        utterance.lang = 'en-IN';
      }
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1;
    }
    
    // Queue the utterance
    await new Promise((resolve) => {
      utterance.onend = resolve;
      utterance.onerror = resolve; // Don't block on error
      window.speechSynthesis.speak(utterance);
    });
  }
};

// ── Stop Speaking ───────────────────────────────────────────────────

/**
 * Immediately stop all speech.
 */
export const stopSpeaking = () => {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
};

// ── Chrome Bug Workaround ───────────────────────────────────────────

/**
 * Chrome has a known bug where speechSynthesis pauses after ~15 seconds.
 * This workaround keeps it alive by calling resume() periodically.
 * Call startKeepAlive() when TTS is enabled, and stopKeepAlive() when disabled.
 */
let keepAliveInterval = null;

export const startKeepAlive = () => {
  if (keepAliveInterval) return;
  keepAliveInterval = setInterval(() => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }
  }, 10000); // Every 10 seconds
};

export const stopKeepAlive = () => {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
};

// ── Get Available Voices (for debugging/settings) ───────────────────

/**
 * Get all available system voices, grouped by language.
 */
export const getAvailableVoices = () => {
  const voices = window.speechSynthesis.getVoices();
  // Only expose allowed voices to the app (US, India, JARVIS)
  return voices.filter(isAllowedVoice).map(v => ({
    name: v.name,
    lang: v.lang,
    isLocal: v.localService,
    isDefault: v.default,
  }));
};

// ── Test Voice ──────────────────────────────────────────────────────

/**
 * Play a test phrase with the given preset.
 */
export const testVoice = (preset = 'jarvis') => {
  const phrases = {
    jarvis: "Namaste,sir.All system are online and ready for your command.",
    default: "HELLO! I'm Nexuss, your AI assistant.How can I help you today?",
  };
  
  speak(phrases[preset] || phrases.jarvis, { voicePreset: preset });
};

const VoiceEngine = {
  speak,
  stopSpeaking,
  preloadVoices,
  startKeepAlive,
  stopKeepAlive,
  getAvailableVoices,
  testVoice,
};

export default VoiceEngine;
