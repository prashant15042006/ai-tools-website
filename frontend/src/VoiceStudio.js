import React, { useState, useRef, useEffect } from "react";
import {
  Mic,
  Volume2,
  Play,
  Square,
  Download,
  RefreshCw,
  Sparkles,
  Copy,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import API_BASE_URL from "./apiConfig";

// ============================================================
// 🎙️ VOICE STUDIO — HeyGen Voice TTS (heygen-voice-1-turbo:free)
//    via OpenRouter → Backend /api/tts/heygen
// ============================================================

const VOICE_OPTIONS = [
  { id: "nadine", label: "👩 Nadine (Natural Female - Recommended)", desc: "Clear, warm & natural tone" },
  { id: "tabitha", label: "👩 Tabitha (Expressive Female)", desc: "Vibrant & engaging voice" },
  { id: "bram", label: "👨 Bram (Deep Male)", desc: "Deep, rich & cinematic voice" },
  { id: "gareth", label: "👨 Gareth (Professional Male)", desc: "Polished & authoritative tone" },
  { id: "noelle", label: "👩 Noelle (Soft Female)", desc: "Gentle, friendly & conversational" },
  { id: "meredith", label: "👩 Meredith (Storyteller Female)", desc: "Calm, narrative & audiobook style" },
  { id: "sabrina", label: "👩 Sabrina (Energetic Female)", desc: "Enthusiastic & modern presentation" },
  { id: "lucian", label: "👨 Lucian (Corporate Male)", desc: "Commanding & executive presence" },
  { id: "weston", label: "👨 Weston (Casual Male)", desc: "Friendly, relaxed & approachable" },
  { id: "vincent", label: "👨 Vincent (Dynamic Male)", desc: "Bold, energetic & presenter style" },
];

const QUICK_TEXTS = [
  "Welcome to Nexuss AI — your intelligent AI workspace powered by cutting-edge technology.",
  "Artificial intelligence is transforming the world at an unprecedented pace.",
  "नमस्ते! मैं Nexuss AI हूं, आपका बुद्धिमान AI सहायक।",
  "The future belongs to those who learn, adapt, and innovate every single day.",
];

function Toast({ message, type }) {
  return (
    <div className={`vs-toast ${type === "error" ? "error" : "success"}`}>
      {message}
    </div>
  );
}

export default function VoiceStudio() {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("nadine");
  const [loading, setLoading] = useState(false);
  const [audioDataUrl, setAudioDataUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [toast, setToast] = useState(null);
  const [showVoices, setShowVoices] = useState(false);
  const [charCount, setCharCount] = useState(0);

  const audioRef = useRef(null);

  useEffect(() => {
    setCharCount(text.length);
  }, [text]);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const synthesize = async () => {
    const finalText = text.trim();
    if (!finalText) {
      showToast("Please enter some text to convert!", "error");
      return;
    }
    if (finalText.length > 2000) {
      showToast("Text is too long. Max 2000 characters.", "error");
      return;
    }

    setLoading(true);
    setAudioDataUrl(null);
    setIsPlaying(false);

    const endpoints = [];
    if (API_BASE_URL) endpoints.push(`${API_BASE_URL}/api/tts/heygen`);
    endpoints.push("/api/tts/heygen");

    let result = null;
    let lastError = null;

    for (const ep of endpoints) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 35000);
        const resp = await fetch(ep, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: finalText, voice }),
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (resp.ok) {
          const data = await resp.json();
          if (data.success) {
            result = data;
            break;
          } else {
            lastError = data.error || "Generation unsuccessful";
          }
        } else {
          const errData = await resp.json().catch(() => ({}));
          lastError = errData.error || `Server responded with ${resp.status}`;
        }
      } catch (e) {
        if (e.name === "AbortError") {
          lastError = "Request timed out. Please try again.";
        } else {
          lastError = e.message || "Network error";
          console.warn("HeyGen endpoint failed:", ep, e.message);
        }
      }
    }

    setLoading(false);

    if (result) {
      // Handle different response formats
      let dataUrl = null;
      if (result.dataUrl) {
        dataUrl = result.dataUrl;
      } else if (result.audio_b64) {
        const mime = result.mimeType || "audio/wav";
        dataUrl = `data:${mime};base64,${result.audio_b64}`;
      } else if (result.data?.url) {
        dataUrl = result.data.url;
      } else if (result.data?.b64) {
        dataUrl = `data:audio/wav;base64,${result.data.b64}`;
      }

      if (dataUrl) {
        setAudioDataUrl(dataUrl);
        showToast("🎙️ Audio synthesized! Click Play to listen.");
      } else {
        showToast("Could not extract audio from response.", "error");
      }
    } else {
      showToast(lastError || "Voice generation failed. Please try again.", "error");
    }
  };

  const handlePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleDownload = () => {
    if (!audioDataUrl) return;
    const a = document.createElement("a");
    a.href = audioDataUrl;
    a.download = `nexuss_voice_${Date.now()}.wav`;
    a.click();
    showToast("Audio downloaded! 📥");
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(text).then(() => showToast("Text copied! 📋")).catch(() => showToast("Copy failed.", "error"));
  };

  const selectedVoiceLabel = VOICE_OPTIONS.find(v => v.id === voice)?.label || voice;

  return (
    <div className="page-view vs-page">
      {/* ── HEADER ── */}
      <div className="vs-header">
        <h2 className="vs-title">
          🎙️ AI Voice Studio
        </h2>
        <div className="vs-badge-row">
          <CheckCircle2 size={15} className="vs-badge-icon" />
          <p className="vs-badge-text">
            Powered by HeyGen Voice 1 Turbo • Free via OpenRouter • Natural Neural Voice Synthesis
          </p>
        </div>
      </div>

      {/* ── MAIN PANEL ── */}
      <div className="vs-main-panel">
        {/* Voice Selector */}
        <div className="vs-control-group">
          <label className="vs-section-label">
            🎤 Select Voice
          </label>
          <button
            onClick={() => setShowVoices(v => !v)}
            className="vs-voice-selector-btn"
          >
            <span>{selectedVoiceLabel}</span>
            {showVoices ? <ChevronUp size={16} className="vs-chevron" /> : <ChevronDown size={16} className="vs-chevron" />}
          </button>

          {showVoices && (
            <div className="vs-voice-dropdown">
              {VOICE_OPTIONS.map(v => (
                <button
                  key={v.id}
                  onClick={() => { setVoice(v.id); setShowVoices(false); }}
                  className={`vs-voice-option ${voice === v.id ? "active" : ""}`}
                >
                  <div className="vs-voice-option-name">{v.label}</div>
                  <div className="vs-voice-option-desc">{v.desc}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Text Input */}
        <div className="vs-control-group">
          <div className="vs-textarea-header">
            <label className="vs-section-label">
              ✍️ Text to Convert
            </label>
            <div className="vs-textarea-actions">
              <span className={`vs-char-badge ${charCount > 1800 ? "warn" : ""}`}>
                {charCount}/2000 chars
              </span>
              {text.trim() && (
                <button onClick={handleCopyText} className="vs-action-btn vs-btn-copy">
                  <Copy size={11} /> Copy
                </button>
              )}
              {text.trim() && (
                <button onClick={() => setText("")} className="vs-action-btn vs-btn-clear">
                  Clear
                </button>
              )}
            </div>
          </div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Type or paste text here to convert to speech... e.g. Welcome to Nexuss AI!"
            rows={6}
            maxLength={2000}
            className="vs-textarea"
          />

          {/* Quick Text Chips */}
          <div>
            <div className="vs-examples-header">
              💡 Quick Examples:
            </div>
            <div className="vs-examples-chips">
              {QUICK_TEXTS.map((t, i) => (
                <button
                  key={i}
                  onClick={() => setText(t)}
                  className="vs-example-chip"
                >
                  {t.length > 36 ? t.slice(0, 34) + "…" : t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={synthesize}
          disabled={loading || !text.trim()}
          className={`vs-generate-btn ${loading || !text.trim() ? "disabled" : ""}`}
        >
          {loading ? (
            <><RefreshCw size={19} className="vs-spin-icon" /> Synthesizing Voice...</>
          ) : (
            <><Mic size={19} /> 🎙️ Generate Speech</>
          )}
        </button>
      </div>

      {/* ── AUDIO PLAYER ── */}
      {audioDataUrl && (
        <div className="vs-audio-card">
          <div className="vs-audio-header">
            <div className="vs-audio-icon-wrap">
              <Volume2 size={22} color="white" />
            </div>
            <div>
              <div className="vs-audio-title">Audio Ready</div>
              <div className="vs-audio-subtitle">
                HeyGen Voice 1 Turbo • {VOICE_OPTIONS.find(v => v.id === voice)?.label || voice}
              </div>
            </div>
          </div>

          {/* Native Audio Player */}
          <audio
            ref={audioRef}
            src={audioDataUrl}
            controls
            className="vs-native-audio"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
          />

          {/* Action Buttons */}
          <div className="vs-audio-actions">
            <button
              onClick={handlePlay}
              className={`vs-audio-btn vs-audio-btn-play ${isPlaying ? "playing" : ""}`}
            >
              {isPlaying ? <><Square size={14} /> Stop</> : <><Play size={14} /> Play</>}
            </button>
            <button
              onClick={handleDownload}
              className="vs-audio-btn vs-audio-btn-download"
            >
              <Download size={14} /> Download MP3
            </button>
            <button
              onClick={synthesize}
              disabled={loading}
              className="vs-audio-btn vs-audio-btn-regen"
            >
              <RefreshCw size={14} /> Re-generate
            </button>
          </div>

          {/* Text Preview */}
          <div className="vs-audio-preview">
            <strong>Synthesized text: </strong>
            <em>"{text.trim().slice(0, 120)}{text.trim().length > 120 ? "..." : ""}"</em>
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="vs-info-banner">
        <Sparkles size={13} className="vs-info-icon" />
        <strong>HeyGen Voice 1 Turbo</strong> — Neural TTS model via OpenRouter.
        Supports multiple languages & voice styles. Free tier available. Max 2000 chars per request.
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}

      <style>{`
        /* ============================================================
           VOICE STUDIO DEFAULT (DARK) & LIGHT-MODE STYLES
           ============================================================ */
        .vs-page {
          max-width: 900px;
          margin: 0 auto;
          padding: 24px 28px;
          min-height: 100vh;
          background-image: radial-gradient(rgba(99, 102, 241, 0.08) 1.5px, transparent 1.5px);
          background-size: 24px 24px;
        }

        .vs-header {
          margin-bottom: 28px;
        }

        .vs-title {
          font-size: 32px;
          font-weight: 800;
          background: linear-gradient(135deg, #a855f7, #6366f1, #06b6d4);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 6px;
          letter-spacing: -0.5px;
          filter: drop-shadow(0 2px 10px rgba(99, 102, 241, 0.25));
        }

        .vs-badge-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .vs-badge-icon {
          color: #4ade80;
        }

        .vs-badge-text {
          color: #4ade80;
          font-size: 13px;
          font-weight: 600;
          margin: 0;
        }

        .vs-main-panel {
          background: rgba(11, 14, 26, 0.55);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(99, 102, 241, 0.25);
          border-radius: 24px;
          padding: 28px;
          display: flex;
          flex-direction: column;
          gap: 22px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.35), inset 0 0 20px rgba(99, 102, 241, 0.05);
          margin-bottom: 24px;
          transition: all 0.2s ease;
        }

        .vs-control-group {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .vs-section-label {
          font-size: 12px;
          font-weight: 800;
          color: #a855f7;
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }

        .vs-voice-selector-btn {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(99, 102, 241, 0.3);
          border-radius: 14px;
          padding: 12px 16px;
          color: #e5e7eb;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          width: 100%;
          transition: all 0.2s ease;
        }
        .vs-voice-selector-btn:hover {
          border-color: rgba(99, 102, 241, 0.6);
          background: rgba(0, 0, 0, 0.45);
        }

        .vs-chevron {
          color: #a855f7;
        }

        .vs-voice-dropdown {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          padding: 12px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 14px;
        }

        .vs-voice-option {
          padding: 10px 14px;
          border-radius: 12px;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s ease;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          color: #d1d5db;
          font-size: 13px;
          font-weight: 600;
        }
        .vs-voice-option:hover:not(.active) {
          background: rgba(255, 255, 255, 0.07);
          border-color: rgba(99, 102, 241, 0.4);
        }
        .vs-voice-option.active {
          background: rgba(99, 102, 241, 0.2);
          border: 2px solid rgba(99, 102, 241, 0.8);
          color: #a5b4fc;
        }

        .vs-voice-option-name {
          font-weight: 600;
        }
        .vs-voice-option-desc {
          font-size: 10px;
          color: #9ca3af;
          margin-top: 2px;
        }

        .vs-textarea-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 8px;
        }

        .vs-textarea-actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .vs-char-badge {
          font-size: 11px;
          color: #9ca3af;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 999px;
          padding: 4px 10px;
          font-weight: 500;
        }
        .vs-char-badge.warn {
          color: #f87171;
        }

        .vs-action-btn {
          border-radius: 10px;
          padding: 5px 10px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: all 0.2s ease;
        }
        .vs-btn-copy {
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid rgba(99, 102, 241, 0.3);
          color: #a5b4fc;
        }
        .vs-btn-copy:hover {
          background: rgba(99, 102, 241, 0.2);
        }
        .vs-btn-clear {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: #f87171;
        }
        .vs-btn-clear:hover {
          background: rgba(239, 68, 68, 0.2);
        }

        .vs-textarea {
          width: 100%;
          box-sizing: border-box;
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid rgba(99, 102, 241, 0.25);
          border-radius: 16px;
          padding: 14px 16px;
          color: #f3f4f6;
          font-size: 14px;
          line-height: 1.7;
          resize: vertical;
          outline: none;
          font-family: 'Outfit', 'Inter', sans-serif;
          transition: all 0.2s ease;
        }
        .vs-textarea:focus {
          border-color: rgba(99, 102, 241, 0.8);
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
        }

        .vs-examples-header {
          font-size: 11px;
          font-weight: 700;
          color: #9ca3af;
          margin-bottom: 6px;
        }

        .vs-examples-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .vs-example-chip {
          background: rgba(99, 102, 241, 0.06);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 20px;
          padding: 5px 12px;
          font-size: 11px;
          color: #94a3b8;
          cursor: pointer;
          transition: all 0.2s ease;
          font-weight: 500;
          font-family: inherit;
        }
        .vs-example-chip:hover {
          background: rgba(99, 102, 241, 0.15);
          color: #a5b4fc;
        }

        .vs-generate-btn {
          background: linear-gradient(135deg, #a855f7, #6366f1);
          color: white;
          border: none;
          padding: 16px 20px;
          border-radius: 16px;
          font-weight: 800;
          font-size: 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: all 0.2s ease;
          box-shadow: 0 6px 28px rgba(99, 102, 241, 0.4);
          font-family: inherit;
        }
        .vs-generate-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 32px rgba(99, 102, 241, 0.5);
        }
        .vs-generate-btn.disabled,
        .vs-generate-btn:disabled {
          background: rgba(99, 102, 241, 0.25) !important;
          color: rgba(255, 255, 255, 0.5) !important;
          cursor: not-allowed;
          box-shadow: none !important;
          transform: none !important;
        }

        .vs-spin-icon {
          animation: spin 0.8s linear infinite;
        }

        .vs-audio-card {
          background: rgba(11, 14, 26, 0.55);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(99, 102, 241, 0.3);
          border-radius: 24px;
          padding: 28px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.35), 0 0 20px rgba(99, 102, 241, 0.1);
          margin-bottom: 24px;
          transition: all 0.2s ease;
        }

        .vs-audio-header {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .vs-audio-icon-wrap {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, #a855f7, #6366f1);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
          flex-shrink: 0;
        }

        .vs-audio-title {
          font-size: 15px;
          font-weight: 700;
          color: #e5e7eb;
        }

        .vs-audio-subtitle {
          font-size: 12px;
          color: #a855f7;
          font-weight: 600;
        }

        .vs-native-audio {
          width: 100%;
          border-radius: 12px;
          outline: none;
        }

        .vs-audio-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .vs-audio-btn {
          padding: 10px 20px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s ease;
          font-family: inherit;
        }
        .vs-audio-btn-play {
          background: rgba(99, 102, 241, 0.15);
          border: 1px solid rgba(99, 102, 241, 0.4);
          color: #a5b4fc;
        }
        .vs-audio-btn-play.playing {
          background: rgba(239, 68, 68, 0.15);
          border-color: rgba(239, 68, 68, 0.4);
          color: #f87171;
        }
        .vs-audio-btn-download {
          background: linear-gradient(135deg, #a855f7, #6366f1);
          border: none;
          color: white;
          box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
        }
        .vs-audio-btn-download:hover {
          box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
          transform: translateY(-1px);
        }
        .vs-audio-btn-regen {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #9ca3af;
        }
        .vs-audio-btn-regen:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.08);
          color: #e5e7eb;
        }

        .vs-audio-preview {
          padding: 12px 16px;
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          font-size: 13px;
          color: #9ca3af;
          line-height: 1.6;
        }
        .vs-audio-preview strong {
          color: #d1d5db;
        }

        .vs-info-banner {
          margin-top: 20px;
          padding: 14px 18px;
          background: rgba(99, 102, 241, 0.06);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 14px;
          font-size: 12px;
          color: #9ca3af;
          line-height: 1.6;
        }
        .vs-info-icon {
          display: inline;
          margin-right: 6px;
          color: #a855f7;
        }
        .vs-info-banner strong {
          color: #a5b4fc;
        }

        .vs-toast {
          position: fixed;
          bottom: 80px;
          right: 20px;
          padding: 14px 20px;
          border-radius: 14px;
          font-size: 14px;
          font-weight: 600;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          z-index: 9999;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
          max-width: 340px;
          line-height: 1.5;
          animation: slideUp 0.3s ease;
        }
        .vs-toast.success {
          background: rgba(6, 182, 212, 0.2);
          border: 1px solid rgba(6, 182, 212, 0.5);
          color: #e0f7fa;
        }
        .vs-toast.error {
          background: rgba(239, 68, 68, 0.25);
          border: 1px solid rgba(239, 68, 68, 0.5);
          color: #f87171;
        }

        /* ════════════════════════════════════════════════════════
           LIGHT MODE OVERRIDES FOR VOICE STUDIO
           ════════════════════════════════════════════════════════ */
        .light-mode .vs-page {
          background-image: radial-gradient(rgba(99, 102, 241, 0.12) 1.5px, transparent 1.5px) !important;
        }

        .light-mode .vs-title {
          background: linear-gradient(135deg, #1e1b4b 0%, #4338ca 40%, #7c3aed 100%) !important;
          -webkit-background-clip: text !important;
          -webkit-text-fill-color: transparent !important;
          filter: drop-shadow(0 2px 8px rgba(99, 102, 241, 0.15)) !important;
        }

        .light-mode .vs-badge-icon {
          color: #16a34a !important;
        }

        .light-mode .vs-badge-text {
          color: #15803d !important;
        }

        .light-mode .vs-main-panel {
          background: #ffffff !important;
          border: 1px solid #cbd5e1 !important;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.03) !important;
        }

        .light-mode .vs-section-label {
          color: #4f46e5 !important;
        }

        .light-mode .vs-voice-selector-btn {
          background: #f8fafc !important;
          border: 1px solid #cbd5e1 !important;
          color: #0f172a !important;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02) !important;
        }
        .light-mode .vs-voice-selector-btn:hover {
          background: #f1f5f9 !important;
          border-color: #94a3b8 !important;
        }
        .light-mode .vs-chevron {
          color: #6366f1 !important;
        }

        .light-mode .vs-voice-dropdown {
          background: #ffffff !important;
          border: 1px solid #cbd5e1 !important;
          box-shadow: 0 12px 36px rgba(0, 0, 0, 0.08) !important;
        }

        .light-mode .vs-voice-option {
          background: #f8fafc !important;
          border: 1px solid #e2e8f0 !important;
          color: #1e293b !important;
        }
        .light-mode .vs-voice-option:hover:not(.active) {
          background: #f1f5f9 !important;
          border-color: #cbd5e1 !important;
        }
        .light-mode .vs-voice-option.active {
          background: #ede9fe !important;
          border: 2px solid #7c3aed !important;
          color: #5b21b6 !important;
        }
        .light-mode .vs-voice-option-desc {
          color: #64748b !important;
        }
        .light-mode .vs-voice-option.active .vs-voice-option-desc {
          color: #6d28d9 !important;
        }

        .light-mode .vs-char-badge {
          background: #f1f5f9 !important;
          border: 1px solid #e2e8f0 !important;
          color: #64748b !important;
        }
        .light-mode .vs-char-badge.warn {
          background: #fef2f2 !important;
          border-color: #fecaca !important;
          color: #dc2626 !important;
        }

        .light-mode .vs-btn-copy {
          background: #f1f5f9 !important;
          border: 1px solid #cbd5e1 !important;
          color: #4338ca !important;
        }
        .light-mode .vs-btn-copy:hover {
          background: #e2e8f0 !important;
          color: #312e81 !important;
        }

        .light-mode .vs-btn-clear {
          background: #fef2f2 !important;
          border: 1px solid #fecaca !important;
          color: #dc2626 !important;
        }
        .light-mode .vs-btn-clear:hover {
          background: #fee2e2 !important;
        }

        .light-mode .vs-textarea {
          background: #ffffff !important;
          border: 1px solid #cbd5e1 !important;
          color: #0f172a !important;
        }
        .light-mode .vs-textarea::placeholder {
          color: #94a3b8 !important;
        }
        .light-mode .vs-textarea:focus {
          border-color: #6366f1 !important;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15) !important;
        }

        .light-mode .vs-examples-header {
          color: #64748b !important;
        }

        .light-mode .vs-example-chip {
          background: #f8fafc !important;
          border: 1px solid #cbd5e1 !important;
          color: #334155 !important;
        }
        .light-mode .vs-example-chip:hover {
          background: #ede9fe !important;
          border-color: #a78bfa !important;
          color: #5b21b6 !important;
        }

        .light-mode .vs-generate-btn {
          background: linear-gradient(135deg, #7c3aed, #4f46e5) !important;
          color: #ffffff !important;
          box-shadow: 0 6px 22px rgba(99, 102, 241, 0.35) !important;
        }
        .light-mode .vs-generate-btn:hover:not(:disabled) {
          box-shadow: 0 8px 28px rgba(99, 102, 241, 0.45) !important;
        }
        .light-mode .vs-generate-btn.disabled,
        .light-mode .vs-generate-btn:disabled {
          background: #e2e8f0 !important;
          color: #94a3b8 !important;
          box-shadow: none !important;
        }

        .light-mode .vs-audio-card {
          background: #ffffff !important;
          border: 1px solid #cbd5e1 !important;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.03) !important;
        }

        .light-mode .vs-audio-title {
          color: #0f172a !important;
        }

        .light-mode .vs-audio-subtitle {
          color: #6d28d9 !important;
        }

        .light-mode .vs-audio-btn-play {
          background: #ede9fe !important;
          border: 1px solid #c4b5fd !important;
          color: #5b21b6 !important;
        }
        .light-mode .vs-audio-btn-play:hover {
          background: #ddd6fe !important;
        }
        .light-mode .vs-audio-btn-play.playing {
          background: #fee2e2 !important;
          border-color: #fca5a5 !important;
          color: #dc2626 !important;
        }

        .light-mode .vs-audio-btn-regen {
          background: #f8fafc !important;
          border: 1px solid #cbd5e1 !important;
          color: #475569 !important;
        }
        .light-mode .vs-audio-btn-regen:hover:not(:disabled) {
          background: #f1f5f9 !important;
          color: #0f172a !important;
          border-color: #94a3b8 !important;
        }

        .light-mode .vs-audio-preview {
          background: #f8fafc !important;
          border: 1px solid #e2e8f0 !important;
          color: #475569 !important;
        }
        .light-mode .vs-audio-preview strong {
          color: #0f172a !important;
        }

        .light-mode .vs-info-banner {
          background: #f8fafc !important;
          border: 1px solid #cbd5e1 !important;
          color: #475569 !important;
        }
        .light-mode .vs-info-icon {
          color: #7c3aed !important;
        }
        .light-mode .vs-info-banner strong {
          color: #4338ca !important;
        }

        .light-mode .vs-toast {
          background: #0f172a !important;
          color: #ffffff !important;
          border: 1px solid #334155 !important;
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.25) !important;
        }
        .light-mode .vs-toast.success {
          background: #064e3b !important;
          border-color: #059669 !important;
          color: #ecfdf5 !important;
        }
        .light-mode .vs-toast.error {
          background: #991b1b !important;
          border-color: #dc2626 !important;
          color: #fef2f2 !important;
        }

        /* ── Responsive Mobile ── */
        @media (max-width: 640px) {
          .vs-page {
            padding: 16px 12px;
          }
          .vs-title {
            font-size: 24px;
          }
          .vs-main-panel,
          .vs-audio-card {
            padding: 20px 16px;
            border-radius: 18px;
          }
          .vs-voice-dropdown {
            grid-template-columns: 1fr;
          }
          .vs-audio-actions {
            flex-direction: column;
            width: 100%;
          }
          .vs-audio-btn {
            width: 100%;
            justify-content: center;
          }
        }

        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
