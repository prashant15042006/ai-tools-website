import React, { useState, useRef } from "react";
import { Download, ImageIcon, Sparkles, RefreshCw, Eye } from "lucide-react";

// ── Helper: load Puter.js dynamically ──────────────────────
function loadPuterScript() {
  return new Promise((resolve, reject) => {
    if (window.puter) return resolve(window.puter);
    const existing = document.querySelector('script[src*="puter"]');
    if (existing) {
      existing.onload = () => resolve(window.puter);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://js.puter.com/v2/";
    script.async = true;
    script.onload = () => resolve(window.puter);
    script.onerror = () => reject(new Error("Failed to load Puter.js"));
    document.head.appendChild(script);
  });
}

// ── Toast Notification ──────────────────────────────────────
function Toast({ message, type }) {
  return (
    <div style={{
      position: "fixed", bottom: "24px", right: "24px",
      background: type === "error" ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)",
      border: `1px solid ${type === "error" ? "rgba(239,68,68,0.4)" : "rgba(34,197,94,0.4)"}`,
      color: type === "error" ? "#f87171" : "#4ade80",
      padding: "12px 20px", borderRadius: "12px",
      fontSize: "14px", fontWeight: "600",
      backdropFilter: "blur(10px)",
      zIndex: 9999,
      animation: "slideUp 0.3s ease-out",
      boxShadow: "0 8px 32px rgba(0,0,0,0.3)"
    }}>
      {message}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────
export default function ImageGenerator() {
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState("generate"); // "generate" | "view"
  const [history, setHistory] = useState([]);
  const textareaRef = useRef(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const generateImage = async () => {
    if (!prompt.trim()) {
      showToast("Please enter a prompt first!", "error");
      return;
    }
    setLoading(true);
    setImageUrl(null);
    try {
      const puter = await loadPuterScript();
      // Puter.js AI image generation – no API key needed
      const result = await puter.ai.txt2img(prompt.trim());
      // result is an <img> element or a blob URL
      let url;
      if (typeof result === "string") {
        url = result;
      } else if (result instanceof HTMLImageElement) {
        url = result.src;
      } else if (result instanceof Blob) {
        url = URL.createObjectURL(result);
      } else {
        throw new Error("Unexpected result format from Puter");
      }
      setImageUrl(url);
      setHistory(prev => [{ url, prompt: prompt.trim(), id: Date.now() }, ...prev].slice(0, 20));
      setActiveTab("view");
      showToast("Image generated successfully! ✨");
    } catch (err) {
      console.error("Image generation error:", err);
      showToast("Failed to generate image. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (url, name = "ai_generated_image.png") => {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
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
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          marginBottom: "6px"
        }}>
          🎨 AI Image Generator
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "15px" }}>
          Describe any image and let AI bring it to life — no API key needed.
        </p>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
        {[
          { id: "generate", label: "✏️ Generate", icon: Sparkles },
          { id: "view", label: "🖼️ View", icon: Eye },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "10px 20px", borderRadius: "12px",
              border: activeTab === tab.id ? "1px solid rgba(168,85,247,0.5)" : "1px solid var(--border-color)",
              background: activeTab === tab.id ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.03)",
              color: activeTab === tab.id ? "#c084fc" : "var(--text-secondary)",
              fontWeight: "700", fontSize: "14px", cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Generate Tab ── */}
      {activeTab === "generate" && (
        <div>
          {/* Prompt Input Card */}
          <div style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid var(--border-color)",
            borderRadius: "20px", padding: "24px",
            marginBottom: "24px",
            backdropFilter: "blur(10px)"
          }}>
            <label style={{ fontSize: "13px", fontWeight: "700", color: "#a855f7", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "12px" }}>
              Image Prompt
            </label>
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. A futuristic city at sunset, cyberpunk style, neon lights, ultra-detailed..."
              rows={4}
              style={{
                width: "100%", boxSizing: "border-box",
                background: "rgba(0,0,0,0.25)",
                border: "1px solid var(--border-color)",
                borderRadius: "14px", padding: "14px 16px",
                color: "var(--text-primary)", fontSize: "15px",
                lineHeight: "1.6", resize: "vertical", outline: "none",
                fontFamily: "Outfit, Inter, sans-serif",
                transition: "border-color 0.2s"
              }}
              onFocus={e => e.target.style.borderColor = "rgba(168,85,247,0.5)"}
              onBlur={e => e.target.style.borderColor = "var(--border-color)"}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", flexWrap: "wrap", gap: "12px" }}>
              <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                Ctrl+Enter to generate • Powered by Puter AI (free, no API key)
              </span>
              <button
                onClick={generateImage}
                disabled={loading}
                style={{
                  background: loading ? "rgba(168,85,247,0.3)" : "linear-gradient(135deg, #a855f7, #ec4899)",
                  color: "white", border: "none",
                  padding: "12px 28px", borderRadius: "12px",
                  fontWeight: "700", fontSize: "15px", cursor: loading ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", gap: "8px",
                  transition: "all 0.2s",
                  boxShadow: loading ? "none" : "0 4px 20px rgba(168,85,247,0.4)"
                }}
              >
                {loading ? (
                  <><RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} /> Generating…</>
                ) : (
                  <><Sparkles size={16} /> Generate Image</>
                )}
              </button>
            </div>
          </div>

          {/* Loading Skeleton */}
          {loading && (
            <div style={{
              width: "100%", maxWidth: "520px", margin: "0 auto",
              aspectRatio: "1/1", borderRadius: "20px",
              background: "linear-gradient(90deg, rgba(168,85,247,0.05) 25%, rgba(168,85,247,0.12) 50%, rgba(168,85,247,0.05) 75%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.5s infinite",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: "16px",
              border: "1px solid rgba(168,85,247,0.2)"
            }}>
              <RefreshCw size={40} color="#a855f7" style={{ animation: "spin 1s linear infinite" }} />
              <p style={{ color: "#c084fc", fontWeight: "600", fontSize: "15px" }}>AI is creating your image…</p>
            </div>
          )}
        </div>
      )}

      {/* ── View Tab ── */}
      {activeTab === "view" && (
        <div>
          {imageUrl ? (
            /* Latest generated image */
            <div style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(168,85,247,0.3)",
              borderRadius: "20px", padding: "24px",
              backdropFilter: "blur(10px)",
              marginBottom: "28px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
                <span style={{ fontSize: "13px", fontWeight: "700", color: "#a855f7", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Latest Generated Image
                </span>
                <button
                  onClick={() => handleDownload(imageUrl)}
                  style={{
                    background: "linear-gradient(135deg, #a855f7, #ec4899)",
                    color: "white", border: "none",
                    padding: "10px 20px", borderRadius: "10px",
                    fontWeight: "700", fontSize: "14px", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "8px",
                    boxShadow: "0 4px 14px rgba(168,85,247,0.35)"
                  }}
                >
                  <Download size={15} /> Download
                </button>
              </div>

              {/* Rounded Rectangle Image Display */}
              <div style={{
                width: "100%", maxWidth: "520px", margin: "0 auto",
                borderRadius: "20px", overflow: "hidden",
                boxShadow: "0 12px 48px rgba(168,85,247,0.25)",
                border: "1px solid rgba(168,85,247,0.3)",
                aspectRatio: "1/1",
                background: "#0f0f1a"
              }}>
                <img
                  src={imageUrl}
                  alt="AI Generated"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </div>

              {/* Chat-style message box below image */}
              <div style={{
                marginTop: "20px",
                background: "rgba(168,85,247,0.07)",
                border: "1px solid rgba(168,85,247,0.2)",
                borderRadius: "16px", padding: "16px 20px",
                display: "flex", alignItems: "flex-start", gap: "12px"
              }}>
                <div style={{
                  width: "36px", height: "36px", borderRadius: "50%",
                  background: "linear-gradient(135deg, #a855f7, #ec4899)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0
                }}>
                  <Sparkles size={16} color="white" />
                </div>
                <div>
                  <div style={{ fontWeight: "700", color: "#c084fc", fontSize: "13px", marginBottom: "4px" }}>Nexuss AI</div>
                  <div style={{ color: "var(--text-primary)", fontSize: "14px", lineHeight: "1.6" }}>
                    Your image has been generated! Prompt used: <span style={{ color: "#c084fc", fontStyle: "italic" }}>"{history[0]?.prompt}"</span>
                  </div>
                  <div style={{ marginTop: "10px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <button
                      onClick={() => setActiveTab("generate")}
                      style={{
                        background: "rgba(168,85,247,0.15)", color: "#c084fc",
                        border: "1px solid rgba(168,85,247,0.3)",
                        padding: "6px 14px", borderRadius: "8px",
                        fontSize: "13px", fontWeight: "600", cursor: "pointer"
                      }}
                    >
                      ✏️ Generate Another
                    </button>
                    <button
                      onClick={() => handleDownload(imageUrl)}
                      style={{
                        background: "rgba(168,85,247,0.15)", color: "#c084fc",
                        border: "1px solid rgba(168,85,247,0.3)",
                        padding: "6px 14px", borderRadius: "8px",
                        fontSize: "13px", fontWeight: "600", cursor: "pointer"
                      }}
                    >
                      <Download size={12} style={{ marginRight: "4px" }} />Download
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              textAlign: "center", padding: "80px 20px",
              color: "var(--text-secondary)",
              background: "rgba(255,255,255,0.01)",
              border: "1px dashed var(--border-color)",
              borderRadius: "20px"
            }}>
              <ImageIcon size={60} style={{ marginBottom: "16px", color: "rgba(168,85,247,0.4)" }} />
              <div style={{ fontSize: "18px", fontWeight: "600", marginBottom: "8px" }}>No Image Yet</div>
              <p style={{ fontSize: "14px", marginBottom: "20px" }}>Go to the Generate tab and create your first AI image!</p>
              <button
                onClick={() => setActiveTab("generate")}
                style={{
                  background: "linear-gradient(135deg, #a855f7, #ec4899)",
                  color: "white", border: "none", padding: "12px 24px",
                  borderRadius: "12px", fontWeight: "700", cursor: "pointer"
                }}
              >
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "16px" }}>
                {history.map(item => (
                  <div
                    key={item.id}
                    style={{
                      borderRadius: "14px", overflow: "hidden",
                      border: "1px solid var(--border-color)",
                      background: "rgba(255,255,255,0.02)",
                      cursor: "pointer", transition: "all 0.2s",
                      position: "relative", aspectRatio: "1/1"
                    }}
                    onClick={() => { setImageUrl(item.url); setActiveTab("view"); }}
                  >
                    <img src={item.url} alt={item.prompt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <div style={{
                      position: "absolute", bottom: 0, left: 0, right: 0,
                      background: "linear-gradient(transparent, rgba(0,0,0,0.8))",
                      padding: "20px 10px 10px",
                      fontSize: "11px", color: "rgba(255,255,255,0.8)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                    }}>
                      {item.prompt}
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); handleDownload(item.url); }}
                      style={{
                        position: "absolute", top: "8px", right: "8px",
                        background: "rgba(0,0,0,0.6)", border: "none",
                        borderRadius: "6px", padding: "4px 6px",
                        color: "white", cursor: "pointer", display: "flex", alignItems: "center"
                      }}
                    >
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

      {/* Keyframe styles */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
