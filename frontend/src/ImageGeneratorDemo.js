import React, { useState } from 'react';
import { generateImage, b64ToDataUrl } from './puter';

export default function ImageGeneratorDemo() {
  const [prompt, setPrompt] = useState('A friendly robot painting a sunset');
  const [loading, setLoading] = useState(false);
  const [imgSrc, setImgSrc] = useState(null);
  const [error, setError] = useState(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setImgSrc(null);
    const res = await generateImage(prompt, '512x512');
    setLoading(false);
    if (!res.success) {
      setError(res.error || 'Unknown error');
      return;
    }
    if (res.data.b64_json) {
      setImgSrc(b64ToDataUrl(res.data.b64_json));
    } else if (res.data.url) {
      setImgSrc(res.data.url);
    } else {
      setError('No image returned');
    }
  };

  return (
    <div style={{ padding: 16, maxWidth: 720 }}>
      <h3 style={{ marginBottom: 8 }}>Image Generator (demo)</h3>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} style={{ width: '100%', minHeight: 80, padding: 8, borderRadius: 8, marginBottom: 8 }} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={handleGenerate} disabled={loading} className="send-btn">
          {loading ? 'Generating...' : 'Generate Image'}
        </button>
      </div>

      {error && <div style={{ color: '#f87171', marginBottom: 8 }}>{error}</div>}

      {imgSrc && (
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', width: 512, height: 512 }}>
          <img src={imgSrc} alt="Generated" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}
    </div>
  );
}
