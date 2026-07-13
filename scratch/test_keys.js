import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const geminiKey = process.env.GEMINI_API_KEY;
const zaiKey = process.env.ZAI_API_KEY;

console.log('GEMINI_API_KEY:', geminiKey ? geminiKey.substring(0, 10) + '...' : 'none');
console.log('ZAI_API_KEY:', zaiKey ? zaiKey.substring(0, 10) + '...' : 'none');

async function testGemini() {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'Hello, what is your name?' }] }] })
    });
    const data = await res.json();
    console.log('\n--- Gemini Direct Response ---');
    console.log('Status:', res.status);
    console.log('Response:', JSON.stringify(data));
  } catch (err) {
    console.log('Gemini Direct Error:', err.message);
  }
}

async function testOpenRouter() {
  try {
    const mockBase64Image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${zaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openrouter/free',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'What color is this image?' },
            { type: 'image_url', image_url: { url: mockBase64Image } }
          ]
        }],
        max_tokens: 200
      })
    });
    const data = await res.json();
    console.log('\n--- OpenRouter Free Model Response ---');
    console.log('Status:', res.status);
    console.log('Response:', JSON.stringify(data));
  } catch (err) {
    console.log('OpenRouter Error:', err.message);
  }
}

async function run() {
  await testGemini();
  await testOpenRouter();
}
run();
