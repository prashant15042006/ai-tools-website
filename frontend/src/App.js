import React, { useState, useEffect, createContext, useContext } from "react";

import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import { MessageSquare, Code, PenTool, FolderOpen, Settings, Layout, Plus, Search, Sparkles, PanelLeftClose, PanelLeft, Bell, Sun, Moon, Volume2, VolumeX, Trash2, User, Shield, Menu, X, Download, ChevronLeft, Save, RotateCw, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import Chat from "./Chat";
import CodeGenerator from "./CodeGenerator";
import ContentGenerator from "./ContentGenerator";
import Dashboard from "./Dashboard";
import PromptManager from "./PromptManager";
import { auth } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import Login from "./Login";
import API_BASE_URL from "./apiConfig";
import "./App.css";

// Global context for dark mode & TTS
export const AppContext = createContext();

// ── Custom hook: detect mobile ──────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

const SidebarItem = ({ to, icon: Icon, label, isActive, color, onClick }) => (
  <Link to={to} className={`menu-item ${isActive ? "active" : ""}`} onClick={onClick}>
    <Icon size={20} style={{ color: color || 'inherit' }} />
    <span>{label}</span>
  </Link>
);

// Toggle switch component
const Toggle = ({ checked, onChange }) => (
  <div
    onClick={onChange}
    style={{
      width: '52px', height: '28px',
      background: checked ? 'var(--accent)' : '#334155',
      borderRadius: '14px', position: 'relative', cursor: 'pointer',
      transition: 'all 0.3s'
    }}
  >
    <div style={{
      width: '22px', height: '22px', background: 'white', borderRadius: '50%',
      position: 'absolute', top: '3px',
      left: checked ? '27px' : '3px',
      transition: 'left 0.3s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)'
    }} />
  </div>
);

// --- New Components for Projects and Settings ---

const ProjectsView = ({ projects, setProjects }) => {
  const { user } = useContext(AppContext);
  const [selectedProject, setSelectedProject] = useState(null);
  const [notes, setNotes] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [syncStatus, setSyncStatus] = useState("saved"); // 'saved' | 'saving' | 'offline'
  const [searchQuery, setSearchQuery] = useState("");
  const autoSaveTimerRef = React.useRef(null);

  // Load selected project notes when opened
  const openProject = (proj) => {
    setSelectedProject(proj);
    setNotes(proj.notes || "");
    setSyncStatus("saved");
  };

  const closeProject = () => {
    setSelectedProject(null);
    setNotes("");
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
  };

  const addProject = async () => {
    if (!newName.trim() || !user?.email) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          name: newName,
          desc: newDesc || "New workspace project"
        })
      });

      if (response.ok) {
        const created = await response.json();
        const updatedList = [...projects, created];
        setProjects(updatedList);
        localStorage.setItem(`nexus_projects_${user.email}`, JSON.stringify(updatedList));
      } else {
        throw new Error("API call failed");
      }
    } catch (err) {
      console.warn("API add failed, saving locally:", err.message);
      // Local fallback
      const id = Date.now().toString();
      const created = {
        id,
        email: user.email,
        name: newName,
        desc: newDesc || "New workspace project",
        notes: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const updatedList = [...projects, created];
      setProjects(updatedList);
      localStorage.setItem(`nexus_projects_${user.email}`, JSON.stringify(updatedList));
    }

    setNewName("");
    setNewDesc("");
    setIsAdding(false);
  };

  const deleteProject = async (id) => {
    if (!window.confirm("Delete this project? This action cannot be undone.")) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/projects/${id}`, {
        method: "DELETE"
      });
      if (!response.ok) throw new Error("API call failed");
    } catch (err) {
      console.warn("API delete failed, updating local state:", err.message);
    }

    const updatedList = projects.filter(p => p.id !== id);
    setProjects(updatedList);
    localStorage.setItem(`nexus_projects_${user.email}`, JSON.stringify(updatedList));
    if (selectedProject?.id === id) {
      closeProject();
    }
  };

  const saveNotes = async (currentNotes = notes, silent = false) => {
    if (!selectedProject || !user?.email) return;
    if (!silent) setSyncStatus("saving");

    try {
      const response = await fetch(`${API_BASE_URL}/api/projects/${selectedProject.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: currentNotes
        })
      });

      if (response.ok) {
        setSyncStatus("saved");
      } else {
        throw new Error("Server error");
      }
    } catch (err) {
      console.warn("Auto-save to server failed, saved locally:", err.message);
      setSyncStatus("offline");
    }

    // Always update local state & cache
    const updatedProjects = projects.map(p => {
      if (p.id === selectedProject.id) {
        return { ...p, notes: currentNotes, updatedAt: new Date().toISOString() };
      }
      return p;
    });

    setProjects(updatedProjects);
    localStorage.setItem(`nexus_projects_${user.email}`, JSON.stringify(updatedProjects));

    // Update active selected project object
    setSelectedProject(prev => prev ? { ...prev, notes: currentNotes } : null);
  };

  // Auto-save effect
  const handleNotesChange = (e) => {
    const val = e.target.value;
    setNotes(val);
    setSyncStatus("saving");

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(() => {
      saveNotes(val, true);
    }, 1500); // Save notes after 1.5 seconds of silence
  };

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.desc && p.desc.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // If a project is selected, render the gorgeous glassmorphic editor
  if (selectedProject) {
    const wordCount = notes.trim() === "" ? 0 : notes.trim().split(/\s+/).length;
    const charCount = notes.length;

    return (
      <div className="page-view" style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
        
        {/* Editor Header Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button 
              onClick={closeProject}
              style={{ 
                background: 'rgba(255,255,255,0.05)', 
                color: 'white', 
                border: '1px solid var(--border-color)', 
                padding: '8px 16px', 
                borderRadius: '10px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                fontWeight: '600', 
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              className="back-btn"
            >
              <ChevronLeft size={16} /> Back to Projects
            </button>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h2 style={{ 
                fontSize: '26px', 
                fontWeight: '800', 
                background: 'linear-gradient(135deg, #60a5fa, #a78bfa)', 
                WebkitBackgroundClip: 'text', 
                WebkitTextFillColor: 'transparent',
                lineHeight: '1.2'
              }}>
                {selectedProject.name}
              </h2>
            </div>
          </div>

          {/* Sync Status Badge & Action */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                padding: '8px 14px', 
                borderRadius: '10px', 
                background: syncStatus === 'saved' ? 'rgba(34, 197, 94, 0.1)' : syncStatus === 'saving' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                border: `1px solid ${syncStatus === 'saved' ? 'rgba(34, 197, 94, 0.2)' : syncStatus === 'saving' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
                fontSize: '13px',
                color: syncStatus === 'saved' ? '#4ade80' : syncStatus === 'saving' ? '#60a5fa' : '#fbbf24',
                fontWeight: '600'
              }}
            >
              {syncStatus === 'saved' && (
                <>
                  <CheckCircle2 size={15} />
                  <span>All changes synced</span>
                </>
              )}
              {syncStatus === 'saving' && (
                <>
                  <RotateCw size={15} className="spin-animation" style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Saving changes...</span>
                </>
              )}
              {syncStatus === 'offline' && (
                <>
                  <AlertCircle size={15} />
                  <span>Saved locally (Offline)</span>
                </>
              )}
            </div>

            <button 
              onClick={() => saveNotes(notes, false)}
              style={{ 
                background: 'var(--accent)', 
                color: 'white', 
                border: 'none', 
                padding: '9px 18px', 
                borderRadius: '10px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                fontWeight: '700', 
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <Save size={16} /> Save Now
            </button>
          </div>
        </div>

        {/* Project Description Banner */}
        {selectedProject.desc && (
          <div style={{ padding: '0 4px', marginBottom: '20px', color: 'var(--text-secondary)', fontSize: '15px' }}>
            <strong>Description:</strong> {selectedProject.desc}
          </div>
        )}

        {/* Text Editor Container */}
        <div style={{ 
          flex: 1, 
          position: 'relative', 
          background: 'rgba(255, 255, 255, 0.02)', 
          border: '1px solid var(--border-color)', 
          borderRadius: '18px',
          padding: '24px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '300px'
        }}>
          {/* Notes Title Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px', color: '#a78bfa' }}>
            <FileText size={18} />
            <span style={{ fontSize: '14px', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Workspace Notebook</span>
          </div>

          <textarea
            value={notes}
            onChange={handleNotesChange}
            placeholder="Write your ideas, code snippets, notes, prompts, or generate some creative text and store them here! Auto-saves as you type..."
            style={{
              width: '100%',
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: '#f8fafc',
              fontSize: '16px',
              lineHeight: '1.6',
              resize: 'none',
              outline: 'none',
              fontFamily: 'Outfit, sans-serif'
            }}
          />

          {/* Editor Footer (Counters and Info) */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            borderTop: '1px solid rgba(255,255,255,0.06)', 
            paddingTop: '16px', 
            marginTop: '16px',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <span style={{ fontStyle: 'italic' }}>AI-compatible notepad. Everything written is stored under your email profile.</span>
            <div style={{ display: 'flex', gap: '16px', fontWeight: '600' }}>
              <span>{wordCount} words</span>
              <span>{charCount} characters</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // List View (rendered when selectedProject === null)
  return (
    <div className="page-view" style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '32px', fontWeight: '800' }}>Projects</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Manage your AI workspaces, documentations, and workspace notes.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          style={{ background: 'var(--accent)', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', cursor: 'pointer' }}
        >
          <Plus size={20} /> New Project
        </button>
      </div>

      {/* New Project Form */}
      {isAdding && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', padding: '24px', borderRadius: '16px', marginBottom: '32px' }}>
          <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '700' }}>Create New Project</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input 
              type="text" 
              placeholder="Project Name" 
              value={newName} 
              onChange={(e) => setNewName(e.target.value)}
              style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', color: 'white', fontSize: '14px' }}
            />
            <input 
              type="text" 
              placeholder="Project Description (optional)" 
              value={newDesc} 
              onChange={(e) => setNewDesc(e.target.value)}
              style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', color: 'white', fontSize: '14px' }}
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setIsAdding(false)} style={{ background: 'transparent', border: '1px solid var(--border-color)', padding: '10px 20px', borderRadius: '8px', color: 'white', cursor: 'pointer' }}>Cancel</button>
              <button onClick={addProject} style={{ background: 'var(--accent)', border: 'none', padding: '10px 24px', borderRadius: '8px', color: 'white', fontWeight: '600', cursor: 'pointer' }}>Create Project</button>
            </div>
          </div>
        </div>
      )}

      {/* Search Filter Bar */}
      <div style={{ position: 'relative', marginBottom: '32px' }}>
        <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
        <input 
          type="text" 
          placeholder="Search projects..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '12px 12px 12px 48px', color: 'white', fontSize: '15px' }}
        />
      </div>

      {/* Projects Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
        {filteredProjects.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-color)', borderRadius: '16px' }}>
            No projects found. Create one to get started!
          </div>
        ) : (
          filteredProjects.map(p => {
            const wordCount = p.notes ? p.notes.trim().split(/\s+/).filter(Boolean).length : 0;
            return (
              <div 
                key={p.id} 
                onClick={() => openProject(p)}
                className="dashboard-card"
                style={{ 
                  background: 'rgba(255,255,255,0.02)', 
                  border: '1px solid var(--border-color)', 
                  padding: '24px', 
                  borderRadius: '16px', 
                  position: 'relative', 
                  transition: 'all 0.3s',
                  cursor: 'pointer',
                  overflow: 'hidden'
                }}
              >
                {/* Glowing ambient background inside card */}
                <div style={{ position: 'absolute', right: -20, top: -20, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(96,165,250,0.04) 0%, transparent 60%)', pointerEvents: 'none' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
                  <div style={{ background: 'rgba(37, 99, 235, 0.1)', color: '#3b82f6', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FolderOpen size={20} />
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent opening the project when clicking delete
                      deleteProject(p.id);
                    }} 
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.8, transition: 'all 0.2s' }}
                    title="Delete Project"
                    className="delete-project-btn"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px', color: '#f8fafc' }}>{p.name}</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '20px', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden', height: '42px' }}>
                  {p.desc || "No description provided."}
                </p>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '14px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <span>{wordCount} words stored</span>
                  <span style={{ color: 'var(--accent)', fontWeight: '700' }}>Open Workspace &rarr;</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

const SettingsView = () => {
  const { darkMode, setDarkMode, ttsEnabled, setTtsEnabled, user, voicePreset, setVoicePreset } = useContext(AppContext);
  const displayName = localStorage.getItem("nexus_user_name") || user?.displayName || (user?.email ? user.email.split('@')[0] : "User");

  const handleTestVoice = (preset) => {
    import('./utils/voiceEngine').then(({ testVoice }) => testVoice(preset));
  };
  
  return (
    <div className="page-view" style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '32px' }}>Settings</h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* Profile Section */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', color: 'var(--accent)' }}>
            <User size={20} />
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'white' }}>Profile</h3>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', padding: '24px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <img 
              src={user?.photoURL || "https://ui-avatars.com/api/?name=" + encodeURIComponent(displayName)} 
              alt="Profile" 
              style={{ width: '64px', height: '64px', borderRadius: '50%', border: '2px solid var(--accent)' }} 
            />
            <div>
              <div style={{ fontSize: '20px', fontWeight: '700' }}>{displayName}</div>
              <div style={{ color: 'var(--text-secondary)' }}>{user?.email}</div>
              <div style={{ display: 'inline-block', marginTop: '8px', padding: '4px 10px', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', borderRadius: '6px', fontSize: '12px', fontWeight: '700' }}>Pro Member</div>
            </div>
          </div>
        </section>

        {/* Preferences Section */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', color: 'var(--accent)' }}>
            <Settings size={20} />
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'white' }}>Preferences</h3>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden' }}>
            <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontWeight: '600' }}>Dark Mode</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Toggle between dark and light interface themes.</div>
              </div>
              <Toggle checked={darkMode} onChange={() => setDarkMode(!darkMode)} />
            </div>
            <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontWeight: '600' }}>AI Voice Response</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Listen to AI responses using Text-to-Speech.</div>
              </div>
              <Toggle checked={ttsEnabled} onChange={() => setTtsEnabled(!ttsEnabled)} />
            </div>
            {ttsEnabled && (
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 220 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: 6 }}>Voice Preset</div>
                    <select 
                      value={voicePreset} 
                      onChange={(e) => setVoicePreset(e.target.value)} 
                      style={{ padding: '8px', borderRadius: 8, background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-color)', minWidth: 220 }}
                    >
                      <option value="ironman_en">🎙️ J.A.R.V.I.S. (English - Movie Premium)</option>
                      <option value="ironman_hi">🎙️ J.A.R.V.I.S. (Hindi - Movie Premium)</option>
                      <option value="ironman_hinglish">🎙️ J.A.R.V.I.S. (Hinglish Mix - Movie Premium)</option>
                    </select>
                  </div>
                  <button 
                    onClick={() => handleTestVoice(voicePreset)} 
                    style={{ 
                      padding: '8px 16px', 
                      borderRadius: 8, 
                      background: 'linear-gradient(135deg, #2563eb, #7c3aed)', 
                      color: 'white', 
                      fontWeight: 700, 
                      border: 'none', 
                      cursor: 'pointer', 
                      fontSize: '13px', 
                      transition: 'all 0.2s', 
                      boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
                      marginTop: '20px'
                    }}
                  >
                    🔊 Test Voice
                  </button>
                </div>
                {voicePreset === 'ironman_hinglish' ? (
                  <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.18)', borderRadius: 10, padding: '12px 16px', fontSize: 13 }}>
                    <div style={{ fontWeight: 700, color: '#10b981', marginBottom: 4 }}>🤖 J.A.R.V.I.S. Hinglish Mix Movie Premium Profile</div>
                    <div style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      Cinematic Movie Premium Jarvis voice with metallic intercom suit effect. Auto-detects Hindi & English in each sentence and speaks with the matching voice. Perfect for mixed Hindi-English (Hinglish) conversations.
                    </div>
                  </div>
                ) : voicePreset === 'ironman_hi' ? (
                  <div style={{ background: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.18)', borderRadius: 10, padding: '12px 16px', fontSize: 13 }}>
                    <div style={{ fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>🤖 J.A.R.V.I.S. Hindi Movie Premium Profile</div>
                    <div style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      Cinematic Movie Premium Jarvis voice with metallic intercom suit effect (Atul Kapoor style). Plays high-fidelity Hindi & Hinglish audio bypassing local system limitations.
                    </div>
                  </div>
                ) : (
                  <div style={{ background: 'rgba(37, 99, 235, 0.06)', border: '1px solid rgba(37, 99, 235, 0.15)', borderRadius: 10, padding: '12px 16px', fontSize: 13 }}>
                    <div style={{ fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>🤖 J.A.R.V.I.S. English Movie Premium Profile</div>
                    <div style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      Cinematic Movie Premium Jarvis voice with metallic intercom suit effect (Paul Bettany style). High-fidelity English speech synthesis with calm, polite tone.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Security Section */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', color: 'var(--accent)' }}>
            <Shield size={20} />
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'white' }}>Account & Security</h3>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', padding: '20px', borderRadius: '16px' }}>
             <button 
               onClick={() => {
                 localStorage.removeItem("nexus_mock_user");
                 localStorage.removeItem("nexus_user_name");
                 signOut(auth).finally(() => window.location.reload());
               }}
               style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '10px 20px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
             >
               Sign Out from Account
             </button>
          </div>
        </section>
      </div>
    </div>
  );
};

// ── Bottom Navigation Bar (Mobile) ────────────────────────────────────────
const BottomNav = ({ navigate, pathname }) => {
  const navItems = [
    { to: '/menu', icon: Layout,       label: 'Home',     color: '#ec4899' },
    { to: '/chat', icon: MessageSquare, label: 'Chat',    color: '#3b82f6' },
    { to: '/code', icon: Code,          label: 'Code',    color: '#10b981' },
    { to: '/content', icon: PenTool,   label: 'Write',    color: '#a855f7' },
    { to: '/settings', icon: Settings, label: 'Settings', color: '#94a3b8' },
  ];

  const isActive = (to) => {
    if (to === '/menu') return pathname === '/menu' || pathname === '/';
    return pathname === to;
  };

  return (
    <nav className="bottom-nav" role="navigation" aria-label="Mobile navigation">
      {navItems.map((item) => (
        <button
          key={item.to}
          className={`bottom-nav-item ${isActive(item.to) ? 'active' : ''}`}
          onClick={() => navigate(item.to)}
          aria-label={item.label}
          style={{ position: 'relative' }}
        >
          <item.icon
            size={22}
            style={{ color: isActive(item.to) ? item.color : undefined }}
          />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
};

// ── PWA Install Banner ────────────────────────────────────────────────────
const PwaInstallBanner = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
      const dismissed = localStorage.getItem('pwa_banner_dismissed');
      
      if (!dismissed && !isStandalone) setShowBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
      localStorage.setItem('pwa_installed', 'true');
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa_banner_dismissed', 'true');
  };

  if (!showBanner) return null;

  return (
    <div className="pwa-install-banner">
      <div className="pwa-banner-icon">
        <Sparkles size={20} color="white" />
      </div>
      <div className="pwa-banner-text">
        <strong>Install Nexuss Ai</strong>
        <span>Add to Home Screen for app-like experience</span>
      </div>
      <button className="pwa-install-btn" onClick={handleInstall}>
        <Download size={14} style={{ display: 'inline', marginRight: '4px' }} />
        Install
      </button>
      <button className="pwa-dismiss-btn" onClick={handleDismiss} aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  );
};

// --- Main App Logic ---

  function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { darkMode, setDarkMode, ttsEnabled, setTtsEnabled, recentChats, user, loading } = useContext(AppContext);
  const displayName = localStorage.getItem("nexus_user_name") || user?.displayName || (user?.email ? user.email.split('@')[0] : "User");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [chatKey, setChatKey] = useState(0);
  const isMobile = useIsMobile();
  
  const [connectionState, setConnectionState] = useState('online'); // 'online' | 'slow' | 'offline'
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    if (!user?.email) return;

    // 1. Initial load from local storage cache
    const cached = localStorage.getItem(`nexus_projects_${user.email}`);
    if (cached) {
      setProjects(JSON.parse(cached));
    } else {
      setProjects([]);
    }

    // 2. Load latest projects from backend API
    const loadProjects = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/projects?email=${encodeURIComponent(user.email)}`);
        if (response.ok) {
          const data = await response.json();
          setProjects(data);
          localStorage.setItem(`nexus_projects_${user.email}`, JSON.stringify(data));
        }
      } catch (err) {
        console.warn("Failed to fetch projects from backend, using local cache:", err.message);
      }
    };

    loadProjects();
  }, [user]);

  // Close mobile sidebar on navigation
  const handleMobileNav = () => {
    if (isMobile) setIsMobileSidebarOpen(false);
  };

  const checkConnectionHealth = async () => {
    if (!navigator.onLine) {
      setConnectionState('offline');
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 2200);
    const start = performance.now();

    try {
      const response = await fetch(`${API_BASE_URL}/api/health`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });
      const elapsed = performance.now() - start;

      if (!response.ok) {
        throw new Error('Health check failed');
      }

      if (elapsed > 1500) {
        setConnectionState('slow');
      } else {
        setConnectionState('online');
      }
    } catch (err) {
      setConnectionState('offline');
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  useEffect(() => {
    checkConnectionHealth();
    const interval = window.setInterval(checkConnectionHealth, 15000);

    const handleOnline = () => {
      checkConnectionHealth();
    };
    const handleOffline = () => setConnectionState('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: 'white' }}>Loading Nexuss...</div>;

  return (
    <div className={`app-container ${darkMode ? '' : 'light-mode'}`}>
      
      {/* ── Mobile Sidebar Backdrop Overlay ── */}
      <div
        className={`sidebar-overlay ${isMobileSidebarOpen ? 'visible' : ''}`}
        onClick={() => setIsMobileSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* ── Sidebar ── */}
      <aside className={`sidebar ${!isSidebarOpen ? "collapsed" : ""} ${isMobileSidebarOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-header">
          <div className="logo-section">
            <div className="logo-icon" style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)', boxShadow: '0 0 15px rgba(37, 99, 235, 0.4)' }}>
              <Sparkles size={18} color="white" />
            </div>
            <span className="logo-text" style={{ fontSize: '20px', letterSpacing: '-0.5px' }}>Nexuss</span>
          </div>
          <button
            className="close-sidebar-btn"
            onClick={() => { setIsSidebarOpen(false); setIsMobileSidebarOpen(false); }}
            title="Close Sidebar"
          >
            <PanelLeftClose size={20} />
          </button>
        </div>

        <div className="new-chat-container">
          <button className="new-chat-btn" onClick={() => {
            const storageKey = user?.email ? `nexus_chat_history_${user.email}` : 'nexus_chat_history_anonymous';
            sessionStorage.removeItem(storageKey);
            setChatKey(prev => prev + 1);
            navigate('/chat');
            handleMobileNav();
          }}>
            <Plus size={18} />
            New Chat
          </button>
        </div>

        <div className="sidebar-scrollable">
          <div className="sidebar-section-title">Menu</div>
          <SidebarItem to="/menu" icon={Layout} label="Dashboard" isActive={location.pathname === "/menu" || location.pathname === "/"} color="#ec4899" onClick={handleMobileNav} />
          <SidebarItem to="/chat" icon={MessageSquare} label="Chat" isActive={location.pathname === "/chat"} color="#3b82f6" onClick={handleMobileNav} />
          <SidebarItem to="/code" icon={Code} label="Code" isActive={location.pathname === "/code"} color="#10b981" onClick={handleMobileNav} />
          <SidebarItem to="/content" icon={PenTool} label="Write" isActive={location.pathname === "/content"} color="#a855f7" onClick={handleMobileNav} />
          {/* Images feature removed */}
          <SidebarItem to="/prompts" icon={Search} label="Prompts" isActive={location.pathname === "/prompts"} color="#06b6d4" onClick={handleMobileNav} />
          <SidebarItem to="/projects" icon={FolderOpen} label="Projects" isActive={location.pathname === "/projects"} color="#f59e0b" onClick={handleMobileNav} />
          <SidebarItem to="/settings" icon={Settings} label="Settings" isActive={location.pathname === "/settings"} color="#94a3b8" onClick={handleMobileNav} />

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '16px 0' }} />
          <div className="sidebar-section-title">Recent Chats</div>
          {recentChats.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px', padding: '10px 14px', fontStyle: 'italic' }}>No recent chats yet</div>
          ) : (
            recentChats.map((chat) => (
              <div key={chat.id} className="chat-history-item" onClick={() => { navigate('/chat'); handleMobileNav(); }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{chat.title}</span>
              </div>
            ))
          )}
        </div>

        <div className="sidebar-footer">
          <div style={{ padding: '12px', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <img 
                  src={user?.photoURL || "https://ui-avatars.com/api/?name=" + encodeURIComponent(displayName)} 
                  alt="Profile" 
                  style={{ width: '36px', height: '36px', borderRadius: '50%', border: '2px solid var(--accent)' }} 
                />
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email || 'No email available'}</div>
              </div>
            </div>
            <button 
              onClick={() => {
                localStorage.removeItem("nexus_mock_user");
                localStorage.removeItem("nexus_user_name");
                signOut(auth).finally(() => window.location.reload());
              }} 
              style={{ width: '100%', padding: '8px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="main-content">
        {/* ── Header ── */}
        <header className="top-bar">
          <div className="header-left">
            {/* Mobile hamburger — always visible on mobile */}
            <button
              className="mobile-menu-btn open-sidebar-btn"
              onClick={() => setIsMobileSidebarOpen(true)}
              title="Open Menu"
              aria-label="Open navigation menu"
            >
              <Menu size={22} />
            </button>

            {/* Desktop open sidebar button */}
            {!isMobile && !isSidebarOpen && (
              <button className="open-sidebar-btn" onClick={() => setIsSidebarOpen(true)} title="Open Sidebar">
                <PanelLeft size={22} />
              </button>
            )}

            <h1 className="page-title" style={{ fontSize: '20px', fontWeight: '800' }}>
               {location.pathname.replace('/', '').toUpperCase() || "DASHBOARD"}
            </h1>
          </div>

          <div className="header-actions">
            <div className="network-status-chip" data-status={connectionState} aria-live="polite" aria-label={`Internet status ${connectionState}`}>
              <span className="network-status-dot" />
              <span>
                {user?.displayName || 'Nexuss'} {connectionState === 'online' ? 'Online' : connectionState === 'slow' ? 'Slow' : 'Offline'}
              </span>
            </div>
            <div className="search-box">
              <Search size={18} className="search-icon" />
              <input type="text" className="search-input" placeholder="Search..." />
            </div>
            <button className="icon-btn" onClick={() => setDarkMode(!darkMode)} title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}>
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="icon-btn" onClick={() => setTtsEnabled(!ttsEnabled)} title={ttsEnabled ? "Mute AI Voice" : "Enable AI Voice"}>
              {ttsEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
            <button className="icon-btn">
              <Bell size={20} />
            </button>
            <div 
              className="profile-btn" 
              style={{ overflow: 'hidden', padding: 0, cursor: 'pointer' }} 
              title={user?.email || displayName || 'Profile'}
              onClick={() => navigate('/settings')}
            >
              <img src={user?.photoURL || "https://ui-avatars.com/api/?name=" + encodeURIComponent(displayName)} alt="P" style={{ width: '100%', height: '100%' }} />
            </div>
          </div>
        </header>

        {/* ── Routes Container ── */}
        <Routes location={location}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/menu" element={<Dashboard />} />
          <Route path="/chat" element={<Chat key={chatKey} />} />
          <Route path="/code" element={<CodeGenerator />} />
          <Route path="/content" element={<ContentGenerator />} />
          <Route path="/prompts" element={<PromptManager />} />
          {/* Images route removed */}
          <Route path="/projects" element={<ProjectsView projects={projects} setProjects={setProjects} />} />
          <Route path="/settings" element={<SettingsView />} />
        </Routes>
      </main>

      {/* ── Mobile Bottom Navigation ── */}
      <BottomNav navigate={navigate} pathname={location.pathname} />

      {/* ── PWA Install Banner ── */}
      <PwaInstallBanner />
    </div>
  );
}

function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [voicePreset, setVoicePreset] = useState(() => {
    const saved = localStorage.getItem('tts_voice');
    return saved === 'ironman_hi' ? 'ironman_hi' : 'ironman_en';
  });
  const [customVoiceUrl, setCustomVoiceUrl] = useState(() => localStorage.getItem('tts_custom_url') || '');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentChats, setRecentChats] = useState(() => {
    const saved = localStorage.getItem("nexus_chats");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        setLoading(false);
      } else {
        const mockEmail = localStorage.getItem("nexus_mock_user");
        const mockName = localStorage.getItem("nexus_user_name");
        if (mockEmail) {
          setUser({
            email: mockEmail,
            displayName: mockName || mockEmail.split('@')[0],
            photoURL: null,
            isMock: true
          });
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem("nexus_chats", JSON.stringify(recentChats));
  }, [recentChats]);

  useEffect(() => {
    localStorage.setItem('tts_voice', voicePreset);
  }, [voicePreset]);

  useEffect(() => {
    localStorage.setItem('tts_custom_url', customVoiceUrl);
  }, [customVoiceUrl]);

  const addRecentChat = (question) => {
    const title = question.length > 36 ? question.substring(0, 36) + '…' : question;
    setRecentChats((prev) => {
      if (prev.length > 0 && prev[0].title === title) return prev;
      return [{ title, id: Date.now() }, ...prev].slice(0, 10);
    });
  };

  return (
    <AppContext.Provider value={{ darkMode, setDarkMode, ttsEnabled, setTtsEnabled, recentChats, addRecentChat, user, loading, voicePreset, setVoicePreset, customVoiceUrl, setCustomVoiceUrl }}>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={user ? <AppContent /> : <Login />} />
        </Routes>
      </Router>
    </AppContext.Provider>
  );
}

export default App;
