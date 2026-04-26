import React, { useState } from "react";
import { Download, ImageIcon, Loader2, Sparkles, Wand2 } from "lucide-react";

function ImageGenerator() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [error, setError] = useState("");

  const generateImage = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError("");
    setImageUrl("");

    try {
      const response = await fetch("http://localhost:5000/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setImageUrl(data.imageUrl);
      } else {
        setError(data.error || "Failed to generate image.");
      }
    } catch (err) {
      setError("Connection error. Is the backend running?");
    }
    setLoading(false);
  };

  return (
    <div className="page-view" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h2 style={{ fontSize: '42px', fontWeight: '800', marginBottom: '12px', background: 'linear-gradient(to right, #6366f1, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Creative Image Forge
        </h2>
        <p style={{ fontSize: '18px', color: 'var(--text-secondary)' }}>
          Transform your descriptions into high-fidelity visual art.
        </p>
      </div>

      <div className="input-box-wrapper" style={{ marginBottom: '40px', padding: '16px 24px' }}>
        <Sparkles size={24} style={{ color: 'var(--accent)', marginRight: '16px' }} />
        <textarea
          className="chat-textarea"
          placeholder="Describe the image you want to create (e.g., 'A futuristic city at sunset with neon lights')..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows="2"
          style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-primary)', fontSize: '18px', resize: 'none' }}
        />
        <button 
          className="send-btn" 
          onClick={generateImage} 
          disabled={loading || !prompt.trim()}
          style={{ marginLeft: '16px', padding: '12px 24px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          {loading ? <Loader2 className="animate-spin" size={20} /> : <Wand2 size={20} />}
          <span>{loading ? "Forging..." : "Generate"}</span>
        </button>
      </div>

      <div style={{ minHeight: '400px', background: 'rgba(255,255,255,0.03)', borderRadius: '32px', border: '2px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', zIndex: 10 }}>
            <Loader2 className="animate-spin" size={48} color="var(--accent)" />
            <span style={{ fontSize: '18px', fontWeight: '600' }}>Crafting your masterpiece...</span>
          </div>
        )}

        {!loading && !imageUrl && !error && (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
            <ImageIcon size={64} style={{ marginBottom: '16px', opacity: 0.3 }} />
            <p>Your generated image will appear here.</p>
          </div>
        )}

        {error && (
          <div style={{ textAlign: 'center', color: '#ef4444', padding: '24px' }}>
            <p style={{ fontSize: '18px', fontWeight: '600' }}>⚠️ {error}</p>
          </div>
        )}

        {imageUrl && (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <img 
              src={imageUrl} 
              alt={prompt} 
              style={{ maxWidth: '100%', maxHeight: '600px', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }} 
            />
            <button 
              className="action-btn" 
              onClick={() => window.open(imageUrl, '_blank')}
              style={{ marginTop: '24px', background: 'var(--bg-hover)', padding: '12px 24px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Download size={20} />
              <span>Download High-Res</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ImageGenerator;
