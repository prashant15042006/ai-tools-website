import React, { useState } from "react";
import { ClipboardCopy, ExternalLink, Plus } from "lucide-react";

const BUILT_IN_PROMPTS = [
  { id: 1, title: "Quantum Computing", prompt: "Explain quantum computing in simple terms for a beginner." },
  { id: 2, title: "Debug Code", prompt: "Help me find bugs and suggest fixes in the following code:\n```js\n// paste code here\n```" },
  { id: 3, title: "Translation", prompt: "Translate the following text from English to Spanish:\n\n" },
  { id: 4, title: "Email Writing", prompt: "Write a professional email for the following purpose:\n\n" },
];

export default function PromptManager({ onInsert }) {
  const [selected, setSelected] = useState(null);
  const [edited, setEdited] = useState("");

  const openPrompt = (p) => {
    setSelected(p);
    setEdited(p.prompt);
  };

  return (
    <div className="main-content" style={{ padding: 24 }}>
      <div style={{ display: 'flex', gap: 18, height: '100%' }}>
        {/* Left: prompt list */}
        <div style={{ width: 340, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 800 }}>Prompts</h2>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Manage reusable prompts</div>
            </div>
            <div>
              <button className="new-chat-btn" onClick={() => openPrompt({ id: Date.now(), title: 'New Prompt', prompt: '' })}>
                <Plus size={14} />&nbsp;New
              </button>
            </div>
          </div>

          <div style={{ overflowY: 'auto', paddingRight: 6, marginTop: 8 }}>
            <div style={{ display: 'grid', gap: 12 }}>
              {BUILT_IN_PROMPTS.map(p => (
                <div key={p.id} onClick={() => openPrompt(p)} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: 14, borderRadius: 10, cursor: 'pointer' }}>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>{p.title}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 13, height: 44, overflow: 'hidden' }}>{p.prompt}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: editor */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: 16, borderRadius: 12, flex: '0 0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{selected?.title || 'Select a prompt'}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{selected ? 'Edit and insert this prompt into chat input.' : 'Click a prompt to edit or create a new one.'}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { navigator.clipboard && navigator.clipboard.writeText(edited); }} className="icon-btn" aria-label="Copy prompt"> <ClipboardCopy size={16} /></button>
                <button onClick={() => window.open('https://example.com', '_blank')} className="icon-btn" aria-label="Open docs"><ExternalLink size={16} /></button>
              </div>
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'hidden' }}>
            <textarea value={edited} onChange={(e)=>setEdited(e.target.value)} style={{ width: '100%', height: '100%', minHeight: 320, padding: 16, borderRadius: 10, background: '#071226', color: '#e6eef8', border: '1px solid rgba(255,255,255,0.04)', resize: 'none' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setSelected(null)} className="action-btn" style={{ padding: '8px 12px', borderRadius: 8, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.06)' }}>Close</button>
            <button onClick={() => { if (typeof onInsert === 'function') onInsert(edited); }} className="send-btn" style={{ padding: '8px 12px', borderRadius: 8 }}>Insert into chat</button>
          </div>
        </div>
      </div>
    </div>
  );
}
