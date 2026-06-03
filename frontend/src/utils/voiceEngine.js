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
  // Highest-quality voices for a polished Indian English Jarvis style
  'Microsoft Aria Online (Natural)',
  'Microsoft Aria',
  'Google India English Male',
  'Google India English Female',
  'Google UK English Male',
  'Google UK English Female',
  'Google US English',
  'Microsoft Rahul Online (Natural)',
  'Microsoft Priya Online (Natural)',
  'Microsoft Indira Online (Natural)',
  'Microsoft Priya',
  'Microsoft Rahul',
  'Microsoft Guy Online (Natural)',
  'Microsoft David Desktop',
  'Microsoft David',
  'Microsoft Mark',
  'Alex',                            // macOS US male
  'Fred',                            // macOS US male
  'en-IN',
  'en-GB',
  'en-US',
  'en',
];

/**
 * Real Jarvis priority — use the most natural, expressive voice available.
 */
const REALJARVIS_VOICE_PRIORITY = [
  'Microsoft Aria Online (Natural)',
  'Microsoft Aria',
  'Google UK English Male',
  'Google UK English Female',
  'Google US English',
  'Google India English Male',
  'Google India English Female',
  'Microsoft Rahul Online (Natural)',
  'Microsoft Priya Online (Natural)',
  'Microsoft Indira Online (Natural)',
  'Microsoft Guy Online (Natural)',
  'Microsoft David Desktop',
  'Microsoft Mark',
  'Alex',
  'Fred',
  'en-IN',
  'en-GB',
  'en-US',
  'en',
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
  if (name.includes('savi')) return true;
  if (lang.startsWith('en-')) return true; // English voices
  if (lang.startsWith('hi-')) return true; // Hindi voices
  if (name.includes('english')) return true;
  if (name.includes('india')) return true;
  if (name.includes('aria')) return true;
  if (name.includes('natural')) return true;

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
  
  // Remove emojis to prevent TTS from speaking "smiling face", etc.
  cleaned = cleaned.replace(/[\p{Emoji}]/gu, '');
  
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
 * @param {string} options.voicePreset - 'default' | 'jarvis' | 'custom' | 'system' | explicit system voice name
 * @param {string} options.customVoiceUrl - URL for custom TTS endpoint
 * @param {React.RefObject} options.ttsEnabledRef - Ref to check if TTS is still enabled
 * @returns {Promise<void>}
 */
export const speak = async (text, { voicePreset = 'jarvis', customVoiceUrl = '', ttsEnabledRef = null } = {}) => {
  // Guard: check if TTS is enabled
  if (ttsEnabledRef && !ttsEnabledRef.current) return;
  
  // Cancel any ongoing speech
  window.speechSynthesis.cancel();
  
  if (voicePreset === 'system') {
    voicePreset = 'default';
  }
  
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
    
    if (voicePreset === 'realjarvis') {
      // ── Real J.A.R.V.I.S. Mode ──
      // Highest-fidelity voice, extra natural and expressive.
      if (isHindi) {
        const hindiVoice = findBestVoice(HINDI_VOICE_PRIORITY, voices)
          || voices.find(v => v.lang && v.lang.toLowerCase().startsWith('hi-in'))
          || voices.find(v => v.lang && v.lang.toLowerCase().startsWith('hi'));
        if (hindiVoice) utterance.voice = hindiVoice;
        utterance.lang = hindiVoice?.lang || 'hi-IN';
        utterance.rate = 1.28;
        utterance.pitch = 1.1;
        utterance.volume = 1;
      } else {
        const jarvisVoice = findBestVoice(REALJARVIS_VOICE_PRIORITY, voices)
          || voices.find(v => v.lang && v.lang.toLowerCase().startsWith('en-in'))
          || voices.find(v => v.name && /india/i.test(v.name))
          || voices.find(v => v.lang && v.lang.toLowerCase().startsWith('en-us'))
          || voices.find(v => v.lang && v.lang.toLowerCase().startsWith('en'))
          || voices[0];
        if (jarvisVoice) utterance.voice = jarvisVoice;
        utterance.lang = jarvisVoice?.lang || 'en-IN';
        utterance.rate = 1.38;
        utterance.pitch = 1.15;
        utterance.volume = 1;
      }
      } else if (voicePreset === 'ironman_en') {
        // ── Ironman English Mode ──
        // Uses a strong, confident synthetic voice, akin to a heroic AI.
        // Prioritize high-fidelity English voice; fallback to first available.
        const ironVoice = findBestVoice([
          'Microsoft Aria Online (Natural)',
          'Google US English',
          'Google UK English Male',
          'Microsoft David Desktop'
        ], voices) || voices[0];
        if (ironVoice) utterance.voice = ironVoice;
        utterance.lang = ironVoice?.lang || 'en-US';
        utterance.rate = 1.5; // slightly faster for heroic tone
        utterance.pitch = 1.0;
        utterance.volume = 1;
      } else if (voicePreset === 'ironman_hi') {
        // ── Ironman Hindi Mode ──
        // Uses a bold Hindi voice with clear articulation.
        // Prioritize natural Hindi voices first.
        const ironHindiVoice = findBestVoice(HINDI_VOICE_PRIORITY, voices)
          || findBestVoice([
            'Google हिन्दी',
            'Microsoft Madhur Online (Natural)',
            'Microsoft Swara Online (Natural)'
          ], voices);
        if (ironHindiVoice) utterance.voice = ironHindiVoice;
        utterance.lang = ironHindiVoice?.lang || 'hi-IN';
        // Reduce rate for better comprehension (previously 1.4)
        utterance.rate = 1.2;
        utterance.pitch = 1.0;
        utterance.volume = 1;
      } else if (voicePreset === 'jarvis') {
      // ── J.A.R.V.I.S. Mode ──
      // Polished Indian English accent, confident, fast, and natural.
      // Real-sounding delivery with strong volume and clear tone.
      
      if (isHindi) {
        const hindiVoice = findBestVoice(HINDI_VOICE_PRIORITY, voices)
          || voices.find(v => v.lang && v.lang.toLowerCase().startsWith('hi-in'))
          || voices.find(v => v.lang && v.lang.toLowerCase().startsWith('hi'));
        if (hindiVoice) utterance.voice = hindiVoice;
        utterance.lang = hindiVoice?.lang || 'hi-IN';
        utterance.rate = 1.2;
        utterance.pitch = 1.05;
        utterance.volume = 1;
      } else {
        const jarvisVoice = findBestVoice(JARVIS_VOICE_PRIORITY, voices)
          || voices.find(v => v.lang && v.lang.toLowerCase().startsWith('en-in'))
          || voices.find(v => v.name && /india/i.test(v.name))
          || voices.find(v => v.lang && v.lang.toLowerCase().startsWith('en-us'))
          || voices.find(v => v.lang && v.lang.toLowerCase().startsWith('en'))
          || voices[0];
        if (jarvisVoice) utterance.voice = jarvisVoice;
        utterance.lang = jarvisVoice?.lang || 'en-IN';
        utterance.rate = 1.3;
        utterance.pitch = 1.1;
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
        // Fallback to default behavior when the explicit voice name is unavailable.
        const fallback = isHindi
          ? findBestVoice(HINDI_VOICE_PRIORITY, voices)
          : findBestVoice(JARVIS_VOICE_PRIORITY, voices) || voices.find(v => v.lang && v.lang.toLowerCase().startsWith('en'));
        if (fallback) utterance.voice = fallback;
        utterance.lang = fallback?.lang || (isHindi ? 'hi-IN' : 'en-IN');
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
export const testVoice = (preset = 'jarvis', customVoiceUrl = '') => {
  const phrases = {
    jarvis: "Namaste, sir. All systems are online and ready for your command.",
    realjarvis: "This is the Real Jarvis voice check. Listen to the natural tone, speed, and clarity.",
    default: "Hello, this is Nexuss. Please listen to the voice quality and clarity.",
    system: "This is Savi verifying your selected system voice. Please listen to tone, speed, and clarity.",
  };
  const phrase = phrases[preset] || `This is Savi testing the selected voice: ${preset}. Please listen carefully.`;
  return speak(phrase, { voicePreset: preset === 'system' ? 'default' : preset, customVoiceUrl });
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
