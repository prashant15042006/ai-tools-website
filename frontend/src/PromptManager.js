import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, Search, Copy, Check, Play, MessageSquare, Sparkles, BookOpen, ArrowLeft, Zap, Code2, Globe, Mail, FileText, Image, Layers, ChevronRight } from "lucide-react";
import API_BASE_URL from "./apiConfig";
import './PromptManager.css';

const CATEGORY_META = {
  Coding:      { icon: Code2,    color: '#34d399', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.2)'  },
  Research:    { icon: Sparkles, color: '#a78bfa', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.2)' },
  Translation: { icon: Globe,    color: '#f472b6', bg: 'rgba(236,72,153,0.1)', border: 'rgba(236,72,153,0.2)' },
  Email:       { icon: Mail,     color: '#60a5fa', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)' },
  Content:     { icon: FileText, color: '#fbbf24', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' },
  Image:       { icon: Image,    color: '#22d3ee', bg: 'rgba(6,182,212,0.1)',  border: 'rgba(6,182,212,0.2)'  },
  Template:    { icon: Layers,   color: '#818cf8', bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.2)' },
};

const BUILT_IN_PROMPTS = [
  { id: 'builtin-coding-1', category: 'Coding',      title: "Debug & Fix Workflow",        prompt: "Analyze the following code, identify any bugs, inefficiencies, or logical errors, and provide a corrected version along with a brief explanation:\n\n```js\n// paste code here\n```" },
  { id: 'builtin-coding-2', category: 'Coding',      title: "Code Explanation",            prompt: "Break down the following code step-by-step, explaining the logic, performance impact, and key concepts in simple terms:\n\n```js\n// paste code here\n```" },
  { id: 'builtin-research-1', category: 'Research',  title: "Quick Concept Explainer",     prompt: "Explain the following scientific concept or topic in a clear, concise manner suitable for a beginner, and provide 3 key real-world applications:\n\n[Topic]" },
  { id: 'builtin-research-2', category: 'Research',  title: "Structured Deep Dive",        prompt: "Perform a comprehensive deep-dive into the following topic. Provide structured sections: 1) Executive Summary, 2) Historical Context, 3) Key Technical Pillars, 4) Current Challenges, and 5) Future Outlook:\n\n[Topic]" },
  { id: 'builtin-translation-1', category: 'Translation', title: "Natural English to Hindi", prompt: "Translate the following English text into natural, culturally-aware Hindi. Ensure the tone is preserved and feels authentic rather than a literal word-for-word translation:\n\n" },
  { id: 'builtin-email-1', category: 'Email',        title: "Professional Email Writer",   prompt: "Draft a professional email based on the following details. Ensure a polite, clear, and action-oriented tone:\n\n- Recipient: \n- Subject/Purpose: \n- Key Points to Include: \n- Call to Action: " },
  { id: 'builtin-content-1', category: 'Content',    title: "SEO Blog Outline",            prompt: "Generate a detailed SEO-optimized blog outline for the topic below. Include target keywords, heading structures (H1, H2, H3), and a brief description of what should be covered under each heading:\n\n[Blog Topic]" },
  { id: 'builtin-image-1', category: 'Image',        title: "AI Image Prompt Builder",     prompt: "Convert the following simple image idea into a detailed, descriptive text prompt for an AI image generator. Include specific art styles, lighting, camera angles, color grading, and descriptive modifiers:\n\n[Simple Idea]" },
  { id: 'builtin-template-1', category: 'Template',  title: "4-Point Summary",             prompt: "Analyze the text below and generate: 1) A one-sentence high-level summary, 2) Four bullet points containing the most critical facts, and 3) A short list of recommended next steps:\n\n" },
];

const STORAGE_KEY = 'nexuss_prompts_v1';
const CATEGORIES = ['All', 'Coding', 'Research', 'Translation', 'Email', 'Content', 'Image', 'Template'];
const PERSONALIZATION_OPTIONS = [
  { value: 'Default',   label: 'Default Output' },
  { value: 'Hinglish',  label: 'Hinglish (Hindi + English)' },
  { value: 'HindiStep', label: 'Step-by-Step Hindi' },
  { value: 'Simple',    label: 'Simple English' },
  { value: 'Technical', label: 'Advanced Technical' },
];

export default function PromptManager() {
  const navigate = useNavigate();
  const [selected, setSelected]           = useState(null);
  const [edited, setEdited]               = useState("");
  const [title, setTitle]                 = useState('');
  const [editCategory, setEditCategory]   = useState('Coding');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [personalization, setPersonalization] = useState('Default');
  const [query, setQuery]                 = useState('');
  const [prompts, setPrompts]             = useState([]);
  const [generated, setGenerated]         = useState('');
  const [generating, setGenerating]       = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [copiedId, setCopiedId]           = useState(null);
  const [toast, setToast]                 = useState(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    let userPrompts = [];
    try { userPrompts = raw ? JSON.parse(raw) : []; } catch { userPrompts = []; }
    setPrompts([...userPrompts, ...BUILT_IN_PROMPTS]);
  }, []);

  const saveToStorage = (userPrompts) => localStorage.setItem(STORAGE_KEY, JSON.stringify(userPrompts));

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
    const newPrompt = { id: `user-${Date.now()}`, title: 'New Prompt Template', prompt: 'Write your prompt instructions here...', category: 'Coding' };
    const updated = [newPrompt, ...prompts];
    setPrompts(updated);
    saveToStorage(updated.filter(p => String(p.id).startsWith('user-')));
    openPrompt(newPrompt);
    showToast('New prompt created! 📝');
  };

  const handleSave = () => {
    if (!selected) return;
    if (String(selected.id).startsWith('builtin')) { showToast('Built-in prompts are read-only. Create a new one!', 'error'); return; }
    const updated = prompts.map(p => p.id === selected.id ? { ...p, title: title || 'Untitled', prompt: edited, category: editCategory } : p);
    setPrompts(updated);
    saveToStorage(updated.filter(p => String(p.id).startsWith('user-')));
    setSelected(prev => ({ ...prev, title: title || 'Untitled', prompt: edited, category: editCategory }));
    showToast('Saved! 💾');
  };

  const handleGenerate = async () => {
    if (!selected || !edited.trim()) return;
    setGenerating(true); setGenerateError(''); setGenerated('');
    let finalMessage = edited;
    if (personalization === "Hinglish")  finalMessage += "\n\nNote: Please respond in natural Hinglish (Hindi + English mix).";
    if (personalization === "HindiStep") finalMessage += "\n\nNote: Please respond in step-by-step clear Hindi.";
    if (personalization === "Simple")    finalMessage += "\n\nNote: Please respond in simple English, step-by-step.";
    if (personalization === "Technical") finalMessage += "\n\nNote: Please respond in detailed technical English with code examples.";
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/complete`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: finalMessage, userName: 'Prompt Tester' }),
      });
      if (!response.ok) throw new Error(`Backend error ${response.status}`);
      const data = await response.json();
      setGenerated(data.reply || data.result || 'No reply returned.');
      showToast('Done! ✨');
    } catch (error) {
      setGenerateError(error.message || 'Error generating response.');
      showToast('Execution failed.', 'error');
    } finally { setGenerating(false); }
  };

  const handleDelete = () => {
    if (!selected) return;
    if (String(selected.id).startsWith('builtin')) { showToast('Cannot delete built-in template!', 'error'); return; }
    if (!window.confirm('Delete this prompt?')) return;
    const remaining = prompts.filter(p => p.id !== selected.id);
    setPrompts(remaining);
    setSelected(null); setEdited(''); setTitle('');
    saveToStorage(remaining.filter(p => String(p.id).startsWith('user-')));
    showToast('Prompt deleted.');
  };

  const handleCopy = (txt, id) => {
    navigator.clipboard.writeText(txt).then(() => {
      setCopiedId(id); showToast('Copied! 📋');
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => showToast('Failed to copy.', 'error'));
  };

  const handleUseInChat = () => {
    if (!edited.trim()) return;
    localStorage.setItem("prefilled_prompt_transfer", edited);
    navigate('/chat', { state: { prefilledPrompt: edited } });
    showToast('Loaded into Chat! 💬');
  };

  const filtered = prompts.filter(p => {
    if (categoryFilter !== 'All' && p.category !== categoryFilter) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (p.title || '').toLowerCase().includes(q) || (p.prompt || '').toLowerCase().includes(q);
  });

  const isBuiltin = selected ? String(selected.id).startsWith('builtin') : false;
  const totalCustom  = prompts.filter(p => String(p.id).startsWith('user-')).length;
  const totalBuiltin = prompts.filter(p => String(p.id).startsWith('builtin')).length;

  return (
    <div className="pm-root">

      {/* ── Toast ── */}
      {toast && (
        <div className={`pm-toast ${toast.type}`}>
          {toast.message}
        </div>
      )}

      {/* ══════════ LEFT SIDEBAR ══════════ */}
      <aside className={`pm-sidebar ${selected ? 'pm-sidebar--hidden' : ''}`}>

        {/* Header */}
        <div className="pm-sidebar-head">
          <div>
            <p className="pm-sidebar-eyebrow">Prompt Studio</p>
            <h2 className="pm-sidebar-title">Templates</h2>
          </div>
          <button className="pm-new-btn" onClick={handleNew}>
            <Plus size={15} /> New
          </button>
        </div>

        {/* Search */}
        <div className="pm-search">
          <Search size={15} className="pm-search-icon" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search templates..."
          />
        </div>

        {/* Category Pills */}
        <div className="pm-pills">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`pm-pill ${categoryFilter === cat ? 'pm-pill--on' : ''}`}
              onClick={() => setCategoryFilter(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="pm-list">
          {filtered.length === 0 ? (
            <div className="pm-empty-list">
              <BookOpen size={28} />
              <span>No templates found</span>
            </div>
          ) : (
            filtered.map(p => {
              const meta = CATEGORY_META[p.category] || CATEGORY_META.Template;
              const Icon = meta.icon;
              return (
                <div
                  key={p.id}
                  className={`pm-card ${selected?.id === p.id ? 'pm-card--active' : ''}`}
                  onClick={() => openPrompt(p)}
                >
                  <div className="pm-card-top">
                    <div className="pm-card-icon" style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
                      <Icon size={14} />
                    </div>
                    <span className="pm-card-type">{String(p.id).startsWith('builtin') ? 'System' : 'Custom'}</span>
                  </div>
                  <h4 className="pm-card-title">{p.title}</h4>
                  <p className="pm-card-preview">{p.prompt}</p>
                  <div className="pm-card-bottom">
                    <span className="pm-card-cat" style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}>
                      {p.category}
                    </span>
                    <ChevronRight size={13} className="pm-card-arrow" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ══════════ RIGHT WORKSPACE ══════════ */}
      <main className={`pm-workspace ${!selected ? 'pm-workspace--hidden' : ''}`}>

        {selected ? (
          <div className="pm-editor">

            {/* Mobile back */}
            <button className="pm-back" onClick={() => setSelected(null)}>
              <ArrowLeft size={15} /> Back
            </button>

            {/* Title row */}
            <div className="pm-editor-header">
              <div className="pm-editor-title-wrap">
                <input
                  className="pm-editor-title"
                  type="text"
                  value={title}
                  disabled={isBuiltin}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Template title..."
                />
                {isBuiltin && <span className="pm-readonly-badge">Read Only</span>}
              </div>

              {/* Controls row */}
              <div className="pm-controls">
                <div className="pm-control-group">
                  <label className="pm-label">Category</label>
                  <select
                    className="pm-select"
                    value={editCategory}
                    disabled={isBuiltin}
                    onChange={e => setEditCategory(e.target.value)}
                  >
                    {CATEGORIES.filter(c => c !== 'All').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="pm-control-group">
                  <label className="pm-label">Response Style</label>
                  <select
                    className="pm-select"
                    value={personalization}
                    onChange={e => setPersonalization(e.target.value)}
                  >
                    {PERSONALIZATION_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Textarea */}
            <div className="pm-textarea-wrap">
              <div className="pm-textarea-label-row">
                <span className="pm-label">Prompt Content</span>
                <span className="pm-char-count">{edited.length} chars</span>
              </div>
              <textarea
                className="pm-textarea"
                value={edited}
                disabled={isBuiltin}
                onChange={e => setEdited(e.target.value)}
                placeholder="Write your detailed prompt or template here..."
              />
              {isBuiltin && (
                <p className="pm-lock-hint">🔐 Duplicate as custom to edit this template</p>
              )}
            </div>

            {/* Action Bar */}
            <div className="pm-actions">
              <div className="pm-actions-left">
                {!isBuiltin && (
                  <button className="pm-btn pm-btn--danger" onClick={handleDelete}>
                    <Trash2 size={15} /> Delete
                  </button>
                )}
              </div>
              <div className="pm-actions-right">
                <button className="pm-btn pm-btn--ghost" onClick={() => handleCopy(edited, selected.id)}>
                  {copiedId === selected.id ? <Check size={15} style={{ color: '#34d399' }} /> : <Copy size={15} />}
                  Copy
                </button>
                {!isBuiltin && (
                  <button className="pm-btn pm-btn--green" onClick={handleSave}>
                    Save
                  </button>
                )}
                <button className="pm-btn pm-btn--indigo" onClick={handleUseInChat}>
                  <MessageSquare size={15} /> Chat
                </button>
                <button
                  className={`pm-btn pm-btn--primary ${generating ? 'pm-btn--loading' : ''}`}
                  onClick={handleGenerate}
                  disabled={generating || !edited.trim()}
                >
                  {generating ? (
                    <><span className="pm-spinner" /> Running...</>
                  ) : (
                    <><Play size={15} /> Run Test</>
                  )}
                </button>
              </div>
            </div>

            {/* Result Panel */}
            {(generated || generateError) && (
              <div className={`pm-result ${generateError ? 'pm-result--error' : ''}`}>
                <div className="pm-result-header">
                  <Zap size={14} />
                  <span>{generateError ? 'Error' : 'AI Response'}</span>
                  <button className="pm-result-copy" onClick={() => handleCopy(generated || generateError, 'result')}>
                    Copy
                  </button>
                </div>
                <div className="pm-result-body">
                  {generateError || generated}
                </div>
              </div>
            )}
          </div>

        ) : (
          /* ── Dashboard (empty state) ── */
          <div className="pm-dashboard">
            <div className="pm-dashboard-hero">
              <div className="pm-hero-icon">
                <Sparkles size={32} />
              </div>
              <h3>Prompt Studio</h3>
              <p>Create, manage, and test your AI prompt templates. Pick one from the sidebar or create a new one.</p>
            </div>

            {/* Stats */}
            <div className="pm-stats">
              <div className="pm-stat">
                <span className="pm-stat-num">{totalBuiltin}</span>
                <span className="pm-stat-lbl">System</span>
              </div>
              <div className="pm-stat-divider" />
              <div className="pm-stat">
                <span className="pm-stat-num">{totalCustom}</span>
                <span className="pm-stat-lbl">Custom</span>
              </div>
              <div className="pm-stat-divider" />
              <div className="pm-stat">
                <span className="pm-stat-num">{totalBuiltin + totalCustom}</span>
                <span className="pm-stat-lbl">Total</span>
              </div>
            </div>

            {/* Quick start */}
            <div className="pm-quickstart">
              <p className="pm-qs-label">Quick Start</p>
              <div className="pm-qs-grid">
                {BUILT_IN_PROMPTS.slice(0, 4).map(p => {
                  const meta = CATEGORY_META[p.category] || CATEGORY_META.Template;
                  const Icon = meta.icon;
                  return (
                    <div key={p.id} className="pm-qs-card" onClick={() => openPrompt(p)}>
                      <div className="pm-qs-icon" style={{ background: meta.bg, color: meta.color }}>
                        <Icon size={16} />
                      </div>
                      <div className="pm-qs-info">
                        <h5>{p.title}</h5>
                        <span style={{ color: meta.color }}>{p.category}</span>
                      </div>
                      <ChevronRight size={16} className="pm-qs-arrow" />
                    </div>
                  );
                })}
              </div>
            </div>

            <button className="pm-cta-btn" onClick={handleNew}>
              <Plus size={16} /> Create New Template
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
