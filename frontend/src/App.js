import React, { useState, useEffect, createContext, useContext } from "react";

import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import { MessageSquare, Code, PenTool, FolderOpen, Settings, Layout, Plus, Search, Sparkles, PanelLeftClose, PanelLeft, Bell, Sun, Moon, Volume2, VolumeX, Trash2, User, Shield, Menu, X, Download } from "lucide-react";
import Chat from "./Chat";
import CodeGenerator from "./CodeGenerator";
import ContentGenerator from "./ContentGenerator";
import Dashboard from "./Dashboard";
import PromptManager from "./PromptManager";
import { auth } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import Login from "./Login";
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
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const addProject = () => {
    if (newName.trim()) {
      setProjects([...projects, { name: newName, desc: "New workspace project", id: Date.now() }]);
      setNewName("");
      setIsAdding(false);
    }
  };

  const deleteProject = (id) => {
    if (window.confirm("Delete this project?")) {
      setProjects(projects.filter(p => p.id !== id));
    }
  };

  return (
    <div className="page-view" style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '32px', fontWeight: '800' }}>Projects</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Manage your AI workspaces and generated content.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          style={{ background: 'var(--accent)', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', cursor: 'pointer' }}
        >
          <Plus size={20} /> New Project
        </button>
      </div>

      {isAdding && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', padding: '24px', borderRadius: '16px', marginBottom: '32px' }}>
          <h3 style={{ marginBottom: '16px' }}>Create New Project</h3>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input 
              type="text" 
              placeholder="Project Name" 
              value={newName} 
              onChange={(e) => setNewName(e.target.value)}
              style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', color: 'white' }}
            />
            <button onClick={addProject} style={{ background: 'var(--accent)', border: 'none', padding: '0 24px', borderRadius: '8px', color: 'white', fontWeight: '600' }}>Create</button>
            <button onClick={() => setIsAdding(false)} style={{ background: 'transparent', border: '1px solid var(--border-color)', padding: '0 24px', borderRadius: '8px', color: 'white' }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
        {projects.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>No projects found. Create one to get started!</div>
        ) : (
          projects.map(p => (
            <div key={p.id || p.name} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', padding: '24px', borderRadius: '16px', position: 'relative', transition: 'all 0.3s' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                 <div style={{ background: 'rgba(37, 99, 235, 0.1)', color: '#3b82f6', padding: '8px', borderRadius: '10px' }}>
                    <FolderOpen size={24} />
                 </div>
                 <button onClick={() => deleteProject(p.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', opacity: 0.6 }}>
                    <Trash2 size={18} />
                 </button>
               </div>
               <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>{p.name}</h3>
               <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{p.desc}</p>
               <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'white', padding: '6px 14px', borderRadius: '8px', fontSize: '13px' }}>Open Project</button>
               </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const SettingsView = () => {
  const { darkMode, setDarkMode, ttsEnabled, setTtsEnabled, user } = useContext(AppContext);
  
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
              src={user?.photoURL || "https://ui-avatars.com/api/?name=" + (user?.displayName || user?.email)} 
              alt="Profile" 
              style={{ width: '64px', height: '64px', borderRadius: '50%', border: '2px solid var(--accent)' }} 
            />
            <div>
              <div style={{ fontSize: '20px', fontWeight: '700' }}>{user?.displayName || user?.email?.split('@')[0]}</div>
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
            <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: '600' }}>AI Voice Response</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Listen to AI responses using Text-to-Speech.</div>
              </div>
              <Toggle checked={ttsEnabled} onChange={() => setTtsEnabled(!ttsEnabled)} />
            </div>
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [chatKey, setChatKey] = useState(0);
  const isMobile = useIsMobile();
  
  const [projects, setProjects] = useState(() => {
    const saved = localStorage.getItem("nexus_projects");
    return saved ? JSON.parse(saved) : [
      { id: 1, name: "E-Commerce Backend", desc: "Node.js API with Express and MongoDB. Last edited 2 days ago." },
      { id: 2, name: "React Portfolio", desc: "Personal portfolio website built with React and Framer Motion." }
    ];
  });

  useEffect(() => {
    localStorage.setItem("nexus_projects", JSON.stringify(projects));
  }, [projects]);

  // Close mobile sidebar on navigation
  const handleMobileNav = () => {
    if (isMobile) setIsMobileSidebarOpen(false);
  };

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
          <button className="new-chat-btn" onClick={() => { setChatKey(prev => prev + 1); navigate('/chat'); handleMobileNav(); }}>
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
                src={user?.photoURL || "https://ui-avatars.com/api/?name=" + (user?.displayName || user?.email)} 
                alt="Profile" 
                style={{ width: '36px', height: '36px', borderRadius: '50%', border: '2px solid var(--accent)' }} 
              />
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.displayName || user?.email?.split('@')[0]}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Pro Account</div>
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
              style={{ display: 'none' }}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '24px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 10px #22c55e' }}></div>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Nexuss Online</span>
            </div>
          </div>

          <div className="header-actions">
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
            <div className="profile-btn" style={{ overflow: 'hidden', padding: 0 }}>
               <img src={user?.photoURL || "https://ui-avatars.com/api/?name=" + (user?.displayName || user?.email)} alt="P" style={{ width: '100%', height: '100%' }} />
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
          <Route path="/prompts" element={<PromptManager onInsert={(p)=>{ /* insert to chat by navigating to chat and using localStorage or global context */ localStorage.setItem('prompt_to_insert', p); navigate('/chat'); }} />} />
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

  const addRecentChat = (question) => {
    const title = question.length > 36 ? question.substring(0, 36) + '…' : question;
    setRecentChats((prev) => {
      if (prev.length > 0 && prev[0].title === title) return prev;
      return [{ title, id: Date.now() }, ...prev].slice(0, 10);
    });
  };

  return (
    <AppContext.Provider value={{ darkMode, setDarkMode, ttsEnabled, setTtsEnabled, recentChats, addRecentChat, user, loading }}>
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
