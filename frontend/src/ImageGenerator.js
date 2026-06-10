import React, { useState } from "react";
import { Download, ImageIcon, Sparkles, RefreshCw, AlertCircle } from "lucide-react";

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

// ── Toast ──────────────────────────────────────────────────
function Toast({ message, type }) {
  return (
    <div style={{
      position: "fixed", bottom: "24px", right: "24px",
      background: type === "error" ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)",
      border: `1px solid ${type === "error" ? "rgba(239,68,68,0.4)" : "rgba(34,197,94,0.4)"}`,
      color: type === "error" ? "#f87171" : "#4ade80",
      padding: "14px 20px", borderRadius: "12px",
      fontSize: "14px", fontWeight: "600",
      backdropFilter: "blur(10px)", zIndex: 9999,
      animation: "slideUp 0.3s ease-out",
      boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
      maxWidth: "340px", lineHeight: "1.5"
    }}>
      {message}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────
export default function ImageGenerator() {
  const [prompt, setPrompt]       = useState("");
  const [imageUrl, setImageUrl]   = useState(null);
  const [loading, setLoading]     = useState(false);
  const [toast, setToast]         = useState(null);
  const [activeTab, setActiveTab] = useState("generate");
  const [history, setHistory]     = useState([]);
  const [errorDetail, setErrorDetail] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const generateImage = async () => {
    if (!prompt.trim()) { showToast("Please enter a prompt first!", "error"); return; }

    setLoading(true);
    setImageUrl(null);
    setErrorDetail(null);

    try {
      const puter = await loadPuter();

      // puter.ai.txt2img returns an HTMLImageElement
      // Pass `true` as second arg for test_mode if you want to skip Puter login
      const imgEl = await puter.ai.txt2img(prompt.trim());

      if (!(imgEl instanceof HTMLImageElement)) {
        throw new Error("Unexpected response from puter.ai.txt2img");
      }

      const url = imgEl.src;
      setImageUrl(url);
      setHistory(prev => [{ url, prompt: prompt.trim(), id: Date.now() }, ...prev].slice(0, 20));
      setActiveTab("view");
      showToast("Image generated successfully! ✨");
    } catch (err) {
      console.error("Image generation error:", err);
      const msg = err?.message || String(err);

      // Detect Puter login requirement
      if (msg.toLowerCase().includes("auth") || msg.toLowerCase().includes("sign") || msg.toLowerCase().includes("login")) {
        setErrorDetail("puter-login");
      } else {
        setErrorDetail("generic");
      }
      showToast("Failed to generate image — see details below.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Try test_mode (no Puter account needed, returns a sample image)
  const generateTestImage = async () => {
    if (!prompt.trim()) { showToast("Please enter a prompt first!", "error"); return; }
    setLoading(true);
    setImageUrl(null);
    setErrorDetail(null);
    try {
      const puter = await loadPuter();
      // true = test_mode: returns a placeholder, no account / credits needed
      const imgEl = await puter.ai.txt2img(prompt.trim(), true);
      const url = imgEl.src;
      setImageUrl(url);
      setHistory(prev => [{ url, prompt: prompt.trim() + " (test)", id: Date.now() }, ...prev].slice(0, 20));
      setActiveTab("view");
      showToast("Test image loaded! (For real AI image, log in to Puter)");
    } catch (err) {
      console.error("Test image error:", err);
      showToast("Test mode also failed. Check internet connection.", "error");
      setErrorDetail("generic");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (url, fname = "ai_generated_image.png") => {
    const a = document.createElement("a");
    a.href = url;
    a.download = fname;
    a.click();
    showToast("Download started!");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) generateImage();
  };

  return (
    <div className="page-view" style={{ padding: "24px 28px", maxWidth: "900px", margin: "0 auto" }}>

      {/* ── Page Title ── */}
      <div style={{ marginBottom: "28px" }}>
        <h2 style={{
          fontSize: "30px", fontWeight: "800",
          background: "linear-gradient(135deg, #a855f7, #ec4899)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: "6px"
        }}>
          🎨 AI Image Generator
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "15px" }}>
          Describe any image and let AI bring it to life — powered by Puter.js (free, no API key needed).
        </p>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
        {[
          { id: "generate", label: "✏️ Generate" },
          { id: "view",     label: "🖼️ View"     },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: "10px 20px", borderRadius: "12px", fontWeight: "700", fontSize: "14px",
            cursor: "pointer", transition: "all 0.2s",
            border:      activeTab === tab.id ? "1px solid rgba(168,85,247,0.5)" : "1px solid var(--border-color)",
            background:  activeTab === tab.id ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.03)",
            color:       activeTab === tab.id ? "#c084fc" : "var(--text-secondary)",
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════ GENERATE TAB ══════════ */}
      {activeTab === "generate" && (
        <div>
          {/* Prompt card */}
          <div style={{
            background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)",
            borderRadius: "20px", padding: "24px", marginBottom: "24px", backdropFilter: "blur(10px)"
          }}>
            <label style={{
              fontSize: "13px", fontWeight: "700", color: "#a855f7",
              textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "12px"
            }}>
              Image Prompt
            </label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. A futuristic city at sunset, cyberpunk style, neon lights, ultra-detailed..."
              rows={4}
              style={{
                width: "100%", boxSizing: "border-box",
                background: "rgba(0,0,0,0.25)", border: "1px solid var(--border-color)",
                borderRadius: "14px", padding: "14px 16px", color: "var(--text-primary)",
                fontSize: "15px", lineHeight: "1.6", resize: "vertical", outline: "none",
                fontFamily: "Outfit, Inter, sans-serif", transition: "border-color 0.2s"
              }}
              onFocus={e => (e.target.style.borderColor = "rgba(168,85,247,0.5)")}
              onBlur={e  => (e.target.style.borderColor = "var(--border-color)")}
            />

            {/* Buttons row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", flexWrap: "wrap", gap: "12px" }}>
              <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                Ctrl+Enter to generate  •  Powered by Puter AI
              </span>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {/* Test-mode button */}
                <button
                  onClick={generateTestImage}
                  disabled={loading}
                  style={{
                    background: "rgba(168,85,247,0.12)", color: "#c084fc",
                    border: "1px solid rgba(168,85,247,0.3)",
                    padding: "11px 20px", borderRadius: "12px",
                    fontWeight: "600", fontSize: "14px", cursor: loading ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", gap: "8px"
                  }}
                >
                  🧪 Test Mode
                </button>

                {/* Real generate button */}
                <button
                  onClick={generateImage}
                  disabled={loading}
                  style={{
                    background: loading
                      ? "rgba(168,85,247,0.3)"
                      : "linear-gradient(135deg, #a855f7, #ec4899)",
                    color: "white", border: "none",
                    padding: "12px 28px", borderRadius: "12px",
                    fontWeight: "700", fontSize: "15px", cursor: loading ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", gap: "8px", transition: "all 0.2s",
                    boxShadow: loading ? "none" : "0 4px 20px rgba(168,85,247,0.4)"
                  }}
                >
                  {loading
                    ? <><RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} /> Generating…</>
                    : <><Sparkles size={16} /> Generate Image</>}
                </button>
              </div>
            </div>
          </div>

          {/* ── Error detail box ── */}
          {errorDetail === "puter-login" && (
            <div style={{
              background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)",
              borderRadius: "16px", padding: "20px", marginBottom: "20px",
              display: "flex", gap: "14px", alignItems: "flex-start"
            }}>
              <AlertCircle size={22} color="#fbbf24" style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <div style={{ fontWeight: "700", color: "#fbbf24", marginBottom: "8px", fontSize: "15px" }}>
                  Puter Account Required for Full AI Generation
                </div>
                <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: "1.7", margin: 0 }}>
                  Puter.js uses your own free Puter account to generate real AI images.
                  <br />
                  <strong style={{ color: "#e2e8f0" }}>Steps:</strong>
                  <ol style={{ margin: "10px 0 10px 16px", padding: 0, lineHeight: "2" }}>
                    <li>Go to <a href="https://puter.com" target="_blank" rel="noreferrer" style={{ color: "#a855f7" }}>puter.com</a> → sign up (100% free)</li>
                    <li>Come back here and click <strong>"Generate Image"</strong> — Puter will open a popup to log in</li>
                    <li>After login the image will generate automatically</li>
                  </ol>
                  Or use <strong style={{ color: "#c084fc" }}>🧪 Test Mode</strong> above to see a sample image without any account.
                </p>
              </div>
            </div>
          )}

          {errorDetail === "generic" && (
            <div style={{
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "16px", padding: "18px", marginBottom: "20px",
              display: "flex", gap: "14px", alignItems: "flex-start"
            }}>
              <AlertCircle size={22} color="#f87171" style={{ flexShrink: 0 }} />
              <div style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: "1.7" }}>
                <strong style={{ color: "#f87171", display: "block", marginBottom: "6px" }}>Generation failed</strong>
                Possible reasons: no internet, Puter servers down, or ad-blocker blocking puter.js.<br />
                Try: disable ad-blocker → refresh page → try again.
              </div>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div style={{
              width: "100%", maxWidth: "520px", margin: "0 auto", aspectRatio: "1/1",
              borderRadius: "20px",
              background: "linear-gradient(90deg, rgba(168,85,247,0.05) 25%, rgba(168,85,247,0.13) 50%, rgba(168,85,247,0.05) 75%)",
              backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px",
              border: "1px solid rgba(168,85,247,0.2)"
            }}>
              <RefreshCw size={44} color="#a855f7" style={{ animation: "spin 1s linear infinite" }} />
              <p style={{ color: "#c084fc", fontWeight: "600", fontSize: "15px" }}>AI is creating your image…</p>
              <p style={{ color: "var(--text-secondary)", fontSize: "12px", maxWidth: "240px", textAlign: "center" }}>
                This may take 10–30 seconds. A Puter login popup may appear — please allow it.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ══════════ VIEW TAB ══════════ */}
      {activeTab === "view" && (
        <div>
          {imageUrl ? (
            <div style={{
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(168,85,247,0.3)",
              borderRadius: "20px", padding: "24px", backdropFilter: "blur(10px)", marginBottom: "28px"
            }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
                <span style={{ fontSize: "13px", fontWeight: "700", color: "#a855f7", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  ✨ Latest Generated Image
                </span>
                <button onClick={() => handleDownload(imageUrl)} style={{
                  background: "linear-gradient(135deg, #a855f7, #ec4899)", color: "white", border: "none",
                  padding: "10px 20px", borderRadius: "10px", fontWeight: "700", fontSize: "14px",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: "8px",
                  boxShadow: "0 4px 14px rgba(168,85,247,0.35)"
                }}>
                  <Download size={15} /> Download
                </button>
              </div>

              {/* Rounded Rectangle Image Display */}
              <div style={{
                width: "100%", maxWidth: "520px", margin: "0 auto",
                borderRadius: "20px", overflow: "hidden",
                boxShadow: "0 12px 48px rgba(168,85,247,0.25)",
                border: "1px solid rgba(168,85,247,0.3)",
                aspectRatio: "1/1", background: "#0f0f1a"
              }}>
                <img
                  src={imageUrl}
                  alt="AI Generated"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </div>

              {/* Chat-style message box */}
              <div style={{
                marginTop: "20px",
                background: "rgba(168,85,247,0.07)", border: "1px solid rgba(168,85,247,0.2)",
                borderRadius: "16px", padding: "16px 20px",
                display: "flex", alignItems: "flex-start", gap: "12px"
              }}>
                <div style={{
                  width: "36px", height: "36px", borderRadius: "50%",
                  background: "linear-gradient(135deg, #a855f7, #ec4899)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                }}>
                  <Sparkles size={16} color="white" />
                </div>
                <div>
                  <div style={{ fontWeight: "700", color: "#c084fc", fontSize: "13px", marginBottom: "4px" }}>Nexuss AI</div>
                  <div style={{ color: "var(--text-primary)", fontSize: "14px", lineHeight: "1.6" }}>
                    Your image has been generated! Prompt: <span style={{ color: "#c084fc", fontStyle: "italic" }}>
                      "{history[0]?.prompt}"
                    </span>
                  </div>
                  <div style={{ marginTop: "10px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <button onClick={() => setActiveTab("generate")} style={{
                      background: "rgba(168,85,247,0.15)", color: "#c084fc",
                      border: "1px solid rgba(168,85,247,0.3)",
                      padding: "6px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: "600", cursor: "pointer"
                    }}>
                      ✏️ Generate Another
                    </button>
                    <button onClick={() => handleDownload(imageUrl)} style={{
                      background: "rgba(168,85,247,0.15)", color: "#c084fc",
                      border: "1px solid rgba(168,85,247,0.3)",
                      padding: "6px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: "600",
                      cursor: "pointer", display: "flex", alignItems: "center", gap: "6px"
                    }}>
                      <Download size={12} /> Download
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              textAlign: "center", padding: "80px 20px", color: "var(--text-secondary)",
              background: "rgba(255,255,255,0.01)", border: "1px dashed var(--border-color)", borderRadius: "20px"
            }}>
              <ImageIcon size={60} style={{ marginBottom: "16px", color: "rgba(168,85,247,0.4)" }} />
              <div style={{ fontSize: "18px", fontWeight: "600", marginBottom: "8px" }}>No Image Yet</div>
              <p style={{ fontSize: "14px", marginBottom: "20px" }}>Go to the Generate tab and create your first AI image!</p>
              <button onClick={() => setActiveTab("generate")} style={{
                background: "linear-gradient(135deg, #a855f7, #ec4899)",
                color: "white", border: "none", padding: "12px 24px",
                borderRadius: "12px", fontWeight: "700", cursor: "pointer"
              }}>
                ✏️ Start Generating
              </button>
            </div>
          )}

          {/* History Grid */}
          {history.length > 1 && (
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "16px", color: "var(--text-secondary)" }}>
                📚 History ({history.length} images)
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "14px" }}>
                {history.map(item => (
                  <div key={item.id} onClick={() => { setImageUrl(item.url); setActiveTab("view"); }} style={{
                    borderRadius: "14px", overflow: "hidden",
                    border: "1px solid var(--border-color)", background: "rgba(255,255,255,0.02)",
                    cursor: "pointer", transition: "all 0.2s", position: "relative", aspectRatio: "1/1"
                  }}>
                    <img src={item.url} alt={item.prompt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <div style={{
                      position: "absolute", bottom: 0, left: 0, right: 0,
                      background: "linear-gradient(transparent, rgba(0,0,0,0.8))",
                      padding: "20px 8px 8px", fontSize: "11px", color: "rgba(255,255,255,0.8)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                    }}>
                      {item.prompt}
                    </div>
                    <button onClick={e => { e.stopPropagation(); handleDownload(item.url); }} style={{
                      position: "absolute", top: "6px", right: "6px",
                      background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "6px",
                      padding: "4px 6px", color: "white", cursor: "pointer", display: "flex", alignItems: "center"
                    }}>
                      <Download size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* Keyframes */}
      <style>{`
        @keyframes spin    { from { transform: rotate(0deg); }    to { transform: rotate(360deg); } }
        @keyframes shimmer { 0%   { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
