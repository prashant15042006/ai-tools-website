import React, { useState, useEffect, createContext, useContext } from "react";

import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import { MessageSquare, Code, PenTool, FolderOpen, Settings, Layout, Plus, Search, Sparkles, PanelLeftClose, PanelLeft, Bell, Sun, Moon, Volume2, VolumeX, Trash2, Edit3 } from "lucide-react";
import Chat from "./Chat";
import CodeGenerator from "./CodeGenerator";
import ContentGenerator from "./ContentGenerator";
import "./App.css";

// Global context for dark mode & TTS
export const AppContext = createContext();

const SidebarItem = ({ to, icon: Icon, label, isActive, color }) => (
  <Link to={to} className={`menu-item ${isActive ? "active" : ""}`}>
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
      background: checked ? 'var(--accent)' : 'var(--border-color)',
      borderRadius: '14px', position: 'relative', cursor: 'pointer',
      transition: 'background 0.3s'
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

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { darkMode, setDarkMode, ttsEnabled, setTtsEnabled, recentChats } = useContext(AppContext);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [notifications, setNotifications] = useState(false);
  const [chatKey, setChatKey] = useState(0);
  const [projects, setProjects] = useState(() => {
    const saved = localStorage.getItem("nexus_projects");
    return saved ? JSON.parse(saved) : [
      { name: "E-Commerce Backend", desc: "Node.js API with Express and MongoDB. Last edited 2 days ago." },
      { name: "React Portfolio", desc: "Personal portfolio website built with React and Framer Motion." }
    ];
  });

  useEffect(() => {
    localStorage.setItem("nexus_projects", JSON.stringify(projects));
  }, [projects]);

  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [selectedProject, setSelectedProject] = useState(null);

  const handleCreateProject = () => {
    if (newProjectName.trim()) {
      setProjects([...projects, { name: newProjectName, desc: "Newly created project. Start adding files." }]);
      setNewProjectName("");
      setIsCreatingProject(false);
    }
  };

  const handleDeleteProject = (e, idx) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this project?")) {
      const updated = projects.filter((_, i) => i !== idx);
      setProjects(updated);
      if (selectedProject === projects[idx]) setSelectedProject(null);
    }
  };

  const [editingIdx, setEditingIdx] = useState(-1);
  const [editingName, setEditingName] = useState("");

  const startRename = (e, idx) => {
    e.stopPropagation();
    setEditingIdx(idx);
    setEditingName(projects[idx].name);
  };

  const handleRename = () => {
    if (editingName.trim()) {
      const updated = projects.map((p, i) => i === editingIdx ? { ...p, name: editingName } : p);
      setProjects(updated);
      setEditingIdx(-1);
    }
  };

  return (
    <div className={`app-container ${darkMode ? '' : 'light-mode'}`}>
      {/* Sidebar */}
      <aside className={`sidebar ${!isSidebarOpen ? "collapsed" : ""}`}>
        <div className="sidebar-header">
          <div className="logo-section">
            <div className="logo-icon">
              <Sparkles size={22} color="white" />
            </div>
            <span className="logo-text">Nexus</span>
          </div>
          <button className="close-sidebar-btn" onClick={() => setIsSidebarOpen(false)} title="Close Sidebar">
            <PanelLeftClose size={22} />
          </button>
        </div>

        <div className="new-chat-container">
          <button className="new-chat-btn" onClick={() => { setChatKey(prev => prev + 1); navigate('/'); }}>
            <Plus size={18} />
            New Chat
          </button>
        </div>

        <div className="sidebar-scrollable">
          <div className="sidebar-section-title">Menu</div>
          <SidebarItem to="/" icon={MessageSquare} label="Chat" isActive={location.pathname === "/"} color="#3b82f6" />
          <SidebarItem to="/code" icon={Code} label="Code" isActive={location.pathname === "/code"} color="#10b981" />
          <SidebarItem to="/content" icon={PenTool} label="Write" isActive={location.pathname === "/content"} color="#a855f7" />
          <SidebarItem to="/projects" icon={FolderOpen} label="Projects" isActive={location.pathname === "/projects"} color="#f59e0b" />
          <SidebarItem to="/settings" icon={Settings} label="Settings" isActive={location.pathname === "/settings"} color="#94a3b8" />
          <SidebarItem to="/menu" icon={Layout} label="Dashboard" isActive={location.pathname === "/menu"} color="#ec4899" />

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '16px 0' }} />
          <div className="sidebar-section-title">Recent Chats</div>
          {recentChats.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px', padding: '10px 14px', fontStyle: 'italic' }}>No recent chats yet</div>
          ) : (
            recentChats.map((chat) => (
              <div key={chat.id} className="chat-history-item" onClick={() => navigate('/')}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{chat.title}</span>
              </div>
            ))
          )}
        </div>

        <div className="sidebar-footer">
          <div className="chat-history-item" style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '15px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', marginRight: '8px', flexShrink: 0 }}></div>
            Nexus Online
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Header */}
        <header className="top-bar">
          <div className="header-left">
            {!isSidebarOpen && (
              <button className="open-sidebar-btn" onClick={() => setIsSidebarOpen(true)} title="Open Sidebar">
                <PanelLeft size={22} />
              </button>
            )}
            <h1 className="page-title">
              {location.pathname === "/" && "Nexus Chat"}
              {location.pathname === "/code" && "Code Generation"}
              {location.pathname === "/content" && "Writing Assistant"}
              {location.pathname === "/projects" && "Projects"}
              {location.pathname === "/settings" && "Settings"}
              {location.pathname === "/menu" && "Dashboard"}
            </h1>
          </div>

          <div className="header-actions">
            <div className="search-box">
              <Search size={18} className="search-icon" />
              <input type="text" className="search-input" placeholder="Search..." />
            </div>
            {/* Dark/Light mode quick toggle in header */}
            <button className="icon-btn" onClick={() => setDarkMode(!darkMode)} title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}>
              {darkMode ? <Sun size={22} /> : <Moon size={22} />}
            </button>
            {/* TTS quick toggle */}
            <button className="icon-btn" onClick={() => setTtsEnabled(!ttsEnabled)} title={ttsEnabled ? "Mute AI Voice" : "Enable AI Voice"}>
              {ttsEnabled ? <Volume2 size={22} /> : <VolumeX size={22} />}
            </button>
            <button className="icon-btn">
              <Bell size={22} />
            </button>
            <button className="profile-btn">K</button>
          </div>
        </header>

        {/* Routes Container */}
        <Routes location={location}>
          <Route path="/" element={<Chat key={chatKey} />} />
          <Route path="/code" element={<CodeGenerator />} />
          <Route path="/content" element={<ContentGenerator />} />

          {/* Projects Page */}
          <Route path="/projects" element={
            <div className="page-view">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '36px', fontWeight: '800' }}>{selectedProject ? selectedProject.name : "Your Projects"}</h2>
                {selectedProject && (
                  <button onClick={() => setSelectedProject(null)} style={{ padding: '8px 16px', background: 'var(--bg-hover)', border: 'none', borderRadius: '8px', color: 'var(--text-primary)', cursor: 'pointer' }}>Back to List</button>
                )}
              </div>
              
              {!selectedProject ? (
                <div className="dashboard-grid">
                  {projects.map((proj, idx) => (
                    <div key={idx} className="dashboard-card" onClick={() => setSelectedProject(proj)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        {editingIdx === idx ? (
                          <div style={{ flex: 1, display: 'flex', gap: '8px' }}>
                            <input 
                              type="text" 
                              value={editingName} 
                              onChange={(e) => setEditingName(e.target.value)}
                              style={{ flex: 1, background: 'var(--bg-hover)', border: '1px solid var(--accent)', borderRadius: '4px', color: 'white', padding: '4px 8px', fontSize: '14px' }}
                              autoFocus
                              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                            />
                            <button onClick={(e) => { e.stopPropagation(); handleRename(); }} style={{ padding: '4px 8px', background: 'var(--accent)', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer' }}>OK</button>
                          </div>
                        ) : (
                          <div className="dashboard-card-title"><FolderOpen size={22} color="var(--accent)" /> {proj.name}</div>
                        )}
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="icon-btn" onClick={(e) => startRename(e, idx)} title="Rename"><Edit3 size={16} /></button>
                          <button className="icon-btn" onClick={(e) => handleDeleteProject(e, idx)} title="Delete" style={{ color: '#ef4444' }}><Trash2 size={16} /></button>
                        </div>
                      </div>
                      <div className="dashboard-card-desc">{proj.desc}</div>
                    </div>
                  ))}
                  {isCreatingProject ? (
                    <div className="dashboard-card" style={{ borderStyle: 'solid', borderColor: 'var(--accent)' }}>
                      <div className="dashboard-card-title" style={{ fontSize: '18px' }}>New Project Name</div>
                      <input
                        type="text"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        placeholder="e.g. Finance App"
                        className="chat-textarea"
                        style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', fontSize: '17px', outline: 'none', width: '100%', marginBottom: '10px' }}
                        autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCreateProject(); }}
                      />
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={handleCreateProject} style={{ flex: 1, padding: '12px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: '600' }}>Save</button>
                        <button onClick={() => setIsCreatingProject(false)} style={{ flex: 1, padding: '12px', background: 'var(--border-color)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px' }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="dashboard-card" onClick={() => setIsCreatingProject(true)} style={{ borderStyle: 'dashed', borderColor: 'var(--text-secondary)', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                      <Plus size={28} color="var(--text-secondary)" />
                      <span style={{ color: 'var(--text-secondary)', fontSize: '17px' }}>Create New Project</span>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ background: 'var(--bg-sidebar)', padding: '40px', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                  <h3 style={{ marginBottom: '16px', color: 'var(--accent)' }}>Project Overview</h3>
                  <p style={{ fontSize: '18px', color: 'var(--text-primary)', lineHeight: '1.6' }}>{selectedProject.desc}</p>
                  <div style={{ marginTop: '32px', display: 'flex', gap: '16px' }}>
                    <button onClick={() => navigate('/code')} style={{ padding: '14px 28px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '600', cursor: 'pointer' }}>Generate Code</button>
                    <button style={{ padding: '14px 28px', background: 'var(--bg-hover)', color: 'var(--text-primary)', border: 'none', borderRadius: '12px', fontWeight: '600', cursor: 'pointer' }}>Manage Files</button>
                  </div>
                </div>
              )}
            </div>
          } />

          {/* Settings Page */}
          <Route path="/settings" element={
            <div className="page-view">
              <h2 style={{ fontSize: '36px', marginBottom: '12px', fontWeight: '800' }}>Settings</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '16px', marginBottom: '32px' }}>Manage your Nexus preferences</p>
              <div style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {/* Dark Mode */}
                <div className="setting-row">
                  <div className="setting-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      {darkMode ? <Moon size={20} color="var(--accent)" /> : <Sun size={20} color="#f59e0b" />}
                      <h3>Dark Mode</h3>
                    </div>
                    <p>{darkMode ? "Dark theme active — easy on the eyes." : "Light theme active — bright and clean."}</p>
                  </div>
                  <Toggle checked={darkMode} onChange={() => setDarkMode(!darkMode)} />
                </div>

                {/* AI Voice (TTS) */}
                <div className="setting-row">
                  <div className="setting-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      {ttsEnabled ? <Volume2 size={20} color="var(--accent)" /> : <VolumeX size={20} color="var(--text-secondary)" />}
                      <h3>AI Voice Responses</h3>
                    </div>
                    <p>{ttsEnabled ? "AI will speak its answers aloud." : "AI voice is muted."}</p>
                  </div>
                  <Toggle checked={ttsEnabled} onChange={() => setTtsEnabled(!ttsEnabled)} />
                </div>

                {/* Notifications */}
                <div className="setting-row">
                  <div className="setting-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <Bell size={20} color={notifications ? "var(--accent)" : "var(--text-secondary)"} />
                      <h3>Notifications</h3>
                    </div>
                    <p>{notifications ? "Desktop alerts enabled." : "Notifications are off."}</p>
                  </div>
                  <Toggle checked={notifications} onChange={() => setNotifications(!notifications)} />
                </div>

              </div>
            </div>
          } />

          {/* Dashboard Page */}
          <Route path="/menu" element={
            <div className="page-view">
              <h2 style={{ fontSize: '36px', marginBottom: '12px', fontWeight: '800' }}>Dashboard Overview</h2>
              <div className="dashboard-grid">
                <div className="dashboard-card" onClick={() => navigate('/')}>
                  <div className="dashboard-card-title"><MessageSquare size={22} color="#3b82f6" /> AI Chat</div>
                  <div className="dashboard-card-desc">Continue your conversation with Nexus.</div>
                </div>
                <div className="dashboard-card" onClick={() => navigate('/code')}>
                  <div className="dashboard-card-title"><Code size={22} color="#10b981" /> Code Generation</div>
                  <div className="dashboard-card-desc">Write, debug, and optimize code faster.</div>
                </div>
                <div className="dashboard-card" onClick={() => navigate('/content')}>
                  <div className="dashboard-card-title"><PenTool size={22} color="#a855f7" /> Writing Assistant</div>
                  <div className="dashboard-card-desc">Draft emails, essays, and articles.</div>
                </div>
                <div className="dashboard-card" onClick={() => navigate('/settings')}>
                  <div className="dashboard-card-title"><Settings size={22} color="#94a3b8" /> Preferences</div>
                  <div className="dashboard-card-desc">Manage your account and app settings.</div>
                </div>
              </div>
            </div>
          } />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [recentChats, setRecentChats] = useState(() => {
    const saved = localStorage.getItem("nexus_chats");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem("nexus_chats", JSON.stringify(recentChats));
  }, [recentChats]);

  const addRecentChat = (question) => {
    const title = question.length > 36 ? question.substring(0, 36) + '…' : question;
    setRecentChats((prev) => {
      // Avoid duplicate consecutive entry
      if (prev.length > 0 && prev[0].title === title) return prev;
      return [{ title, id: Date.now() }, ...prev].slice(0, 10); // keep latest 10
    });
  };

  return (
    <AppContext.Provider value={{ darkMode, setDarkMode, ttsEnabled, setTtsEnabled, recentChats, addRecentChat }}>
      <Router>
        <AppContent />
      </Router>
    </AppContext.Provider>
  );
}

export default App;
