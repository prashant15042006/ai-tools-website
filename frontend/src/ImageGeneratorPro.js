import React, { useMemo, useState } from "react";
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
              <label className="img-gen-label">🖊️ Image Prompt</label>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span className="img-gen-counter-badge">{promptWordCount} words</span>
                <span className="img-gen-counter-badge">{promptCharCount} chars</span>
                {prompt.trim() && (
                  <button type="button" onClick={clearPrompt} className="img-gen-clear-btn">Clear</button>
                )}
              </div>
            </div>

            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you want to see... e.g. A majestic white owl in a magical fantasy library, oil painting style..."
              rows={4}
              className="img-gen-textarea"
            />

            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {PROMPT_CHIPS.map(fragment => (
                <button key={fragment} type="button" onClick={() => appendPromptFragment(fragment)} className="img-gen-chip">
                  + {fragment}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
              {SUGGESTIONS.map((s, i) => (
                <button key={i} type="button" onClick={() => setPrompt(s)} className="img-gen-suggestion">
                  {s.length > 32 ? s.slice(0, 30) + "…" : s}
                </button>
              ))}
            </div>

            {prompt.trim() && (
              <div className="img-gen-tip-box">
                <div className="img-gen-tip-text">
                  <strong>Tip:</strong> Add subject + style + lighting + mood for stronger results.
                </div>
                <button type="button" onClick={() => navigator.clipboard.writeText(prompt).then(() => showToast("Prompt copied! 📋")).catch(() => showToast("Failed to copy.", "error"))} className="img-gen-chip-copy">
                  <Copy size={12} /> Copy Prompt
                </button>
              </div>
            )}
          </div>

          <button type="button" onClick={() => setShowAdvanced(prev => !prev)} className="img-gen-adv-toggle">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Settings size={16} style={{ color: "#22d3ee" }} />
              <span>Advanced Settings (Model, Ratio)</span>
            </div>
            {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showAdvanced && (
            <div className="img-gen-adv-panel">
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <label className="img-gen-label">🤖 AI Model</label>
                <div className="img-gen-model-grid">
                  {MODELS.map(m => (
                    <button key={m.id} type="button" onClick={() => setModel(m.id)} className={`img-gen-model-btn ${model === m.id ? "active" : ""}`}>
                      <div className="img-gen-model-label">{m.label}</div>
                      <div className="img-gen-model-desc">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

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


              <div className="img-gen-enhance-row">
                <div>
                  <span className="img-gen-enhance-title">Enhance Prompt</span>
                  <span className="img-gen-enhance-desc">Automatically add details to prompt</span>
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
                      <h4 className="img-gen-empty-title">Rendering Masterpiece</h4>
                      <p className="img-gen-empty-subtitle">FLUX.1 is weaving the pixels... usually 5–15 seconds</p>
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
                <p className="img-gen-empty-subtitle">Pollinations AI server took too long to respond. Let's retry with a different configuration.</p>
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
                <h4 className="img-gen-empty-title">Output Workspace</h4>
                <p className="img-gen-empty-subtitle">Your generated masterpiece will render here. Choose options on the left to start!</p>
              </div>
            </div>
          )}

          {imageUrl && !loading && (
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ width: "100%", maxWidth: "100%", aspectRatio: ASPECT_RATIOS.find(r => r.id === (activeResult?.ratio || aspectRatio))?.width / ASPECT_RATIOS.find(r => r.id === (activeResult?.ratio || aspectRatio))?.height, borderRadius: "18px", overflow: "hidden", boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)", border: "2px solid rgba(6, 182, 212, 0.25)", background: "#07070d", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <img src={imageUrl} alt="AI Generated Output" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>

              <div className="img-gen-result-box">
                <div className="img-gen-action-row">
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#06b6d4", textTransform: "uppercase", letterSpacing: "0.5px" }}>✨ Generated Design</span>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => navigator.clipboard.writeText(imageUrl).then(() => showToast("Direct URL copied to clipboard! 📋")).catch(() => showToast("Failed to copy URL.", "error"))} className="img-gen-link-btn">
                      <Copy size={13} /> Copy Link
                    </button>
                    <button onClick={() => handleDownload(imageUrl)} style={{ background: "linear-gradient(135deg, #6366f1, #06b6d4)", color: "white", border: "none", padding: "8px 18px", borderRadius: "10px", fontSize: "12px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
                      <Download size={13} /> Download
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
              <input value={historyQuery} onChange={e => setHistoryQuery(e.target.value)} placeholder="Search history by prompt, model, ratio" aria-label="Search generation history" className="img-gen-history-search" />
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
        .img-gen-label { font-size: 12px; font-weight: 800; color: #22d3ee; text-transform: uppercase; letter-spacing: 0.8px; }
        .img-gen-counter-badge { font-size: 11px; color: #9ca3af; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 999px; padding: 4px 10px; }
        .img-gen-clear-btn { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #f87171; border-radius: 10px; padding: 6px 10px; font-size: 11px; font-weight: 700; cursor: pointer; transition: all 0.2s; }

        .img-gen-workspace-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-bottom: 40px; }
        .img-gen-panel {
          background: rgba(11, 14, 26, 0.45); backdrop-filter: blur(24px);
          border: 1px solid rgba(6, 182, 212, 0.18); border-radius: 24px;
          padding: 28px; display: flex; flex-direction: column; gap: 24px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3), inset 0 0 20px rgba(6, 182, 212, 0.05);
        }
        .img-gen-output-panel { align-items: center; justify-content: center; min-height: 480px; position: relative; }

        .img-gen-textarea {
          width: 100%; box-sizing: border-box; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(6, 182, 212, 0.25);
          border-radius: 16px; padding: 14px 16px; color: #f3f4f6; font-size: 15px; line-height: 1.6;
          resize: vertical; outline: none; font-family: Outfit, Inter, sans-serif; transition: all 0.2s;
        }
        .img-gen-textarea:focus { border-color: rgba(6, 182, 212, 0.7); }
        .img-gen-textarea::placeholder { color: #9ca3af; }

        .img-gen-chip {
          background: rgba(6, 182, 212, 0.06); border: 1px solid rgba(6, 182, 212, 0.18); border-radius: 999px;
          padding: 6px 10px; font-size: 11px; color: #22d3ee; cursor: pointer; transition: all 0.2s; font-weight: 600;
        }
        .img-gen-chip:hover { background: rgba(6, 182, 212, 0.15); }

        .img-gen-chip-copy {
          background: rgba(255,255,255,0.04); border: 1px solid rgba(6, 182, 212, 0.18); color: #d1d5db;
          border-radius: 10px; padding: 7px 12px; font-size: 11px; font-weight: 700; cursor: pointer;
          display: flex; align-items: center; gap: 6px; transition: all 0.2s;
        }

        .img-gen-suggestion {
          background: rgba(6, 182, 212, 0.05); border: 1px solid rgba(6, 182, 212, 0.2); border-radius: 20px;
          padding: 5px 12px; font-size: 11px; color: #22d3ee; cursor: pointer; transition: all 0.2s; font-weight: 500;
        }
        .img-gen-suggestion:hover { background: rgba(6, 182, 212, 0.12); }

        .img-gen-tip-box {
          display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;
          padding: 10px 12px; border-radius: 12px; background: rgba(6, 182, 212, 0.06); border: 1px solid rgba(6, 182, 212, 0.14);
        }
        .img-gen-tip-text { font-size: 11px; color: #9ca3af; line-height: 1.4; }
        .img-gen-tip-text strong { color: #e5e7eb; }

        .img-gen-adv-toggle {
          display: flex; align-items: center; justify-content: space-between; width: 100%;
          background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 14px; padding: 12px 16px; color: #e5e7eb; font-size: 13px; font-weight: 700;
          cursor: pointer; transition: all 0.2s; marginTop: 6px; outline: none;
        }
        .img-gen-adv-panel {
          display: flex; flex-direction: column; gap: 18px; padding: 16px;
          background: rgba(0, 0, 0, 0.15); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px;
        }

        .img-gen-model-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .img-gen-model-btn {
          padding: 10px 12px; border-radius: 12px; cursor: pointer; transition: all 0.2s; text-align: left;
          background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .img-gen-model-btn.active {
          background: rgba(6, 182, 212, 0.12); border: 2px solid rgba(6, 182, 212, 0.75);
          box-shadow: 0 4px 15px rgba(6, 182, 212, 0.2);
        }
        .img-gen-model-label { font-size: 12px; font-weight: 700; color: #d1d5db; }
        .img-gen-model-btn.active .img-gen-model-label { color: #22d3ee; }
        .img-gen-model-desc { font-size: 9px; color: #9ca3af; margin-top: 2px; line-height: 1.3; }

        .img-gen-ratio-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .img-gen-ratio-btn {
          padding: 8px 6px; border-radius: 10px; cursor: pointer; transition: all 0.2s; text-align: center;
          background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .img-gen-ratio-btn.active {
          background: rgba(6, 182, 212, 0.12); border: 2px solid rgba(6, 182, 212, 0.75);
        }
        .img-gen-ratio-label { font-size: 10px; font-weight: 700; color: #e5e7eb; }
        .img-gen-ratio-desc { font-size: 8px; color: #9ca3af; margin-top: 1px; }

        .img-gen-enhance-row { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.05); paddingTop: 14px; }
        .img-gen-enhance-title { font-size: 13px; font-weight: 600; color: #e5e7eb; display: block; }
        .img-gen-enhance-desc { font-size: 10px; color: #9ca3af; }

        .img-gen-empty-title { color: #e5e7eb; font-size: 18px; font-weight: 700; margin: 0 0 6px 0; }
        .img-gen-empty-subtitle { color: #9ca3af; font-size: 13px; max-width: 320px; margin: 0; line-height: 1.6; }

        .img-gen-result-box {
          background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(6, 182, 212, 0.15);
          border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 12px;
        }
        .img-gen-action-row { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
        .img-gen-link-btn {
          background: rgba(255,255,255,0.03); color: #22d3ee; border: 1px solid rgba(6, 182, 212, 0.25);
          padding: 8px 14px; border-radius: 10px; font-size: 12px; font-weight: 600; cursor: pointer;
          display: flex; align-items: center; gap: 5px; transition: all 0.2s;
        }
        .img-gen-result-prompt { font-size: 12px; color: #9ca3af; border-top: 1px solid rgba(255,255,255,0.05); paddingTop: 10px; line-height: 1.5; }
        .img-gen-result-prompt strong { color: #d1d5db; }
        .img-gen-meta-row { margin-top: 6px; display: flex; gap: 12px; color: #8a94a6; font-size: 11px; flex-wrap: wrap; }

        .img-gen-history-panel { background: rgba(11, 14, 26, 0.25); border: 1px solid rgba(6, 182, 212, 0.1); border-radius: 24px; padding: 28px; }
        .img-gen-history-title { font-size: 18px; font-weight: 700; color: #d1d5db; margin: 0; }
        .img-gen-history-badge { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); }
        .img-gen-history-badge span { font-size: 12px; color: #e5e7eb; font-weight: 600; }
        .img-gen-history-search { min-width: 240px; background: rgba(0, 0, 0, 0.28); border: 1px solid rgba(6, 182, 212, 0.16); border-radius: 10px; padding: 9px 12px; color: #f3f4f6; font-size: 12px; outline: none; transition: all 0.2s; }
        .img-gen-clear-btn { background: rgba(239, 68, 68, 0.1); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.2); padding: 8px 14px; border-radius: 10px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s; }

        .img-gen-history-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 18px; }
        .img-gen-history-card {
          border-radius: 16px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.05);
          background: rgba(0, 0, 0, 0.2); cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; position: relative; aspect-ratio: 1/1; flex-shrink: 0;
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

        .light-mode .img-gen-subtitle {
          color: #15803d !important;
        }

        .light-mode .img-gen-panel,
        .light-mode .img-gen-history-panel {
          background: #ffffff !important;
          border-color: #d1dae6 !important;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.03) !important;
        }

        .light-mode .img-gen-label {
          color: #0284c7 !important;
        }

        .light-mode .img-gen-counter-badge {
          background: #f1f5f9 !important;
          border-color: #e2e8f0 !important;
          color: #475569 !important;
        }

        .light-mode .img-gen-textarea {
          background: #ffffff !important;
          border-color: #cbd5e1 !important;
          color: #0f172a !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04) !important;
        }
        .light-mode .img-gen-textarea::placeholder {
          color: #94a3b8 !important;
        }
        .light-mode .img-gen-textarea:focus {
          border-color: #0284c7 !important;
          box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.15) !important;
        }

        .light-mode .img-gen-chip {
          background: #f0f9ff !important;
          border-color: rgba(6, 182, 212, 0.3) !important;
          color: #0284c7 !important;
        }
        .light-mode .img-gen-chip:hover {
          background: rgba(6, 182, 212, 0.15) !important;
        }

        .light-mode .img-gen-chip-copy {
          background: #ffffff !important;
          border-color: #bae6fd !important;
          color: #0284c7 !important;
        }

        .light-mode .img-gen-suggestion {
          background: #f0fdf4 !important;
          border-color: rgba(16, 185, 129, 0.3) !important;
          color: #047857 !important;
        }
        .light-mode .img-gen-suggestion:hover {
          background: rgba(16, 185, 129, 0.15) !important;
        }

        .light-mode .img-gen-tip-box {
          background: #f0f9ff !important;
          border-color: #bae6fd !important;
        }
        .light-mode .img-gen-tip-text {
          color: #0369a1 !important;
        }
        .light-mode .img-gen-tip-text strong {
          color: #0c4a6e !important;
        }

        .light-mode .img-gen-adv-toggle {
          background: #f8fafc !important;
          border-color: #e2e8f0 !important;
          color: #1e293b !important;
        }
        .light-mode .img-gen-adv-panel {
          background: #f8fafc !important;
          border-color: #e2e8f0 !important;
        }

        .light-mode .img-gen-model-btn {
          background: #ffffff !important;
          border-color: #e2e8f0 !important;
        }
        .light-mode .img-gen-model-btn.active {
          background: rgba(6, 182, 212, 0.08) !important;
          border: 2px solid #0284c7 !important;
          box-shadow: 0 4px 12px rgba(6, 182, 212, 0.12) !important;
        }
        .light-mode .img-gen-model-label {
          color: #1e293b !important;
        }
        .light-mode .img-gen-model-btn.active .img-gen-model-label {
          color: #0284c7 !important;
        }
        .light-mode .img-gen-model-desc {
          color: #64748b !important;
        }

        .light-mode .img-gen-ratio-btn {
          background: #ffffff !important;
          border-color: #e2e8f0 !important;
        }
        .light-mode .img-gen-ratio-btn.active {
          background: rgba(6, 182, 212, 0.08) !important;
          border: 2px solid #0284c7 !important;
        }
        .light-mode .img-gen-ratio-label {
          color: #1e293b !important;
        }
        .light-mode .img-gen-ratio-btn.active .img-gen-ratio-label {
          color: #0284c7 !important;
        }
        .light-mode .img-gen-ratio-desc {
          color: #64748b !important;
        }

        .light-mode .img-gen-enhance-row {
          border-top-color: #e2e8f0 !important;
        }
        .light-mode .img-gen-enhance-title {
          color: #1e293b !important;
        }
        .light-mode .img-gen-enhance-desc {
          color: #64748b !important;
        }

        .light-mode .img-gen-empty-title {
          color: #0f172a !important;
        }
        .light-mode .img-gen-empty-subtitle {
          color: #64748b !important;
        }

        .light-mode .img-gen-result-box {
          background: #f8fafc !important;
          border-color: #e2e8f0 !important;
        }
        .light-mode .img-gen-link-btn {
          background: #ffffff !important;
          border-color: #cbd5e1 !important;
          color: #0284c7 !important;
        }
        .light-mode .img-gen-result-prompt {
          color: #475569 !important;
          border-top-color: #e2e8f0 !important;
        }
        .light-mode .img-gen-result-prompt strong {
          color: #0f172a !important;
        }

        .light-mode .img-gen-history-title {
          color: #0f172a !important;
        }
        .light-mode .img-gen-history-badge {
          background: #f1f5f9 !important;
          border-color: #e2e8f0 !important;
        }
        .light-mode .img-gen-history-badge span {
          color: #1e293b !important;
        }
        .light-mode .img-gen-history-search {
          background: #ffffff !important;
          border-color: #cbd5e1 !important;
          color: #0f172a !important;
        }
        .light-mode .img-gen-history-search::placeholder {
          color: #94a3b8 !important;
        }
        .light-mode .img-gen-history-card {
          background: #ffffff !important;
          border-color: #e2e8f0 !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04) !important;
        }
        .light-mode .img-gen-history-card.active {
          border-color: #0284c7 !important;
          box-shadow: 0 4px 14px rgba(6, 182, 212, 0.2) !important;
        }


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