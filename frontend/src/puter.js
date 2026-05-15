// puter.js
// Simple frontend helper to request image generation from the backend
// Usage:
// import { generateImage, b64ToDataUrl } from './puter';
// const { success, data } = await generateImage('a cute robot reading a book');
// if (success) { const url = b64ToDataUrl(data.b64_json); /* set as img.src */ }

import API_BASE_URL from './apiConfig';

export async function generateImage(prompt, size = '1024x1024') {
  try {
    const endpoint = `${API_BASE_URL}/api/generate-image`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, size }),
    });

    const json = await res.json();
    if (json.success && json.data) {
      // If server returned b64_json, return as-is. If it returned a URL, forward it.
      if (json.data.b64_json) return json;
      if (json.data.url) return { success: true, data: { url: json.data.url } };
    }
    return json;
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
}

export function b64ToDataUrl(b64) {
  return `data:image/png;base64,${b64}`;
}

const puter = { generateImage, b64ToDataUrl };

export default puter;