/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  Nexuss Voice Engine — J.A.R.V.I.S. Grade TTS               ║
 * ║                                                               ║
 * ║  Indian-accented, calm, natural, human-like AI voice.         ║
 * ║  Speaks Hindi + English fluently with auto-detection.         ║
 * ║  No robotic slowness — fast, clear, and confident.            ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

import API_BASE_URL from "../apiConfig";

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
    if (typeof window.speechSynthesis.addEventListener === 'function') {
      window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    } else {
      // Older browsers may only support the onvoiceschanged handler
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
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

// ── Devanagari to Latin (Hinglish) Transliterator ───────────────────
const DEVANAGARI_CONSONANTS = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n',
  'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'n',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
  'क्ष': 'ksh', 'त्र': 'tr', 'ज्ञ': 'gy'
};

const DEVANAGARI_VOWELS = {
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au'
};

const DEVANAGARI_MATRAS = {
  'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
  'ं': 'n', 'ः': 'h', 'ँ': 'n'
};

const transliterateDevanagari = (text) => {
  if (!text) return '';
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (DEVANAGARI_CONSONANTS[char]) {
      let base = DEVANAGARI_CONSONANTS[char];
      if (nextChar && DEVANAGARI_MATRAS[nextChar]) {
        result += base + DEVANAGARI_MATRAS[nextChar];
        i++; // skip matra
      } else if (nextChar === '्') {
        result += base;
        i++; // skip halant
      } else {
        // Inherent 'a' sound unless followed by a space, punctuation, or end of string (schwa deletion)
        const isEndOfWord = !nextChar || /[\s\p{P}]/u.test(nextChar);
        if (isEndOfWord) {
          result += base;
        } else {
          result += base + 'a';
        }
      }
    } else if (DEVANAGARI_VOWELS[char]) {
      result += DEVANAGARI_VOWELS[char];
    } else if (DEVANAGARI_MATRAS[char]) {
      result += DEVANAGARI_MATRAS[char];
    } else if (char === '्') {
      // ignore standalone halant
    } else {
      result += char;
    }
  }
  return result;
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
  const filteredVoices = (voices || []).filter(v => v && !isArabicVoice(v) && isAllowedVoice(v));
  for (const target of priorityList) {
    // Try exact name match first
    const byName = filteredVoices.find(v => v.name === target || (v.name && v.name.toLowerCase() === String(target).toLowerCase()));
    if (byName) return byName;
    
    // Try partial name match
    const byPartial = filteredVoices.find(v => v.name && v.name.toLowerCase().includes(String(target).toLowerCase()));
    if (byPartial) return byPartial;
    
    // Try lang match (handles 'en', 'en-IN', 'hi', 'hi-IN', etc.)
    const tLower = String(target).toLowerCase();
    const byLang = filteredVoices.find(v => {
      const lang = (v.lang || '').toLowerCase();
      return lang === tLower || lang.startsWith(tLower + '-') || lang.startsWith(tLower);
    });
    if (byLang) return byLang;
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

/**
 * Break long text into sentence-level chunks for smoother delivery.
 * Prevents the "buffering pause" that makes TTS sound robotic.
 * 
 * Splits on:  . ! ? । , ; : — (sentence & clause boundaries)
 * This aggressive splitting ensures Hinglish auto-detection works
 * per-clause, not just per-paragraph.
 */
const chunkText = (text, maxLen = 150) => {
  if (text.length <= maxLen) return [text];
  
  const chunks = [];
  // Split on sentence AND clause boundaries (period, comma, semicolon, colon, dash, Hindi danda)
  const sentences = text.split(/(?<=[.!?।;:,—–])\s+/);
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
  
  // Filter out empty/whitespace-only chunks
  return chunks.filter(c => c.length > 0);
};

// ── Main Speak Function ─────────────────────────────────────────────

let audioContext = null;
let currentPlayingAudio = null;

/**
 * Play audio through Web Audio API with a cinematic metallic J.A.R.V.I.S. filter.
 * 
 * 8-Stage Premium Audio Pipeline:
 * ┌─────────┐   ┌──────────┐   ┌───────────┐   ┌────────────┐   ┌──────────┐
 * │ Source  │──▶│ Highpass │──▶│ Low Shelf │──▶│ Mid Peak 1 │──▶│Mid Peak 2│
 * └─────────┘   │ 120 Hz   │   │ +3dB@280 │   │ +5dB@1.8k  │   │+4dB@3.2k │
 *               └──────────┘   └───────────┘   └────────────┘   └──────────┘
 *                                                                     │
 *  ┌────────────┐   ┌────────────┐   ┌───────────────┐   ┌───────────┘
 *  │ Master Out │◀──│ Compressor │◀──│ Delay Mix     │◀──│ Presence   │
 *  │  Gain 1.4  │   │ Broadcast  │   │ Dry + 35ms    │   │ +3dB@4.5k  │
 *  └────────────┘   └────────────┘   │ Wet at 15%    │   │ HiShelf -6 │
 *                                    └───────────────┘   └────────────┘
 */
const playAudioWithJarvisFilter = (url, isHindi, ttsEnabledRef) => {
  return new Promise((resolve) => {
    // Stop any existing audio first
    if (currentPlayingAudio) {
      currentPlayingAudio.pause();
      currentPlayingAudio.src = "";
    }

    const audio = new Audio(url);
    audio.crossOrigin = "anonymous";
    currentPlayingAudio = audio;

    // Playback rate tuning:
    //   Hindi:    1.15 — natural, warm, conversational pace
    //   English:  1.22 — confident, crisp, professional pace
    audio.playbackRate = isHindi ? 1.15 : 1.22;

    audio.onended = () => {
      if (currentPlayingAudio === audio) currentPlayingAudio = null;
      resolve();
    };

    audio.onerror = (e) => {
      console.warn("[VoiceEngine] Premium audio playback failed:", e);
      if (currentPlayingAudio === audio) currentPlayingAudio = null;
      resolve();
    };

    try {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }

      if (audioContext.state === "suspended") {
        audioContext.resume();
      }

      const source = audioContext.createMediaElementSource(audio);
      const ctx = audioContext;

      // ═══════════════════════════════════════════════════════════
      //  STAGE 1: Highpass Filter — Remove sub-bass rumble
      //  Creates the "intercom / radio comms" foundation.
      //  120Hz is gentler than before, keeping vocal warmth.
      // ═══════════════════════════════════════════════════════════
      const highpass = ctx.createBiquadFilter();
      highpass.type = "highpass";
      highpass.frequency.value = 120;
      highpass.Q.value = 0.7; // Butterworth — smooth rolloff

      // ═══════════════════════════════════════════════════════════
      //  STAGE 2: Low Shelf — Add chest/body warmth
      //  A subtle +3dB boost below 280Hz gives the voice weight
      //  and prevents the highpass from making it thin.
      // ═══════════════════════════════════════════════════════════
      const lowShelf = ctx.createBiquadFilter();
      lowShelf.type = "lowshelf";
      lowShelf.frequency.value = 280;
      lowShelf.gain.value = isHindi ? 3.5 : 2.5; // Hindi gets warmer body

      // ═══════════════════════════════════════════════════════════
      //  STAGE 3: Mid Resonance Peak 1 — Metallic "suit" tone
      //  A peaking EQ at 1.8kHz with moderate Q creates the
      //  distinctive metallic resonance of Jarvis in the helmet.
      // ═══════════════════════════════════════════════════════════
      const midPeak1 = ctx.createBiquadFilter();
      midPeak1.type = "peaking";
      midPeak1.frequency.value = 1800;
      midPeak1.Q.value = 1.8;
      midPeak1.gain.value = 5; // Strong metallic ring

      // ═══════════════════════════════════════════════════════════
      //  STAGE 4: Mid Resonance Peak 2 — Upper harmonic shimmer
      //  A second, lighter peak at 3.2kHz adds the "digital AI"
      //  shimmer. The dual-peak creates that unmistakable Jarvis
      //  character — one peak alone sounds like a phone call.
      // ═══════════════════════════════════════════════════════════
      const midPeak2 = ctx.createBiquadFilter();
      midPeak2.type = "peaking";
      midPeak2.frequency.value = 3200;
      midPeak2.Q.value = 2.0;
      midPeak2.gain.value = 4;

      // ═══════════════════════════════════════════════════════════
      //  STAGE 5: Presence Boost — Speech clarity & intelligibility
      //  A gentle lift at 4.5kHz makes consonants crisp and clear
      //  without being harsh. Critical for "sir" sounding premium.
      // ═══════════════════════════════════════════════════════════
      const presence = ctx.createBiquadFilter();
      presence.type = "peaking";
      presence.frequency.value = 4500;
      presence.Q.value = 1.0;
      presence.gain.value = 3;

      // ═══════════════════════════════════════════════════════════
      //  STAGE 6: High Shelf Rolloff — Smooth out harshness
      //  Cuts frequencies above 9kHz by -6dB to remove sibilance
      //  and digital artifacts. Makes the voice feel "enclosed"
      //  in a premium helmet/HUD environment.
      // ═══════════════════════════════════════════════════════════
      const hiShelf = ctx.createBiquadFilter();
      hiShelf.type = "highshelf";
      hiShelf.frequency.value = 9000;
      hiShelf.gain.value = -6;

      // ═══════════════════════════════════════════════════════════
      //  STAGE 7: Slapback Delay — "Inside the suit" spatial feel
      //  A very short delay (35ms) mixed at low volume creates
      //  the impression of sound bouncing inside a metal helmet.
      //  The dry signal stays dominant; the wet is just a ghost.
      // ═══════════════════════════════════════════════════════════
      const dryGain = ctx.createGain();
      dryGain.gain.value = 1.0; // Full volume dry signal

      const wetGain = ctx.createGain();
      wetGain.gain.value = 0.15; // 15% wet — subtle spatial cue

      const delayNode = ctx.createDelay(0.1);
      delayNode.delayTime.value = 0.035; // 35ms slapback

      // Feedback filter on delay — darken the echo so it sits behind
      const delayFilter = ctx.createBiquadFilter();
      delayFilter.type = "lowpass";
      delayFilter.frequency.value = 2200; // Muffled echo

      // Merge node to combine dry + wet
      const merger = ctx.createGain();
      merger.gain.value = 1.0;

      // ═══════════════════════════════════════════════════════════
      //  STAGE 8: Dynamics Compressor — Broadcast-quality leveling
      //  Evens out volume spikes and dips, giving the voice that
      //  consistent "news anchor / AI announcement" power.
      // ═══════════════════════════════════════════════════════════
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-24, ctx.currentTime);
      compressor.knee.setValueAtTime(12, ctx.currentTime);
      compressor.ratio.setValueAtTime(4, ctx.currentTime);
      compressor.attack.setValueAtTime(0.003, ctx.currentTime);
      compressor.release.setValueAtTime(0.15, ctx.currentTime);

      // ═══════════════════════════════════════════════════════════
      //  MASTER GAIN — Final output level
      // ═══════════════════════════════════════════════════════════
      const masterGain = ctx.createGain();
      masterGain.gain.value = 1.4;

      // ── CONNECT THE CHAIN ──
      // Source → Highpass → LowShelf → MidPeak1 → MidPeak2 → Presence → HiShelf
      source.connect(highpass);
      highpass.connect(lowShelf);
      lowShelf.connect(midPeak1);
      midPeak1.connect(midPeak2);
      midPeak2.connect(presence);
      presence.connect(hiShelf);

      // HiShelf splits into dry path and wet (delay) path
      hiShelf.connect(dryGain);
      hiShelf.connect(delayNode);

      // Delay → DarkenFilter → WetGain
      delayNode.connect(delayFilter);
      delayFilter.connect(wetGain);

      // Both paths merge
      dryGain.connect(merger);
      wetGain.connect(merger);

      // Merger → Compressor → MasterGain → Output
      merger.connect(compressor);
      compressor.connect(masterGain);
      masterGain.connect(ctx.destination);

    } catch (err) {
      console.warn("[VoiceEngine] Web Audio API failed to configure, playing clean audio:", err);
    }

    // Double check if TTS was disabled while initializing
    if (ttsEnabledRef && !ttsEnabledRef.current) {
      audio.pause();
      audio.src = "";
      if (currentPlayingAudio === audio) currentPlayingAudio = null;
      resolve();
      return;
    }

    audio.play().catch((err) => {
      console.error("[VoiceEngine] Audio play failed:", err);
      resolve();
    });
  });
};

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

  // ── Premium Movie Jarvis Mode (Server-side Google TTS + Web Audio Filter) ──
  if (voicePreset === 'ironman_hi' || voicePreset === 'ironman_en' || voicePreset === 'ironman_hinglish') {
    const chunks = chunkText(cleaned);
    
    for (let i = 0; i < chunks.length; i++) {
      if (ttsEnabledRef && !ttsEnabledRef.current) {
        if (currentPlayingAudio) {
          currentPlayingAudio.pause();
          currentPlayingAudio.src = "";
          currentPlayingAudio = null;
        }
        return;
      }
      
      // For Hinglish: auto-detect language per chunk
      // For pure Hindi/English: use fixed lang
      let langCode;
      if (voicePreset === 'ironman_hinglish') {
        const chunkLang = detectLanguage(chunks[i]);
        langCode = chunkLang === 'hi-IN' ? 'hi' : 'en';
      } else {
        langCode = voicePreset === 'ironman_hi' ? 'hi' : 'en';
      }
      
      const isHindiChunk = langCode === 'hi';
      const chunkTextEncoded = encodeURIComponent(chunks[i]);
      const audioUrl = `${API_BASE_URL}/api/tts/google?lang=${langCode}&text=${chunkTextEncoded}`;
      
      await playAudioWithJarvisFilter(audioUrl, isHindiChunk, ttsEnabledRef);
    }
    return;
  }
  
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
  
  // Check if Hindi voices are available on the user's system
  const hasHindiVoice = voices.some(v => v.lang && v.lang.toLowerCase().startsWith('hi'));
  
  let processedText = cleaned;
  if (isHindi && !hasHindiVoice) {
    processedText = transliterateDevanagari(cleaned);
  }
  
  // Chunk long text for smoother delivery
  const chunks = chunkText(processedText);
  
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
        const fallbackVoice = !hindiVoice ? findBestVoice(REALJARVIS_VOICE_PRIORITY, voices) : null;
        if (hindiVoice) utterance.voice = hindiVoice;
        else if (fallbackVoice) utterance.voice = fallbackVoice;
        utterance.lang = hindiVoice?.lang || fallbackVoice?.lang || 'hi-IN';
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
          || voices.find(v => v.lang && v.lang.toLowerCase().startsWith('hi-in'))
          || voices.find(v => v.lang && v.lang.toLowerCase().startsWith('hi'));
        // Fallback to a generic English voice if no Hindi voice found
        const fallbackVoice = !ironHindiVoice ? findBestVoice(JARVIS_VOICE_PRIORITY, voices) : null;
        if (ironHindiVoice) utterance.voice = ironHindiVoice;
        else if (fallbackVoice) utterance.voice = fallbackVoice;
        utterance.lang = ironHindiVoice?.lang || fallbackVoice?.lang || 'hi-IN';
        // Reduced rate for better comprehension
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1;
      } else if (voicePreset === 'jarvis') {
        // ── J.A.R.V.I.S. Mode ──
        // Polished Indian English accent, confident, fast, and natural.
        // Real-sounding delivery with strong volume and clear tone.
        const jarvisVoice = isHindi
          ? findBestVoice(HINDI_VOICE_PRIORITY, voices) || findBestVoice(JARVIS_VOICE_PRIORITY, voices)
          : findBestVoice(JARVIS_VOICE_PRIORITY, voices);
        // Fallback to English voice if still null
        const finalJarvisVoice = jarvisVoice || findBestVoice(JARVIS_VOICE_PRIORITY, voices);
        if (finalJarvisVoice) utterance.voice = finalJarvisVoice;
        utterance.lang = finalJarvisVoice?.lang || (isHindi ? 'hi-IN' : 'en-IN');
        utterance.rate = 1.3;
        utterance.pitch = 1.1;
        utterance.volume = 1;
      } else if (voicePreset === 'default') {
        // ── Default Mode ──
        // Force English voice for professional English output
        const englishVoice = findBestVoice(JARVIS_VOICE_PRIORITY, voices)
          || voices.find(v => v.lang && v.lang.toLowerCase().startsWith('en'));
        if (englishVoice) utterance.voice = englishVoice;
        utterance.lang = 'en-IN';
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
  if (currentPlayingAudio) {
    currentPlayingAudio.pause();
    currentPlayingAudio.src = "";
    currentPlayingAudio = null;
  }
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
export const testVoice = (preset = 'ironman_en', customVoiceUrl = '') => {
  const phrases = {
    ironman_en: "Welcome back, sir. All systems are fully operational, and I am ready for your command.",
    ironman_hi: "स्वागत है सर। सभी सिस्टम चालू हैं, और मैं आपके आदेशों के लिए तैयार हूँ।",
    ironman_hinglish: "Welcome back sir. Aapke sabhi systems fully operational hain. Main aapke commands ke liye ready hoon."
  };
  const phrase = phrases[preset] || phrases['ironman_en'];
  return speak(phrase, { voicePreset: preset, customVoiceUrl });
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
