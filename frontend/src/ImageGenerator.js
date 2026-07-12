import React, { useState, useRef } from "react";
import { Download, ImageIcon, Sparkles, RefreshCw, CheckCircle2, AlertCircle, Copy, Trash2, Upload, X, Settings, ChevronDown, ChevronUp } from "lucide-react";

// ── Pollinations.ai URL builder ──
function buildImageUrl(prompt, options = {}) {
  const {
    width  = 1024,
    height = 1024,
    model  = "flux",
    seed   = Math.floor(Math.random() * 999999),
    enhance = true,
    image   = null,
  } = options;

  const encoded = encodeURIComponent(prompt.trim());
  let url = `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&model=${model}&seed=${seed}&nologo=true&enhance=${enhance}`;
  if (image) {
    url += `&image=${encodeURIComponent(image)}`;
  }
  return url;
}

// ── Detect aspect ratio from prompt text ──
// Returns matching ASPECT_RATIOS id (e.g. "16:9") or null
function detectRatioFromPrompt(promptText) {
  const p = promptText.toLowerCase();
  // Explicit ratio keywords
  if (/\b16[:\sx]9\b/.test(p) || /\blandscape\s*ratio\b/.test(p) || /\bwidescreen\b/.test(p)) return "16:9";
  if (/\b9[:\sx]16\b/.test(p) || /\bportrait\s*ratio\b/.test(p) || /\bvertical\s*ratio\b/.test(p)) return "9:16";
  if (/\b4[:\sx]3\b/.test(p) || /\bclassic\s*ratio\b/.test(p)) return "4:3";
  if (/\b1[:\sx]1\b/.test(p) || /\bsquare\s*ratio\b/.test(p)) return "1:1";
  // Also detect dimension keywords without "ratio" word
  if (/\b(16x9|16[/]9)\b/.test(p)) return "16:9";
  if (/\b(9x16|9[/]16)\b/.test(p)) return "9:16";
  if (/\b(4x3|4[/]3)\b/.test(p)) return "4:3";
  return null;
}

// ── Models Data ──
const MODELS = [
  { id: "flux",          label: "⚡ Flux.1 (Premium)",    desc: "Best overall details, realism and quality" },
  { id: "turbo",         label: "🚀 Turbo (Fastest)",      desc: "Generates high quality art in seconds" },
  { id: "flux-realism",  label: "📷 Flux Realism",         desc: "Optimized for photographic styles" },
  { id: "flux-anime",    label: "🌸 Flux Anime",           desc: "Gorgeous anime and manga style art" },
  { id: "flux-3d",       label: "🎮 Flux 3D",              desc: "3D render, game assets and toy style" },
];

// ── Aspect Ratio options ──
const ASPECT_RATIOS = [
  { id: "1:1",  label: "Square",      width: 1024, height: 1024, icon: "⏹️", desc: "1024 × 1024" },
  { id: "16:9", label: "Landscape",   width: 1024, height: 576,  icon: "🌅", desc: "1024 × 576" },
  { id: "9:16", label: "Portrait",    width: 576,  height: 1024, icon: "📱", desc: "576 × 1024" },
  { id: "4:3",  label: "Classic",     width: 1024, height: 768,  icon: "📺", desc: "1024 × 768" },
];

// ── Quick suggestions ──
const SUGGESTIONS = [
  "Cyberpunk cat, neon details, 3D style",
  "Astronaut walking on Mars, cinematic",
  "Lofi study room, rain outside, cozy",
  "Floating fantasy castle, detailed art",
];

// ── Toast component ──
function Toast({ message, type }) {
  return (
    <div style={{
      position: "fixed", bottom: "80px", right: "20px",
      background: type === "error"
        ? "rgba(239,68,68,0.2)"
        : "rgba(6, 182, 212, 0.15)",
      border: `1px solid ${type === "error" ? "rgba(239,68,68,0.4)" : "rgba(6, 182, 212, 0.4)"}`,
      color: type === "error" ? "#f87171" : "#e0f7fa",
      padding: "14px 20px", borderRadius: "14px",
      fontSize: "14px", fontWeight: "600",
      backdropFilter: "blur(12px)", zIndex: 9999,
      animation: "slideUp 0.3s ease-out",
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      maxWidth: "320px", lineHeight: "1.5"
    }}>
      {message}
    </div>
  );
}

export default function ImageGenerator() {
  const [prompt, setPrompt]               = useState("");
  const [model, setModel]                 = useState("flux");
  const [aspectRatio, setAspectRatio]     = useState("1:1");
  const [enhance, setEnhance]             = useState(true);
  const [imageUrl, setImageUrl]           = useState(null);
  const [loading, setLoading]             = useState(false);
  const [loadFailed, setLoadFailed]       = useState(false);
  const [toast, setToast]                 = useState(null);
  
  // ── New Reference Image States ──
  const [refImage, setRefImage]           = useState(null); // Preview data URL
  const [refImageFile, setRefImageFile]   = useState(null); // Raw file
  const [refImageUrl, setRefImageUrl]     = useState(null); // Backend public hosted URL
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showAdvanced, setShowAdvanced]   = useState(false); // Collapsed by default

  const fileInputRef                      = useRef(null);

  // Load history from localStorage
  const [history, setHistory]             = useState(() => {
    try {
      const saved = localStorage.getItem("nexus_image_history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const saveHistory = (newHistory) => {
    setHistory(newHistory);
    try {
      localStorage.setItem("nexus_image_history", JSON.stringify(newHistory));
    } catch (e) {
      console.warn("Could not save history to localStorage", e);
    }
  };

  // ── File Upload / Drag & Drop Handlers ──
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file) => {
    if (!file.type.startsWith("image/")) {
      showToast("Please upload an image file only!", "error");
      return;
    }
    setRefImageFile(file);
    setRefImageUrl(null);

    // Create a local data URL preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
      setRefImage(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  };

  const clearRefImage = () => {
    setRefImage(null);
    setRefImageFile(null);
    setRefImageUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const generateImage = async () => {
    if (!prompt.trim()) {
      showToast("Please enter a prompt first!", "error");
      return;
    }

    setImageUrl(null);
    setLoadFailed(false);
    setLoading(true);

    let activeImageUrl = null;

    // ── If reference image provided, upload it to get a public URL ──────────
    if (refImageFile && !refImageUrl) {
      setUploadingImage(true);
      showToast("⬆️ Uploading reference image...");
      try {
        const formData = new FormData();
        formData.append("file", refImageFile);

        const res = await fetch("https://tmpfiles.org/api/v1/upload", {
          method: "POST",
          body: formData
        });

        const data = await res.json();
        if (!res.ok || data.status !== "success" || !data.data || !data.data.url) {
          throw new Error(data?.message || "Upload to tmpfiles failed");
        }

        // Convert tmpfiles link to direct download link:
        // https://tmpfiles.org/12345/image.png -> https://tmpfiles.org/dl/12345/image.png
        const directUrl = data.data.url.replace("tmpfiles.org/", "tmpfiles.org/dl/");

        setRefImageUrl(directUrl);
        activeImageUrl = directUrl;
        showToast("Reference image ready! 🖼️");
      } catch (err) {
        console.error("❌ Image upload failed:", err);
        showToast("Image upload failed. Try again with another image.", "error");
        setLoading(false);
        setUploadingImage(false);
        return;
      } finally {
        setUploadingImage(false);
      }
    } else if (refImageUrl) {
      activeImageUrl = refImageUrl;
    }

    // Auto-detect ratio from prompt text; user can override via UI buttons
    const detectedRatioId = detectRatioFromPrompt(prompt);
    const finalRatioId = detectedRatioId || aspectRatio;
    if (detectedRatioId && detectedRatioId !== aspectRatio) {
      setAspectRatio(detectedRatioId);
    }
    const ratio = ASPECT_RATIOS.find(r => r.id === finalRatioId) || ASPECT_RATIOS[0];
    const seed = Math.floor(Math.random() * 999999);

    const url = buildImageUrl(prompt, {
      width: ratio.width,
      height: ratio.height,
      model,
      seed,
      enhance,
      image: activeImageUrl
    });

    const loadWithUrl = (genUrl, isRetry = false) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = genUrl;

      img.onload = () => {
        setImageUrl(genUrl);
        setLoading(false);
        const newHistory = [
          { url: genUrl, prompt: prompt.trim(), model, ratio: finalRatioId, seed, id: Date.now() },
          ...history
        ].slice(0, 30);
        saveHistory(newHistory);
        showToast("Image generated successfully! ✨");
      };

      img.onerror = () => {
        if (!isRetry) {
          // Auto-retry once with a new seed
          const retrySeed = Math.floor(Math.random() * 999999);
          const retryUrl = buildImageUrl(prompt, {
            width: ratio.width,
            height: ratio.height,
            model,
            seed: retrySeed,
            enhance,
            image: activeImageUrl
          });
          loadWithUrl(retryUrl, true);
        } else {
          setLoading(false);
          setLoadFailed(true);
          showToast(
            activeImageUrl
              ? "Image editing failed. Try a different prompt or model."
              : "Generation failed. Check your network connection.",
            "error"
          );
        }
      };
    };

    loadWithUrl(url);
  };

  const handleDownload = async (url) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `nexuss_ai_${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(blobUrl);
      showToast("Download started! 📥");
    } catch {
      window.open(url, "_blank");
      showToast("Opening image in new tab.");
    }
  };

  const copyUrlToClipboard = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      showToast("Direct URL copied to clipboard! 📋");
    } catch {
      showToast("Failed to copy URL.", "error");
    }
  };

  const deleteItem = (id, e) => {
    e.stopPropagation();
    const newHistory = history.filter(item => item.id !== id);
    saveHistory(newHistory);
    showToast("Removed from history.");
    // If the active viewed image was deleted, clear active view
    const deletedItem = history.find(item => item.id === id);
    if (deletedItem && imageUrl === deletedItem.url) {
      setImageUrl(null);
    }
  };

  const clearHistory = () => {
    if (window.confirm("Are you sure you want to clear your generation history?")) {
      saveHistory([]);
      setImageUrl(null);
      showToast("History cleared.");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      generateImage();
    }
  };

  return (
    <div className="page-view img-gen-page" style={{ maxWidth: "1280px", margin: "0 auto" }}>
      
      {/* ── Title Card ── */}
      <div className="img-gen-header">
        <div>
          <h2 className="img-gen-title">
            🎨 AI Image Generator
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <CheckCircle2 size={15} color="#4ade80" />
            <p className="img-gen-subtitle">
              Powered by ⚡ Pollinations AI (Flux) • 100% Free • No Login Required
            </p>
          </div>
        </div>
      </div>

      {/* ── Workspace Grid ── */}
      <div className="img-gen-workspace-grid">
        
        {/* ── LEFT PANE: Generator Controls ── */}
        <div className="img-gen-panel">
          
          {/* Prompt Section */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <label style={{
              fontSize: "12px", fontWeight: "800", color: "#22d3ee",
              textTransform: "uppercase", letterSpacing: "0.8px"
            }}>
              🖊️ Image Prompt
            </label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you want to see... e.g. A majestic white owl in a magical fantasy library, oil painting style..."
              rows={4}
              style={{
                width: "100%", boxSizing: "border-box",
                background: "rgba(0, 0, 0, 0.3)", border: "1px solid rgba(6, 182, 212, 0.25)",
                borderRadius: "16px", padding: "14px 16px", color: "#f3f4f6",
                fontSize: "15px", lineHeight: "1.6", resize: "vertical", outline: "none",
                fontFamily: "Outfit, Inter, sans-serif", transition: "all 0.2s"
              }}
              onFocus={e => (e.target.style.borderColor = "rgba(6, 182, 212, 0.7)")}
              onBlur={e  => (e.target.style.borderColor = "rgba(6, 182, 212, 0.25)")}
            />
            {/* AI Image Generate Badge */}
            <div style={{
              display: "flex", alignItems: "center", gap: "8px",
              marginTop: "8px", marginBottom: "2px"
            }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: "7px",
                background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(6,182,212,0.18))",
                border: "1px solid rgba(16,185,129,0.35)",
                borderRadius: "30px", padding: "5px 14px 5px 8px",
                boxShadow: "0 0 14px rgba(6,182,212,0.18), 0 0 6px rgba(16,185,129,0.12)",
              }}>
                {/* Animated glowing dot */}
                <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{
                    display: "block", width: "9px", height: "9px", borderRadius: "50%",
                    background: "linear-gradient(135deg, #10b981, #06b6d4)",
                    boxShadow: "0 0 8px #10b981, 0 0 4px #06b6d4",
                    animation: "imgGenPulse 1.8s ease-in-out infinite"
                  }} />
                </span>
                {/* Icon SVG — sparkle / image stars */}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                  <defs>
                    <linearGradient id="imgBadgeGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#10b981"/>
                      <stop offset="100%" stopColor="#06b6d4"/>
                    </linearGradient>
                  </defs>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="url(#imgBadgeGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  <circle cx="9" cy="9" r="1.5" fill="url(#imgBadgeGrad)"/>
                  <path d="M21 15l-5-5L7 17" stroke="url(#imgBadgeGrad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span style={{
                  fontSize: "11px", fontWeight: "700", letterSpacing: "0.4px",
                  background: "linear-gradient(90deg, #10b981, #06b6d4)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  backgroundClip: "text"
                }}>
                  AI Image Generate
                </span>
              </div>
            </div>
            {/* Keyframe for pulse — injected once */}
            <style>{`
              @keyframes imgGenPulse {
                0%, 100% { transform: scale(1); opacity: 1; box-shadow: 0 0 8px #10b981, 0 0 4px #06b6d4; }
                50% { transform: scale(1.5); opacity: 0.6; box-shadow: 0 0 16px #10b981, 0 0 10px #06b6d4; }
              }
            `}</style>
            {/* Quick Suggestions */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => setPrompt(s)} style={{
                  background: "rgba(6, 182, 212, 0.05)", border: "1px solid rgba(6, 182, 212, 0.2)",
                  borderRadius: "20px", padding: "5px 12px", fontSize: "11px",
                  color: "#22d3ee", cursor: "pointer", transition: "all 0.2s", fontWeight: "500"
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(6, 182, 212, 0.15)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(6, 182, 212, 0.05)"; }}
                >
                  {s.length > 32 ? s.slice(0, 30) + "…" : s}
                </button>
              ))}
            </div>
            {/* Copy Prompt Button */}
            {prompt.trim() && (
              <button
                onClick={() => { navigator.clipboard.writeText(prompt).then(() => showToast("Prompt copied! 📋")).catch(() => showToast("Failed to copy.", "error")); }}
                style={{
                  alignSelf: "flex-start",
                  background: "rgba(6, 182, 212, 0.08)", border: "1px solid rgba(6, 182, 212, 0.2)",
                  borderRadius: "10px", padding: "6px 14px", fontSize: "11px",
                  color: "#22d3ee", cursor: "pointer", transition: "all 0.2s", fontWeight: "600",
                  display: "flex", alignItems: "center", gap: "5px"
                }}
              >
                <Copy size={12} /> Copy Prompt
              </button>
            )}
          </div>

          {/* Reference Image Section */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <label style={{
              fontSize: "12px", fontWeight: "800", color: "#22d3ee",
              textTransform: "uppercase", letterSpacing: "0.8px"
            }}>
              🖼️ Reference Image (Optional)
            </label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              style={{ display: "none" }}
            />
            {!refImage ? (
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                style={{
                  border: "2px dashed rgba(6, 182, 212, 0.25)",
                  borderRadius: "16px",
                  padding: "16px",
                  textAlign: "center",
                  background: "rgba(0, 0, 0, 0.2)",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "8px"
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = "rgba(6, 182, 212, 0.6)";
                  e.currentTarget.style.background = "rgba(6, 182, 212, 0.05)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = "rgba(6, 182, 212, 0.25)";
                  e.currentTarget.style.background = "rgba(0, 0, 0, 0.2)";
                }}
              >
                <Upload size={20} color="rgba(6, 182, 212, 0.6)" />
                <div style={{ fontSize: "12px", color: "#d1d5db", fontWeight: "600" }}>
                  Drag & Drop or Click to Upload
                </div>
                <div style={{ fontSize: "10px", color: "#9ca3af" }}>
                  Select an image to modify or transform
                </div>
              </div>
            ) : (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                background: "rgba(0, 0, 0, 0.25)",
                border: "1px solid rgba(6, 182, 212, 0.25)",
                borderRadius: "16px",
                padding: "10px",
                position: "relative"
              }}>
                <div style={{
                  width: "50px",
                  height: "50px",
                  borderRadius: "8px",
                  overflow: "hidden",
                  border: "1px solid rgba(6, 182, 212, 0.3)",
                  background: "#07070d",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <img src={refImage} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "12px", fontWeight: "600", color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {refImageFile ? refImageFile.name : "Selected Image"}
                  </div>
                  <div style={{ fontSize: "10px", color: uploadingImage ? "#38bdf8" : "#4ade80", display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                    {uploadingImage ? (
                      <>
                        <RefreshCw size={10} className="animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={10} />
                        <span>Ready!</span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearRefImage}
                  disabled={loading || uploadingImage}
                  style={{
                    background: "rgba(239, 68, 68, 0.15)",
                    color: "#f87171",
                    border: "none",
                    borderRadius: "50%",
                    width: "24px",
                    height: "24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(239, 68, 68, 0.3)"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)"}
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>
          {refImage && (
            <div style={{
              background: "rgba(6, 182, 212, 0.08)",
              border: "1px solid rgba(6, 182, 212, 0.25)",
              borderRadius: "10px",
              padding: "8px 12px",
              fontSize: "11px",
              color: "#22d3ee",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}>
              <span>💡</span>
              <span><strong>Tip:</strong> Write details in your prompt describing how you want to modify this reference image!</span>
            </div>
          )}

          {/* Toggle Advanced Options */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.05)",
              borderRadius: "14px",
              padding: "12px 16px",
              color: "#e5e7eb",
              fontSize: "13px",
              fontWeight: "700",
              cursor: "pointer",
              transition: "all 0.2s",
              marginTop: "6px",
              outline: "none"
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)"}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Settings size={16} style={{ color: "#22d3ee" }} />
              <span>Advanced Settings (Model, Ratio)</span>
            </div>
            {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showAdvanced && (
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "18px",
              padding: "16px",
              background: "rgba(0, 0, 0, 0.15)",
              border: "1px solid rgba(255, 255, 255, 0.05)",
              borderRadius: "16px",
              animation: "fadeIn 0.2s ease-out"
            }}>
              {/* Model Selector */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <label style={{
                  fontSize: "11px", fontWeight: "800", color: "#22d3ee",
                  textTransform: "uppercase", letterSpacing: "0.8px"
                }}>
                  🤖 AI Model
                </label>
                <div className="img-gen-model-grid">
                  {MODELS.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setModel(m.id)}
                      style={{
                        padding: "10px 12px", borderRadius: "12px",
                        cursor: "pointer", transition: "all 0.2s", textAlign: "left",
                        background: model === m.id ? "rgba(6, 182, 212, 0.12)" : "rgba(0, 0, 0, 0.25)",
                        border: model === m.id ? "2px solid rgba(6, 182, 212, 0.75)" : "1px solid rgba(255, 255, 255, 0.05)",
                        boxShadow: model === m.id ? "0 4px 15px rgba(6, 182, 212, 0.2)" : "none"
                      }}
                    >
                      <div style={{ fontSize: "12px", fontWeight: "700", color: model === m.id ? "#22d3ee" : "#d1d5db" }}>
                        {m.label}
                      </div>
                      <div style={{ fontSize: "9px", color: "#9ca3af", marginTop: "2px", lineHeight: "1.3" }}>
                        {m.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Aspect Ratio Selector */}
              <div className="img-gen-ratio-wrapper" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <label style={{
                  fontSize: "11px", fontWeight: "800", color: "#22d3ee",
                  textTransform: "uppercase", letterSpacing: "0.8px"
                }}>
                  📐 Aspect Ratio
                </label>
                <div className="img-gen-ratio-grid">
                  {ASPECT_RATIOS.map(ratio => (
                    <button
                      key={ratio.id}
                      onClick={() => setAspectRatio(ratio.id)}
                      style={{
                        padding: "8px 6px", borderRadius: "10px", cursor: "pointer",
                        transition: "all 0.2s", textAlign: "center",
                        background: aspectRatio === ratio.id ? "rgba(6, 182, 212, 0.12)" : "rgba(0, 0, 0, 0.25)",
                        border: aspectRatio === ratio.id ? "2px solid rgba(6, 182, 212, 0.75)" : "1px solid rgba(255, 255, 255, 0.05)"
                      }}
                    >
                      <div style={{ fontSize: "16px", marginBottom: "2px" }}>{ratio.icon}</div>
                      <div style={{ fontSize: "10px", fontWeight: "700", color: "#e5e7eb" }}>{ratio.label}</div>
                      <div style={{ fontSize: "8px", color: "#9ca3af", marginTop: "1px" }}>{ratio.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced Switches */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "4px" }}>
                <div>
                  <span style={{ fontSize: "13px", fontWeight: "600", color: "#e5e7eb", display: "block" }}>Enhance Prompt</span>
                  <span style={{ fontSize: "10px", color: "#9ca3af" }}>Automatically add details to prompt</span>
                </div>
                <label style={{ position: "relative", display: "inline-block", width: "44px", height: "24px" }}>
                  <input
                    type="checkbox"
                    checked={enhance}
                    onChange={e => setEnhance(e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: "absolute", cursor: "pointer", top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: enhance ? "#06b6d4" : "rgba(255,255,255,0.1)",
                    transition: "0.3s", borderRadius: "24px"
                  }}>
                    <span style={{
                      position: "absolute", content: '""', height: "18px", width: "18px", left: "3px", bottom: "3px",
                      backgroundColor: "white", transition: "0.3s", borderRadius: "50%",
                      transform: enhance ? "translateX(20px)" : "translateX(0)"
                    }} />
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={generateImage}
            disabled={loading}
            style={{
              background: loading
                ? "rgba(6,182,212,0.25)"
                : "linear-gradient(135deg, #6366f1, #06b6d4)",
              color: "white", border: "none",
              padding: "16px 20px", borderRadius: "16px",
              fontWeight: "800", fontSize: "16px",
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
              transition: "all 0.2s",
              boxShadow: loading ? "none" : "0 6px 28px rgba(6,182,212,0.4)",
              marginTop: "8px"
            }}
          >
            {loading ? (
              <>
                <RefreshCw size={19} style={{ animation: "spin 0.8s linear infinite" }} />
                Creating Masterpiece...
              </>
            ) : (
              <>
                <Sparkles size={19} />
                Generate Masterpiece
              </>
            )}
          </button>
        </div>

        {/* ── RIGHT PANE: Output Canvas ── */}
        <div className="img-gen-panel img-gen-output-panel">
          
          {loading && (
            <div style={{
              width: "100%", height: "100%", minHeight: "360px",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: "20px", animation: "shimmer 1.8s infinite"
            }}>
              <div style={{
                position: "relative", width: "80px", height: "80px",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                <div style={{
                  position: "absolute", width: "100%", height: "100%",
                  border: "4px solid rgba(6, 182, 212, 0.15)", borderTopColor: "#06b6d4",
                  borderRadius: "50%", animation: "spin 1s linear infinite"
                }} />
                <Sparkles size={32} color="#06b6d4" style={{ animation: "pulse 1.5s infinite" }} />
              </div>
              <div style={{ textAlign: "center" }}>
                <h4 style={{ color: "#e9d5ff", fontSize: "16px", fontWeight: "700", margin: "0 0 6px 0" }}>
                  Rendering Masterpiece
                </h4>
                <p style={{ color: "#9ca3af", fontSize: "13px", margin: 0, padding: "0 20px" }}>
                  Injecting details and lightning layers. This takes a few seconds...
                </p>
              </div>
            </div>
          )}

          {loadFailed && !loading && (
            <div style={{
              padding: "40px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px",
              textAlign: "center"
            }}>
              <AlertCircle size={48} color="#ef4444" />
              <div>
                <h4 style={{ color: "#f87171", fontSize: "16px", fontWeight: "700", margin: "0 0 8px 0" }}>
                  Generation Interrupted
                </h4>
                <p style={{ color: "#9ca3af", fontSize: "13px", maxWidth: "300px", margin: 0 }}>
                  Pollinations AI server took too long to respond. Let's retry with a different configuration.
                </p>
              </div>
              <button onClick={generateImage} style={{
                background: "rgba(168,85,247,0.15)", color: "#c084fc", border: "1px solid rgba(168,85,247,0.3)",
                padding: "10px 20px", borderRadius: "10px", fontWeight: "700", cursor: "pointer",
                display: "flex", alignItems: "center", gap: "8px"
              }}>
                <RefreshCw size={14} /> Try Again
              </button>
            </div>
          )}

          {!imageUrl && !loading && !loadFailed && (
            <div style={{
              padding: "60px 20px", display: "flex", flexDirection: "column", alignItems: "center",
              gap: "18px", textAlign: "center"
            }}>
              <div style={{
                width: "90px", height: "90px", borderRadius: "50%",
                background: "rgba(6, 182, 212, 0.06)", border: "1px dashed rgba(6, 182, 212, 0.3)",
                display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "8px"
              }}>
                <ImageIcon size={44} color="rgba(6, 182, 212, 0.4)" />
              </div>
              <div>
                <h4 style={{ color: "#e5e7eb", fontSize: "18px", fontWeight: "700", margin: "0 0 6px 0" }}>
                  Output Workspace
                </h4>
                <p style={{ color: "#9ca3af", fontSize: "13px", maxWidth: "320px", margin: 0, lineHeight: "1.6" }}>
                  Your generated masterpiece will render here. Choose options on the left to start!
                </p>
              </div>
            </div>
          )}

          {imageUrl && !loading && (
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "20px" }}>
              
              {/* Aspect Ratio Configured Wrapper */}
              <div style={{
                width: "100%",
                maxWidth: "100%",
                aspectRatio: ASPECT_RATIOS.find(r => r.id === (history[0]?.ratio || aspectRatio))?.width / ASPECT_RATIOS.find(r => r.id === (history[0]?.ratio || aspectRatio))?.height,
                borderRadius: "18px",
                overflow: "hidden",
                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
                border: "2px solid rgba(6, 182, 212, 0.25)",
                background: "#07070d",
                margin: "0 auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <img
                  src={imageUrl}
                  alt="AI Generated Output"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </div>

              {/* Action Buttons & Prompt Detail Box */}
              <div style={{
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid rgba(6, 182, 212, 0.15)",
                borderRadius: "16px", padding: "16px",
                display: "flex", flexDirection: "column", gap: "12px"
              }}>
                <div className="img-gen-action-row">
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#06b6d4", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    ✨ Generated Design
                  </span>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => copyUrlToClipboard(imageUrl)} style={{
                      background: "rgba(255,255,255,0.03)", color: "#22d3ee",
                      border: "1px solid rgba(6, 182, 212, 0.25)",
                      padding: "8px 14px", borderRadius: "10px",
                      fontSize: "12px", fontWeight: "600", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: "5px"
                    }}>
                      <Copy size={13} /> Copy Link
                    </button>
                    <button onClick={() => handleDownload(imageUrl)} style={{
                      background: "linear-gradient(135deg, #6366f1, #06b6d4)",
                      color: "white", border: "none",
                      padding: "8px 18px", borderRadius: "10px",
                      fontSize: "12px", fontWeight: "700", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: "5px"
                    }}>
                      <Download size={13} /> Download
                    </button>
                  </div>
                </div>
                
                <div style={{
                  fontSize: "12px", color: "#9ca3af", borderTop: "1px solid rgba(255,255,255,0.05)",
                  paddingTop: "10px", lineHeight: "1.5"
                }}>
                  <strong style={{ color: "#d1d5db" }}>Prompt:</strong> "<em>{history[0]?.prompt}</em>"
                  <div className="img-gen-meta-row">
                    <span>Model: {MODELS.find(m => m.id === history[0]?.model)?.label.split(" (")[0] || "Flux"}</span>
                    <span>Ratio: {history[0]?.ratio || "1:1"}</span>
                    <span>Seed: {history[0]?.seed}</span>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>
      </div>

      {/* ── HISTORY WORKSPACE ── */}
      {history.length > 0 && (
        <div className="img-gen-history-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#d1d5db", margin: 0 }}>
                📚 Creation History ({history.length})
              </h3>
              <span className="img-gen-swipe-hint" style={{ fontSize: "11px", color: "#06b6d4", background: "rgba(6, 182, 212, 0.08)", padding: "4px 8px", borderRadius: "8px", fontWeight: "600" }}>
                ← Swipe to browse →
              </span>
            </div>
            <button
              onClick={clearHistory}
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                color: "#f87171",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                padding: "8px 14px",
                borderRadius: "10px",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.2s"
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)")}
            >
              <Trash2 size={13} /> Clear History
            </button>
          </div>

          <div className="img-gen-history-grid">
            {history.map(item => (
              <div
                key={item.id}
                onClick={() => setImageUrl(item.url)}
                style={{
                  borderRadius: "16px", overflow: "hidden",
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                  background: "rgba(0, 0, 0, 0.2)",
                  cursor: "pointer", transition: "transform 0.2s, box-shadow 0.2s",
                  position: "relative", aspectRatio: "1/1", flexShrink: 0
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = "scale(1.03)";
                  e.currentTarget.style.boxShadow = "0 8px 24px rgba(6, 182, 212, 0.35)";
                  e.currentTarget.style.borderColor = "rgba(6, 182, 212, 0.6)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.05)";
                }}
              >
                <img src={item.url} alt={item.prompt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                
                {/* Information Overlay */}
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0,
                  background: "linear-gradient(transparent, rgba(0, 0, 0, 0.9))",
                  padding: "20px 10px 8px 10px", fontSize: "11px",
                  color: "#d1d5db", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                }}>
                  {item.prompt}
                </div>

                {/* Quick actions overlay */}
                <div className="img-gen-history-actions">
                  <button
                    onClick={e => { e.stopPropagation(); handleDownload(item.url); }}
                    className="img-gen-history-action-btn"
                  >
                    <Download className="img-gen-history-icon" />
                  </button>
                  <button
                    onClick={e => deleteItem(item.id, e)}
                    className="img-gen-history-action-btn delete"
                  >
                    <Trash2 className="img-gen-history-icon" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}

      <style>{`
        @keyframes spin    { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes slideUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse   { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.15); opacity: 0.7; } }

        /* ── Image Generator Layout System ── */
        .img-gen-page {
          padding: 24px 28px;
          background-image: radial-gradient(rgba(6, 182, 212, 0.08) 1.5px, transparent 1.5px);
          background-size: 24px 24px;
          min-height: 100vh;
        }
        .img-gen-header { margin-bottom: 28px; display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 16px; }
        .img-gen-title {
          font-size: 34px; font-weight: 800;
          background: linear-gradient(135deg, #6366f1, #06b6d4, #3b82f6);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          margin-bottom: 6px; letter-spacing: -0.5px;
          filter: drop-shadow(0 2px 10px rgba(6, 182, 212, 0.25));
        }
        .img-gen-subtitle { color: #4ade80; font-size: 14px; font-weight: 600; margin: 0; }
        .img-gen-workspace-grid {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 28px; margin-bottom: 40px;
        }
        .img-gen-panel {
          background: rgba(11, 14, 26, 0.45); backdrop-filter: blur(24px);
          border: 1px solid rgba(6, 182, 212, 0.18); border-radius: 24px;
          padding: 28px; display: flex; flex-direction: column; gap: 24px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3), inset 0 0 20px rgba(6, 182, 212, 0.05);
        }
        .img-gen-output-panel {
          align-items: center; justify-content: center;
          min-height: 480px; position: relative;
        }
        .img-gen-model-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .img-gen-ratio-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .img-gen-action-row { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
        .img-gen-meta-row { margin-top: 6px; display: flex; gap: 12px; color: #8a94a6; font-size: 11px; flex-wrap: wrap; }
        .img-gen-history-panel {
          background: rgba(11, 14, 26, 0.25); border: 1px solid rgba(6, 182, 212, 0.1);
          border-radius: 24px; padding: 28px;
        }
        .img-gen-history-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 18px;
        }

        .img-gen-swipe-hint {
          display: none;
        }

        /* History card action buttons layout */
        .img-gen-history-actions {
          position: absolute; top: 8px; right: 8px; display: flex; gap: 4px; z-index: 10;
        }
        .img-gen-history-action-btn {
          background: rgba(0, 0, 0, 0.65); backdrop-filter: blur(4px);
          border: none; border-radius: 8px; padding: 6px;
          color: white; cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: all 0.2s;
        }
        .img-gen-history-action-btn:hover {
          background: rgba(6, 182, 212, 0.85);
          transform: scale(1.08);
        }
        .img-gen-history-action-btn.delete {
          background: rgba(239, 68, 68, 0.8);
        }
        .img-gen-history-action-btn.delete:hover {
          background: rgba(239, 68, 68, 0.95);
        }
        .img-gen-history-icon {
          width: 12px; height: 12px; display: block;
        }

        /* ── Mobile Responsive & UX Enhancements ── */
        @media (max-width: 768px) {
          .img-gen-page { padding: 16px 12px !important; }
          .img-gen-title { font-size: 26px !important; text-align: center; width: 100%; }
          .img-gen-subtitle { font-size: 11px !important; text-align: center; width: 100%; justify-content: center; }
          .img-gen-header { justify-content: center; text-align: center; }
          .img-gen-header > div { display: flex; flex-direction: column; align-items: center; }
          .img-gen-workspace-grid {
            grid-template-columns: 1fr !important;
            gap: 18px !important;
          }
          .img-gen-panel {
            padding: 18px !important; gap: 18px !important; border-radius: 18px !important;
            border: 1px solid rgba(6, 182, 212, 0.25) !important;
            box-shadow: 0 8px 32px rgba(11, 14, 26, 0.5), inset 0 0 20px rgba(6, 182, 212, 0.08) !important;
          }
          .img-gen-output-panel { min-height: 300px !important; }
          .img-gen-model-grid { grid-template-columns: 1fr !important; }
          
          /* Hide Aspect Ratio completely on mobile */
          .img-gen-ratio-wrapper { display: none !important; }
          
          .img-gen-history-panel { padding: 16px !important; border-radius: 18px !important; }
          
          .img-gen-swipe-hint {
            display: inline-block !important;
            animation: pulse 2s infinite ease-in-out;
          }

          /* Convert history grid into a premium horizontal gallery slider */
          .img-gen-history-grid {
            display: flex !important;
            overflow-x: auto !important;
            flex-wrap: nowrap !important;
            gap: 14px !important;
            padding: 10px 4px 16px 4px !important;
            scroll-behavior: smooth;
            -webkit-overflow-scrolling: touch;
          }
          /* Styled scrollbar for clear visibility */
          .img-gen-history-grid::-webkit-scrollbar {
            display: block !important;
            height: 5px !important;
          }
          .img-gen-history-grid::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.02) !important;
            border-radius: 10px !important;
          }
          .img-gen-history-grid::-webkit-scrollbar-thumb {
            background: rgba(6, 182, 212, 0.4) !important;
            border-radius: 10px !important;
          }

          /* Larger history image items on mobile */
          .img-gen-history-grid > div {
            flex: 0 0 180px !important;
            height: 180px !important;
            aspect-ratio: 1/1 !important;
            border-radius: 16px !important;
            box-shadow: 0 4px 15px rgba(6, 182, 212, 0.2) !important;
            border: 1px solid rgba(6, 182, 212, 0.25) !important;
          }

          /* Smaller buttons and icon symbols on mobile */
          .img-gen-history-actions {
            top: 4px !important; right: 4px !important; gap: 3px !important;
          }
          .img-gen-history-action-btn {
            padding: 4px !important; border-radius: 6px !important;
          }
          .img-gen-history-icon {
            width: 10px !important; height: 10px !important;
          }

          .img-gen-action-row { flex-direction: column; align-items: stretch; }
          .img-gen-action-row > div { display: flex; gap: 8px; }
          .img-gen-action-row > div button { flex: 1; justify-content: center; }
          .img-gen-meta-row { flex-direction: column; gap: 4px !important; }
        }

        @media (max-width: 400px) {
          .img-gen-page { padding: 10px 8px !important; }
          .img-gen-title { font-size: 22px !important; }
          .img-gen-panel { padding: 14px !important; border-radius: 14px !important; }
          .img-gen-history-grid > div {
            flex: 0 0 145px !important;
            height: 145px !important;
          }
        }
      `}</style>
    </div>
  );
}
