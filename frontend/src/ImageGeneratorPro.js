import React, { useState } from "react";
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
  Check,
  ArrowUpRight,
  ImageIcon,
} from "lucide-react";
import API_BASE_URL from "./apiConfig";
import { detectRatioFromPrompt } from "./utils/helpers";

// ============================================================
// 🎨 AI IMAGE STUDIO — BEAST MODE (CLEAN & INTELLIGENT)
// - No manual model buttons: AI auto-routes under the hood
// - No manual ratio buttons: AI auto-detects from natural prompt
// - No manual style buttons: User controls style directly in prompt
// - AI Magic Enhance: Polishes simple prompts into 8K masterpieces
// - Full scrolling fix: Smooth native scrolling across all screens
// ============================================================

const ASPECT_RATIO_CONFIGS = {
  "16:9": { width: 1024, height: 576, label: "16:9 Widescreen", icon: "🌅" },
  "9:16": { width: 576, height: 1024, label: "9:16 Portrait / Story", icon: "📱" },
  "4:3": { width: 1024, height: 768, label: "4:3 Classic Photo", icon: "📺" },
  "1:1": { width: 1024, height: 1024, label: "1:1 Square", icon: "⏹️" },
};

const INSPIRATION_PROMPTS = [
  "A majestic white tiger with glowing bioluminescent cyan stripes in a mystical moonlit jungle, 8k cinematic lighting, 16:9",
  "Futuristic Formula 1 cyber car racing across a neon glass skybridge over neo-Tokyo at midnight, rain reflections, widescreen",
  "Astronaut discovering a giant glowing crystalline obelisk on an alien desert planet at sunset, photorealistic 8k, landscape",
  "Cozy lofi Japanese cafe during gentle snowfall, warm yellow lanterns, steaming coffee cup, Makoto Shinkai anime style, 16:9",
  "Cyberpunk samurai in ornate chrome armor standing beneath pouring neon rain, volumetric lighting, vertical portrait",
  "Hyper-realistic portrait of an ethereal celestial goddess with diamond jewelry and golden nebulae in the background, 8k",
  "Minimalist geometric vector logo of a roaring lion in gold and deep navy blue, clean lines, white background",
  "Ancient fantasy castle built into a towering misty waterfall, dramatic sunset rays, epic digital concept art, 16:9",
];

function selectFluxModelClient(promptText = "") {
  const p = promptText.toLowerCase();
  if (/\b(anime|manga|chibi|ghibli|waifu|shinkai|kawaii|comic|illustration)\b/.test(p)) {
    return "flux-anime";
  }
  if (/\b(3d|render|blender|octane|cgi|unreal|pixar|sculpture|isometric)\b/.test(p)) {
    return "flux-3d";
  }
  if (/\b(photo|portrait|realistic|realism|hyperrealistic|dslr|cinematic|camera|face|person|man|woman|nature|landscape)\b/.test(p)) {
    return "flux-realism";
  }
  return "flux";
}

function buildImageUrl(prompt, options = {}) {
  const {
    width = 1024,
    height = 1024,
    model = null,
    seed = Math.floor(Math.random() * 999999),
    enhance = false,
  } = options;

  const chosenModel = model || selectFluxModelClient(prompt);
  const promptBoost = `${prompt.trim()}, 8k uhd, highly detailed, professional masterpiece`;
  const encoded = encodeURIComponent(promptBoost);
  return `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&model=${chosenModel}&seed=${seed}&nologo=true&enhance=${enhance}`;
}

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
  const [imageUrl, setImageUrl] = useState(null);
  const [activeResult, setActiveResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [toast, setToast] = useState(null);
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
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
      try {
        // Fallback for quota: strip ultra-large base64 items for localStorage
        const sanitized = newHistory.slice(0, 10).map((item) => {
          if (item.url && item.url.startsWith("data:") && item.url.length > 250000) {
            return { ...item, url: "" };
          }
          return item;
        });
        localStorage.setItem("nexus_image_history", JSON.stringify(sanitized));
      } catch (err) {
        console.warn("Could not save history to localStorage", err);
      }
    }
  };

  // ── Smart Auto-Detection from Prompt ──
  const detectedRatio = detectRatioFromPrompt(prompt) || "1:1";
  const ratioConfig = ASPECT_RATIO_CONFIGS[detectedRatio] || ASPECT_RATIO_CONFIGS["1:1"];

  // ── Random Inspiration ──
  const handleRandomPrompt = () => {
    const randomIndex = Math.floor(Math.random() * INSPIRATION_PROMPTS.length);
    setPrompt(INSPIRATION_PROMPTS[randomIndex]);
    showToast("Loaded creative prompt idea! 🎲");
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
      const fallback = prompt.trim() + ", photorealistic 8k, highly detailed, dramatic lighting, sharp focus";
      setPrompt(fallback);
      showToast("Enhanced with cinematic details! ✨");
    }
  };

  // ── Intelligent Generation Engine (Prioritized Beast Waterfall) ──
  const generateImage = async () => {
    const finalPrompt = prompt.trim();
    if (!finalPrompt) {
      showToast("Please enter a prompt first!", "error");
      return;
    }

    setImageUrl(null);
    setLoadFailed(false);
    setLoading(true);

    // ── AI Decider: Perplexity Decision Engine for Precision Ratio & Genre ──
    let ratioId = detectRatioFromPrompt(finalPrompt) || "1:1";
    let detectedGenre = null;

    try {
      const deciderEndpoints = [];
      if (API_BASE_URL) deciderEndpoints.push(`${API_BASE_URL}/api/decider`);
      deciderEndpoints.push("/api/decider");

      for (const decEp of deciderEndpoints) {
        try {
          const decController = new AbortController();
          const decTimer = setTimeout(() => decController.abort(), 3500);
          const decRes = await fetch(decEp, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "image", prompt: finalPrompt }),
            signal: decController.signal,
          });
          clearTimeout(decTimer);

          if (decRes.ok) {
            const decData = await decRes.json();
            if (decData.success && decData.ratio) {
              ratioId = decData.ratio;
              detectedGenre = decData.genre;
              break;
            }
          }
        } catch (e) {}
      }
    } catch (e) {}

    const currentRatio = ASPECT_RATIO_CONFIGS[ratioId] || ASPECT_RATIO_CONFIGS["1:1"];
    const seed = Math.floor(Math.random() * 999999);

    // ── Prioritized Backend Engine Waterfall ──
    // 1. Recraft V4.1 Flash (8K-quality SOTA raster, photorealism & typography)
    // 2. Pollinations FLUX Smart Router (Realism / Anime / 3D with enhance=false)
    const endpoints = [];
    if (API_BASE_URL) {
      endpoints.push(`${API_BASE_URL}/api/image/generate`);
      endpoints.push(`${API_BASE_URL}/api/image/recraft`);
    }
    endpoints.push("/api/image/generate");
    endpoints.push("/api/image/recraft");

    let generatedArtUrl = null;
    let engineName = "Recraft V4.1 Flash";

    for (const ep of endpoints) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 50000);
        const resp = await fetch(ep, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: finalPrompt,
            width: currentRatio.width,
            height: currentRatio.height,
            genre: detectedGenre,
          }),
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (resp.ok) {
          const data = await resp.json();
          if (data.success && (data.dataUrl || data.imageUrl)) {
            generatedArtUrl = data.dataUrl || data.imageUrl;
            engineName = data.engine || "Recraft V4.1 Flash";
            break;
          }
        }
      } catch (e) {
        console.warn(`Endpoint ${ep} error:`, e.message);
      }
    }

    if (generatedArtUrl) {
      const result = {
        url: generatedArtUrl,
        prompt: finalPrompt,
        ratio: ratioId,
        genre: detectedGenre,
        engine: engineName,
        seed,
        id: Date.now(),
      };
      setImageUrl(generatedArtUrl);
      setActiveResult(result);
      setLoading(false);
      saveHistory([result, ...history].slice(0, 30));
      showToast(`✨ 8K Masterpiece created with ${engineName}!`);
      return;
    }

    // ── Direct Browser Fallback: FLUX Smart Router (enhance=false) ──
    const clientFluxUrl = buildImageUrl(finalPrompt, {
      width: currentRatio.width,
      height: currentRatio.height,
      seed,
      enhance: false,
    });

    const loadWithUrl = (genUrl, isRetry = false) => {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.src = genUrl;

      img.onload = () => {
        const result = {
          url: genUrl,
          prompt: finalPrompt,
          ratio: ratioId,
          engine: isRetry ? "SANA Fast Engine" : "FLUX Smart Router",
          seed,
          id: Date.now(),
        };
        setImageUrl(genUrl);
        setActiveResult(result);
        setLoading(false);
        saveHistory([result, ...history].slice(0, 30));
        showToast("✨ Masterpiece generated successfully!");
      };

      img.onerror = () => {
        if (!isRetry) {
          // Fallback to SANA high-speed model
          const retrySeed = Math.floor(Math.random() * 999999);
          const retryUrl = buildImageUrl(finalPrompt, {
            width: currentRatio.width,
            height: currentRatio.height,
            model: "sana",
            seed: retrySeed,
            enhance: false,
          });
          loadWithUrl(retryUrl, true);
          return;
        }

        setLoading(false);
        setLoadFailed(true);
        showToast("Generation failed. Please retry.", "error");
      };
    };

    loadWithUrl(clientFluxUrl);
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

  return (
    <div className="page-view beast-studio-page">
      {/* ── HEADER ── */}
      <div className="beast-header">
        <div className="beast-header-left">
          <div className="beast-icon-glow">
            <Sparkles size={20} />
          </div>
          <div>
            <h1 className="beast-title">AI Image Studio</h1>
            <p className="beast-subtitle">
              Type your vision naturally in plain words • AI automatically crafts the art & ratio
            </p>
          </div>
        </div>
      </div>

      {/* ── HERO PROMPT COMMAND BAR ── */}
      <div className="beast-command-card">
        <div className="prompt-input-row">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe anything you want to create... (e.g. 'Majestic white tiger in bioluminescent jungle, 16:9 widescreen' or 'Anime sunset cafe')"
            rows={3}
            className="beast-textarea"
          />
        </div>

        {/* Command Bar Footer with Live Intelligent Badges & Actions */}
        <div className="beast-command-footer">
          <div className="beast-badges-group">
            {/* Live Auto-detected Ratio Badge */}
            <div className="auto-ratio-badge" title="Auto-detected from your prompt words (16:9, portrait, landscape, square)">
              <span className="ratio-badge-icon">{ratioConfig.icon}</span>
              <span className="ratio-badge-text">
                Ratio: <strong>{ratioConfig.label}</strong>
              </span>
            </div>

            {/* Quick Actions */}
            <button
              type="button"
              onClick={enhancePromptWithAI}
              disabled={isEnhancingPrompt || !prompt.trim()}
              className="beast-tool-btn"
              title="Enhance prompt with 8K photorealistic lighting and detail"
            >
              {isEnhancingPrompt ? (
                <>
                  <RefreshCw size={13} className="spin-icon" />
                  <span>Enhancing...</span>
                </>
              ) : (
                <>
                  <Wand2 size={13} />
                  <span>AI Enhance</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleRandomPrompt}
              className="beast-tool-btn"
              title="Load a random creative prompt"
            >
              <Dices size={13} />
              <span>Surprise Me</span>
            </button>

            {prompt.trim() && (
              <button
                type="button"
                onClick={() => setPrompt("")}
                className="beast-tool-btn danger"
              >
                Clear
              </button>
            )}
          </div>

          {/* Big Radiant Generate Action Button */}
          <button
            type="button"
            onClick={generateImage}
            disabled={loading || !prompt.trim()}
            className="beast-generate-btn"
          >
            {loading ? (
              <>
                <RefreshCw size={18} className="spin-icon" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Sparkles size={18} />
                <span>Generate Art</span>
                <span className="key-hint">Ctrl + ↵</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── HERO OUTPUT CANVAS ── */}
      <div className="beast-canvas-section">
        {/* Loading State */}
        {loading && (
          <div className="beast-canvas-box loading-box">
            <div className="beast-pulse-ring">
              <Sparkles size={34} color="#06b6d4" />
            </div>
            <h3 className="canvas-state-title">Weaving High-Resolution Pixels</h3>
            <p className="canvas-state-desc">Synthesizing lighting, atmosphere and textures...</p>
            <div className="canvas-progress-track">
              <div className="canvas-progress-bar" />
            </div>
          </div>
        )}

        {/* Failed State */}
        {loadFailed && !loading && (
          <div className="beast-canvas-box error-box">
            <div className="error-badge-icon">⚠️</div>
            <h3 className="canvas-state-title" style={{ color: "#f87171" }}>Generation Interrupted</h3>
            <p className="canvas-state-desc">The render engine took too long. Let's retry.</p>
            <button type="button" onClick={generateImage} className="beast-retry-btn">
              <RefreshCw size={14} />
              <span>Retry Generation</span>
            </button>
          </div>
        )}

        {/* Empty Canvas Placeholder */}
        {!imageUrl && !loading && !loadFailed && (
          <div className="beast-canvas-box empty-box">
            <div className="empty-halo-icon">
              <ImageIcon size={44} color="#06b6d4" />
            </div>
            <h3 className="canvas-state-title">Your Masterpiece Canvas</h3>
            <p className="canvas-state-desc">
              Write any creative idea above or hit <strong style={{ color: "#22d3ee" }}>"Surprise Me"</strong> to create studio-quality visuals.
            </p>
            <div className="prompt-tip-chip">
              💡 <span>Tip: Mention aspect ratios like <strong>"16:9"</strong>, <strong>"landscape"</strong>, or <strong>"portrait"</strong> right in your prompt.</span>
            </div>
          </div>
        )}

        {/* Loaded Image Result */}
        {imageUrl && !loading && (
          <div className="beast-result-card">
            <div className="beast-image-container">
              <img
                src={imageUrl}
                alt="AI Masterpiece"
                className="beast-rendered-img"
              />

              {/* Floating Action Controls on Canvas */}
              <div className="canvas-floating-toolbar">
                <button
                  type="button"
                  onClick={() => setLightboxOpen(true)}
                  className="floating-action-btn"
                  title="Fullscreen Lightbox"
                >
                  <Maximize2 size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyPrompt(activeResult?.prompt || prompt)}
                  className="floating-action-btn"
                  title="Copy Prompt"
                >
                  {copiedPrompt ? <Check size={16} color="#4ade80" /> : <Copy size={16} />}
                </button>
                <button
                  type="button"
                  onClick={generateImage}
                  className="floating-action-btn"
                  title="Re-roll with new seed"
                >
                  <RefreshCw size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload(imageUrl)}
                  className="floating-download-btn"
                >
                  <Download size={15} />
                  <span>Download High-Res</span>
                </button>
              </div>
            </div>

            {/* Prompt details ribbon */}
            <div className="beast-details-ribbon">
              <div className="ribbon-tags">
                <span className="ribbon-tag">
                  {ratioConfig.icon} {ratioConfig.label}
                </span>
                {activeResult?.engine && (
                  <span className="ribbon-tag" style={{ color: "#22d3ee", borderColor: "rgba(6, 182, 212, 0.4)" }}>
                    ⚡ {activeResult.engine}
                  </span>
                )}
                {activeResult?.genre && (
                  <span className="ribbon-tag" style={{ color: "#a855f7", borderColor: "rgba(168, 85, 247, 0.4)" }}>
                    🎨 {activeResult.genre.replace("_", " ").toUpperCase()}
                  </span>
                )}
                {activeResult?.seed && (
                  <span className="ribbon-tag">Seed #{activeResult.seed}</span>
                )}
              </div>
              <p className="ribbon-prompt">"{activeResult?.prompt || prompt}"</p>
            </div>
          </div>
        )}
      </div>

      {/* ── RECENT CREATIONS GALLERY ── */}
      {history.length > 0 && (
        <div className="beast-gallery-section">
          <div className="gallery-section-header">
            <div>
              <h2 className="section-title">Recent Creations ({history.length})</h2>
              <p className="section-sub">Click any creation to reload its prompt onto your canvas</p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Clear all generation history?")) {
                  saveHistory([]);
                  showToast("History cleared");
                }
              }}
              className="gallery-clear-btn"
            >
              <Trash2 size={13} />
              <span>Clear History</span>
            </button>
          </div>

          <div className="beast-gallery-grid">
            {history.map((item) => (
              <div
                key={item.id}
                className="gallery-thumb-card"
                onClick={() => {
                  setPrompt(item.prompt);
                  setImageUrl(item.url);
                  setActiveResult(item);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                  showToast("Loaded artwork prompt! 🎨");
                }}
              >
                <img src={item.url} alt={item.prompt} loading="lazy" />
                <div className="gallery-thumb-overlay">
                  <p className="gallery-thumb-prompt">{item.prompt}</p>
                  <div className="thumb-action-row" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleDownload(item.url)}
                      className="thumb-mini-btn"
                      title="Download"
                    >
                      <Download size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = history.filter((h) => h.id !== item.id);
                        saveHistory(updated);
                        showToast("Removed from history");
                      }}
                      className="thumb-mini-btn danger"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPrompt(item.prompt);
                        setImageUrl(item.url);
                        setActiveResult(item);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="thumb-mini-btn primary"
                      title="Load"
                    >
                      <ArrowUpRight size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── LIGHTBOX MODAL ── */}
      {lightboxOpen && imageUrl && (
        <div className="beast-lightbox-backdrop" onClick={() => setLightboxOpen(false)}>
          <button
            type="button"
            className="beast-lightbox-close"
            onClick={() => setLightboxOpen(false)}
          >
            <X size={24} />
          </button>
          <img
            src={imageUrl}
            alt="Fullscreen Artwork"
            className="beast-lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Toast Notification */}
      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* ── STYLES (CLEAN, MODERN & FULLY SCROLLABLE) ── */}
      <style>{`
        @keyframes toastSlide {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulseHalo {
          0%, 100% { box-shadow: 0 0 25px rgba(6, 182, 212, 0.25); transform: scale(1); }
          50% { box-shadow: 0 0 50px rgba(6, 182, 212, 0.6); transform: scale(1.06); }
        }
        @keyframes progressSlide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }

        .spin-icon { animation: spin 0.8s linear infinite; }

        /* ── Full Scroll Container Fix ── */
        .beast-studio-page {
          max-width: 1200px !important;
          margin: 0 auto !important;
          padding: 24px 20px 80px 20px !important;
          height: 100% !important;
          overflow-y: auto !important;
          -webkit-overflow-scrolling: touch !important;
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        /* ── Header ── */
        .beast-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .beast-header-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .beast-icon-glow {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          background: linear-gradient(135deg, #06b6d4, #6366f1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 4px 20px rgba(6, 182, 212, 0.4);
        }
        .beast-title {
          font-size: 24px;
          font-weight: 800;
          margin: 0;
          color: #f8fafc;
          letter-spacing: -0.4px;
        }
        .beast-subtitle {
          font-size: 13px;
          color: #94a3b8;
          margin: 3px 0 0 0;
          font-weight: 500;
        }

        /* ── Command Bar Card ── */
        .beast-command-card {
          background: rgba(15, 23, 42, 0.7);
          backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 22px;
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4), inset 0 0 20px rgba(6, 182, 212, 0.03);
          transition: border-color 0.2s ease;
        }
        .beast-command-card:focus-within {
          border-color: rgba(6, 182, 212, 0.5);
          box-shadow: 0 10px 45px rgba(6, 182, 212, 0.15);
        }

        .prompt-input-row {
          width: 100%;
        }
        .beast-textarea {
          width: 100%;
          box-sizing: border-box;
          background: transparent;
          border: none;
          color: #f8fafc;
          font-size: 15px;
          line-height: 1.6;
          resize: vertical;
          min-height: 72px;
          outline: none;
          font-family: inherit;
        }
        .beast-textarea::placeholder {
          color: #64748b;
        }

        .beast-command-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          padding-top: 10px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .beast-badges-group {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        /* Auto-ratio badge */
        .auto-ratio-badge {
          background: rgba(6, 182, 212, 0.12);
          border: 1px solid rgba(6, 182, 212, 0.3);
          color: #22d3ee;
          padding: 6px 12px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .ratio-badge-icon { font-size: 14px; }
        .ratio-badge-text strong { color: #ffffff; }

        .beast-tool-btn {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.09);
          color: #cbd5e1;
          padding: 6px 12px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease;
        }
        .beast-tool-btn:hover:not(:disabled) {
          background: rgba(6, 182, 212, 0.15);
          color: #22d3ee;
          border-color: rgba(6, 182, 212, 0.4);
        }
        .beast-tool-btn.danger:hover {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
          border-color: rgba(239, 68, 68, 0.4);
        }
        .beast-tool-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Generate Button */
        .beast-generate-btn {
          background: linear-gradient(135deg, #06b6d4, #6366f1);
          color: #ffffff;
          border: none;
          padding: 11px 22px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 4px 20px rgba(6, 182, 212, 0.4);
          transition: all 0.2s ease;
        }
        .beast-generate-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 28px rgba(6, 182, 212, 0.6);
        }
        .beast-generate-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          box-shadow: none;
        }
        .key-hint {
          font-size: 10px;
          background: rgba(255, 255, 255, 0.2);
          padding: 2px 6px;
          border-radius: 4px;
        }

        /* ── Canvas Section ── */
        .beast-canvas-section {
          width: 100%;
        }

        .beast-canvas-box {
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          min-height: 480px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 36px 24px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        }

        .beast-pulse-ring {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: rgba(6, 182, 212, 0.1);
          border: 2px solid #06b6d4;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: pulseHalo 1.8s infinite ease-in-out;
          margin-bottom: 16px;
        }
        .empty-halo-icon {
          width: 80px;
          height: 80px;
          border-radius: 22px;
          background: rgba(6, 182, 212, 0.06);
          border: 1px dashed rgba(6, 182, 212, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
        }
        .error-badge-icon {
          font-size: 44px;
          margin-bottom: 12px;
        }

        .canvas-state-title {
          font-size: 20px;
          font-weight: 800;
          color: #f8fafc;
          margin: 0 0 6px 0;
        }
        .canvas-state-desc {
          font-size: 13px;
          color: #94a3b8;
          max-width: 440px;
          margin: 0;
          line-height: 1.6;
        }
        .canvas-progress-track {
          width: 240px;
          height: 4px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 4px;
          overflow: hidden;
          margin-top: 16px;
        }
        .canvas-progress-bar {
          width: 50%;
          height: 100%;
          background: linear-gradient(90deg, #06b6d4, #6366f1);
          border-radius: 4px;
          animation: progressSlide 1.5s infinite linear;
        }

        .prompt-tip-chip {
          margin-top: 20px;
          background: rgba(6, 182, 212, 0.08);
          border: 1px solid rgba(6, 182, 212, 0.2);
          border-radius: 12px;
          padding: 8px 16px;
          font-size: 12px;
          color: #cbd5e1;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .beast-retry-btn {
          margin-top: 16px;
          background: rgba(6, 182, 212, 0.15);
          border: 1px solid rgba(6, 182, 212, 0.4);
          color: #22d3ee;
          padding: 9px 18px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        /* ── Loaded Image Masterpiece Card ── */
        .beast-result-card {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .beast-image-container {
          position: relative;
          width: 100%;
          max-height: 600px;
          border-radius: 20px;
          overflow: hidden;
          background: #020617;
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .beast-rendered-img {
          width: 100%;
          height: 100%;
          max-height: 600px;
          object-fit: contain;
          display: block;
        }

        /* Floating action buttons */
        .canvas-floating-toolbar {
          position: absolute;
          bottom: 16px;
          right: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          padding: 6px 8px;
          border-radius: 14px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        }
        .floating-action-btn {
          width: 38px;
          height: 38px;
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
        .floating-action-btn:hover {
          background: rgba(6, 182, 212, 0.2);
          color: #22d3ee;
          border-color: #06b6d4;
        }
        .floating-download-btn {
          background: linear-gradient(135deg, #06b6d4, #6366f1);
          color: #ffffff;
          border: none;
          padding: 0 16px;
          height: 38px;
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
        .floating-download-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(6, 182, 212, 0.5);
        }

        /* Ribbon info */
        .beast-details-ribbon {
          background: rgba(15, 23, 42, 0.5);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 14px 18px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .ribbon-tags {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .ribbon-tag {
          font-size: 11px;
          color: #22d3ee;
          background: rgba(6, 182, 212, 0.1);
          border: 1px solid rgba(6, 182, 212, 0.25);
          padding: 3px 8px;
          border-radius: 6px;
          font-weight: 600;
        }
        .ribbon-prompt {
          font-size: 13px;
          color: #cbd5e1;
          margin: 0;
          line-height: 1.6;
          font-style: italic;
        }

        /* ── Recent Gallery Feed ── */
        .beast-gallery-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding-top: 10px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }
        .gallery-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .section-title {
          font-size: 18px;
          font-weight: 800;
          color: #f1f5f9;
          margin: 0;
        }
        .section-sub {
          font-size: 12px;
          color: #64748b;
          margin: 3px 0 0 0;
        }
        .gallery-clear-btn {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.25);
          color: #f87171;
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
        .gallery-clear-btn:hover {
          background: rgba(239, 68, 68, 0.2);
        }

        .beast-gallery-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 14px;
        }
        .gallery-thumb-card {
          position: relative;
          aspect-ratio: 1 / 1;
          border-radius: 14px;
          overflow: hidden;
          background: #020617;
          border: 1px solid rgba(255, 255, 255, 0.08);
          cursor: pointer;
          transition: transform 0.2s ease;
        }
        .gallery-thumb-card:hover {
          transform: translateY(-2px);
          border-color: rgba(6, 182, 212, 0.6);
        }
        .gallery-thumb-card img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .gallery-thumb-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.3) 50%, transparent 100%);
          opacity: 0;
          transition: opacity 0.2s ease;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 10px;
          gap: 6px;
        }
        .gallery-thumb-card:hover .gallery-thumb-overlay {
          opacity: 1;
        }
        .gallery-thumb-prompt {
          font-size: 11px;
          color: #e2e8f0;
          margin: 0;
          line-height: 1.3;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .thumb-action-row {
          display: flex;
          gap: 5px;
        }
        .thumb-mini-btn {
          width: 28px;
          height: 28px;
          border-radius: 7px;
          background: rgba(255, 255, 255, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .thumb-mini-btn:hover { background: #06b6d4; }
        .thumb-mini-btn.danger:hover { background: #ef4444; }
        .thumb-mini-btn.primary { background: rgba(6, 182, 212, 0.8); }

        /* ── Fullscreen Lightbox ── */
        .beast-lightbox-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.94);
          backdrop-filter: blur(16px);
          z-index: 999999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          cursor: zoom-out;
        }
        .beast-lightbox-img {
          max-width: 92vw;
          max-height: 92vh;
          object-fit: contain;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.15);
          cursor: default;
        }
        .beast-lightbox-close {
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
        .beast-lightbox-close:hover {
          background: rgba(239, 68, 68, 0.8);
          border-color: #ef4444;
        }

        /* ══════════════════════════════════════════════
           LIGHT MODE OVERRIDES FOR AI IMAGE STUDIO
           ══════════════════════════════════════════════ */
        .light-mode .beast-title {
          color: #0f172a !important;
        }
        .light-mode .beast-subtitle {
          color: #64748b !important;
        }
        .light-mode .beast-command-card {
          background: #ffffff !important;
          border: 1px solid #cbd5e1 !important;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.03) !important;
        }
        .light-mode .beast-command-card:focus-within {
          border-color: #06b6d4 !important;
          box-shadow: 0 10px 35px rgba(6, 182, 212, 0.15) !important;
        }
        .light-mode .beast-textarea {
          color: #0f172a !important;
        }
        .light-mode .beast-textarea::placeholder {
          color: #94a3b8 !important;
        }
        .light-mode .beast-command-footer {
          border-top-color: #e2e8f0 !important;
        }
        .light-mode .auto-ratio-badge {
          background: #ecfeff !important;
          border-color: #a5f3fc !important;
          color: #0891b2 !important;
        }
        .light-mode .auto-ratio-badge strong {
          color: #0e7490 !important;
        }
        .light-mode .beast-tool-btn {
          background: #f1f5f9 !important;
          border-color: #cbd5e1 !important;
          color: #334155 !important;
        }
        .light-mode .beast-tool-btn:hover:not(:disabled) {
          background: #cffafe !important;
          color: #0891b2 !important;
          border-color: #06b6d4 !important;
        }
        .light-mode .beast-tool-btn.danger:hover {
          background: #fee2e2 !important;
          color: #dc2626 !important;
          border-color: #f87171 !important;
        }
        .light-mode .beast-canvas-box {
          background: #ffffff !important;
          border-color: #cbd5e1 !important;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05) !important;
        }
        .light-mode .empty-halo-icon {
          background: #ecfeff !important;
          border-color: #a5f3fc !important;
        }
        .light-mode .canvas-state-title {
          color: #0f172a !important;
        }
        .light-mode .canvas-state-desc {
          color: #475569 !important;
        }
        .light-mode .canvas-progress-track {
          background: #e2e8f0 !important;
        }
        .light-mode .prompt-tip-chip {
          background: #ecfeff !important;
          border-color: #a5f3fc !important;
          color: #0e7490 !important;
        }
        .light-mode .beast-image-container {
          background: #f8fafc !important;
          border-color: #cbd5e1 !important;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.08) !important;
        }
        .light-mode .canvas-floating-toolbar {
          background: rgba(255, 255, 255, 0.95) !important;
          border-color: #cbd5e1 !important;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12) !important;
        }
        .light-mode .floating-action-btn {
          background: #f1f5f9 !important;
          border-color: #cbd5e1 !important;
          color: #334155 !important;
        }
        .light-mode .floating-action-btn:hover {
          background: #cffafe !important;
          color: #0891b2 !important;
          border-color: #06b6d4 !important;
        }
        .light-mode .beast-details-ribbon {
          background: #ffffff !important;
          border-color: #cbd5e1 !important;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05) !important;
        }
        .light-mode .ribbon-tag {
          background: #ecfeff !important;
          border-color: #a5f3fc !important;
          color: #0891b2 !important;
        }
        .light-mode .ribbon-prompt {
          color: #334155 !important;
        }
        .light-mode .section-title {
          color: #0f172a !important;
        }
        .light-mode .section-sub {
          color: #64748b !important;
        }
        .light-mode .gallery-thumb-card {
          background: #f8fafc !important;
          border-color: #cbd5e1 !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05) !important;
        }
        .light-mode .beast-gallery-section {
          border-top-color: #e2e8f0 !important;
        }
        .light-mode .beast-lightbox-backdrop {
          background: rgba(15, 23, 42, 0.88) !important;
        }

        /* ── Responsive Mobile ── */
        @media (max-width: 640px) {
          .beast-command-footer {
            flex-direction: column;
            align-items: stretch;
          }
          .beast-badges-group {
            justify-content: space-between;
          }
          .beast-generate-btn {
            width: 100%;
            justify-content: center;
          }
          .canvas-floating-toolbar {
            bottom: 10px;
            right: 10px;
            left: 10px;
            justify-content: space-around;
          }
        }
      `}</style>
    </div>
  );
}
