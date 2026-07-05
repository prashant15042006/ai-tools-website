import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, Search, Copy, Check, Play, MessageSquare, Sparkles, BookOpen, ArrowRight, ArrowLeft } from "lucide-react";
import API_BASE_URL from "./apiConfig";
import './PromptManager.css';

const BUILT_IN_PROMPTS = [
  { id: 'builtin-coding-1', category: 'Coding', title: "Debug & Fix Workflow", prompt: "Analyze the following code, identify any bugs, inefficiencies, or logical errors, and provide a corrected version along with a brief explanation:\n\n```js\n// paste code here\n```" },
  { id: 'builtin-coding-2', category: 'Coding', title: "Code Explanation", prompt: "Break down the following code step-by-step, explaining the logic, performance impact, and key concepts in simple terms:\n\n```js\n// paste code here\n```" },
  { id: 'builtin-research-1', category: 'Research', title: "Quick Concept Explainer", prompt: "Explain the following scientific concept or topic in a clear, concise manner suitable for a beginner, and provide 3 key real-world applications:\n\n[Topic]" },
  { id: 'builtin-research-2', category: 'Research', title: "Structured Deep Dive", prompt: "Perform a comprehensive deep-dive into the following topic. Provide structured sections: 1) Executive Summary, 2) Historical Context, 3) Key Technical Pillars, 4) Current Challenges, and 5) Future Outlook:\n\n[Topic]" },
  { id: 'builtin-translation-1', category: 'Translation', title: "Natural English to Hindi", prompt: "Translate the following English text into natural, culturally-aware Hindi. Ensure the tone is preserved and feels authentic rather than a literal word-for-word translation:\n\n" },
  { id: 'builtin-email-1', category: 'Email', title: "Professional Email Writer", prompt: "Draft a professional email based on the following details. Ensure a polite, clear, and action-oriented tone:\n\n- Recipient: \n- Subject/Purpose: \n- Key Points to Include: \n- Call to Action: " },
  { id: 'builtin-content-1', category: 'Content', title: "SEO Blog Outline", prompt: "Generate a detailed SEO-optimized blog outline for the topic below. Include target keywords, heading structures (H1, H2, H3), and a brief description of what should be covered under each heading:\n\n[Blog Topic]" },
  { id: 'builtin-image-1', category: 'Image', title: "Midjourney/SD Prompt Builder", prompt: "Convert the following simple image idea into a detailed, descriptive text prompt for an AI image generator. Include specific art styles, lighting, camera angles, color grading, and descriptive modifiers:\n\n[Simple Idea]" },
  { id: 'builtin-template-1', category: 'Template', title: "4-Point Summary", prompt: "Analyze the text below and generate: 1) A one-sentence high-level summary, 2) Four bullet points containing the most critical facts, and 3) A short list of recommended next steps:\n\n" },
];

const STORAGE_KEY = 'nexuss_prompts_v1';
const CATEGORIES = ['All', 'Coding', 'Research', 'Translation', 'Email', 'Content', 'Image', 'Template'];

export default function PromptManager() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState(null);
  const [edited, setEdited] = useState("");
  const [title, setTitle] = useState('');
  const [editCategory, setEditCategory] = useState('Coding');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [personalization, setPersonalization] = useState('Default');
  const [query, setQuery] = useState('');
  const [prompts, setPrompts] = useState([]);
  const [generated, setGenerated] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    let userPrompts = [];
    try { userPrompts = raw ? JSON.parse(raw) : []; } catch { userPrompts = []; }
    setPrompts([...userPrompts, ...BUILT_IN_PROMPTS]);
  }, []);

  const saveToStorage = (userPrompts) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userPrompts));
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const openPrompt = (prompt) => {
    setSelected(prompt);
    setEdited(prompt.prompt || '');
    setTitle(prompt.title || 'Untitled');
    setEditCategory(prompt.category || 'Coding');
    setGenerated('');
    setGenerateError('');
  };

  const handleNew = () => {
    const newPrompt = { 
      id: `user-${Date.now()}`, 
      title: 'New Prompt Template', 
      prompt: 'Write your prompt instructions here...',
      category: 'Coding' 
    };
    
    // Save to prompt list (prepend to keep at top)
    const updated = [newPrompt, ...prompts];
    setPrompts(updated);
    saveToStorage(updated.filter((p) => String(p.id).startsWith('user-')));
    openPrompt(newPrompt);
    showToast('New custom prompt created! 📝');
  };

  const handleSave = () => {
    if (!selected) return;
    if (String(selected.id).startsWith('builtin')) {
      showToast('Cannot modify built-in prompts. Create a New Prompt instead!', 'error');
      return;
    }

    const updated = prompts.map((prompt) => {
      if (prompt.id === selected.id) {
        return { 
          ...prompt, 
          title: title || 'Untitled', 
          prompt: edited,
          category: editCategory 
        };
      }
      return prompt;
    });

    setPrompts(updated);
    saveToStorage(updated.filter((p) => String(p.id).startsWith('user-')));
    setSelected(prev => ({ ...prev, title: title || 'Untitled', prompt: edited, category: editCategory }));
    showToast('Prompt saved successfully! 💾');
  };

  const handleGenerate = async () => {
    if (!selected || !edited.trim()) return;
    setGenerating(true);
    setGenerateError('');
    setGenerated('');

    // Append personalization instructions if needed
    let finalMessage = edited;
    if (personalization === "Hinglish") {
      finalMessage += "\n\nNote: Please respond in natural Hinglish (Hindi + English mix).";
    } else if (personalization === "HindiStep") {
      finalMessage += "\n\nNote: Please respond in step-by-step clear Hindi.";
    } else if (personalization === "Simple") {
      finalMessage += "\n\nNote: Please respond in simple English, step-by-step instructions.";
    } else if (personalization === "Technical") {
      finalMessage += "\n\nNote: Please respond in detailed technical English, including code examples and structural explanations where applicable.";
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: finalMessage,
          userName: 'Prompt Tester',
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Backend error ${response.status}: ${text}`);
      }

      const data = await response.json();
      setGenerated(data.reply || data.result || 'No reply returned from backend.');
      showToast('Execution completed! ✨');
    } catch (error) {
      setGenerateError(error.message || 'Error generating prompt response.');
      showToast('Execution failed.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = () => {
    if (!selected) return;
    if (String(selected.id).startsWith('builtin')) {
      showToast('Cannot delete built-in template!', 'error');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this prompt?')) return;
    
    const remaining = prompts.filter((prompt) => prompt.id !== selected.id);
    setPrompts(remaining);
    setSelected(null);
    setEdited('');
    setTitle('');
    saveToStorage(remaining.filter((p) => String(p.id).startsWith('user-')));
    showToast('Prompt deleted.');
  };

  const handleCopy = (txt, id) => {
    navigator.clipboard.writeText(txt).then(() => {
      setCopiedId(id);
      showToast('Copied to clipboard! 📋');
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => {
      showToast('Failed to copy.', 'error');
    });
  };

  const handleUseInChat = () => {
    if (!edited.trim()) return;
    // Save to localStorage as reliable bridge — Chat.js reads and clears it on mount
    localStorage.setItem("prefilled_prompt_transfer", edited);
    navigate('/chat', { state: { prefilledPrompt: edited } });
    showToast('Prompt loaded into Chat! 💬');
  };

  const filtered = prompts.filter((prompt) => {
    if (categoryFilter !== 'All' && prompt.category !== categoryFilter) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (prompt.title || '').toLowerCase().includes(q) || (prompt.prompt || '').toLowerCase().includes(q);
  });

  // Category counts for stats
  const totalCustom = prompts.filter(p => String(p.id).startsWith('user-')).length;
  const totalBuiltin = prompts.filter(p => String(p.id).startsWith('builtin')).length;

  return (
    <div className="prompt-studio-container">
      {/* Toast Notification */}
      {toast && (
        <div className={`studio-toast ${toast.type}`}>
          <div className="toast-content">{toast.message}</div>
        </div>
      )}

      {/* Left Sidebar Pane */}
      <aside className={`prompt-list-pane ${selected ? 'mobile-hidden' : ''}`}>
        <div className="pane-header">
          <div className="pane-title-group">
            <span className="pane-badge">Prompts</span>
            <h2>Studio Workspace</h2>
          </div>
          <button className="add-prompt-btn" onClick={handleNew}>
            <Plus size={16} /> New Template
          </button>
        </div>

        <div className="pane-search-container">
          <Search size={16} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search prompt templates..."
          />
        </div>

        <div className="pane-filters-scroll">
          {CATEGORIES.map((item) => (
            <button
              key={item}
              className={`filter-pill ${categoryFilter === item ? 'active' : ''}`}
              onClick={() => setCategoryFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="prompts-scrollable-list">
          {filtered.length === 0 ? (
            <div className="empty-list-state">
              <BookOpen size={24} style={{ opacity: 0.3, marginBottom: '8px' }} />
              <p>No prompts found</p>
            </div>
          ) : (
            filtered.map((prompt) => {
              const isBuiltin = String(prompt.id).startsWith('builtin');
              return (
                <div
                  key={prompt.id}
                  className={`prompt-item-card ${selected?.id === prompt.id ? 'active' : ''}`}
                  onClick={() => openPrompt(prompt)}
                >
                  <div className="prompt-item-header">
                    <h4 className="prompt-item-title">{prompt.title}</h4>
                    <span className={`category-tag ${prompt.category?.toLowerCase() || 'default'}`}>
                      {prompt.category}
                    </span>
                  </div>
                  <p className="prompt-item-preview">{prompt.prompt}</p>
                  <div className="prompt-item-meta">
                    <span>{isBuiltin ? '🔑 Template' : '👤 Personal'}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Right Content/Editor Pane */}
      <main className={`prompt-workspace-pane ${!selected ? 'mobile-hidden' : ''}`}>
        {selected ? (
          <div className="workspace-editor-container">
            <button className="mobile-back-btn" onClick={() => setSelected(null)}>
              <ArrowLeft size={16} /> Back to list
            </button>
            <div className="editor-top-bar">
              <div className="editor-title-row">
                <input
                  type="text"
                  className="editor-title-input"
                  value={title}
                  disabled={String(selected.id).startsWith('builtin')}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter template title..."
                />
                <span className="source-indicator">
                  {String(selected.id).startsWith('builtin') ? 'Built-in Template (Read Only)' : 'Custom Template'}
                </span>
              </div>
              
              <div className="editor-meta-row">
                <div className="meta-field">
                  <label>Category</label>
                  <select 
                    value={editCategory} 
                    disabled={String(selected.id).startsWith('builtin')}
                    onChange={(e) => setEditCategory(e.target.value)}
                  >
                    {CATEGORIES.filter(c => c !== 'All').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="meta-field">
                  <label>Personalization Option</label>
                  <select value={personalization} onChange={(e) => setPersonalization(e.target.value)}>
                    <option value="Default">Default Output</option>
                    <option value="Hinglish">Explain in Hinglish (Hindi + English)</option>
                    <option value="HindiStep">Explain in Hindi (Step-by-Step)</option>
                    <option value="Simple">Simple English (For Beginners)</option>
                    <option value="Technical">Advanced Technical (With Code)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="editor-textarea-container">
              <label className="section-label">Prompt Content</label>
              <textarea
                className="editor-textarea"
                value={edited}
                disabled={String(selected.id).startsWith('builtin')}
                onChange={(e) => setEdited(e.target.value)}
                placeholder="Write your detailed system prompt or templates here..."
              />
              <div className="editor-textarea-footer">
                <span>{edited.length} characters</span>
                {String(selected.id).startsWith('builtin') && (
                  <span className="lock-notice">🔐 Duplicate or create new prompt to edit</span>
                )}
              </div>
            </div>

            <div className="editor-actions-bar">
              <div className="left-actions">
                {!String(selected.id).startsWith('builtin') && (
                  <button className="action-btn delete-btn" onClick={handleDelete} title="Delete Template">
                    <Trash2 size={16} /> Delete
                  </button>
                )}
              </div>
              <div className="right-actions">
                <button className="action-btn copy-btn" onClick={() => handleCopy(edited, selected.id)}>
                  {copiedId === selected.id ? <Check size={16} style={{ color: '#10b981' }} /> : <Copy size={16} />}
                  Copy Raw
                </button>
                
                {!String(selected.id).startsWith('builtin') && (
                  <button className="action-btn save-btn" onClick={handleSave}>
                    Save Changes
                  </button>
                )}

                <button className="action-btn use-chat-btn" onClick={handleUseInChat}>
                  <MessageSquare size={16} /> Use in Chat
                </button>
                
                <button 
                  className={`action-btn run-btn ${generating ? 'loading' : ''}`}
                  onClick={handleGenerate}
                  disabled={generating || !edited.trim()}
                >
                  <Play size={16} /> {generating ? 'Executing...' : 'Run Test'}
                </button>
              </div>
            </div>

            {/* Test Run Output Panel */}
            {(generated || generateError) && (
              <div className="test-results-panel">
                <div className="panel-header">
                  <Sparkles size={14} style={{ color: '#818cf8' }} />
                  <h4>Live Test Response</h4>
                  <button className="copy-result-btn" onClick={() => handleCopy(generated || generateError, 'result')}>
                    Copy Result
                  </button>
                </div>
                <div className={`panel-content-box ${generateError ? 'error' : ''}`}>
                  {generateError || generated}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Empty / Default Dashboard State */
          <div className="workspace-empty-state">
            <div className="empty-state-card">
              <div className="glowing-icon">
                <Sparkles size={40} />
              </div>
              <h3>Prompt Studio & Testing Lab</h3>
              <p>Select any prompt template from the sidebar to view, customize, test-run, or inject it directly into your live chat workspace.</p>
              
              <div className="stats-row">
                <div className="stat-card">
                  <span className="stat-number">{totalBuiltin}</span>
                  <span className="stat-label">System Templates</span>
                </div>
                <div className="stat-card">
                  <span className="stat-number">{totalCustom}</span>
                  <span className="stat-label">User Prompts</span>
                </div>
                <div className="stat-card">
                  <span className="stat-number">{totalBuiltin + totalCustom}</span>
                  <span className="stat-label">Total Pool</span>
                </div>
              </div>

              <div className="quick-start-section">
                <h4>Quick Start Prompts</h4>
                <div className="quick-suggestions-grid">
                  {BUILT_IN_PROMPTS.slice(0, 3).map((p) => (
                    <div key={p.id} className="suggestion-card" onClick={() => openPrompt(p)}>
                      <div className="suggest-header">
                        <span className={`category-tag ${p.category.toLowerCase()}`}>{p.category}</span>
                        <ArrowRight size={14} />
                      </div>
                      <h5>{p.title}</h5>
                      <p>{p.prompt.slice(0, 70)}...</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
