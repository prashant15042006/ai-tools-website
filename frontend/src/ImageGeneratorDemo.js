import React, { useState, useRef } from 'react';
import { generateImage, b64ToDataUrl } from './puter';

export default function ImageGeneratorDemo() {
  const [prompt, setPrompt] = useState('A friendly robot painting a sunset');
  const [loading, setLoading] = useState(false);
  const [imgSrc, setImgSrc] = useState(null);
  const [error, setError] = useState(null);
  const [provider, setProvider] = useState('server'); // 'server' or 'puterjs'
  const previewRef = useRef(null);

  const loadPuterSdk = () => {
    return new Promise((resolve, reject) => {
      if (window.puter && window.puter.ai) return resolve(window.puter);
      const existing = document.querySelector('script[data-puter-sdk]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.puter));
        existing.addEventListener('error', () => reject(new Error('Failed to load puter SDK')));
        return;
      }
      const s = document.createElement('script');
      s.src = 'https://js.puter.com/v2/';
      s.setAttribute('data-puter-sdk', 'true');
      s.async = true;
      s.onload = () => resolve(window.puter);
      s.onerror = () => reject(new Error('Failed to load puter SDK'));
      document.head.appendChild(s);
    });
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setImgSrc(null);
    if (previewRef.current) previewRef.current.innerHTML = '';
    const res = await generateImage(prompt, '512x512');
    try {
      if (provider === 'server') {
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
          setError('No image returned from server');
        }
      } else {
        // Provider: puter.js client SDK
        try {
          const puter = await loadPuterSdk();
          // Use testMode = true so it doesn't consume credits in test environment
          const imgElement = await puter.ai.txt2img(prompt, true);
          setLoading(false);
          if (imgElement && imgElement.src) {
            // If SDK returned an <img> element, append to preview container
            if (previewRef.current) {
              previewRef.current.appendChild(imgElement);
              setImgSrc(null);
            } else {
              setImgSrc(imgElement.src);
            }
          } else if (imgElement && imgElement instanceof HTMLElement) {
            if (previewRef.current) previewRef.current.appendChild(imgElement);
          } else {
            setError('puter SDK did not return an image element.');
          }
        } catch (sdkErr) {
          setLoading(false);
          setError(sdkErr.message || String(sdkErr));
        }
      }
    } catch (err) {
      setLoading(false);
      setError(err.message || String(err));
    }
  };

  return (
    <div style={{ padding: 16, maxWidth: 920 }} className="image-generator-page">
      <h3 style={{ marginBottom: 8 }}>Image Generator (demo)</h3>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <select value={provider} onChange={(e) => setProvider(e.target.value)} style={{ padding: 8, borderRadius: 8, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
          <option value="server">Server (recommended)</option>
          <option value="puterjs">Puter.js (client SDK)</option>
        </select>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} style={{ flex: 1, minHeight: 80, padding: 8, borderRadius: 8 }} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={handleGenerate} disabled={loading} className="send-btn">
          {loading ? 'Generating...' : 'Generate Image'}
        </button>
      </div>

      {error && <div style={{ color: '#f87171', marginBottom: 8 }}>{error}</div>}

      <div className="image-preview-row" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {imgSrc && (
          <div className="image-preview" style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
            <img src={imgSrc} alt="Generated" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}

        <div ref={previewRef} className="image-preview image-preview-fallback" style={{ borderRadius: 12, border: '1px dashed rgba(255,255,255,0.04)', overflow: 'hidden' }} />
      </div>
    </div>
  );
}
