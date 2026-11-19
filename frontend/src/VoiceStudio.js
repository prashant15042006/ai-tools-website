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
    <div style={{
      position: "fixed",
      bottom: "80px",
      right: "20px",
      background: type === "error" ? "rgba(239,68,68,0.25)" : "rgba(6, 182, 212, 0.2)",
      border: `1px solid ${type === "error" ? "rgba(239,68,68,0.5)" : "rgba(6, 182, 212, 0.5)"}`,
      color: type === "error" ? "#f87171" : "#e0f7fa",
      padding: "14px 20px",
      borderRadius: "14px",
      fontSize: "14px",
      fontWeight: "600",
      backdropFilter: "blur(16px)",
      zIndex: 9999,
      boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
      maxWidth: "340px",
      lineHeight: "1.5",
    }}>
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
    <div className="page-view" style={{
      maxWidth: "900px",
      margin: "0 auto",
      padding: "24px 28px",
      minHeight: "100vh",
      backgroundImage: "radial-gradient(rgba(99, 102, 241, 0.08) 1.5px, transparent 1.5px)",
      backgroundSize: "24px 24px",
    }}>
      {/* ── HEADER ── */}
      <div style={{ marginBottom: "28px" }}>
        <h2 style={{
          fontSize: "32px",
          fontWeight: "800",
          background: "linear-gradient(135deg, #a855f7, #6366f1, #06b6d4)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          marginBottom: "6px",
          letterSpacing: "-0.5px",
          filter: "drop-shadow(0 2px 10px rgba(99, 102, 241, 0.25))",
        }}>
          🎙️ AI Voice Studio
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <CheckCircle2 size={15} color="#4ade80" />
          <p style={{ color: "#4ade80", fontSize: "13px", fontWeight: "600", margin: 0 }}>
            Powered by HeyGen Voice 1 Turbo • Free via OpenRouter • Natural Neural Voice Synthesis
          </p>
        </div>
      </div>

      {/* ── MAIN PANEL ── */}
      <div style={{
        background: "rgba(11, 14, 26, 0.55)",
        backdropFilter: "blur(24px)",
        border: "1px solid rgba(99, 102, 241, 0.25)",
        borderRadius: "24px",
        padding: "28px",
        display: "flex",
        flexDirection: "column",
        gap: "22px",
        boxShadow: "0 10px 40px rgba(0, 0, 0, 0.35), inset 0 0 20px rgba(99, 102, 241, 0.05)",
        marginBottom: "24px",
      }}>

        {/* Voice Selector */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <label style={{ fontSize: "12px", fontWeight: "800", color: "#a855f7", textTransform: "uppercase", letterSpacing: "0.8px" }}>
            🎤 Select Voice
          </label>
          <button
            onClick={() => setShowVoices(v => !v)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "rgba(0,0,0,0.3)", border: "1px solid rgba(99, 102, 241, 0.3)",
              borderRadius: "14px", padding: "12px 16px", color: "#e5e7eb",
              fontSize: "14px", fontWeight: "600", cursor: "pointer", width: "100%",
              transition: "all 0.2s",
            }}
          >
            <span>{selectedVoiceLabel}</span>
            {showVoices ? <ChevronUp size={16} color="#a855f7" /> : <ChevronDown size={16} color="#a855f7" />}
          </button>

          {showVoices && (
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px",
              padding: "12px", background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(99, 102, 241, 0.2)", borderRadius: "14px",
            }}>
              {VOICE_OPTIONS.map(v => (
                <button
                  key={v.id}
                  onClick={() => { setVoice(v.id); setShowVoices(false); }}
                  style={{
                    padding: "10px 14px", borderRadius: "12px", cursor: "pointer",
                    textAlign: "left", transition: "all 0.2s",
                    background: voice === v.id ? "rgba(99, 102, 241, 0.2)" : "rgba(255,255,255,0.03)",
                    border: voice === v.id ? "2px solid rgba(99, 102, 241, 0.8)" : "1px solid rgba(255,255,255,0.06)",
                    color: voice === v.id ? "#a5b4fc" : "#d1d5db",
                    fontSize: "13px", fontWeight: "600",
                  }}
                >
                  <div>{v.label}</div>
                  <div style={{ fontSize: "10px", color: "#9ca3af", marginTop: "2px" }}>{v.desc}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Text Input */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
            <label style={{ fontSize: "12px", fontWeight: "800", color: "#a855f7", textTransform: "uppercase", letterSpacing: "0.8px" }}>
              ✍️ Text to Convert
            </label>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span style={{
                fontSize: "11px", color: charCount > 1800 ? "#f87171" : "#9ca3af",
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: "999px", padding: "4px 10px",
              }}>
                {charCount}/2000 chars
              </span>
              {text.trim() && (
                <button onClick={handleCopyText} style={{
                  background: "rgba(99, 102, 241, 0.1)", border: "1px solid rgba(99, 102, 241, 0.3)",
                  color: "#a5b4fc", borderRadius: "10px", padding: "5px 10px",
                  fontSize: "11px", fontWeight: "700", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: "4px",
                }}>
                  <Copy size={11} /> Copy
                </button>
              )}
              {text.trim() && (
                <button onClick={() => setText("")} style={{
                  background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)",
                  color: "#f87171", borderRadius: "10px", padding: "5px 10px",
                  fontSize: "11px", fontWeight: "700", cursor: "pointer",
                }}>
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
            style={{
              width: "100%", boxSizing: "border-box",
              background: "rgba(0, 0, 0, 0.35)", border: "1px solid rgba(99, 102, 241, 0.25)",
              borderRadius: "16px", padding: "14px 16px", color: "#f3f4f6",
              fontSize: "14px", lineHeight: "1.7", resize: "vertical", outline: "none",
              fontFamily: "Outfit, Inter, sans-serif", transition: "all 0.2s",
            }}
            onFocus={e => { e.target.style.borderColor = "rgba(99, 102, 241, 0.8)"; e.target.style.boxShadow = "0 0 0 2px rgba(99, 102, 241, 0.15)"; }}
            onBlur={e => { e.target.style.borderColor = "rgba(99, 102, 241, 0.25)"; e.target.style.boxShadow = "none"; }}
          />

          {/* Quick Text Chips */}
          <div>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "#9ca3af", marginBottom: "6px" }}>
              💡 Quick Examples:
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {QUICK_TEXTS.map((t, i) => (
                <button
                  key={i}
                  onClick={() => setText(t)}
                  style={{
                    background: "rgba(99, 102, 241, 0.06)", border: "1px solid rgba(99, 102, 241, 0.2)",
                    borderRadius: "20px", padding: "5px 12px", fontSize: "11px", color: "#94a3b8",
                    cursor: "pointer", transition: "all 0.2s", fontWeight: "500",
                  }}
                  onMouseEnter={e => { e.target.style.background = "rgba(99, 102, 241, 0.15)"; e.target.style.color = "#a5b4fc"; }}
                  onMouseLeave={e => { e.target.style.background = "rgba(99, 102, 241, 0.06)"; e.target.style.color = "#94a3b8"; }}
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
          style={{
            background: loading || !text.trim() ? "rgba(99, 102, 241, 0.25)" : "linear-gradient(135deg, #a855f7, #6366f1)",
            color: "white", border: "none", padding: "16px 20px",
            borderRadius: "16px", fontWeight: "800", fontSize: "16px",
            cursor: loading || !text.trim() ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
            transition: "all 0.2s", boxShadow: loading ? "none" : "0 6px 28px rgba(99, 102, 241, 0.4)",
          }}
        >
          {loading ? (
            <><RefreshCw size={19} style={{ animation: "spin 0.8s linear infinite" }} /> Synthesizing Voice...</>
          ) : (
            <><Mic size={19} /> 🎙️ Generate Speech</>
          )}
        </button>
      </div>

      {/* ── AUDIO PLAYER ── */}
      {audioDataUrl && (
        <div style={{
          background: "rgba(11, 14, 26, 0.55)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(99, 102, 241, 0.3)",
          borderRadius: "24px",
          padding: "28px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.35), 0 0 20px rgba(99, 102, 241, 0.1)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "48px", height: "48px", borderRadius: "50%",
              background: "linear-gradient(135deg, #a855f7, #6366f1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 20px rgba(99, 102, 241, 0.4)",
            }}>
              <Volume2 size={22} color="white" />
            </div>
            <div>
              <div style={{ fontSize: "15px", fontWeight: "700", color: "#e5e7eb" }}>Audio Ready</div>
              <div style={{ fontSize: "12px", color: "#a855f7", fontWeight: "600" }}>
                HeyGen Voice 1 Turbo • {VOICE_OPTIONS.find(v => v.id === voice)?.label || voice}
              </div>
            </div>
          </div>

          {/* Native Audio Player */}
          <audio
            ref={audioRef}
            src={audioDataUrl}
            controls
            style={{ width: "100%", borderRadius: "12px", outline: "none" }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
          />

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button
              onClick={handlePlay}
              style={{
                background: isPlaying ? "rgba(239, 68, 68, 0.15)" : "rgba(99, 102, 241, 0.15)",
                border: `1px solid ${isPlaying ? "rgba(239, 68, 68, 0.4)" : "rgba(99, 102, 241, 0.4)"}`,
                color: isPlaying ? "#f87171" : "#a5b4fc",
                padding: "10px 20px", borderRadius: "12px", fontSize: "13px",
                fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px",
              }}
            >
              {isPlaying ? <><Square size={14} /> Stop</> : <><Play size={14} /> Play</>}
            </button>
            <button
              onClick={handleDownload}
              style={{
                background: "linear-gradient(135deg, #a855f7, #6366f1)",
                border: "none", color: "white",
                padding: "10px 20px", borderRadius: "12px", fontSize: "13px",
                fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px",
                boxShadow: "0 4px 15px rgba(99, 102, 241, 0.4)",
              }}
            >
              <Download size={14} /> Download MP3
            </button>
            <button
              onClick={synthesize}
              disabled={loading}
              style={{
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#9ca3af", padding: "10px 20px", borderRadius: "12px",
                fontSize: "13px", fontWeight: "700", cursor: "pointer",
                display: "flex", alignItems: "center", gap: "8px",
              }}
            >
              <RefreshCw size={14} /> Re-generate
            </button>
          </div>

          {/* Text Preview */}
          <div style={{
            padding: "12px 16px", background: "rgba(0,0,0,0.25)",
            border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px",
            fontSize: "13px", color: "#9ca3af", lineHeight: "1.6",
          }}>
            <strong style={{ color: "#d1d5db" }}>Synthesized text: </strong>
            <em>"{text.trim().slice(0, 120)}{text.trim().length > 120 ? "..." : ""}"</em>
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div style={{
        marginTop: "20px",
        padding: "14px 18px",
        background: "rgba(99, 102, 241, 0.06)",
        border: "1px solid rgba(99, 102, 241, 0.2)",
        borderRadius: "14px",
        fontSize: "12px",
        color: "#9ca3af",
        lineHeight: "1.6",
      }}>
        <Sparkles size={13} style={{ display: "inline", marginRight: "6px", color: "#a855f7" }} />
        <strong style={{ color: "#a5b4fc" }}>HeyGen Voice 1 Turbo</strong> — Neural TTS model via OpenRouter.
        Supports multiple languages & voice styles. Free tier available. Max 2000 chars per request.
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
