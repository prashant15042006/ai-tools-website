import React, { useState, useEffect } from "react";
import { Plus, Trash2, Search } from "lucide-react";
import API_BASE_URL from "./apiConfig";
import './PromptManager.css';

const BUILT_IN_PROMPTS = [
  { id: 'builtin-coding-1', category: 'Coding', title: "Debug & Fix Workflow", prompt: "Step 1: Analyze the code and explain the bug.\nStep 2: Suggest a fix with code changes.\nStep 3: Write a short summary email explaining the fix." },
  { id: 'builtin-coding-2', category: 'Coding', title: "Explain Code (Hindi)", prompt: "Explain the following code in Hindi, step-by-step, in simple terms:\n\n```js\n// paste code here\n```" },
  { id: 'builtin-research-1', category: 'Research', title: "Quick Q&A", prompt: "Provide a concise answer with 3 references and a short explainer for: " },
  { id: 'builtin-research-2', category: 'Research', title: "Deep Dive", prompt: "Give a structured deep-dive with sections: Overview, Key Concepts, Next Steps, and References for: " },
  { id: 'builtin-translation-1', category: 'Translation', title: "Translate EN → HI", prompt: "Translate the following text from English to Hindi, preserving tone and cultural references:\n\n" },
  { id: 'builtin-email-1', category: 'Email', title: "Professional Email (short)", prompt: "Write a concise professional email for: \n- Purpose: \n- Tone: Formal\nInclude subject line and sign-off." },
  { id: 'builtin-content-1', category: 'Content', title: "Blog Outline", prompt: "Create a detailed blog post outline with headings, subpoints, and suggested word counts for: " },
  { id: 'builtin-image-1', category: 'Image', title: "Image Prompt (detailed)", prompt: "Generate a detailed image prompt suitable for text-to-image models describing: " },
  { id: 'builtin-template-1', category: 'Template', title: "Summary Template", prompt: "Summarize the following text in 4 bullet points, then provide a one-sentence TL;DR:\n\n" },
];

const STORAGE_KEY = 'nexuss_prompts_v1';
const CATEGORIES = ['All', 'Coding', 'Research', 'Translation', 'Email', 'Content', 'Image', 'Template'];

export default function PromptManager() {
  const [selected, setSelected] = useState(null);
  const [edited, setEdited] = useState("");
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('All');
  const [personalization, setPersonalization] = useState('Default');
  const [query, setQuery] = useState('');
  const [prompts, setPrompts] = useState([]);
  const [generated, setGenerated] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    let userPrompts = [];
    try { userPrompts = raw ? JSON.parse(raw) : []; } catch { userPrompts = []; }
    setPrompts([...userPrompts, ...BUILT_IN_PROMPTS]);
    const last = localStorage.getItem('nexuss_prompts_last_used');
    if (last) {
      // last-used prompt id saved for future use if needed
    }
  }, []);

  const saveToStorage = (userPrompts) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userPrompts));
  };

  const openPrompt = (prompt) => {
    setSelected(prompt);
    setEdited(prompt.prompt || '');
    setTitle(prompt.title || 'Untitled');
    setCategory(prompt.category || 'All');
    try { localStorage.setItem('nexuss_prompts_last_used', prompt.id); } catch {}
  };

  const handleNew = () => {
    const prompt = { id: `user-${Date.now()}`, title: 'New Prompt', prompt: '' };
    setPrompts([prompt, ...prompts]);
    openPrompt(prompt);
  };

  const handleSave = () => {
    if (!selected) return;
    const updated = prompts.map((prompt) => {
      if (prompt.id === selected.id) return { ...prompt, title: title || 'Untitled', prompt: edited };
      return prompt;
    });
    setPrompts(updated);
    saveToStorage(updated.filter((p) => String(p.id).startsWith('user-')));
    alert('Prompt saved');
  };

  const handleGenerate = async () => {
    if (!selected || !edited.trim()) return;
    setGenerating(true);
    setGenerateError('');
    setGenerated('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: edited,
          userName: 'Prompt Manager',
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Backend error ${response.status}: ${text}`);
      }

      const data = await response.json();
      setGenerated(data.reply || data.result || 'No reply returned from backend.');
    } catch (error) {
      setGenerateError(error.message || 'Error generating prompt response.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = () => {
    if (!selected) return;
    if (!window.confirm('Delete this prompt?')) return;
    const remaining = prompts.filter((prompt) => prompt.id !== selected.id);
    setPrompts(remaining);
    setSelected(null);
    setEdited('');
    setTitle('');
    saveToStorage(remaining.filter((p) => String(p.id).startsWith('user-')));
  };

  const filtered = prompts.filter((prompt) => {
    if (category !== 'All' && prompt.category !== category) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (prompt.title || '').toLowerCase().includes(q) || (prompt.prompt || '').toLowerCase().includes(q);
  });

  return (
    <div className="chat-container prompt-manager-page">
      <div className="chat-history-scroll">
        <div className="prompt-banner-card">
          <div className="prompt-badge">Prompt Studio</div>
          <h1>Fresh prompt workspace</h1>
          <p>Build, browse and reuse prompts in a chat-style workspace that matches the Nexuss UI.</p>
        </div>

        <div className="prompt-top-row">
          <div className="search-box prompt-search">
            <Search size={18} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search prompts"
            />
          </div>
          <button className="send-btn prompt-new-btn" onClick={handleNew}>
            <Plus size={18} />
            New Prompt
          </button>
        </div>

        <div className="prompt-categories-row">
          {CATEGORIES.map((item) => (
            <button
              key={item}
              className={`category-chip ${category === item ? 'active' : ''}`}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="prompt-suggestions-grid">
          {filtered.map((prompt) => (
            <article
              key={prompt.id}
              className={`dashboard-card prompt-card ${selected?.id === prompt.id ? 'selected' : ''}`}
              onClick={() => openPrompt(prompt)}
            >
              <div className="prompt-card-header">
                <div className="prompt-card-title">{prompt.title}</div>
                <span className="prompt-card-tag">{prompt.category}</span>
              </div>
              <p className="prompt-card-description">{prompt.prompt}</p>
              <div className="prompt-card-actions">
                <button className="btn" type="button">Open</button>
              </div>
            </article>
          ))}
        </div>

        {selected && (
          <div className="prompt-editor-panel">
            <div className="prompt-editor-header">
              <div>
                <div className="prompt-editor-label">Editing prompt</div>
                <h2>{title || 'New Prompt'}</h2>
              </div>
              <div className="prompt-editor-meta">{String(selected.id).startsWith('builtin') ? 'Built-in template' : 'Saved prompt'}</div>
            </div>

            <div className="prompt-editor-body">
              <input
                className="prompt-editor-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Prompt title"
              />
              <textarea
                className="prompt-editor-textarea"
                value={edited}
                onChange={(e) => setEdited(e.target.value)}
                placeholder="Write or edit the prompt here..."
              />
              <div className="prompt-editor-options">
                <div className="prompt-editor-option">
                  <label>Personalize</label>
                  <select value={personalization} onChange={(e) => setPersonalization(e.target.value)}>
                    <option value="Default">Default</option>
                    <option value="Hinglish">Explain in Hinglish (Hindi + English)</option>
                    <option value="HindiStep">Explain in Hindi, step-by-step</option>
                    <option value="Simple">Simple English, step-by-step</option>
                    <option value="Technical">Technical, include code examples</option>
                  </select>
                </div>
                </div>
            </div>

            <div className="prompt-editor-actions">
              <button className="btn danger" onClick={handleDelete} disabled={String(selected.id).startsWith('builtin')}>
                <Trash2 size={14} /> Delete
              </button>
              <button className="btn" onClick={handleSave}>Save</button>
              <button className="btn" onClick={() => setSelected(null)}>Close</button>
              <button
                className="send-btn prompt-insert-btn"
                onClick={handleGenerate}
                disabled={generating || !edited.trim()}
              >
                {generating ? 'Generating...' : 'Generate'}
              </button>
            </div>
            {(generated || generateError) && (
              <div className="prompt-generate-result">
                <div className="prompt-generate-title">Generated result</div>
                <div className={`prompt-generate-box ${generateError ? 'error' : ''}`}>
                  {generateError || generated}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {!selected && (
        <div className="input-container prompt-footer">
          <div className="input-box-wrapper" style={{ justifyContent: 'space-between', gap: '16px' }}>
            <div>
              <div className="prompt-footer-title">Select any prompt card to edit it, or click New Prompt to create a fresh prompt.</div>
              <div className="prompt-footer-text">The layout now matches the chat workspace style with clean cards and editor zone.</div>
            </div>
            <button className="send-btn prompt-new-btn" onClick={handleNew}>+ New Prompt</button>
          </div>
        </div>
      )}
    </div>
  );
}
