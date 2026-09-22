import React, { useMemo, useState, useRef } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Download,
  ImageIcon,
  RefreshCw,
  Settings,
  Sparkles,
  Trash2,
  ChevronDown,
  ChevronUp,
  Upload,
  Eye,
  Wand2,
  X,
  Camera,
  Palette,
  Check
} from "lucide-react";
import API_BASE_URL from "./apiConfig";
import { detectRatioFromPrompt } from "./utils/helpers";

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
  { id: "flux", label: "⚡ Flux.1 (Ultra Realism)", desc: "Best photorealism, details, anatomy & textures" },
  { id: "turbo", label: "🚀 Turbo (Ultra Fast)", desc: "Lightning fast generation in 2–4 seconds" },
  { id: "flux-realism", label: "📷 Flux Realism", desc: "Studio photography, natural skin & lighting" },
  { id: "flux-anime", label: "🌸 Flux Anime", desc: "Studio Ghibli & modern anime masterpiece style" },
  { id: "flux-3d", label: "🎮 Flux 3D", desc: "Unreal Engine 5 & Blender 3D CGI render" },
  { id: "sana", label: "💎 Sana 4K", desc: "Crisp high-resolution modern generative art" },
];

const ASPECT_RATIOS = [
  { id: "1:1", label: "Square", width: 1024, height: 1024, icon: "⏹️", desc: "1024 × 1024" },
  { id: "16:9", label: "Landscape", width: 1024, height: 576, icon: "🌅", desc: "1024 × 576" },
  { id: "9:16", label: "Portrait", width: 576, height: 1024, icon: "📱", desc: "576 × 1024" },
  { id: "4:3", label: "Classic", width: 1024, height: 768, icon: "📺", desc: "1024 × 768" },
];

const STYLE_PRESETS = [
  { label: "📸 8K Photorealistic", suffix: "photorealistic 8k, ultra sharp focus, Hasselblad camera, studio lighting" },
  { label: "🎨 Digital Concept Art", suffix: "concept art, digital painting, trending on ArtStation, intricate detail" },
  { label: "🌸 Anime Masterpiece", suffix: "anime aesthetic, Makoto Shinkai style, vibrant colors, detailed scenery" },
  { label: "🕹️ Cyberpunk Neon", suffix: "cyberpunk city, neon lights, volumetric rain, octane render 8k" },
  { label: "🎬 Cinematic Film", suffix: "cinematic film still, 35mm photograph, dramatic rim lighting, depth of field" },
  { label: "🏰 Fantasy Oil Painting", suffix: "classical oil painting, textured canvas, atmospheric lighting, masterpiece" },
  { label: "✨ 3D Isometric", suffix: "isometric 3D render, Pixar style, cute, smooth shading, clay material" },
];

const SUGGESTIONS = [
  "Cyberpunk cat with glowing neon eyes, 3D render",
  "Astronaut standing on alien crystal planet at sunset, cinematic 8k",
  "Lofi cozy study room with rain outside the window, warm lights",
  "Royal white Bengal tiger in lush rainforest, photorealistic",
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

export default function ImageGeneratorPro() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("flux");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [enhance, setEnhance] = useState(true);
  const [imageUrl, setImageUrl] = useState(null);
  const [activeResult, setActiveResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [toast, setToast] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // ── Image Upload & AI Vision State ──
  const [uploadedImage, setUploadedImage] = useState(null);
  const [uploadFileName, setUploadFileName] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [imageAnalysis, setImageAnalysis] = useState(null);
  const [suggestedPrompt, setSuggestedPrompt] = useState("");
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem("nexus_image_history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [historyQuery, setHistoryQuery] = useState("");

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const saveHistory = (newHistory) => {
    setHistory(newHistory);
    try {
      localStorage.setItem("nexus_image_history", JSON.stringify(newHistory));
    } catch (error) {
      console.warn("Could not save history to localStorage", error);
    }
  };

  const clearPrompt = () => {
    setPrompt("");
    showToast("Prompt cleared.");
  };

  const appendStylePreset = (suffix) => {
    setPrompt(prev => {
      const base = prev.trim();
      if (!base) return suffix;
      if (base.toLowerCase().includes(suffix.toLowerCase())) return prev;
      return `${base}, ${suffix}`;
    });
    showToast("Style preset added! 🎨");
  };

  // ── Handle File Upload ──
  const processImageFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Please upload an image file (PNG, JPG, WEBP).", "error");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast("Image size too large. Please upload under 8MB.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedImage(e.target.result);
      setUploadFileName(file.name);
      setImageAnalysis(null);
      setSuggestedPrompt("");
      showToast("Image uploaded! Click 'Analyze Image' to understand it. 📷");
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    processImageFile(file);
    e.target.value = "";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    processImageFile(file);
  };

  const handleRemoveUploadedImage = () => {
    setUploadedImage(null);
    setUploadFileName("");
    setImageAnalysis(null);
    setSuggestedPrompt("");
    showToast("Uploaded image removed.");
  };

  // ── AI Vision: Understand & Analyze Image ──
  const analyzeImage = async () => {
    if (!uploadedImage) {
      showToast("Please upload an image first!", "error");
      return;
    }

    setIsAnalyzing(true);
    const endpoints = [];
    if (API_BASE_URL) {
      endpoints.push(`${API_BASE_URL}/api/image-analyze`);
    }
    endpoints.push("/api/image-analyze");

    let lastError = "";
    let data = null;

    for (const ep of endpoints) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 35000);
        const res = await fetch(ep, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: uploadedImage,
            mode: "analyze",
            userPrompt: prompt.trim(),
          }),
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (res.ok) {
          data = await res.json();
          break;
        } else {
          lastError = `Status ${res.status}`;
        }
      } catch (err) {
        lastError = err.message;
      }
    }

    setIsAnalyzing(false);

    if (data && data.success) {
      setImageAnalysis(data.description);
      if (data.suggestedPrompt) {
        setSuggestedPrompt(data.suggestedPrompt);
      }
      showToast("Image analyzed & understood successfully! 🧠✨");
    } else {
      showToast("Could not analyze image. Please try again.", "error");
      console.error("Image analysis failed:", lastError);
    }
  };

  // ── AI Magic Wand: Enhance / Translate Prompt ──
  const enhancePromptWithAI = async () => {
    if (!prompt.trim() && !imageAnalysis) {
      showToast("Please enter a prompt or analyze an image first!", "error");
      return;
    }

    setIsEnhancingPrompt(true);
    const endpoints = [];
    if (API_BASE_URL) {
      endpoints.push(`${API_BASE_URL}/api/image-prompt`);
    }
    endpoints.push("/api/image-prompt");

    let enhanced = "";

    for (const ep of endpoints) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(ep, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: prompt.trim() || "Create a high quality image based on this",
            imageContext: imageAnalysis || "",
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
      } catch (e) { }
    }

    setIsEnhancingPrompt(false);

    if (enhanced) {
      setPrompt(enhanced);
      showToast("Prompt enhanced with 8K photorealistic details! ✨");
    } else {
      // Local fallback enhancement
      const fallback = prompt.trim() + ", photorealistic 8k, highly detailed, dramatic lighting, sharp focus";
      setPrompt(fallback);
      showToast("Applied photography enhancement tags!");
    }
  };

  // ── Image Generation ──
  const generateImage = async () => {
    let finalPrompt = prompt.trim();

    // If prompt is empty but we have a suggested prompt from uploaded image, use it!
    if (!finalPrompt && suggestedPrompt) {
      finalPrompt = suggestedPrompt;
      setPrompt(suggestedPrompt);
    }

    if (!finalPrompt) {
      showToast("Please enter a prompt or analyze an uploaded image first!", "error");
      return;
    }

    setImageUrl(null);
    setLoadFailed(false);
    setLoading(true);

    const detectedRatioId = detectRatioFromPrompt(finalPrompt);
    const finalRatioId = detectedRatioId || aspectRatio;
    if (detectedRatioId && detectedRatioId !== aspectRatio) setAspectRatio(detectedRatioId);

    const ratio = ASPECT_RATIOS.find(item => item.id === finalRatioId) || ASPECT_RATIOS[0];
    const seed = Math.floor(Math.random() * 999999);

    const url = buildImageUrl(finalPrompt, {
      width: ratio.width,
      height: ratio.height,
      model,
      seed,
      enhance,
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
          referenceImage: uploadedImage ? true : false,
        };
        setImageUrl(genUrl);
        setActiveResult(result);
        setLoading(false);
        const newHistory = [result, ...history].slice(0, 30);
        saveHistory(newHistory);
        showToast("Masterpiece generated successfully! ✨");
      };

      img.onerror = () => {
        if (!isRetry) {
          // Retry once with alternate model / seed
          const retrySeed = Math.floor(Math.random() * 999999);
          const fallbackModel = model === "flux" ? "turbo" : "flux";
          const retryUrl = buildImageUrl(finalPrompt, {
            width: ratio.width,
            height: ratio.height,
            model: fallbackModel,
            seed: retrySeed,
            enhance,
          });
          loadWithUrl(retryUrl, true);
          return;
        }

        setLoading(false);
        setLoadFailed(true);
        showToast("Generation failed. Please check network connection and retry.", "error");
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
      anchor.download = `nexus_ai_${Date.now()}.png`;
      anchor.click();
      URL.revokeObjectURL(blobUrl);
      showToast("Download started! 📥");
    } catch {
      window.open(url, "_blank");
      showToast("Opening image in new tab.");
    }
  };

  const clearHistory = () => {
    if (window.confirm("Are you sure you want to clear your generation history?")) {
      saveHistory([]);
      setImageUrl(null);
      setActiveResult(null);
      showToast("History cleared.");
    }
  };

  const openHistoryItem = (item) => {
    setImageUrl(item.url);
    setActiveResult(item);
    setLoadFailed(false);
  };

  const reuseHistoryItem = (item, e) => {
    e.stopPropagation();
    setPrompt(item.prompt || "");
    setModel(item.model || "flux");
    setAspectRatio(item.ratio || "1:1");
    setImageUrl(item.url);
    setActiveResult(item);
    setLoadFailed(false);
    setShowAdvanced(true);
    showToast("Loaded history prompt into generator.");
  };

  const deleteItem = (id, e) => {
    e.stopPropagation();
    const newHistory = history.filter(item => item.id !== id);
    saveHistory(newHistory);
    showToast("Removed from history.");
    const deletedItem = history.find(item => item.id === id);
    if (deletedItem && imageUrl === deletedItem.url) {
      setImageUrl(null);
      setActiveResult(null);
    }
  };

  const filteredHistory = useMemo(() => {
    const query = historyQuery.trim().toLowerCase();
    if (!query) return history;
    return history.filter(item => {
      const promptValue = (item.prompt || "").toLowerCase();
      const modelLabel = MODELS.find(m => m.id === item.model)?.label.toLowerCase() || "";
      const ratio = (item.ratio || "").toLowerCase();
      return promptValue.includes(query) || modelLabel.includes(query) || ratio.includes(query);
    });
  }, [history, historyQuery]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      generateImage();
    }
  };

  const promptWordCount = prompt.trim() ? prompt.trim().split(/\s+/).length : 0;
  const promptCharCount = prompt.length;

  return (
    <div className="page-view img-gen-page" style={{ maxWidth: "1320px", margin: "0 auto" }}>
      {/* ── HEADER ── */}
      <div className="img-gen-header">
        <div>
          <h2 className="img-gen-title">🎨 AI Image & Vision Studio</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <CheckCircle2 size={15} color="#4ade80" />
            <p className="img-gen-subtitle">
              Free High-Quality AI Image Generator • Vision Understanding • Image-to-Image & Prompt Enhancer
            </p>
          </div>
        </div>
      </div>

      <div className="img-gen-workspace-grid">
        {/* ── LEFT PANEL: CONTROLS & INPUTS ── */}
        <div className="img-gen-panel">
          
          {/* 1. IMAGE UPLOAD & VISION RECOGNITION SECTION */}
          <div className="img-gen-upload-container">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <label className="img-gen-label">
                <Camera size={13} style={{ display: "inline", marginRight: "5px" }} />
                Reference Image / Vision Upload
              </label>
              {uploadedImage && (
                <button type="button" onClick={handleRemoveUploadedImage} className="img-gen-clear-btn" title="Remove image">
                  <X size={12} /> Remove
                </button>
              )}
            </div>

            {!uploadedImage ? (
              <div
                className={`img-gen-dropzone ${isDragging ? "dragging" : ""}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/png, image/jpeg, image/webp"
                  style={{ display: "none" }}
                />
                <Upload size={24} color="#06b6d4" style={{ marginBottom: "6px" }} />
                <div style={{ fontSize: "13px", fontWeight: "600", color: "#e5e7eb" }}>
                  Upload image to analyze or recreate
                </div>
                <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "2px" }}>
                  Drag & drop or click to browse (PNG, JPG, WEBP)
                </div>
              </div>
            ) : (
              <div className="img-gen-uploaded-preview-box">
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <img
                    src={uploadedImage}
                    alt="Upload Preview"
                    style={{ width: "64px", height: "64px", borderRadius: "10px", objectFit: "cover", border: "1px solid rgba(6,182,212,0.4)" }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "13px", fontWeight: "700", color: "#f3f4f6", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {uploadFileName || "Uploaded Image"}
                    </div>
                    <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "2px" }}>
                      Ready for AI Vision Analysis & Recreation
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={analyzeImage}
                    disabled={isAnalyzing}
                    className="img-gen-vision-btn"
                  >
                    {isAnalyzing ? (
                      <><RefreshCw size={13} style={{ animation: "spin 0.8s linear infinite" }} /> Analyzing Vision...</>
                    ) : (
                      <><Eye size={13} /> 🔍 Analyze Image (AI Vision)</>
                    )}
                  </button>

                  {suggestedPrompt && (
                    <button
                      type="button"
                      onClick={() => {
                        setPrompt(suggestedPrompt);
                        showToast("Recreation prompt copied to prompt box! ✨");
                      }}
                      className="img-gen-apply-prompt-btn"
                    >
                      <Sparkles size={13} /> Use As Prompt
                    </button>
                  )}
                </div>

                {/* AI Vision Results Display */}
                {imageAnalysis && (
                  <div className="img-gen-analysis-box">
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#22d3ee", fontWeight: "700", fontSize: "12px", marginBottom: "4px" }}>
                      <Check size={14} color="#4ade80" /> AI Visual Understanding:
                    </div>
                    <div style={{ fontSize: "12px", color: "#d1d5db", lineHeight: "1.5" }}>
                      {imageAnalysis}
                    </div>

                    {suggestedPrompt && (
                      <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <span style={{ fontSize: "11px", fontWeight: "700", color: "#a5b4fc" }}>Generated Recreation Prompt:</span>
                        <div style={{ fontSize: "11px", color: "#9ca3af", fontStyle: "italic", marginTop: "2px" }}>
                          "{suggestedPrompt}"
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. TEXT PROMPT AREA */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
              <label className="img-gen-label">🖊️ Image Description & Prompt</label>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span className="img-gen-counter-badge">{promptWordCount} words</span>
                <span className="img-gen-counter-badge">{promptCharCount} chars</span>
                {prompt.trim() && (
                  <button type="button" onClick={clearPrompt} className="img-gen-clear-btn">Clear</button>
                )}
              </div>
            </div>

            <div style={{ position: "relative" }}>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={uploadedImage ? "Describe how to modify this image or what to generate... e.g. Make it anime style, add neon sunset lighting..." : "Describe what you want to see... e.g. A majestic white tiger in a magical neon jungle, 8k cinematic lighting..."}
                rows={4}
                className="img-gen-textarea"
              />
            </div>

            {/* Prompt Actions Toolbar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
              <button
                type="button"
                onClick={enhancePromptWithAI}
                disabled={isEnhancingPrompt}
                className="img-gen-enhance-btn"
                title="Convert prompt to 8K photorealistic English description"
              >
                {isEnhancingPrompt ? (
                  <><RefreshCw size={13} style={{ animation: "spin 0.8s linear infinite" }} /> Enhancing...</>
                ) : (
                  <><Wand2 size={13} /> ✨ AI Auto-Enhance Prompt</>
                )}
              </button>

              {prompt.trim() && (
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(prompt).then(() => showToast("Prompt copied! 📋")).catch(() => showToast("Failed to copy.", "error"))}
                  className="img-gen-chip-copy"
                >
                  <Copy size={12} /> Copy Prompt
                </button>
              )}
            </div>

            {/* Style Preset Filter Chips */}
            <div>
              <div style={{ fontSize: "11px", fontWeight: "700", color: "#9ca3af", marginBottom: "6px" }}>
                <Palette size={12} style={{ display: "inline", marginRight: "4px" }} />
                1-Click Style Filters:
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {STYLE_PRESETS.map((p, i) => (
                  <button key={i} type="button" onClick={() => appendStylePreset(p.suffix)} className="img-gen-chip">
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Inspiration Suggestions */}
            <div>
              <div style={{ fontSize: "11px", fontWeight: "700", color: "#9ca3af", marginBottom: "6px" }}>
                💡 Quick Inspiration:
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} type="button" onClick={() => setPrompt(s)} className="img-gen-suggestion">
                    {s.length > 34 ? s.slice(0, 32) + "…" : s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3. ADVANCED SETTINGS (MODEL, ASPECT RATIO) */}
          <button type="button" onClick={() => setShowAdvanced(prev => !prev)} className="img-gen-adv-toggle">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Settings size={16} style={{ color: "#22d3ee" }} />
              <span>Model & Aspect Ratio Settings ({MODELS.find(m => m.id === model)?.label.split(" (")[0]})</span>
            </div>
            {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showAdvanced && (
            <div className="img-gen-adv-panel">
              {/* Models */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <label className="img-gen-label">🤖 Generator Model</label>
                <div className="img-gen-model-grid">
                  {MODELS.map(m => (
                    <button key={m.id} type="button" onClick={() => setModel(m.id)} className={`img-gen-model-btn ${model === m.id ? "active" : ""}`}>
                      <div className="img-gen-model-label">{m.label}</div>
                      <div className="img-gen-model-desc">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Aspect Ratio */}
              <div className="img-gen-ratio-wrapper" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <label className="img-gen-label">📐 Aspect Ratio</label>
                <div className="img-gen-ratio-grid">
                  {ASPECT_RATIOS.map(ratio => (
                    <button key={ratio.id} type="button" onClick={() => setAspectRatio(ratio.id)} className={`img-gen-ratio-btn ${aspectRatio === ratio.id ? "active" : ""}`}>
                      <div style={{ fontSize: "16px", marginBottom: "2px" }}>{ratio.icon}</div>
                      <div className="img-gen-ratio-label">{ratio.label}</div>
                      <div className="img-gen-ratio-desc">{ratio.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Enhance Prompt Toggle */}
              <div className="img-gen-enhance-row">
                <div>
                  <span className="img-gen-enhance-title">Deep Model Enhancement</span>
                  <span className="img-gen-enhance-desc">Automatically optimize rendering details during generation</span>
                </div>
                <label style={{ position: "relative", display: "inline-block", width: "44px", height: "24px" }}>
                  <input type="checkbox" checked={enhance} onChange={e => setEnhance(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                  <span style={{ position: "absolute", cursor: "pointer", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: enhance ? "#06b6d4" : "rgba(255,255,255,0.1)", transition: "0.3s", borderRadius: "24px" }}>
                    <span style={{ position: "absolute", content: '""', height: "18px", width: "18px", left: "3px", bottom: "3px", backgroundColor: "white", transition: "0.3s", borderRadius: "50%", transform: enhance ? "translateX(20px)" : "translateX(0)" }} />
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* 4. GENERATE BUTTON */}
          <button
            onClick={generateImage}
            disabled={loading}
            className="img-gen-main-btn"
          >
            {loading ? (
              <><RefreshCw size={19} style={{ animation: "spin 0.8s linear infinite" }} /> Generating Masterpiece...</>
            ) : (
              <><Sparkles size={19} /> Generate Masterpiece</>
            )}
          </button>
        </div>

        {/* ── RIGHT PANEL: OUTPUT WORKSPACE ── */}
        <div className="img-gen-panel img-gen-output-panel">
          {loading && (() => {
            const ratio = ASPECT_RATIOS.find(r => r.id === aspectRatio);
            const shimmerAspect = ratio ? ratio.width / ratio.height : 1;
            return (
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{
                  width: "100%",
                  aspectRatio: shimmerAspect,
                  borderRadius: "18px",
                  overflow: "hidden",
                  position: "relative",
                  background: "linear-gradient(90deg, rgba(6,182,212,0.04) 25%, rgba(6,182,212,0.12) 50%, rgba(6,182,212,0.04) 75%)",
                  backgroundSize: "200% 100%",
                  animation: "shimmer 1.8s infinite",
                  border: "2px solid rgba(6,182,212,0.25)",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                }}>
                  <div style={{
                    position: "absolute", inset: 0,
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", gap: "16px"
                  }}>
                    <div style={{ position: "relative", width: "72px", height: "72px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ position: "absolute", width: "100%", height: "100%", border: "3px solid rgba(6,182,212,0.2)", borderTopColor: "#06b6d4", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                      <Sparkles size={28} color="#06b6d4" />
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <h4 className="img-gen-empty-title">Weaving High-Resolution Pixels</h4>
                      <p className="img-gen-empty-subtitle">Using {MODELS.find(m => m.id === model)?.label.split(" (")[0] || "Flux"} • typically 5–12 seconds</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {loadFailed && !loading && (
            <div style={{ padding: "40px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", textAlign: "center" }}>
              <AlertCircle size={48} color="#ef4444" />
              <div>
                <h4 style={{ color: "#f87171", fontSize: "16px", fontWeight: "700", margin: "0 0 8px 0" }}>Generation Interrupted</h4>
                <p className="img-gen-empty-subtitle">The image generation server took too long. Let's retry with an alternate configuration.</p>
              </div>
              <button onClick={generateImage} style={{ background: "rgba(6,182,212,0.2)", color: "#22d3ee", border: "1px solid rgba(6,182,212,0.4)", padding: "10px 22px", borderRadius: "12px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
                <RefreshCw size={14} /> Retry Generation
              </button>
            </div>
          )}

          {!imageUrl && !loading && !loadFailed && (
            <div style={{ padding: "60px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "18px", textAlign: "center" }}>
              <div style={{ width: "90px", height: "90px", borderRadius: "50%", background: "rgba(6, 182, 212, 0.06)", border: "1px dashed rgba(6, 182, 212, 0.3)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "8px" }}>
                <ImageIcon size={44} color="rgba(6, 182, 212, 0.5)" />
              </div>
              <div>
                <h4 className="img-gen-empty-title">Output Canvas</h4>
                <p className="img-gen-empty-subtitle">
                  Your generated masterpiece will render here. Describe a scene or upload an image on the left to start!
                </p>
              </div>
            </div>
          )}

          {imageUrl && !loading && (
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ width: "100%", maxWidth: "100%", aspectRatio: ASPECT_RATIOS.find(r => r.id === (activeResult?.ratio || aspectRatio))?.width / ASPECT_RATIOS.find(r => r.id === (activeResult?.ratio || aspectRatio))?.height, borderRadius: "18px", overflow: "hidden", boxShadow: "0 10px 30px rgba(0, 0, 0, 0.6)", border: "2px solid rgba(6, 182, 212, 0.35)", background: "#07070d", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <img src={imageUrl} alt="AI Generated Output" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>

              <div className="img-gen-result-box">
                <div className="img-gen-action-row">
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#06b6d4", textTransform: "uppercase", letterSpacing: "0.5px" }}>✨ Generated Design</span>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => navigator.clipboard.writeText(imageUrl).then(() => showToast("Direct URL copied! 📋")).catch(() => showToast("Failed to copy URL.", "error"))} className="img-gen-link-btn">
                      <Copy size={13} /> Copy Link
                    </button>
                    <button onClick={() => handleDownload(imageUrl)} className="img-gen-download-btn">
                      <Download size={13} /> Download 8K
                    </button>
                  </div>
                </div>

                <div className="img-gen-result-prompt">
                  <strong>Prompt:</strong> "<em>{activeResult?.prompt || history[0]?.prompt}</em>"
                  <div className="img-gen-meta-row">
                    <span>Model: {MODELS.find(m => m.id === (activeResult?.model || history[0]?.model))?.label.split(" (")[0] || "Flux"}</span>
                    <span>Ratio: {activeResult?.ratio || history[0]?.ratio || "1:1"}</span>
                    <span>Seed: {activeResult?.seed || history[0]?.seed}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── CREATION HISTORY SECTION ── */}
      {history.length > 0 && (
        <div className="img-gen-history-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h3 className="img-gen-history-title">📚 Creation History ({history.length})</h3>
              <span className="img-gen-swipe-hint" style={{ fontSize: "11px", color: "#06b6d4", background: "rgba(6, 182, 212, 0.08)", padding: "4px 8px", borderRadius: "8px", fontWeight: "600" }}>← Swipe to browse →</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <div className="img-gen-history-badge">
                <Sparkles size={13} color="#22d3ee" />
                <span>{new Set(history.map(item => item.model).filter(Boolean)).size} models used</span>
              </div>
              <input value={historyQuery} onChange={e => setHistoryQuery(e.target.value)} placeholder="Search history..." aria-label="Search generation history" className="img-gen-history-search" />
            </div>
            <button onClick={clearHistory} className="img-gen-clear-btn">
              <Trash2 size={13} /> Clear History
            </button>
          </div>

          {historyQuery.trim() && (
            <div style={{ marginBottom: "14px", fontSize: "12px", color: "#9ca3af" }}>Showing {filteredHistory.length} of {history.length} items for “{historyQuery.trim()}”.</div>
          )}

          <div className="img-gen-history-grid">
            {filteredHistory.map(item => (
              <div key={item.id} onClick={() => openHistoryItem(item)} className={`img-gen-history-card ${imageUrl === item.url ? "active" : ""}`}>
                <img src={item.url} alt={item.prompt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0, 0, 0, 0.95))", padding: "20px 10px 8px 10px", fontSize: "11px", color: "#d1d5db", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.prompt}
                </div>
                <div className="img-gen-history-actions">
                  <button onClick={e => reuseHistoryItem(item, e)} className="img-gen-history-action-btn" title="Reuse this prompt"><RefreshCw className="img-gen-history-icon" /></button>
                  <button onClick={e => { e.stopPropagation(); handleDownload(item.url); }} className="img-gen-history-action-btn" title="Download image"><Download className="img-gen-history-icon" /></button>
                  <button onClick={e => deleteItem(item.id, e)} className="img-gen-history-action-btn delete" title="Delete from history"><Trash2 className="img-gen-history-icon" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* ── STYLES ── */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.15); opacity: 0.7; } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }

        .img-gen-page {
          padding: 24px 28px;
          background-image: radial-gradient(rgba(6, 182, 212, 0.08) 1.5px, transparent 1.5px);
          background-size: 24px 24px;
          min-height: 100vh;
        }
        .img-gen-header { margin-bottom: 28px; display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 16px; }
        .img-gen-title {
          font-size: 32px; font-weight: 800;
          background: linear-gradient(135deg, #6366f1, #06b6d4, #3b82f6);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          margin-bottom: 6px; letter-spacing: -0.5px;
          filter: drop-shadow(0 2px 10px rgba(6, 182, 212, 0.25));
        }
        .img-gen-subtitle { color: #4ade80; font-size: 13px; font-weight: 600; margin: 0; }
        .img-gen-label { font-size: 12px; font-weight: 800; color: #22d3ee; text-transform: uppercase; letter-spacing: 0.8px; }
        .img-gen-counter-badge { font-size: 11px; color: #9ca3af; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 999px; padding: 4px 10px; }
        .img-gen-clear-btn { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #f87171; border-radius: 10px; padding: 6px 10px; font-size: 11px; font-weight: 700; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 4px; }
        .img-gen-clear-btn:hover { background: rgba(239, 68, 68, 0.2); }

        .img-gen-workspace-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-bottom: 40px; }
        .img-gen-panel {
          background: rgba(11, 14, 26, 0.55); backdrop-filter: blur(24px);
          border: 1px solid rgba(6, 182, 212, 0.18); border-radius: 24px;
          padding: 26px; display: flex; flex-direction: column; gap: 22px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.35), inset 0 0 20px rgba(6, 182, 212, 0.05);
        }
        .img-gen-output-panel { align-items: center; justify-content: center; min-height: 480px; position: relative; }

        /* Dropzone */
        .img-gen-dropzone {
          border: 2px dashed rgba(6, 182, 212, 0.35); border-radius: 16px;
          padding: 20px 16px; text-align: center; cursor: pointer;
          background: rgba(6, 182, 212, 0.03); transition: all 0.2s;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
        }
        .img-gen-dropzone:hover, .img-gen-dropzone.dragging {
          border-color: #06b6d4; background: rgba(6, 182, 212, 0.08); transform: translateY(-1px);
        }

        .img-gen-uploaded-preview-box {
          background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(6, 182, 212, 0.25);
          border-radius: 16px; padding: 14px;
        }

        .img-gen-vision-btn {
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(6, 182, 212, 0.2));
          border: 1px solid rgba(6, 182, 212, 0.4); color: #22d3ee;
          padding: 8px 14px; border-radius: 10px; font-size: 12px; font-weight: 700;
          cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;
        }
        .img-gen-vision-btn:hover { background: rgba(6, 182, 212, 0.3); transform: scale(1.02); }

        .img-gen-apply-prompt-btn {
          background: linear-gradient(135deg, #6366f1, #06b6d4);
          border: none; color: white;
          padding: 8px 14px; border-radius: 10px; font-size: 12px; font-weight: 700;
          cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;
        }
        .img-gen-apply-prompt-btn:hover { opacity: 0.9; transform: scale(1.02); }

        .img-gen-analysis-box {
          margin-top: 12px; padding: 12px; border-radius: 12px;
          background: rgba(6, 182, 212, 0.05); border: 1px solid rgba(6, 182, 212, 0.18);
        }

        .img-gen-textarea {
          width: 100%; box-sizing: border-box; background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(6, 182, 212, 0.25);
          border-radius: 16px; padding: 14px 16px; color: #f3f4f6; font-size: 14px; line-height: 1.6;
          resize: vertical; outline: none; font-family: Outfit, Inter, sans-serif; transition: all 0.2s;
        }
        .img-gen-textarea:focus { border-color: rgba(6, 182, 212, 0.8); box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15); }
        .img-gen-textarea::placeholder { color: #9ca3af; }

        .img-gen-enhance-btn {
          background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.35);
          color: #a5b4fc; border-radius: 10px; padding: 7px 12px; font-size: 11px; font-weight: 700;
          cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s;
        }
        .img-gen-enhance-btn:hover { background: rgba(99, 102, 241, 0.25); border-color: #818cf8; }

        .img-gen-chip {
          background: rgba(6, 182, 212, 0.06); border: 1px solid rgba(6, 182, 212, 0.18); border-radius: 999px;
          padding: 5px 10px; font-size: 11px; color: #22d3ee; cursor: pointer; transition: all 0.2s; font-weight: 600;
        }
        .img-gen-chip:hover { background: rgba(6, 182, 212, 0.18); border-color: #06b6d4; }

        .img-gen-chip-copy {
          background: rgba(255,255,255,0.04); border: 1px solid rgba(6, 182, 212, 0.18); color: #d1d5db;
          border-radius: 10px; padding: 7px 12px; font-size: 11px; font-weight: 700; cursor: pointer;
          display: flex; align-items: center; gap: 6px; transition: all 0.2s;
        }

        .img-gen-suggestion {
          background: rgba(6, 182, 212, 0.05); border: 1px solid rgba(6, 182, 212, 0.2); border-radius: 20px;
          padding: 5px 12px; font-size: 11px; color: #94a3b8; cursor: pointer; transition: all 0.2s; font-weight: 500;
        }
        .img-gen-suggestion:hover { background: rgba(6, 182, 212, 0.15); color: #22d3ee; }

        .img-gen-adv-toggle {
          display: flex; align-items: center; justify-content: space-between; width: 100%;
          background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 14px; padding: 12px 16px; color: #e5e7eb; font-size: 13px; font-weight: 700;
          cursor: pointer; transition: all 0.2s; outline: none;
        }
        .img-gen-adv-toggle:hover { background: rgba(255, 255, 255, 0.06); }

        .img-gen-adv-panel {
          display: flex; flex-direction: column; gap: 18px; padding: 16px;
          background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 16px;
        }

        .img-gen-model-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .img-gen-model-btn {
          padding: 10px 12px; border-radius: 12px; cursor: pointer; transition: all 0.2s; text-align: left;
          background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.06);
        }
        .img-gen-model-btn.active {
          background: rgba(6, 182, 212, 0.12); border: 2px solid rgba(6, 182, 212, 0.85);
          box-shadow: 0 4px 15px rgba(6, 182, 212, 0.25);
        }
        .img-gen-model-label { font-size: 12px; font-weight: 700; color: #d1d5db; }
        .img-gen-model-btn.active .img-gen-model-label { color: #22d3ee; }
        .img-gen-model-desc { font-size: 9px; color: #9ca3af; margin-top: 2px; line-height: 1.3; }

        .img-gen-ratio-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .img-gen-ratio-btn {
          padding: 8px 6px; border-radius: 10px; cursor: pointer; transition: all 0.2s; text-align: center;
          background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.06);
        }
        .img-gen-ratio-btn.active {
          background: rgba(6, 182, 212, 0.12); border: 2px solid rgba(6, 182, 212, 0.85);
        }
        .img-gen-ratio-label { font-size: 10px; font-weight: 700; color: #e5e7eb; }
        .img-gen-ratio-desc { font-size: 8px; color: #9ca3af; margin-top: 1px; }

        .img-gen-enhance-row { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.06); paddingTop: 14px; }
        .img-gen-enhance-title { font-size: 13px; font-weight: 600; color: #e5e7eb; display: block; }
        .img-gen-enhance-desc { font-size: 10px; color: #9ca3af; }

        .img-gen-main-btn {
          background: linear-gradient(135deg, #6366f1, #06b6d4); color: white; border: none;
          padding: 16px 20px; border-radius: 16px; font-weight: 800; font-size: 16px;
          cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;
          transition: all 0.2s; box-shadow: 0 6px 28px rgba(6,182,212,0.4); margin-top: 4px;
        }
        .img-gen-main-btn:disabled { background: rgba(6,182,212,0.25); cursor: not-allowed; box-shadow: none; }
        .img-gen-main-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(6,182,212,0.6); }

        .img-gen-empty-title { color: #e5e7eb; font-size: 18px; font-weight: 700; margin: 0 0 6px 0; }
        .img-gen-empty-subtitle { color: #9ca3af; font-size: 13px; max-width: 340px; margin: 0; line-height: 1.6; }

        .img-gen-result-box {
          background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(6, 182, 212, 0.2);
          border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 12px; width: 100%; box-sizing: border-box;
        }
        .img-gen-action-row { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; align-items: center; }
        .img-gen-link-btn {
          background: rgba(255,255,255,0.03); color: #22d3ee; border: 1px solid rgba(6, 182, 212, 0.25);
          padding: 8px 14px; border-radius: 10px; font-size: 12px; font-weight: 600; cursor: pointer;
          display: flex; align-items: center; gap: 5px; transition: all 0.2s;
        }
        .img-gen-download-btn {
          background: linear-gradient(135deg, #6366f1, #06b6d4); color: white; border: none;
          padding: 8px 18px; border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer;
          display: flex; align-items: center; gap: 5px; transition: all 0.2s;
        }
        .img-gen-result-prompt { font-size: 12px; color: #9ca3af; border-top: 1px solid rgba(255,255,255,0.06); paddingTop: 10px; line-height: 1.5; }
        .img-gen-result-prompt strong { color: #d1d5db; }
        .img-gen-meta-row { margin-top: 6px; display: flex; gap: 12px; color: #8a94a6; font-size: 11px; flex-wrap: wrap; }

        .img-gen-history-panel { background: rgba(11, 14, 26, 0.35); border: 1px solid rgba(6, 182, 212, 0.15); border-radius: 24px; padding: 26px; }
        .img-gen-history-title { font-size: 18px; font-weight: 700; color: #d1d5db; margin: 0; }
        .img-gen-history-badge { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); }
        .img-gen-history-badge span { font-size: 12px; color: #e5e7eb; font-weight: 600; }
        .img-gen-history-search { min-width: 240px; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(6, 182, 212, 0.2); border-radius: 10px; padding: 9px 12px; color: #f3f4f6; font-size: 12px; outline: none; transition: all 0.2s; }
        
        .img-gen-history-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 18px; }
        .img-gen-history-card {
          border-radius: 16px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.05);
          background: rgba(0, 0, 0, 0.25); cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; position: relative; aspect-ratio: 1/1; flex-shrink: 0;
        }
        .img-gen-history-card.active {
          border: 1px solid rgba(6, 182, 212, 0.9); background: rgba(6, 182, 212, 0.08);
        }

        .img-gen-swipe-hint { display: none; }
        .img-gen-history-actions { position: absolute; top: 8px; right: 8px; display: flex; gap: 4px; z-index: 10; }
        .img-gen-history-action-btn { background: rgba(0, 0, 0, 0.65); backdrop-filter: blur(4px); border: none; border-radius: 8px; padding: 6px; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .img-gen-history-action-btn:hover { background: rgba(6, 182, 212, 0.85); transform: scale(1.08); }
        .img-gen-history-action-btn.delete { background: rgba(239, 68, 68, 0.8); }
        .img-gen-history-action-btn.delete:hover { background: rgba(239, 68, 68, 0.95); }
        .img-gen-history-icon { width: 12px; height: 12px; display: block; }

        /* ── LIGHT MODE OVERRIDES ── */
        .light-mode .img-gen-page {
          background-color: #f0f4f8 !important;
          background-image: radial-gradient(rgba(6, 182, 212, 0.12) 1.5px, transparent 1.5px) !important;
        }
        .light-mode .img-gen-subtitle { color: #15803d !important; }
        .light-mode .img-gen-panel,
        .light-mode .img-gen-history-panel {
          background: #ffffff !important;
          border-color: #d1dae6 !important;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.03) !important;
        }
        .light-mode .img-gen-label { color: #0284c7 !important; }
        .light-mode .img-gen-counter-badge { background: #f1f5f9 !important; border-color: #e2e8f0 !important; color: #475569 !important; }
        .light-mode .img-gen-textarea { background: #ffffff !important; border-color: #cbd5e1 !important; color: #0f172a !important; }
        .light-mode .img-gen-textarea::placeholder { color: #94a3b8 !important; }
        .light-mode .img-gen-chip { background: #f0f9ff !important; border-color: rgba(6, 182, 212, 0.3) !important; color: #0284c7 !important; }
        .light-mode .img-gen-dropzone { background: #f0fdfa !important; border-color: #99f6e4 !important; }
        .light-mode .img-gen-dropzone div { color: #0f172a !important; }
        .light-mode .img-gen-uploaded-preview-box { background: #f8fafc !important; border-color: #cbd5e1 !important; }
        .light-mode .img-gen-analysis-box { background: #f0fdfa !important; border-color: #ccfbf1 !important; color: #1e293b !important; }
        .light-mode .img-gen-suggestion { background: #f0fdf4 !important; border-color: rgba(16, 185, 129, 0.3) !important; color: #047857 !important; }
        .light-mode .img-gen-adv-toggle, .light-mode .img-gen-adv-panel { background: #f8fafc !important; border-color: #e2e8f0 !important; color: #1e293b !important; }
        .light-mode .img-gen-model-btn, .light-mode .img-gen-ratio-btn { background: #ffffff !important; border-color: #e2e8f0 !important; }
        .light-mode .img-gen-model-btn.active, .light-mode .img-gen-ratio-btn.active { background: rgba(6, 182, 212, 0.08) !important; border-color: #0284c7 !important; }
        .light-mode .img-gen-model-label, .light-mode .img-gen-ratio-label { color: #1e293b !important; }
        .light-mode .img-gen-empty-title, .light-mode .img-gen-history-title { color: #0f172a !important; }
        .light-mode .img-gen-empty-subtitle { color: #64748b !important; }
        .light-mode .img-gen-result-box { background: #f8fafc !important; border-color: #e2e8f0 !important; }
        .light-mode .img-gen-history-card { background: #ffffff !important; border-color: #e2e8f0 !important; }

        @media (max-width: 768px) {
          .img-gen-page { padding: 16px 12px !important; }
          .img-gen-title { font-size: 24px !important; text-align: center; width: 100%; }
          .img-gen-subtitle { font-size: 11px !important; text-align: center; width: 100%; justify-content: center; }
          .img-gen-header { justify-content: center; text-align: center; }
          .img-gen-workspace-grid { grid-template-columns: 1fr !important; gap: 18px !important; }
          .img-gen-panel { padding: 18px !important; gap: 18px !important; border-radius: 18px !important; }
          .img-gen-output-panel { min-height: 300px !important; }
          .img-gen-model-grid { grid-template-columns: 1fr !important; }
          .img-gen-ratio-wrapper { display: none !important; }
          .img-gen-history-panel { padding: 16px !important; border-radius: 18px !important; }
          .img-gen-swipe-hint { display: inline-block !important; animation: pulse 2s infinite ease-in-out; }
          .img-gen-history-grid { display: flex !important; overflow-x: auto !important; flex-wrap: nowrap !important; gap: 14px !important; padding: 10px 4px 16px 4px !important; }
          .img-gen-history-grid > div { flex: 0 0 170px !important; height: 170px !important; }
          .img-gen-action-row { flex-direction: column; align-items: stretch; }
          .img-gen-action-row > div { display: flex; gap: 8px; }
          .img-gen-action-row > div button { flex: 1; justify-content: center; }
        }
      `}</style>
    </div>
  );
}