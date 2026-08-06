import React, { useMemo, useRef, useState } from "react";
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
  ChevronUp
} from "lucide-react";
import { detectRatioFromPrompt } from "./utils/helpers";

function buildImageUrl(prompt, options = {}) {
  const {
    width = 1024,
    height = 1024,
    model = "flux",
    seed = Math.floor(Math.random() * 999999),
    enhance = true,
    image = null,
    strength = 0.6,
  } = options;

  const encoded = encodeURIComponent(prompt.trim());
  let url = `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&model=${model}&seed=${seed}&nologo=true&enhance=${enhance}`;
  if (image) {
    url += `&image=${encodeURIComponent(image)}&strength=${strength}`;
  }
  return url;
}


const MODELS = [
  { id: "flux", label: "⚡ Flux.1 (Premium)", desc: "Best overall details, realism and quality" },
  { id: "turbo", label: "🚀 Turbo (Fastest)", desc: "Generates high quality art in seconds" },
  { id: "flux-realism", label: "📷 Flux Realism", desc: "Optimized for photographic styles" },
  { id: "flux-anime", label: "🌸 Flux Anime", desc: "Gorgeous anime and manga style art" },
  { id: "flux-3d", label: "🎮 Flux 3D", desc: "3D render, game assets and toy style" },
];

const ASPECT_RATIOS = [
  { id: "1:1", label: "Square", width: 1024, height: 1024, icon: "⏹️", desc: "1024 × 1024" },
  { id: "16:9", label: "Landscape", width: 1024, height: 576, icon: "🌅", desc: "1024 × 576" },
  { id: "9:16", label: "Portrait", width: 576, height: 1024, icon: "📱", desc: "576 × 1024" },
  { id: "4:3", label: "Classic", width: 1024, height: 768, icon: "📺", desc: "1024 × 768" },
];

const SUGGESTIONS = [
  "Cyberpunk cat, neon details, 3D style",
  "Astronaut walking on Mars, cinematic",
  "Lofi study room, rain outside, cozy",
  "Floating fantasy castle, detailed art",
];

const PROMPT_CHIPS = [
  "cinematic lighting",
  "ultra detailed",
  "soft shadows",
  "volumetric glow",
  "high contrast",
];

function Toast({ message, type }) {
  return (
    <div style={{
      position: "fixed",
      bottom: "80px",
      right: "20px",
      background: type === "error" ? "rgba(239,68,68,0.2)" : "rgba(6, 182, 212, 0.15)",
      border: `1px solid ${type === "error" ? "rgba(239,68,68,0.4)" : "rgba(6, 182, 212, 0.4)"}`,
      color: type === "error" ? "#f87171" : "#e0f7fa",
      padding: "14px 20px",
      borderRadius: "14px",
      fontSize: "14px",
      fontWeight: "600",
      backdropFilter: "blur(12px)",
      zIndex: 9999,
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      maxWidth: "320px",
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
    setTimeout(() => setToast(null), 3000);
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

  const appendPromptFragment = (fragment) => {
    setPrompt(prev => {
      const base = prev.trim();
      if (!base) return fragment;
      if (base.toLowerCase().includes(fragment.toLowerCase())) return prev;
      return `${base}, ${fragment}`;
    });
  };


  const generateImage = async () => {
    if (!prompt.trim()) {
      showToast("Please enter a prompt first!", "error");
      return;
    }

    setImageUrl(null);
    setLoadFailed(false);
    setLoading(true);


    const detectedRatioId = detectRatioFromPrompt(prompt);
    const finalRatioId = detectedRatioId || aspectRatio;
    if (detectedRatioId && detectedRatioId !== aspectRatio) setAspectRatio(detectedRatioId);

    const ratio = ASPECT_RATIOS.find(item => item.id === finalRatioId) || ASPECT_RATIOS[0];
    const seed = Math.floor(Math.random() * 999999);
    const url = buildImageUrl(prompt, {
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
        const result = { url: genUrl, prompt: prompt.trim(), model, ratio: finalRatioId, seed, id: Date.now() };
        setImageUrl(genUrl);
        setActiveResult(result);
        setLoading(false);
        const newHistory = [result, ...history].slice(0, 30);
        saveHistory(newHistory);
        showToast("Image generated successfully! ✨");
      };

      img.onerror = () => {
        if (!isRetry) {
          const retrySeed = Math.floor(Math.random() * 999999);
          const retryUrl = buildImageUrl(prompt, {
            width: ratio.width,
            height: ratio.height,
            model,
            seed: retrySeed,
            enhance,
          });
          loadWithUrl(retryUrl, true);
          return;
        }

        setLoading(false);
        setLoadFailed(true);
        showToast("Generation failed. Check your network connection.", "error");
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
    showToast("Loaded history item into the generator.");
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
      const modelLabel = MODELS.find(modelItem => modelItem.id === item.model)?.label.toLowerCase() || "";
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
    <div className="page-view img-gen-page" style={{ maxWidth: "1280px", margin: "0 auto" }}>
      <div className="img-gen-header">
        <div>
          <h2 className="img-gen-title">🎨 AI Image Generator</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <CheckCircle2 size={15} color="#4ade80" />
            <p className="img-gen-subtitle">Powered by ⚡ Pollinations AI (Flux) • 100% Free • No Login Required</p>
          </div>
        </div>
      </div>

      <div className="img-gen-workspace-grid">
        <div className="img-gen-panel">
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
              <label style={{ fontSize: "12px", fontWeight: "800", color: "#22d3ee", textTransform: "uppercase", letterSpacing: "0.8px" }}>🖊️ Image Prompt</label>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "11px", color: "#9ca3af", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "999px", padding: "4px 10px" }}>{promptWordCount} words</span>
                <span style={{ fontSize: "11px", color: "#9ca3af", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "999px", padding: "4px 10px" }}>{promptCharCount} chars</span>
                {prompt.trim() && (
                  <button type="button" onClick={clearPrompt} style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", color: "#f87171", borderRadius: "10px", padding: "6px 10px", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}>Clear</button>
                )}
              </div>
            </div>

            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you want to see... e.g. A majestic white owl in a magical fantasy library, oil painting style..."
              rows={4}
              style={{ width: "100%", boxSizing: "border-box", background: "rgba(0, 0, 0, 0.3)", border: "1px solid rgba(6, 182, 212, 0.25)", borderRadius: "16px", padding: "14px 16px", color: "#f3f4f6", fontSize: "15px", lineHeight: "1.6", resize: "vertical", outline: "none", fontFamily: "Outfit, Inter, sans-serif", transition: "all 0.2s" }}
              onFocus={e => (e.target.style.borderColor = "rgba(6, 182, 212, 0.7)")}
              onBlur={e => (e.target.style.borderColor = "rgba(6, 182, 212, 0.25)")}
            />

            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {PROMPT_CHIPS.map(fragment => (
                <button key={fragment} type="button" onClick={() => appendPromptFragment(fragment)} style={{ background: "rgba(6, 182, 212, 0.06)", border: "1px solid rgba(6, 182, 212, 0.18)", borderRadius: "999px", padding: "6px 10px", fontSize: "11px", color: "#22d3ee", cursor: "pointer", transition: "all 0.2s", fontWeight: "600" }}>
                  + {fragment}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
              {SUGGESTIONS.map((s, i) => (
                <button key={i} type="button" onClick={() => setPrompt(s)} style={{ background: "rgba(6, 182, 212, 0.05)", border: "1px solid rgba(6, 182, 212, 0.2)", borderRadius: "20px", padding: "5px 12px", fontSize: "11px", color: "#22d3ee", cursor: "pointer", transition: "all 0.2s", fontWeight: "500" }}>
                  {s.length > 32 ? s.slice(0, 30) + "…" : s}
                </button>
              ))}
            </div>

            {prompt.trim() && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", padding: "10px 12px", borderRadius: "12px", background: "rgba(6, 182, 212, 0.06)", border: "1px solid rgba(6, 182, 212, 0.14)" }}>
                <div style={{ fontSize: "11px", color: "#9ca3af", lineHeight: "1.4" }}>
                  <strong style={{ color: "#e5e7eb" }}>Tip:</strong> Add subject + style + lighting + mood for stronger results.
                </div>
                <button type="button" onClick={() => navigator.clipboard.writeText(prompt).then(() => showToast("Prompt copied! 📋")).catch(() => showToast("Failed to copy.", "error"))} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(6, 182, 212, 0.18)", color: "#d1d5db", borderRadius: "10px", padding: "7px 12px", fontSize: "11px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Copy size={12} /> Copy Prompt
                </button>
              </div>
            )}
          </div>

          <button type="button" onClick={() => setShowAdvanced(prev => !prev)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.05)", borderRadius: "14px", padding: "12px 16px", color: "#e5e7eb", fontSize: "13px", fontWeight: "700", cursor: "pointer", transition: "all 0.2s", marginTop: "6px", outline: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Settings size={16} style={{ color: "#22d3ee" }} />
              <span>Advanced Settings (Model, Ratio)</span>
            </div>
            {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showAdvanced && (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px", padding: "16px", background: "rgba(0, 0, 0, 0.15)", border: "1px solid rgba(255, 255, 255, 0.05)", borderRadius: "16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <label style={{ fontSize: "11px", fontWeight: "800", color: "#22d3ee", textTransform: "uppercase", letterSpacing: "0.8px" }}>🤖 AI Model</label>
                <div className="img-gen-model-grid">
                  {MODELS.map(m => (
                    <button key={m.id} type="button" onClick={() => setModel(m.id)} style={{ padding: "10px 12px", borderRadius: "12px", cursor: "pointer", transition: "all 0.2s", textAlign: "left", background: model === m.id ? "rgba(6, 182, 212, 0.12)" : "rgba(0, 0, 0, 0.25)", border: model === m.id ? "2px solid rgba(6, 182, 212, 0.75)" : "1px solid rgba(255, 255, 255, 0.05)", boxShadow: model === m.id ? "0 4px 15px rgba(6, 182, 212, 0.2)" : "none" }}>
                      <div style={{ fontSize: "12px", fontWeight: "700", color: model === m.id ? "#22d3ee" : "#d1d5db" }}>{m.label}</div>
                      <div style={{ fontSize: "9px", color: "#9ca3af", marginTop: "2px", lineHeight: "1.3" }}>{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="img-gen-ratio-wrapper" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <label style={{ fontSize: "11px", fontWeight: "800", color: "#22d3ee", textTransform: "uppercase", letterSpacing: "0.8px" }}>📐 Aspect Ratio</label>
                <div className="img-gen-ratio-grid">
                  {ASPECT_RATIOS.map(ratio => (
                    <button key={ratio.id} type="button" onClick={() => setAspectRatio(ratio.id)} style={{ padding: "8px 6px", borderRadius: "10px", cursor: "pointer", transition: "all 0.2s", textAlign: "center", background: aspectRatio === ratio.id ? "rgba(6, 182, 212, 0.12)" : "rgba(0, 0, 0, 0.25)", border: aspectRatio === ratio.id ? "2px solid rgba(6, 182, 212, 0.75)" : "1px solid rgba(255, 255, 255, 0.05)" }}>
                      <div style={{ fontSize: "16px", marginBottom: "2px" }}>{ratio.icon}</div>
                      <div style={{ fontSize: "10px", fontWeight: "700", color: "#e5e7eb" }}>{ratio.label}</div>
                      <div style={{ fontSize: "8px", color: "#9ca3af", marginTop: "1px" }}>{ratio.desc}</div>
                    </button>
                  ))}
                </div>
              </div>


              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "14px" }}>
                <div>
                  <span style={{ fontSize: "13px", fontWeight: "600", color: "#e5e7eb", display: "block" }}>Enhance Prompt</span>
                  <span style={{ fontSize: "10px", color: "#9ca3af" }}>Automatically add details to prompt</span>
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

          <button onClick={generateImage} disabled={loading} style={{ background: loading ? "rgba(6,182,212,0.25)" : "linear-gradient(135deg, #6366f1, #06b6d4)", color: "white", border: "none", padding: "16px 20px", borderRadius: "16px", fontWeight: "800", fontSize: "16px", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", transition: "all 0.2s", boxShadow: loading ? "none" : "0 6px 28px rgba(6,182,212,0.4)", marginTop: "8px" }}>
            {loading ? (
              <><RefreshCw size={19} style={{ animation: "spin 0.8s linear infinite" }} /> Creating Masterpiece...</>
            ) : (
              <><Sparkles size={19} /> Generate Masterpiece</>
            )}
          </button>
        </div>

        <div className="img-gen-panel img-gen-output-panel">
          {loading && (() => {
            const ratio = ASPECT_RATIOS.find(r => r.id === aspectRatio);
            const shimmerAspect = ratio ? ratio.width / ratio.height : 1;
            return (
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Shimmer skeleton matching selected aspect ratio */}
                <div style={{
                  width: "100%",
                  aspectRatio: shimmerAspect,
                  borderRadius: "18px",
                  overflow: "hidden",
                  position: "relative",
                  background: "linear-gradient(90deg, rgba(6,182,212,0.04) 25%, rgba(6,182,212,0.1) 50%, rgba(6,182,212,0.04) 75%)",
                  backgroundSize: "200% 100%",
                  animation: "shimmer 1.8s infinite",
                  border: "2px solid rgba(6,182,212,0.15)",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
                }}>
                  <div style={{
                    position: "absolute", inset: 0,
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", gap: "16px"
                  }}>
                    <div style={{ position: "relative", width: "72px", height: "72px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ position: "absolute", width: "100%", height: "100%", border: "3px solid rgba(6,182,212,0.15)", borderTopColor: "#06b6d4", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                      <Sparkles size={28} color="#06b6d4" />
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <h4 style={{ color: "#e9d5ff", fontSize: "16px", fontWeight: "700", margin: "0 0 6px 0" }}>Rendering Masterpiece</h4>
                      <p style={{ color: "#9ca3af", fontSize: "13px", margin: 0 }}>FLUX.1 is weaving the pixels... usually 5–15 seconds</p>
                    </div>
                  </div>
                </div>
                {/* Shimmer detail bars */}
                <div style={{ display: "flex", gap: "10px" }}>
                  {["60%", "25%", "15%"].map((w, i) => (
                    <div key={i} style={{ height: "36px", borderRadius: "10px", background: "rgba(6,182,212,0.06)", animation: "shimmer 1.8s infinite", backgroundSize: "200% 100%", width: w }} />
                  ))}
                </div>
              </div>
            );
          })()}

          {loadFailed && !loading && (
            <div style={{ padding: "40px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", textAlign: "center" }}>
              <AlertCircle size={48} color="#ef4444" />
              <div>
                <h4 style={{ color: "#f87171", fontSize: "16px", fontWeight: "700", margin: "0 0 8px 0" }}>Generation Interrupted</h4>
                <p style={{ color: "#9ca3af", fontSize: "13px", maxWidth: "300px", margin: 0 }}>Pollinations AI server took too long to respond. Let's retry with a different configuration.</p>
              </div>
              <button onClick={generateImage} style={{ background: "rgba(168,85,247,0.15)", color: "#c084fc", border: "1px solid rgba(168,85,247,0.3)", padding: "10px 20px", borderRadius: "10px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
                <RefreshCw size={14} /> Try Again
              </button>
            </div>
          )}

          {!imageUrl && !loading && !loadFailed && (
            <div style={{ padding: "60px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "18px", textAlign: "center" }}>
              <div style={{ width: "90px", height: "90px", borderRadius: "50%", background: "rgba(6, 182, 212, 0.06)", border: "1px dashed rgba(6, 182, 212, 0.3)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "8px" }}>
                <ImageIcon size={44} color="rgba(6, 182, 212, 0.4)" />
              </div>
              <div>
                <h4 style={{ color: "#e5e7eb", fontSize: "18px", fontWeight: "700", margin: "0 0 6px 0" }}>Output Workspace</h4>
                <p style={{ color: "#9ca3af", fontSize: "13px", maxWidth: "320px", margin: 0, lineHeight: "1.6" }}>Your generated masterpiece will render here. Choose options on the left to start!</p>
              </div>
            </div>
          )}

          {imageUrl && !loading && (
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ width: "100%", maxWidth: "100%", aspectRatio: ASPECT_RATIOS.find(r => r.id === (activeResult?.ratio || aspectRatio))?.width / ASPECT_RATIOS.find(r => r.id === (activeResult?.ratio || aspectRatio))?.height, borderRadius: "18px", overflow: "hidden", boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)", border: "2px solid rgba(6, 182, 212, 0.25)", background: "#07070d", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <img src={imageUrl} alt="AI Generated Output" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>

              <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(6, 182, 212, 0.15)", borderRadius: "16px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div className="img-gen-action-row">
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#06b6d4", textTransform: "uppercase", letterSpacing: "0.5px" }}>✨ Generated Design</span>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => navigator.clipboard.writeText(imageUrl).then(() => showToast("Direct URL copied to clipboard! 📋")).catch(() => showToast("Failed to copy URL.", "error"))} style={{ background: "rgba(255,255,255,0.03)", color: "#22d3ee", border: "1px solid rgba(6, 182, 212, 0.25)", padding: "8px 14px", borderRadius: "10px", fontSize: "12px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
                      <Copy size={13} /> Copy Link
                    </button>
                    <button onClick={() => handleDownload(imageUrl)} style={{ background: "linear-gradient(135deg, #6366f1, #06b6d4)", color: "white", border: "none", padding: "8px 18px", borderRadius: "10px", fontSize: "12px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
                      <Download size={13} /> Download
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: "12px", color: "#9ca3af", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "10px", lineHeight: "1.5" }}>
                  <strong style={{ color: "#d1d5db" }}>Prompt:</strong> "<em>{activeResult?.prompt || history[0]?.prompt}</em>"
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

      {history.length > 0 && (
        <div className="img-gen-history-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#d1d5db", margin: 0 }}>📚 Creation History ({history.length})</h3>
              <span className="img-gen-swipe-hint" style={{ fontSize: "11px", color: "#06b6d4", background: "rgba(6, 182, 212, 0.08)", padding: "4px 8px", borderRadius: "8px", fontWeight: "600" }}>← Swipe to browse →</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", borderRadius: "10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <Sparkles size={13} color="#22d3ee" />
                <span style={{ fontSize: "12px", color: "#e5e7eb", fontWeight: "600" }}>{new Set(history.map(item => item.model).filter(Boolean)).size} models used</span>
              </div>
              <input value={historyQuery} onChange={e => setHistoryQuery(e.target.value)} placeholder="Search history by prompt, model, ratio" aria-label="Search generation history" style={{ minWidth: "240px", background: "rgba(0, 0, 0, 0.28)", border: "1px solid rgba(6, 182, 212, 0.16)", borderRadius: "10px", padding: "9px 12px", color: "#f3f4f6", fontSize: "12px", outline: "none" }} />
            </div>
            <button onClick={clearHistory} style={{ background: "rgba(239, 68, 68, 0.1)", color: "#f87171", border: "1px solid rgba(239, 68, 68, 0.2)", padding: "8px 14px", borderRadius: "10px", fontSize: "12px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", transition: "all 0.2s" }}>
              <Trash2 size={13} /> Clear History
            </button>
          </div>

          {historyQuery.trim() && (
            <div style={{ marginBottom: "14px", fontSize: "12px", color: "#9ca3af" }}>Showing {filteredHistory.length} of {history.length} items for “{historyQuery.trim()}”.</div>
          )}

          <div className="img-gen-history-grid">
            {filteredHistory.map(item => (
              <div key={item.id} onClick={() => openHistoryItem(item)} style={{ borderRadius: "16px", overflow: "hidden", border: imageUrl === item.url ? "1px solid rgba(6, 182, 212, 0.9)" : "1px solid rgba(255, 255, 255, 0.05)", background: imageUrl === item.url ? "rgba(6, 182, 212, 0.08)" : "rgba(0, 0, 0, 0.2)", cursor: "pointer", transition: "transform 0.2s, box-shadow 0.2s", position: "relative", aspectRatio: "1/1", flexShrink: 0 }}>
                <img src={item.url} alt={item.prompt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0, 0, 0, 0.9))", padding: "20px 10px 8px 10px", fontSize: "11px", color: "#d1d5db", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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

          {filteredHistory.length === 0 && (
            <div style={{ marginTop: "18px", padding: "18px", borderRadius: "14px", border: "1px dashed rgba(6, 182, 212, 0.2)", color: "#9ca3af", fontSize: "13px", textAlign: "center" }}>No history items match your search.</div>
          )}
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.15); opacity: 0.7; } }

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
        .img-gen-workspace-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-bottom: 40px; }
        .img-gen-panel {
          background: rgba(11, 14, 26, 0.45); backdrop-filter: blur(24px);
          border: 1px solid rgba(6, 182, 212, 0.18); border-radius: 24px;
          padding: 28px; display: flex; flex-direction: column; gap: 24px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3), inset 0 0 20px rgba(6, 182, 212, 0.05);
        }
        .img-gen-output-panel { align-items: center; justify-content: center; min-height: 480px; position: relative; }
        .img-gen-model-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .img-gen-ratio-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .img-gen-action-row { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
        .img-gen-meta-row { margin-top: 6px; display: flex; gap: 12px; color: #8a94a6; font-size: 11px; flex-wrap: wrap; }
        .img-gen-history-panel { background: rgba(11, 14, 26, 0.25); border: 1px solid rgba(6, 182, 212, 0.1); border-radius: 24px; padding: 28px; }
        .img-gen-history-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 18px; }
        .img-gen-swipe-hint { display: none; }
        .img-gen-history-actions { position: absolute; top: 8px; right: 8px; display: flex; gap: 4px; z-index: 10; }
        .img-gen-history-action-btn { background: rgba(0, 0, 0, 0.65); backdrop-filter: blur(4px); border: none; border-radius: 8px; padding: 6px; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .img-gen-history-action-btn:hover { background: rgba(6, 182, 212, 0.85); transform: scale(1.08); }
        .img-gen-history-action-btn.delete { background: rgba(239, 68, 68, 0.8); }
        .img-gen-history-action-btn.delete:hover { background: rgba(239, 68, 68, 0.95); }
        .img-gen-history-icon { width: 12px; height: 12px; display: block; }

        @media (max-width: 768px) {
          .img-gen-page { padding: 16px 12px !important; }
          .img-gen-title { font-size: 26px !important; text-align: center; width: 100%; }
          .img-gen-subtitle { font-size: 11px !important; text-align: center; width: 100%; justify-content: center; }
          .img-gen-header { justify-content: center; text-align: center; }
          .img-gen-header > div { display: flex; flex-direction: column; align-items: center; }
          .img-gen-workspace-grid { grid-template-columns: 1fr !important; gap: 18px !important; }
          .img-gen-panel { padding: 18px !important; gap: 18px !important; border-radius: 18px !important; border: 1px solid rgba(6, 182, 212, 0.25) !important; box-shadow: 0 8px 32px rgba(11, 14, 26, 0.5), inset 0 0 20px rgba(6, 182, 212, 0.08) !important; }
          .img-gen-output-panel { min-height: 300px !important; }
          .img-gen-model-grid { grid-template-columns: 1fr !important; }
          .img-gen-ratio-wrapper { display: none !important; }
          .img-gen-history-panel { padding: 16px !important; border-radius: 18px !important; }
          .img-gen-swipe-hint { display: inline-block !important; animation: pulse 2s infinite ease-in-out; }
          .img-gen-history-grid { display: flex !important; overflow-x: auto !important; flex-wrap: nowrap !important; gap: 14px !important; padding: 10px 4px 16px 4px !important; scroll-behavior: smooth; -webkit-overflow-scrolling: touch; }
          .img-gen-history-grid::-webkit-scrollbar { display: block !important; height: 5px !important; }
          .img-gen-history-grid::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02) !important; border-radius: 10px !important; }
          .img-gen-history-grid::-webkit-scrollbar-thumb { background: rgba(6, 182, 212, 0.4) !important; border-radius: 10px !important; }
          .img-gen-history-grid > div { flex: 0 0 180px !important; height: 180px !important; aspect-ratio: 1/1 !important; border-radius: 16px !important; box-shadow: 0 4px 15px rgba(6, 182, 212, 0.2) !important; border: 1px solid rgba(6, 182, 212, 0.25) !important; }
          .img-gen-history-actions { top: 4px !important; right: 4px !important; gap: 3px !important; }
          .img-gen-history-action-btn { padding: 4px !important; border-radius: 6px !important; }
          .img-gen-history-icon { width: 10px !important; height: 10px !important; }
          .img-gen-action-row { flex-direction: column; align-items: stretch; }
          .img-gen-action-row > div { display: flex; gap: 8px; }
          .img-gen-action-row > div button { flex: 1; justify-content: center; }
          .img-gen-meta-row { flex-direction: column; gap: 4px !important; }
        }

        @media (max-width: 400px) {
          .img-gen-page { padding: 10px 8px !important; }
          .img-gen-title { font-size: 22px !important; }
          .img-gen-panel { padding: 14px !important; border-radius: 14px !important; }
          .img-gen-history-grid > div { flex: 0 0 145px !important; height: 145px !important; }
        }
      `}</style>
    </div>
  );
}