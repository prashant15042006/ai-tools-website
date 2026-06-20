import React, { useState } from "react";
import { Download, ImageIcon, Sparkles, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

// ── Load Puter.js from official CDN ────────────────────────
function loadPuter() {
  return new Promise((resolve, reject) => {
    // Already loaded
    if (window.puter && window.puter.ai) return resolve(window.puter);

    // Script already injected — wait for it
    const existing = document.getElementById("puter-script");
    if (existing) {
      let waited = 0;
      const poll = setInterval(() => {
        waited += 100;
        if (window.puter && window.puter.ai) { clearInterval(poll); resolve(window.puter); }
        if (waited > 10000) { clearInterval(poll); reject(new Error("Puter.js load timeout")); }
      }, 100);
      return;
    }

    const script = document.createElement("script");
    script.id = "puter-script";
    script.src = "https://js.puter.com/v2/";
    script.async = true;
    script.onload = () => {
      // Give puter a moment to initialise
      setTimeout(() => {
        if (window.puter && window.puter.ai) resolve(window.puter);
        else reject(new Error("puter.ai not found after load"));
      }, 500);
    };
    script.onerror = () => reject(new Error("Failed to load Puter.js"));
    document.head.appendChild(script);
  });
}

// ─────────────────────────────────────────────────────────────
//  Pollinations.ai — 100% FREE, No API key, No login needed
//  URL format: https://image.pollinations.ai/prompt/{text}
// ─────────────────────────────────────────────────────────────
function buildImageUrl(prompt, options = {}) {
  const {
    width  = 1024,
    height = 1024,
    model  = "flux",          // flux | turbo | dreamshaper | flux-realism
    seed   = Math.floor(Math.random() * 999999),
    nologo = true,
  } = options;

  const encoded = encodeURIComponent(prompt.trim());
  return `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&model=${model}&seed=${seed}&nologo=${nologo}&enhance=true`;
}

// ── Toast ──────────────────────────────────────────────────
function Toast({ message, type }) {
  return (
    <div style={{
      position: "fixed", bottom: "80px", right: "20px",
      background: type === "error"
        ? "rgba(239,68,68,0.15)"
        : "rgba(34,197,94,0.15)",
      border: `1px solid ${type === "error" ? "rgba(239,68,68,0.4)" : "rgba(34,197,94,0.4)"}`,
      color: type === "error" ? "#f87171" : "#4ade80",
      padding: "14px 20px", borderRadius: "14px",
      fontSize: "14px", fontWeight: "600",
      backdropFilter: "blur(12px)", zIndex: 9999,
      animation: "slideUp 0.3s ease-out",
      boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      maxWidth: "320px", lineHeight: "1.5"
    }}>
      {message}
    </div>
  );
}

// ── Model selector ─────────────────────────────────────────
const MODELS = [
  { id: "flux",          label: "⚡ Flux (Best Quality)"  },
  { id: "turbo",         label: "🚀 Turbo (Fastest)"      },
  { id: "flux-realism",  label: "📷 Flux Realism"         },
  { id: "dreamshaper",   label: "🎨 DreamShaper"          },
];

// ── Quick prompt suggestions ───────────────────────────────
const SUGGESTIONS = [
  "A futuristic city at sunset, neon lights, cyberpunk",
  "A cute cat sitting on a rainbow cloud, digital art",
  "Portrait of an astronaut on Mars, dramatic lighting",
  "A magical forest with glowing mushrooms and fireflies",
  "Abstract colorful waves, 4K ultra detailed",
];

// ══════════════════════════════════════════════════════════════
//  Main Component
// ══════════════════════════════════════════════════════════════
export default function ImageGenerator() {
  const [prompt, setPrompt]         = useState("");
  const [model, setModel]           = useState("flux");
  const [imageUrl, setImageUrl]     = useState(null);
  const [loading, setLoading]       = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [toast, setToast]           = useState(null);
  const [activeTab, setActiveTab]   = useState("generate");
  const [history, setHistory]       = useState([]);
  const [engine, setEngine]         = useState("pollinations");
  const [errorDetail, setErrorDetail] = useState(null);


  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Generate image with Pollinations AI ─────────────────
  const generateImagePollinations = () => {
    if (!prompt.trim()) {
      showToast("Please enter a prompt first!", "error");
      return;
    }

    const seed = Math.floor(Math.random() * 999999);
    const url  = buildImageUrl(prompt, { model, seed });

    setImageUrl(null);
    setLoadFailed(false);
    setLoading(true);

    // Pre-load the image
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;

    img.onload = () => {
      setImageUrl(url);
      setLoading(false);
      setHistory(prev =>
        [{ url, prompt: prompt.trim(), generator: "pollinations", model, seed, id: Date.now() }, ...prev].slice(0, 20)
      );
      setActiveTab("view");
      showToast("Image generated! ✨");
    };

    img.onerror = () => {
      setLoading(false);
      setLoadFailed(true);
      showToast("Generation failed — retrying with different seed…", "error");

      // Auto-retry once with a new seed
      const retrySeed = Math.floor(Math.random() * 999999);
      const retryUrl  = buildImageUrl(prompt, { model, seed: retrySeed });
      const retryImg  = new Image();
      retryImg.crossOrigin = "anonymous";
      retryImg.src = retryUrl;
      setLoading(true);
      setLoadFailed(false);

      retryImg.onload = () => {
        setImageUrl(retryUrl);
        setLoading(false);
        setHistory(prev =>
          [{ url: retryUrl, prompt: prompt.trim(), generator: "pollinations", model, seed: retrySeed, id: Date.now() }, ...prev].slice(0, 20)
        );
        setActiveTab("view");
        showToast("Image generated! ✨");
      };
      retryImg.onerror = () => {
        setLoading(false);
        setLoadFailed(true);
        showToast("Generation failed. Check your internet connection.", "error");
      };
    };
  };

  // ── Generate image with Puter AI ────────────────────────
  const generateImagePuter = async () => {
    if (!prompt.trim()) {
      showToast("Please enter a prompt first!", "error");
      return;
    }

    setImageUrl(null);
    setErrorDetail(null);
    setLoadFailed(false);
    setLoading(true);

    try {
      const puter = await loadPuter();
      // puter.ai.txt2img returns an HTMLImageElement
      const imgEl = await puter.ai.txt2img(prompt.trim());

      if (!imgEl || !imgEl.src) {
        throw new Error("Puter AI did not return a valid image source.");
      }

      const url = imgEl.src;
      setImageUrl(url);
      setHistory(prev =>
        [{ url, prompt: prompt.trim(), generator: "puter", id: Date.now() }, ...prev].slice(0, 20)
      );
      setActiveTab("view");
      showToast("Image generated! ✨");
    } catch (err) {
      console.error("Puter AI error:", err);
      const msg = err?.message || String(err);

      if (msg.toLowerCase().includes("auth") || msg.toLowerCase().includes("sign") || msg.toLowerCase().includes("login")) {
        setErrorDetail("puter-login");
      } else {
        setErrorDetail("generic");
      }
      setLoadFailed(true);
      showToast("Puter AI generation failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  // ── Generate test image with Puter AI ────────────────────
  const generateTestImage = async () => {
    if (!prompt.trim()) {
      showToast("Please enter a prompt first!", "error");
      return;
    }

    setImageUrl(null);
    setErrorDetail(null);
    setLoadFailed(false);
    setLoading(true);

    try {
      const puter = await loadPuter();
      // Pass true as second arg for test mode
      const imgEl = await puter.ai.txt2img(prompt.trim(), true);

      if (!imgEl || !imgEl.src) {
        throw new Error("Puter AI did not return a valid image source.");
      }

      const url = imgEl.src;
      setImageUrl(url);
      setHistory(prev =>
        [{ url, prompt: prompt.trim() + " (test)", generator: "puter", id: Date.now() }, ...prev].slice(0, 20)
      );
      setActiveTab("view");
      showToast("Test image loaded! ✨ (Login for real AI images)");
    } catch (err) {
      console.error("Puter Test error:", err);
      setErrorDetail("generic");
      setLoadFailed(true);
      showToast("Test mode failed. Check internet connection.", "error");
    } finally {
      setLoading(false);
    }
  };

  // ── Main Generate function ──────────────────────────────
  const generateImage = () => {
    if (engine === "pollinations") {
      generateImagePollinations();
    } else {
      generateImagePuter();
    }
  };


  // ── Regenerate with same prompt ─────────────────────────
  const regenerate = () => {
    if (!prompt.trim()) return;
    generateImage();
  };

  // ── Download ─────────────────────────────────────────────
  const handleDownload = async (url) => {
    try {
      const response = await fetch(url);
      const blob     = await response.blob();
      const blobUrl  = URL.createObjectURL(blob);
      const a        = document.createElement("a");
      a.href         = blobUrl;
      a.download     = `nexuss_ai_${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(blobUrl);
      showToast("Download started! 📥");
    } catch {
      // Fallback: open in new tab
      window.open(url, "_blank");
      showToast("Opening image in new tab for download.");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) generateImage();
  };

  // ─────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <div className="page-view" style={{ padding: "24px 28px", maxWidth: "920px", margin: "0 auto" }}>

      {/* ── Title ── */}
      <div style={{ marginBottom: "28px" }}>
        <h2 style={{
          fontSize: "30px", fontWeight: "800",
          background: "linear-gradient(135deg, #a855f7, #ec4899)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: "6px"
        }}>
          🎨 AI Image Generator
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <CheckCircle2 size={15} color="#4ade80" />
          <p style={{ color: "#4ade80", fontSize: "14px", fontWeight: "600", margin: 0 }}>
            {engine === "pollinations" 
              ? "Powered by Pollinations AI (Flux) • 100% Free • No Login Required"
              : "Powered by Puter AI (Official) • 100% Free • Login Required for Real Images"}
          </p>
        </div>
      </div>


      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
        {[
          { id: "generate", label: "✏️ Generate" },
          { id: "view",     label: `🖼️ View ${history.length > 0 ? `(${history.length})` : ""}` },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: "10px 20px", borderRadius: "12px", fontWeight: "700", fontSize: "14px",
            cursor: "pointer", transition: "all 0.2s",
            border:     activeTab === tab.id ? "1px solid rgba(168,85,247,0.5)" : "1px solid var(--border-color)",
            background: activeTab === tab.id ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.03)",
            color:      activeTab === tab.id ? "#c084fc" : "var(--text-secondary)",
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════ GENERATE TAB ══════════ */}
      {activeTab === "generate" && (
        <div>
          {/* Prompt Card */}
          <div style={{
            background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)",
            borderRadius: "20px", padding: "24px", marginBottom: "20px", backdropFilter: "blur(10px)"
          }}>



            {/* Prompt label */}
            <label style={{
              fontSize: "12px", fontWeight: "700", color: "#a855f7",
              textTransform: "uppercase", letterSpacing: "0.6px", display: "block", marginBottom: "10px"
            }}>
              🖊️ Describe your image
            </label>

            {/* Textarea */}
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. A majestic lion standing on a rocky cliff at golden hour, highly detailed, 4K..."
              rows={4}
              style={{
                width: "100%", boxSizing: "border-box",
                background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-color)",
                borderRadius: "14px", padding: "14px 16px", color: "var(--text-primary)",
                fontSize: "15px", lineHeight: "1.7", resize: "vertical", outline: "none",
                fontFamily: "Outfit, Inter, sans-serif", transition: "border-color 0.2s"
              }}
              onFocus={e => (e.target.style.borderColor = "rgba(168,85,247,0.6)")}
              onBlur={e  => (e.target.style.borderColor = "var(--border-color)")}
            />

            {/* Quick suggestions */}
            <div style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => setPrompt(s)} style={{
                  background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)",
                  borderRadius: "20px", padding: "4px 12px", fontSize: "12px",
                  color: "#c084fc", cursor: "pointer", transition: "all 0.2s", fontWeight: "500"
                }}>
                  {s.length > 35 ? s.slice(0, 35) + "…" : s}
                </button>
              ))}
            </div>

            {/* Options + Generate button */}
            <div style={{
              display: "flex", flexDirection: "column", gap: "16px",
              marginTop: "18px"
            }}>
              {/* Engine Selector */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: "600" }}>Engine:</span>
                {[
                  { id: "pollinations", label: "⚡ Pollinations AI (Flux)" },
                  { id: "puter",        label: "🤖 Puter AI (Official)" }
                ].map(e => (
                  <button key={e.id} onClick={() => { setEngine(e.id); setErrorDetail(null); }} style={{
                    padding: "6px 14px", borderRadius: "10px", fontSize: "12px", fontWeight: "600",
                    cursor: "pointer", transition: "all 0.2s",
                    border:     engine === e.id ? "1px solid rgba(168,85,247,0.6)" : "1px solid var(--border-color)",
                    background: engine === e.id ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.03)",
                    color:      engine === e.id ? "#c084fc" : "var(--text-secondary)",
                  }}>
                    {e.label}
                  </button>
                ))}
              </div>

              {/* Model Selector (Pollinations only) */}
              {engine === "pollinations" && (
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", animation: "slideUp 0.2s ease-out" }}>
                  <span style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: "600" }}>Model:</span>
                  {MODELS.map(m => (
                    <button key={m.id} onClick={() => setModel(m.id)} style={{
                      padding: "6px 14px", borderRadius: "10px", fontSize: "12px", fontWeight: "600",
                      cursor: "pointer", transition: "all 0.2s",
                      border:     model === m.id ? "1px solid rgba(168,85,247,0.6)" : "1px solid var(--border-color)",
                      background: model === m.id ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.03)",
                      color:      model === m.id ? "#c084fc" : "var(--text-secondary)",
                    }}>
                      {m.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Buttons row */}
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                flexWrap: "wrap", gap: "12px", marginTop: "4px"
              }}>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  Ctrl + Enter to generate instantly • Powered by {engine === "pollinations" ? "⚡ Pollinations AI" : "🤖 Puter AI"}
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  {engine === "puter" && (
                    <button
                      onClick={generateTestImage}
                      disabled={loading}
                      style={{
                        background: "rgba(168,85,247,0.08)",
                        color: "#c084fc",
                        border: "1px solid rgba(168,85,247,0.25)",
                        padding: "13px 20px", borderRadius: "14px",
                        fontWeight: "600", fontSize: "14px",
                        cursor: loading ? "not-allowed" : "pointer",
                        transition: "all 0.2s"
                      }}
                    >
                      🧪 Test Mode
                    </button>
                  )}
                  <button
                    onClick={generateImage}
                    disabled={loading}
                    style={{
                      background: loading
                        ? "rgba(168,85,247,0.25)"
                        : "linear-gradient(135deg, #a855f7, #ec4899)",
                      color: "white", border: "none",
                      padding: "13px 32px", borderRadius: "14px",
                      fontWeight: "800", fontSize: "15px",
                      cursor: loading ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", gap: "9px",
                      transition: "all 0.2s",
                      boxShadow: loading ? "none" : "0 4px 24px rgba(168,85,247,0.45)"
                    }}
                  >
                    {loading
                      ? <><RefreshCw size={17} style={{ animation: "spin 0.8s linear infinite" }} /> Generating…</>
                      : <><Sparkles size={17} /> Generate Image</>
                    }
                  </button>
                </div>
              </div>
            </div>
          </div>




          {/* Loading skeleton */}
          {loading && (
            <div style={{
              width: "100%", maxWidth: "540px", margin: "0 auto",
              aspectRatio: "1/1", borderRadius: "24px",
              background: "linear-gradient(90deg, rgba(168,85,247,0.04) 25%, rgba(168,85,247,0.12) 50%, rgba(168,85,247,0.04) 75%)",
              backgroundSize: "200% 100%", animation: "shimmer 1.8s infinite",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: "18px",
              border: "1px dashed rgba(168,85,247,0.3)"
            }}>
              <RefreshCw size={48} color="#a855f7" style={{ animation: "spin 1s linear infinite" }} />
              <div style={{ textAlign: "center" }}>
                <p style={{ color: "#c084fc", fontWeight: "700", fontSize: "16px", margin: "0 0 6px" }}>
                  Creating your image…
                </p>
                <p style={{ color: "var(--text-secondary)", fontSize: "13px", margin: 0, padding: "0 20px" }}>
                  This takes 10–20 seconds
                </p>
              </div>
            </div>
          )}

          {/* Puter login instructions */}
          {errorDetail === "puter-login" && !loading && (
            <div style={{
              background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)",
              borderRadius: "16px", padding: "20px", marginTop: "16px",
              display: "flex", gap: "14px", alignItems: "flex-start",
              animation: "slideUp 0.3s ease-out"
            }}>
              <AlertCircle size={22} color="#fbbf24" style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <div style={{ fontWeight: "700", color: "#fbbf24", marginBottom: "8px", fontSize: "15px" }}>
                  Puter Account Required for AI Generation
                </div>
                <div style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: "1.7" }}>
                  Puter AI utilizes your own free Puter account to run. Follow these steps:
                  <ol style={{ margin: "10px 0 10px 18px", padding: 0, lineHeight: "2" }}>
                    <li>Go to <a href="https://puter.com" target="_blank" rel="noreferrer" style={{ color: "#a855f7", textDecoration: "underline" }}>puter.com</a> and sign up (100% free)</li>
                    <li>Come back here and click <strong>"Generate Image"</strong> — Puter will show a popup to authorize/login</li>
                    <li>Once authorized, your image will generate automatically!</li>
                  </ol>
                  Or click <strong style={{ color: "#c084fc" }}>🧪 Test Mode</strong> above to quickly generate a sample image without signing in.
                </div>
              </div>
            </div>
          )}

          {/* Puter generic failure */}
          {errorDetail === "generic" && !loading && (
            <div style={{
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "16px", padding: "20px", marginTop: "16px",
              display: "flex", gap: "14px", alignItems: "flex-start",
              animation: "slideUp 0.3s ease-out"
            }}>
              <AlertCircle size={22} color="#f87171" style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <div style={{ fontWeight: "700", color: "#f87171", marginBottom: "8px" }}>Puter AI Generation Failed</div>
                <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: "1.7", margin: "0 0 12px" }}>
                  Something went wrong while connecting to Puter. Please try:
                </p>
                <ul style={{ color: "var(--text-secondary)", fontSize: "14px", margin: "0 0 12px 16px", lineHeight: "2" }}>
                  <li>Make sure your browser is not blocking popups from this site</li>
                  <li>Disable any aggressive ad-blockers or VPNs which might block Puter SDK</li>
                  <li>Verify your internet connection and refresh the page</li>
                </ul>
                <button onClick={generateImage} style={{
                  background: "linear-gradient(135deg, #a855f7, #ec4899)",
                  color: "white", border: "none", padding: "10px 22px",
                  borderRadius: "10px", fontWeight: "700", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: "8px"
                }}>
                  <RefreshCw size={14} /> Try Again
                </button>
              </div>
            </div>
          )}

          {/* Error state (Pollinations fallback) */}
          {loadFailed && !loading && !errorDetail && (
            <div style={{
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "16px", padding: "20px", marginTop: "16px",
              display: "flex", gap: "14px", alignItems: "flex-start"
            }}>
              <AlertCircle size={22} color="#f87171" style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <div style={{ fontWeight: "700", color: "#f87171", marginBottom: "8px" }}>Generation Failed</div>
                <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: "1.7", margin: "0 0 12px" }}>
                  Pollinations AI server couldn't be reached. Try:
                </p>
                <ul style={{ color: "var(--text-secondary)", fontSize: "14px", margin: "0 0 12px 16px", lineHeight: "2" }}>
                  <li>Check your internet connection</li>
                  <li>Disable any ad-blocker or VPN</li>
                  <li>Try a shorter, simpler prompt</li>
                </ul>
                <button onClick={generateImage} style={{
                  background: "linear-gradient(135deg, #a855f7, #ec4899)",
                  color: "white", border: "none", padding: "10px 22px",
                  borderRadius: "10px", fontWeight: "700", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: "8px"
                }}>
                  <RefreshCw size={14} /> Try Again
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ══════════ VIEW TAB ══════════ */}
      {activeTab === "view" && (
        <div>
          {imageUrl ? (
            <div style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(168,85,247,0.3)",
              borderRadius: "24px", padding: "24px",
              backdropFilter: "blur(10px)", marginBottom: "28px"
            }}>
              {/* Top bar */}
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", marginBottom: "18px", flexWrap: "wrap", gap: "12px"
              }}>
                <span style={{ fontSize: "13px", fontWeight: "700", color: "#a855f7", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  ✨ Generated Image
                </span>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button onClick={regenerate} style={{
                    background: "rgba(168,85,247,0.15)", color: "#c084fc",
                    border: "1px solid rgba(168,85,247,0.3)",
                    padding: "9px 18px", borderRadius: "10px",
                    fontWeight: "700", fontSize: "13px", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "7px"
                  }}>
                    <RefreshCw size={14} /> Regenerate
                  </button>
                  <button onClick={() => handleDownload(imageUrl)} style={{
                    background: "linear-gradient(135deg, #a855f7, #ec4899)",
                    color: "white", border: "none",
                    padding: "9px 20px", borderRadius: "10px",
                    fontWeight: "700", fontSize: "13px", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "7px",
                    boxShadow: "0 4px 14px rgba(168,85,247,0.35)"
                  }}>
                    <Download size={14} /> Download
                  </button>
                </div>
              </div>

              {/* ── Rounded Rectangle Image Box ── */}
              <div style={{
                width: "100%", maxWidth: "540px", margin: "0 auto",
                borderRadius: "24px", overflow: "hidden",
                boxShadow: "0 16px 56px rgba(168,85,247,0.3)",
                border: "2px solid rgba(168,85,247,0.35)",
                aspectRatio: "1/1", background: "#0c0c18",
                position: "relative"
              }}>
                <img
                  src={imageUrl}
                  alt="AI Generated"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </div>

              {/* ── Chat-style Message Box ── */}
              <div style={{
                marginTop: "20px",
                background: "rgba(168,85,247,0.06)",
                border: "1px solid rgba(168,85,247,0.18)",
                borderRadius: "18px", padding: "18px 20px",
                display: "flex", alignItems: "flex-start", gap: "14px"
              }}>
                {/* AI Avatar */}
                <div style={{
                  width: "40px", height: "40px", borderRadius: "50%",
                  background: "linear-gradient(135deg, #a855f7, #ec4899)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, boxShadow: "0 0 16px rgba(168,85,247,0.4)"
                }}>
                  <Sparkles size={18} color="white" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "700", color: "#c084fc", fontSize: "13px", marginBottom: "6px" }}>
                    Nexuss AI  <span style={{ color: "var(--text-secondary)", fontWeight: "400", fontSize: "12px" }}>• just now</span>
                  </div>
                  <div style={{ color: "var(--text-primary)", fontSize: "14px", lineHeight: "1.7" }}>
                    Here is your image! I used the <strong style={{ color: "#c084fc" }}>
                    {history[0]?.generator === "puter" 
                      ? "Puter AI (txt2img)" 
                      : `Pollinations (${MODELS.find(m => m.id === (history[0]?.model || model))?.label || "Flux"})`}
                    </strong> engine for this generation.
                    <br />
                    <span style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                      Prompt: "<em>{history[0]?.prompt}</em>"
                    </span>
                  </div>
                  <div style={{ marginTop: "12px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <button onClick={() => setActiveTab("generate")} style={{
                      background: "rgba(168,85,247,0.12)", color: "#c084fc",
                      border: "1px solid rgba(168,85,247,0.25)",
                      padding: "7px 16px", borderRadius: "10px",
                      fontSize: "13px", fontWeight: "600", cursor: "pointer"
                    }}>
                      ✏️ New Prompt
                    </button>
                    <button onClick={regenerate} style={{
                      background: "rgba(168,85,247,0.12)", color: "#c084fc",
                      border: "1px solid rgba(168,85,247,0.25)",
                      padding: "7px 16px", borderRadius: "10px",
                      fontSize: "13px", fontWeight: "600", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: "6px"
                    }}>
                      <RefreshCw size={12} /> Regenerate
                    </button>
                    <button onClick={() => handleDownload(imageUrl)} style={{
                      background: "rgba(168,85,247,0.12)", color: "#c084fc",
                      border: "1px solid rgba(168,85,247,0.25)",
                      padding: "7px 16px", borderRadius: "10px",
                      fontSize: "13px", fontWeight: "600", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: "6px"
                    }}>
                      <Download size={12} /> Download HD
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* No image yet */
            <div style={{
              textAlign: "center", padding: "80px 20px",
              color: "var(--text-secondary)",
              background: "rgba(255,255,255,0.01)",
              border: "1px dashed var(--border-color)", borderRadius: "24px"
            }}>
              <ImageIcon size={64} style={{ marginBottom: "18px", color: "rgba(168,85,247,0.35)" }} />
              <div style={{ fontSize: "20px", fontWeight: "700", marginBottom: "8px" }}>No Image Yet</div>
              <p style={{ fontSize: "14px", marginBottom: "24px" }}>
                Go to the <strong style={{ color: "#c084fc" }}>Generate</strong> tab and create your first AI image!
              </p>
              <button onClick={() => setActiveTab("generate")} style={{
                background: "linear-gradient(135deg, #a855f7, #ec4899)",
                color: "white", border: "none", padding: "13px 28px",
                borderRadius: "14px", fontWeight: "700", fontSize: "15px", cursor: "pointer",
                boxShadow: "0 4px 20px rgba(168,85,247,0.4)"
              }}>
                ✏️ Start Generating
              </button>
            </div>
          )}

          {/* ── History Grid ── */}
          {history.length > 0 && (
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: "700", margin: "0 0 16px", color: "var(--text-secondary)" }}>
                📚 History ({history.length})
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "14px" }}>
                {history.map(item => (
                  <div key={item.id} onClick={() => { setImageUrl(item.url); setActiveTab("view"); }} style={{
                    borderRadius: "16px", overflow: "hidden",
                    border: "1px solid var(--border-color)",
                    background: "rgba(255,255,255,0.02)",
                    cursor: "pointer", transition: "transform 0.2s, box-shadow 0.2s",
                    position: "relative", aspectRatio: "1/1"
                  }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.03)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(168,85,247,0.3)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    <img src={item.url} alt={item.prompt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <div style={{
                      position: "absolute", bottom: 0, left: 0, right: 0,
                      background: "linear-gradient(transparent, rgba(0,0,0,0.85))",
                      padding: "22px 8px 8px", fontSize: "11px",
                      color: "rgba(255,255,255,0.85)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                    }}>
                      {item.prompt}
                    </div>
                    <button onClick={e => { e.stopPropagation(); handleDownload(item.url); }} style={{
                      position: "absolute", top: "7px", right: "7px",
                      background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
                      border: "none", borderRadius: "8px", padding: "5px 7px",
                      color: "white", cursor: "pointer", display: "flex", alignItems: "center"
                    }}>
                      <Download size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}

      <style>{`
        @keyframes spin    { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes slideUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );
}
