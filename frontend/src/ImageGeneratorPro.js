import React, { useMemo, useState, useEffect } from "react";
import {
  Sparkles,
  Download,
  Copy,
  RefreshCw,
  Trash2,
  Wand2,
  Dices,
  Maximize2,
  X,
  ExternalLink,
  Check,
  Zap,
  SlidersHorizontal,
  Layers,
  ArrowUpRight,
  ImageIcon,
} from "lucide-react";
import API_BASE_URL from "./apiConfig";
import { detectRatioFromPrompt } from "./utils/helpers";

// ============================================================
// 🎨 AI IMAGE STUDIO — BEAST DASHBOARD REDESIGN
// Ultra-clean, modern, distraction-free creative workspace
// ============================================================

function buildImageUrl(prompt, options = {}) {
  const {
    width = 1024,
    height = 1024,
    model = "flux",
    seed = Math.floor(Math.random() * 999999),
    enhance = true,
  } = options;

  const encoded = encodeURIComponent(prompt.trim());
  return `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&model=${model}&seed=${seed}&nologo=true&enhance=${enhance}`;
}

const MODELS = [
  { id: "flux", label: "Flux.1 Ultra", badge: "POPULAR", desc: "Hyper-realistic textures & cinematic lighting" },
  { id: "recraft", label: "Recraft v4.1", badge: "NEW", desc: "Crisp vector, branding & ultra-clean details" },
  { id: "turbo", label: "Turbo Speed", badge: "FAST", desc: "Blazing fast generation in 2–4 seconds" },
  { id: "flux-anime", label: "Anime Master", badge: "ART", desc: "Makoto Shinkai & Ghibli aesthetic" },
  { id: "flux-3d", label: "Unreal 3D", badge: "CGI", desc: "3D Pixar & Octane Render CGI quality" },
];

const ASPECT_RATIOS = [
  { id: "1:1", label: "Square", width: 1024, height: 1024, sub: "1:1 • Post", icon: "⏹️" },
  { id: "16:9", label: "Landscape", width: 1024, height: 576, sub: "16:9 • Desktop", icon: "🌅" },
  { id: "9:16", label: "Portrait", width: 576, height: 1024, sub: "9:16 • Story", icon: "📱" },
  { id: "4:3", label: "Classic", width: 1024, height: 768, sub: "4:3 • Photo", icon: "📺" },
];

const STYLES = [
  { id: "photo", label: "📸 8K Photo", suffix: "photorealistic 8k, ultra sharp focus, Hasselblad shot, studio lighting" },
  { id: "cinematic", label: "🎬 Cinematic", suffix: "cinematic movie still, dramatic rim lighting, 35mm lens, depth of field" },
  { id: "anime", label: "🌸 Anime", suffix: "anime aesthetic, Makoto Shinkai style, vibrant colors, detailed scenery" },
  { id: "cyberpunk", label: "🕹️ Cyberpunk", suffix: "cyberpunk city, neon lights, volumetric rain, octane render 8k" },
  { id: "3d", label: "🎮 3D Render", suffix: "unreal engine 5, Pixar 3D style, smooth shading, clay material, 8k render" },
  { id: "fantasy", label: "🏰 Fantasy", suffix: "classical oil painting, textured canvas, atmospheric lighting, masterpiece" },
];

const INSPIRATION_PROMPTS = [
  "A majestic white tiger with glowing cyan stripes resting inside a bioluminescent rainforest, 8k cinematic",
  "Futuristic Formula 1 cyber car racing across a transparent neon skybridge over Tokyo at midnight",
  "Astronaut discovering a giant glowing crystalline obelisk on an alien desert planet at sunset",
  "Cozy lofi Japanese cafe during gentle snowfall, warm yellow lanterns, steaming coffee cup, anime style",
  "Cyberpunk samurai in chrome armor standing beneath pouring neon rain, cinematic reflection",
  "Hyper-realistic portrait of an ethereal celestial goddess woven from golden nebulae and starlight",
];

function Toast({ message, type }) {
  return (
    <div style={{
      position: "fixed",
      bottom: "32px",
      right: "32px",
      background: type === "error" ? "rgba(239, 68, 68, 0.95)" : "rgba(15, 23, 42, 0.95)",
      border: `1px solid ${type === "error" ? "rgba(239, 68, 68, 0.4)" : "rgba(6, 182, 212, 0.4)"}`,
      color: "#ffffff",
      padding: "12px 20px",
      borderRadius: "14px",
      fontSize: "13px",
      fontWeight: "600",
      backdropFilter: "blur(20px)",
      zIndex: 99999,
      boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      gap: "10px",
      animation: "toastSlide 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
    }}>
      <span>{type === "error" ? "⚠️" : "✨"}</span>
      <span>{message}</span>
    </div>
  );
}

export default function ImageGeneratorPro() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("flux");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [imageUrl, setImageUrl] = useState(null);
  const [activeResult, setActiveResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [toast, setToast] = useState(null);
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("create"); // 'create' | 'gallery'
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // ── History State ──
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem("nexus_image_history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3200);
  };

  const saveHistory = (newHistory) => {
    setHistory(newHistory);
    try {
      localStorage.setItem("nexus_image_history", JSON.stringify(newHistory));
    } catch (error) {
      console.warn("Could not save history to localStorage", error);
    }
  };

  // ── Random Prompt ──
  const handleRandomPrompt = () => {
    const randomIndex = Math.floor(Math.random() * INSPIRATION_PROMPTS.length);
    setPrompt(INSPIRATION_PROMPTS[randomIndex]);
    showToast("Loaded fresh creative prompt! 🎲");
  };

  // ── Append Style ──
  const appendStyle = (suffix) => {
    setPrompt((prev) => {
      const base = prev.trim();
      if (!base) return suffix;
      if (base.toLowerCase().includes(suffix.toLowerCase())) return prev;
      return `${base}, ${suffix}`;
    });
    showToast("Style added to prompt! 🎨");
  };

  // ── AI Magic Wand: Enhance Prompt ──
  const enhancePromptWithAI = async () => {
    if (!prompt.trim()) {
      showToast("Please enter a prompt first!", "error");
      return;
    }

    setIsEnhancingPrompt(true);
    const endpoints = [];
    if (API_BASE_URL) endpoints.push(`${API_BASE_URL}/api/image-prompt`);
    endpoints.push("/api/image-prompt");

    let enhanced = "";

    for (const ep of endpoints) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12000);
        const res = await fetch(ep, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: prompt.trim(),
            imageContext: "",
          }),
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (res.ok) {
          const d = await res.json();
          if (d.enhanced) {
            enhanced = d.enhanced;
            break;
          }
        }
      } catch (e) {}
    }

    setIsEnhancingPrompt(false);

    if (enhanced) {
      setPrompt(enhanced);
      showToast("Enhanced with cinematic 8K details! ✨");
    } else {
      const fallback = prompt.trim() + ", photorealistic 8k, highly detailed, cinematic dramatic lighting, sharp focus";
      setPrompt(fallback);
      showToast("Applied photographic details tag! ✨");
    }
  };

  // ── Image Generation ──
  const generateImage = async () => {
    const finalPrompt = prompt.trim();
    if (!finalPrompt) {
      showToast("Please enter a prompt first!", "error");
      return;
    }

    setImageUrl(null);
    setLoadFailed(false);
    setLoading(true);

    const detectedRatioId = detectRatioFromPrompt(finalPrompt);
    const finalRatioId = detectedRatioId || aspectRatio;
    if (detectedRatioId && detectedRatioId !== aspectRatio) setAspectRatio(detectedRatioId);

    const ratio = ASPECT_RATIOS.find((item) => item.id === finalRatioId) || ASPECT_RATIOS[0];
    const seed = Math.floor(Math.random() * 999999);

    // ── Recraft v4.1 Flash via Backend API ──
    if (model === "recraft") {
      try {
        const endpoints = [];
        if (API_BASE_URL) endpoints.push(`${API_BASE_URL}/api/image/recraft`);
        endpoints.push("/api/image/recraft");

        let recraftImageUrl = null;

        for (const ep of endpoints) {
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 55000);
            const resp = await fetch(ep, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt: finalPrompt,
                width: ratio.width,
                height: ratio.height,
              }),
              signal: controller.signal,
            });
            clearTimeout(timer);

            if (resp.ok) {
              const data = await resp.json();
              if (data.success && (data.imageUrl || data.dataUrl)) {
                recraftImageUrl = data.imageUrl || data.dataUrl;
                break;
              }
            }
          } catch (e) {
            console.warn("Recraft endpoint:", ep, e.message);
          }
        }

        if (recraftImageUrl) {
          const result = {
            url: recraftImageUrl,
            prompt: finalPrompt,
            model: "recraft",
            ratio: finalRatioId,
            seed,
            id: Date.now(),
          };
          setImageUrl(recraftImageUrl);
          setActiveResult(result);
          setLoading(false);
          saveHistory([result, ...history].slice(0, 40));
          showToast("✨ Recraft v4.1 masterpiece rendered!");
        } else {
          setLoading(false);
          setLoadFailed(true);
          showToast("Recraft took too long or API is busy. Try Flux or retry.", "error");
        }
      } catch (err) {
        setLoading(false);
        setLoadFailed(true);
        showToast("Generation error: " + (err.message || "Failed"), "error");
      }
      return;
    }

    // ── Pollinations Standard Generation ──
    const url = buildImageUrl(finalPrompt, {
      width: ratio.width,
      height: ratio.height,
      model,
      seed,
      enhance: true,
    });

    const loadWithUrl = (genUrl, isRetry = false) => {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.src = genUrl;

      img.onload = () => {
        const result = {
          url: genUrl,
          prompt: finalPrompt,
          model,
          ratio: finalRatioId,
          seed,
          id: Date.now(),
        };
        setImageUrl(genUrl);
        setActiveResult(result);
        setLoading(false);
        saveHistory([result, ...history].slice(0, 40));
        showToast("Masterpiece generated! ✨");
      };

      img.onerror = () => {
        if (!isRetry) {
          const retrySeed = Math.floor(Math.random() * 999999);
          const fallbackModel = model === "flux" ? "turbo" : "flux";
          const retryUrl = buildImageUrl(finalPrompt, {
            width: ratio.width,
            height: ratio.height,
            model: fallbackModel,
            seed: retrySeed,
            enhance: true,
          });
          loadWithUrl(retryUrl, true);
          return;
        }

        setLoading(false);
        setLoadFailed(true);
        showToast("Generation failed. Please retry.", "error");
      };
    };

    loadWithUrl(url);
  };

  const handleDownload = async (url) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = `nexuss_art_${Date.now()}.png`;
      anchor.click();
      URL.revokeObjectURL(blobUrl);
      showToast("Download started! 📥");
    } catch {
      window.open(url, "_blank");
      showToast("Opening high-res image in new tab");
    }
  };

  const handleCopyPrompt = (textToCopy) => {
    navigator.clipboard.writeText(textToCopy);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
    showToast("Prompt copied to clipboard! 📋");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      generateImage();
    }
  };

  const activeRatioConfig = ASPECT_RATIOS.find((r) => r.id === (activeResult?.ratio || aspectRatio)) || ASPECT_RATIOS[0];
  const activeModelConfig = MODELS.find((m) => m.id === (activeResult?.model || model)) || MODELS[0];

  return (
    <div className="studio-root">
      {/* ── TOP HEADER / NAV BAR ── */}
      <header className="studio-nav">
        <div className="studio-brand">
          <div className="studio-badge-icon">
            <Sparkles size={18} />
          </div>
          <div>
            <h1 className="studio-title">AI Image Studio</h1>
            <p className="studio-caption">State-of-the-Art Generative Visual Engine</p>
          </div>
        </div>

        <div className="studio-header-tabs">
          <button
            onClick={() => setActiveTab("create")}
            className={`studio-tab-btn ${activeTab === "create" ? "active" : ""}`}
          >
            <SlidersHorizontal size={14} />
            <span>Studio</span>
          </button>
          <button
            onClick={() => setActiveTab("gallery")}
            className={`studio-tab-btn ${activeTab === "gallery" ? "active" : ""}`}
          >
            <Layers size={14} />
            <span>History ({history.length})</span>
          </button>
        </div>
      </header>

      {/* ── VIEW: STUDIO CREATE ── */}
      {activeTab === "create" && (
        <div className="studio-grid">
          {/* ── LEFT: WORKSPACE CONTROLS ── */}
          <div className="studio-controls-card">
            {/* Prompt Section */}
            <div className="control-group">
              <div className="group-header">
                <span className="group-label">Description & Prompt</span>
                <div className="prompt-actions-mini">
                  <button
                    type="button"
                    onClick={handleRandomPrompt}
                    className="ghost-pill-btn"
                    title="Generate a random creative prompt"
                  >
                    <Dices size={12} />
                    <span>Surprise Me</span>
                  </button>
                  {prompt.trim() && (
                    <button
                      type="button"
                      onClick={() => setPrompt("")}
                      className="ghost-pill-btn text-danger"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="textarea-wrapper">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe your vision in detail... e.g. An astronaut exploring an ancient bioluminescent crystal city on Mars, 8k cinematic lighting, octane render..."
                  rows={4}
                  className="studio-textarea"
                />
              </div>

              {/* Toolbar beneath textarea */}
              <div className="prompt-footer-row">
                <button
                  type="button"
                  onClick={enhancePromptWithAI}
                  disabled={isEnhancingPrompt || !prompt.trim()}
                  className="magic-enhance-btn"
                >
                  {isEnhancingPrompt ? (
                    <>
                      <RefreshCw size={13} className="spin-icon" />
                      <span>Enhancing Prompt...</span>
                    </>
                  ) : (
                    <>
                      <Wand2 size={13} />
                      <span>AI Magic Enhance</span>
                    </>
                  )}
                </button>

                <span className="char-badge">{prompt.length} chars</span>
              </div>
            </div>

            {/* Quick Style Chips */}
            <div className="control-group">
              <span className="group-label">Artistic Styles</span>
              <div className="chips-flex">
                {STYLES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => appendStyle(s.suffix)}
                    className="style-chip"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Model Selector */}
            <div className="control-group">
              <span className="group-label">Select Generator Model</span>
              <div className="model-selector-grid">
                {MODELS.map((m) => {
                  const isSelected = model === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setModel(m.id)}
                      className={`model-card-btn ${isSelected ? "selected" : ""}`}
                    >
                      <div className="model-card-top">
                        <span className="model-name">{m.label}</span>
                        <span className={`badge-pill ${m.badge.toLowerCase()}`}>{m.badge}</span>
                      </div>
                      <span className="model-sub">{m.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Aspect Ratio Selector */}
            <div className="control-group">
              <span className="group-label">Aspect Ratio</span>
              <div className="ratio-selector-grid">
                {ASPECT_RATIOS.map((r) => {
                  const isSelected = aspectRatio === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setAspectRatio(r.id)}
                      className={`ratio-card-btn ${isSelected ? "selected" : ""}`}
                    >
                      <span className="ratio-icon">{r.icon}</span>
                      <span className="ratio-name">{r.label}</span>
                      <span className="ratio-sub">{r.id}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Main Action Button */}
            <button
              type="button"
              onClick={generateImage}
              disabled={loading || !prompt.trim()}
              className="generate-action-btn"
            >
              {loading ? (
                <>
                  <RefreshCw size={18} className="spin-icon" />
                  <span>Weaving Pixels...</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>Generate Masterpiece</span>
                  <span className="shortcut-hint">Ctrl + ↵</span>
                </>
              )}
            </button>
          </div>

          {/* ── RIGHT: HERO CANVAS ── */}
          <div className="studio-canvas-card">
            {/* 1. Loading State */}
            {loading && (
              <div className="canvas-state-center">
                <div className="render-pulse-ring">
                  <Sparkles size={32} color="#06b6d4" />
                </div>
                <h3 className="state-headline">Rendering Your Vision</h3>
                <p className="state-sub">
                  Synthesizing pixels using <strong style={{ color: "#22d3ee" }}>{activeModelConfig.label}</strong>
                </p>
                <div className="render-progress-bar">
                  <div className="render-progress-fill" />
                </div>
              </div>
            )}

            {/* 2. Error / Failed State */}
            {loadFailed && !loading && (
              <div className="canvas-state-center">
                <div className="error-icon-box">⚠️</div>
                <h3 className="state-headline" style={{ color: "#f87171" }}>Generation Interrupted</h3>
                <p className="state-sub">The render engine encountered a brief hiccup. Please retry.</p>
                <button type="button" onClick={generateImage} className="retry-btn">
                  <RefreshCw size={14} />
                  <span>Retry Generation</span>
                </button>
              </div>
            )}

            {/* 3. Empty Canvas State */}
            {!imageUrl && !loading && !loadFailed && (
              <div className="canvas-state-center">
                <div className="empty-sparkle-box">
                  <ImageIcon size={44} color="#06b6d4" />
                </div>
                <h3 className="state-headline">Your Masterpiece Canvas</h3>
                <p className="state-sub">
                  Enter a prompt on the left or click <strong style={{ color: "#22d3ee" }}>"Surprise Me"</strong> to create high-resolution imagery.
                </p>
              </div>
            )}

            {/* 4. Loaded Active Image Result */}
            {imageUrl && !loading && (
              <div className="active-render-wrapper">
                <div className="image-viewport">
                  <img
                    src={imageUrl}
                    alt="AI Generated Artwork"
                    className="rendered-image"
                  />

                  {/* Floating Action Buttons */}
                  <div className="floating-action-bar">
                    <button
                      type="button"
                      onClick={() => setLightboxOpen(true)}
                      className="canvas-icon-btn"
                      title="Fullscreen Preview"
                    >
                      <Maximize2 size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyPrompt(activeResult?.prompt || prompt)}
                      className="canvas-icon-btn"
                      title="Copy Prompt"
                    >
                      {copiedPrompt ? <Check size={16} color="#4ade80" /> : <Copy size={16} />}
                    </button>
                    <button
                      type="button"
                      onClick={generateImage}
                      className="canvas-icon-btn"
                      title="Regenerate / Remix"
                    >
                      <RefreshCw size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload(imageUrl)}
                      className="canvas-primary-btn"
                    >
                      <Download size={15} />
                      <span>Download</span>
                    </button>
                  </div>
                </div>

                {/* Details Bar */}
                <div className="render-meta-card">
                  <div className="meta-info-row">
                    <div className="meta-tag">
                      <Zap size={13} color="#22d3ee" />
                      <span>{activeModelConfig.label}</span>
                    </div>
                    <div className="meta-tag">
                      <span>{activeRatioConfig.id}</span>
                    </div>
                    {activeResult?.seed && (
                      <div className="meta-tag">
                        <span>Seed: {activeResult.seed}</span>
                      </div>
                    )}
                  </div>
                  <p className="meta-prompt-text">"{activeResult?.prompt || prompt}"</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── VIEW: GALLERY TAB ── */}
      {activeTab === "gallery" && (
        <div className="gallery-view">
          <div className="gallery-header-row">
            <div>
              <h2 className="gallery-title">Your Creation History</h2>
              <p className="gallery-subtitle">{history.length} pieces created in this workspace</p>
            </div>
            {history.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Are you sure you want to clear your generation history?")) {
                    saveHistory([]);
                    showToast("History cleared");
                  }
                }}
                className="clear-history-btn"
              >
                <Trash2 size={14} />
                <span>Clear History</span>
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div className="empty-gallery-state">
              <ImageIcon size={48} color="#4b5563" />
              <p>No creations yet. Head over to the Studio tab to create your first artwork!</p>
              <button onClick={() => setActiveTab("create")} className="start-creating-btn">
                Open Studio
              </button>
            </div>
          ) : (
            <div className="gallery-masonry-grid">
              {history.map((item) => (
                <div key={item.id} className="gallery-card">
                  <img src={item.url} alt={item.prompt} loading="lazy" />
                  <div className="gallery-card-overlay">
                    <p className="gallery-card-prompt">{item.prompt}</p>
                    <div className="gallery-card-actions">
                      <button
                        type="button"
                        onClick={() => {
                          setPrompt(item.prompt);
                          setModel(item.model || "flux");
                          setAspectRatio(item.ratio || "1:1");
                          setImageUrl(item.url);
                          setActiveResult(item);
                          setActiveTab("create");
                          showToast("Loaded artwork into Studio!");
                        }}
                        className="overlay-btn"
                        title="Load into Studio"
                      >
                        <ArrowUpRight size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownload(item.url)}
                        className="overlay-btn"
                        title="Download"
                      >
                        <Download size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = history.filter((h) => h.id !== item.id);
                          saveHistory(updated);
                          showToast("Removed from history");
                        }}
                        className="overlay-btn text-danger"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── LIGHTBOX MODAL ── */}
      {lightboxOpen && imageUrl && (
        <div className="lightbox-backdrop" onClick={() => setLightboxOpen(false)}>
          <button
            type="button"
            className="lightbox-close-btn"
            onClick={() => setLightboxOpen(false)}
          >
            <X size={24} />
          </button>
          <img
            src={imageUrl}
            alt="Enlarged Artwork"
            className="lightbox-image"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Toast Notification */}
      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* ── ULTRA-CLEAN MODERN CSS ── */}
      <style>{`
        @keyframes toastSlide {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 25px rgba(6, 182, 212, 0.25); transform: scale(1); }
          50% { box-shadow: 0 0 50px rgba(6, 182, 212, 0.55); transform: scale(1.05); }
        }
        @keyframes progressSlide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }

        .spin-icon { animation: spin 0.8s linear infinite; }

        .studio-root {
          max-width: 1360px;
          margin: 0 auto;
          padding: 24px 28px;
          min-height: 100vh;
          font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        /* ── Header ── */
        .studio-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }
        .studio-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .studio-badge-icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: linear-gradient(135deg, #06b6d4, #6366f1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 4px 18px rgba(6, 182, 212, 0.35);
        }
        .studio-title {
          font-size: 22px;
          font-weight: 800;
          margin: 0;
          letter-spacing: -0.4px;
          color: #f1f5f9;
        }
        .studio-caption {
          font-size: 12px;
          color: #94a3b8;
          margin: 2px 0 0 0;
          font-weight: 500;
        }

        .studio-header-tabs {
          display: flex;
          background: rgba(15, 23, 42, 0.65);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 4px;
          gap: 4px;
        }
        .studio-tab-btn {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 8px 16px;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: #94a3b8;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .studio-tab-btn.active {
          background: rgba(6, 182, 212, 0.15);
          color: #22d3ee;
        }
        .studio-tab-btn:hover:not(.active) {
          color: #e2e8f0;
        }

        /* ── Studio Layout Grid ── */
        .studio-grid {
          display: grid;
          grid-template-columns: 460px 1fr;
          gap: 24px;
          align-items: start;
        }

        @media (max-width: 1024px) {
          .studio-grid { grid-template-columns: 1fr; }
        }

        /* ── Controls Card ── */
        .studio-controls-card {
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.35);
        }

        .control-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .group-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .group-label {
          font-size: 11px;
          font-weight: 800;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }
        .prompt-actions-mini {
          display: flex;
          gap: 6px;
        }
        .ghost-pill-btn {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #94a3b8;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: all 0.15s ease;
        }
        .ghost-pill-btn:hover {
          background: rgba(6, 182, 212, 0.15);
          color: #22d3ee;
          border-color: rgba(6, 182, 212, 0.3);
        }
        .ghost-pill-btn.text-danger:hover {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
          border-color: rgba(239, 68, 68, 0.3);
        }

        .textarea-wrapper {
          position: relative;
        }
        .studio-textarea {
          width: 100%;
          box-sizing: border-box;
          background: rgba(2, 6, 23, 0.55);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 14px;
          padding: 14px;
          color: #f8fafc;
          font-size: 13px;
          line-height: 1.6;
          resize: vertical;
          min-height: 95px;
          outline: none;
          font-family: inherit;
          transition: all 0.2s ease;
        }
        .studio-textarea:focus {
          border-color: #06b6d4;
          box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.2);
        }
        .studio-textarea::placeholder {
          color: #64748b;
        }

        .prompt-footer-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 2px 2px 0 2px;
        }
        .magic-enhance-btn {
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(6, 182, 212, 0.15));
          border: 1px solid rgba(6, 182, 212, 0.35);
          color: #22d3ee;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease;
        }
        .magic-enhance-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(6, 182, 212, 0.3));
          border-color: #06b6d4;
          transform: translateY(-1px);
        }
        .magic-enhance-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .char-badge {
          font-size: 11px;
          color: #64748b;
        }

        /* Style Chips */
        .chips-flex {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .style-chip {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #cbd5e1;
          padding: 5px 11px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .style-chip:hover {
          background: rgba(6, 182, 212, 0.15);
          border-color: rgba(6, 182, 212, 0.4);
          color: #22d3ee;
        }

        /* Models Grid */
        .model-selector-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
        }
        .model-card-btn {
          background: rgba(2, 6, 23, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 12px;
          padding: 10px 14px;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .model-card-btn:hover {
          background: rgba(6, 182, 212, 0.06);
          border-color: rgba(6, 182, 212, 0.3);
        }
        .model-card-btn.selected {
          background: rgba(6, 182, 212, 0.12);
          border: 1.5px solid #06b6d4;
          box-shadow: 0 4px 20px rgba(6, 182, 212, 0.2);
        }
        .model-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .model-name {
          font-size: 13px;
          font-weight: 700;
          color: #f1f5f9;
        }
        .model-card-btn.selected .model-name {
          color: #22d3ee;
        }
        .model-sub {
          font-size: 11px;
          color: #64748b;
        }
        .badge-pill {
          font-size: 9px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
          letter-spacing: 0.5px;
        }
        .badge-pill.popular { background: rgba(99, 102, 241, 0.25); color: #a5b4fc; }
        .badge-pill.new { background: rgba(34, 197, 94, 0.25); color: #86efac; }
        .badge-pill.fast { background: rgba(245, 158, 11, 0.25); color: #fde68a; }
        .badge-pill.art { background: rgba(236, 72, 153, 0.25); color: #fbcfe8; }
        .badge-pill.cgi { background: rgba(6, 182, 212, 0.25); color: #67e8f9; }

        /* Ratio Grid */
        .ratio-selector-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
        }
        .ratio-card-btn {
          background: rgba(2, 6, 23, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 12px;
          padding: 10px 6px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          transition: all 0.2s ease;
        }
        .ratio-card-btn:hover {
          border-color: rgba(6, 182, 212, 0.3);
        }
        .ratio-card-btn.selected {
          background: rgba(6, 182, 212, 0.12);
          border: 1.5px solid #06b6d4;
          box-shadow: 0 4px 15px rgba(6, 182, 212, 0.2);
        }
        .ratio-icon { font-size: 16px; }
        .ratio-name {
          font-size: 11px;
          font-weight: 700;
          color: #f1f5f9;
        }
        .ratio-card-btn.selected .ratio-name {
          color: #22d3ee;
        }
        .ratio-sub {
          font-size: 9px;
          color: #64748b;
        }

        /* Generate Button */
        .generate-action-btn {
          background: linear-gradient(135deg, #06b6d4, #6366f1);
          color: #ffffff;
          border: none;
          border-radius: 14px;
          padding: 16px;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          box-shadow: 0 6px 25px rgba(6, 182, 212, 0.4);
          transition: all 0.25s ease;
          position: relative;
        }
        .generate-action-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 35px rgba(6, 182, 212, 0.6);
        }
        .generate-action-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          box-shadow: none;
        }
        .shortcut-hint {
          font-size: 10px;
          background: rgba(255, 255, 255, 0.2);
          padding: 2px 6px;
          border-radius: 4px;
          color: #ffffff;
          margin-left: 6px;
        }

        /* ── Canvas Card ── */
        .studio-canvas-card {
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          min-height: 520px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          padding: 20px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.35);
        }

        .canvas-state-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 12px;
          max-width: 380px;
        }
        .render-pulse-ring {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: rgba(6, 182, 212, 0.1);
          border: 2px solid #06b6d4;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: pulseGlow 1.8s infinite ease-in-out;
        }
        .state-headline {
          font-size: 18px;
          font-weight: 700;
          color: #f1f5f9;
          margin: 0;
        }
        .state-sub {
          font-size: 13px;
          color: #94a3b8;
          margin: 0;
          line-height: 1.5;
        }
        .render-progress-bar {
          width: 220px;
          height: 4px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 4px;
          overflow: hidden;
          margin-top: 8px;
          position: relative;
        }
        .render-progress-fill {
          width: 50%;
          height: 100%;
          background: linear-gradient(90deg, #06b6d4, #6366f1);
          border-radius: 4px;
          animation: progressSlide 1.5s infinite linear;
        }

        .empty-sparkle-box {
          width: 76px;
          height: 76px;
          border-radius: 20px;
          background: rgba(6, 182, 212, 0.06);
          border: 1px dashed rgba(6, 182, 212, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 4px;
        }

        .error-icon-box {
          font-size: 40px;
          margin-bottom: 4px;
        }
        .retry-btn {
          margin-top: 8px;
          background: rgba(6, 182, 212, 0.15);
          border: 1px solid rgba(6, 182, 212, 0.4);
          color: #22d3ee;
          padding: 8px 16px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        /* ── Active Render Viewport ── */
        .active-render-wrapper {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .image-viewport {
          position: relative;
          width: 100%;
          max-height: 520px;
          border-radius: 16px;
          overflow: hidden;
          background: #020617;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 15px 45px rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .rendered-image {
          width: 100%;
          height: 100%;
          max-height: 520px;
          object-fit: contain;
          display: block;
        }

        /* Floating action buttons */
        .floating-action-bar {
          position: absolute;
          bottom: 16px;
          right: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          padding: 6px 8px;
          border-radius: 14px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
        }
        .canvas-icon-btn {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .canvas-icon-btn:hover {
          background: rgba(6, 182, 212, 0.2);
          color: #22d3ee;
          border-color: #06b6d4;
        }
        .canvas-primary-btn {
          background: linear-gradient(135deg, #06b6d4, #6366f1);
          color: #ffffff;
          border: none;
          padding: 0 16px;
          height: 36px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          box-shadow: 0 4px 15px rgba(6, 182, 212, 0.35);
          transition: all 0.2s ease;
        }
        .canvas-primary-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(6, 182, 212, 0.5);
        }

        /* Render Meta Card */
        .render-meta-card {
          background: rgba(2, 6, 23, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 14px;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .meta-info-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .meta-tag {
          font-size: 11px;
          color: #cbd5e1;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 3px 8px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          gap: 4px;
          font-weight: 600;
        }
        .meta-prompt-text {
          font-size: 12px;
          color: #94a3b8;
          margin: 0;
          line-height: 1.5;
          font-style: italic;
        }

        /* ── Gallery Tab ── */
        .gallery-view {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .gallery-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .gallery-title {
          font-size: 20px;
          font-weight: 800;
          color: #f1f5f9;
          margin: 0;
        }
        .gallery-subtitle {
          font-size: 13px;
          color: #64748b;
          margin: 4px 0 0 0;
        }
        .clear-history-btn {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #f87171;
          padding: 8px 14px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease;
        }
        .clear-history-btn:hover {
          background: rgba(239, 68, 68, 0.2);
        }

        .gallery-masonry-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
        }
        .gallery-card {
          position: relative;
          aspect-ratio: 1 / 1;
          border-radius: 14px;
          overflow: hidden;
          background: #020617;
          border: 1px solid rgba(255, 255, 255, 0.08);
          cursor: pointer;
          transition: transform 0.2s ease;
        }
        .gallery-card:hover {
          transform: translateY(-2px);
          border-color: rgba(6, 182, 212, 0.5);
        }
        .gallery-card img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .gallery-card-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.3) 50%, transparent 100%);
          opacity: 0;
          transition: opacity 0.2s ease;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 12px;
          gap: 8px;
        }
        .gallery-card:hover .gallery-card-overlay {
          opacity: 1;
        }
        .gallery-card-prompt {
          font-size: 11px;
          color: #e2e8f0;
          margin: 0;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .gallery-card-actions {
          display: flex;
          gap: 6px;
        }
        .overlay-btn {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .overlay-btn:hover {
          background: #06b6d4;
        }
        .overlay-btn.text-danger:hover {
          background: #ef4444;
        }

        .empty-gallery-state {
          padding: 80px 20px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          color: #64748b;
          font-size: 14px;
        }
        .start-creating-btn {
          background: linear-gradient(135deg, #06b6d4, #6366f1);
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 10px;
          font-weight: 700;
          cursor: pointer;
          margin-top: 8px;
        }

        /* ── Lightbox ── */
        .lightbox-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.92);
          backdrop-filter: blur(16px);
          z-index: 999999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          cursor: zoom-out;
        }
        .lightbox-image {
          max-width: 90vw;
          max-height: 90vh;
          object-fit: contain;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.15);
          cursor: default;
        }
        .lightbox-close-btn {
          position: absolute;
          top: 24px;
          right: 24px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #ffffff;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .lightbox-close-btn:hover {
          background: rgba(239, 68, 68, 0.8);
          border-color: #ef4444;
        }
      `}</style>
    </div>
  );
}
