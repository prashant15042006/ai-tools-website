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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="page-view" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 800 }}>Prompts</h2>
          <div style={{ color: 'var(--text-secondary)' }}>Manage reusable prompts. Click a prompt to open the editor.</div>
        </div>
        <div>
          <button style={{ background: 'var(--accent)', color: 'white', padding: '10px 14px', borderRadius: 10, display: 'flex', gap: 8, alignItems: 'center', border: 'none' }} onClick={() => openPrompt({ id: Date.now(), title: 'New Prompt', prompt: '' })}>
            <Plus size={16} /> New Prompt
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
        {BUILT_IN_PROMPTS.map(p => (
          <div key={p.id} onClick={() => openPrompt(p)} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: 16, borderRadius: 12, cursor: 'pointer' }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>{p.title}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13, height: 48, overflow: 'hidden' }}>{p.prompt}</div>
          </div>
        ))}
      </div>

      {selected && (
        <div style={{ marginTop: 20, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: 16, borderRadius: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{selected.title}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Edit and insert this prompt into chat input.</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { navigator.clipboard && navigator.clipboard.writeText(edited); }} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-secondary)', padding: '8px 10px', borderRadius: 8 }} aria-label="Copy prompt"> <ClipboardCopy size={16} /></button>
              <button onClick={() => window.open('https://example.com', '_blank')} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-secondary)', padding: '8px 10px', borderRadius: 8 }} aria-label="Open documentation"><ExternalLink size={16} /></button>
            </div>
          </div>

          <textarea value={edited} onChange={(e)=>setEdited(e.target.value)} style={{ width: '100%', minHeight: 180, marginTop: 12, padding: 12, borderRadius: 8, background: '#071226', color: '#e6eef8', border: '1px solid rgba(255,255,255,0.04)' }} />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button onClick={() => setSelected(null)} style={{ padding: '8px 12px', borderRadius: 8, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.06)' }}>Close</button>
            <button onClick={() => { if (typeof onInsert === 'function') onInsert(edited); }} style={{ padding: '8px 12px', borderRadius: 8, background: 'linear-gradient(135deg,#2563eb,#7c3aed)', color: 'white', border: 'none' }}>Insert into chat</button>
          </div>
        </div>
      )}
    </div>
  );
}
