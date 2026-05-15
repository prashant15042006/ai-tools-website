// puter.js
// Simple frontend helper to request image generation from the backend
// Usage:
// import { generateImage, b64ToDataUrl } from './puter';
// const { success, data } = await generateImage('a cute robot reading a book');
// if (success) { const url = b64ToDataUrl(data.b64_json); /* set as img.src */ }

export async function generateImage(prompt, size = '1024x1024') {
  try {
    const res = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, size }),
    });

    const json = await res.json();
    return json;
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
}

export function b64ToDataUrl(b64) {
  return `data:image/png;base64,${b64}`;
}

export default { generateImage, b64ToDataUrl };