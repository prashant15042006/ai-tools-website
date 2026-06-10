// script.js
// Simple client‑side integration with Puter.js (hypothetical library)
// Puter is assumed to expose a `Puter.generateImage(prompt)` method returning a Promise
// that resolves to a Blob or Data URL of the generated image.

document.addEventListener('DOMContentLoaded', () => {
  const promptInput = document.getElementById('promptInput');
  const generateBtn = document.getElementById('generateBtn');
  const outputSection = document.getElementById('outputSection');
  const imageBox = document.getElementById('imageBox');
  const imgEl = document.getElementById('generatedImg');
  const messageBox = document.getElementById('messageBox');
  const downloadBtn = document.getElementById('downloadBtn');

  // Helper to show a temporary toast
  const showToast = (msg, duration = 3000) => {
    const toast = document.createElement('div');
    toast.textContent = msg;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.background = 'rgba(0,0,0,0.7)';
    toast.style.color = '#fff';
    toast.style.padding = '0.6rem 1rem';
    toast.style.borderRadius = '8px';
    toast.style.zIndex = 1000;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
  };

  generateBtn.addEventListener('click', async () => {
    const prompt = promptInput.value.trim();
    if (!prompt) {
      showToast('Please enter a prompt');
      return;
    }
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating…';
    try {
      // Puter.generateImage is a placeholder for the real API
      const result = await Puter.generateImage(prompt);
      // Accept Blob, DataURL or direct URL string
      let imgUrl;
      if (result instanceof Blob) {
        imgUrl = URL.createObjectURL(result);
      } else if (typeof result === 'string') {
        imgUrl = result.startsWith('data:') ? result : result;
      } else {
        throw new Error('Unsupported image format returned');
      }
      imgEl.src = imgUrl;
      imgEl.onload = () => {
        imgEl.style.opacity = '0';
        requestAnimationFrame(() => (imgEl.style.opacity = '1'));
      };
      outputSection.hidden = false;
      // Store the current image URL for download
      downloadBtn.dataset.img = imgUrl;
    } catch (e) {
      console.error(e);
      showToast('Failed to generate image');
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = 'Generate Image';
    }
  });

  downloadBtn.addEventListener('click', () => {
    const url = downloadBtn.dataset.img;
    if (!url) {
      showToast('No image to download');
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = 'generated_image.png';
    a.click();
    showToast('Image download started');
  });
});
