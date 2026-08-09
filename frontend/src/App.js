import React, { useState, useEffect, createContext, useContext, lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { MessageSquare, Code, PenTool, FolderOpen, Settings, Layout, Plus, Search, Sparkles, PanelLeftClose, PanelLeft, Bell, Sun, Moon, Volume2, VolumeX, Menu, Image, Download, X } from "lucide-react";

// â”€â”€ Eager-loaded (small / always needed) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import Chat from "./Chat";
import Dashboard from "./Dashboard";
import { auth } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import Login from "./Login";
import API_BASE_URL from "./apiConfig";
import "./App.css";
import { useUIStore } from "./uiStore";

// â”€â”€ Split components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import ErrorBoundary from "./components/ErrorBoundary";
import ProjectsView from "./components/ProjectsView";
import SettingsView from "./components/SettingsView";

// â”€â”€ Lazy-loaded (heavy components) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CodeGenerator    = lazy(() => import("./CodeGenerator"));
const ContentGenerator = lazy(() => import("./ContentGenerator"));
const ImageGenerator   = lazy(() => import("./ImageGeneratorPro"));
const PromptManager    = lazy(() => import("./PromptManager"));

// Global context for dark mode & TTS
export const AppContext = createContext();

// â”€â”€ Custom hook: detect mobile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Suspense fallback UI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SuspenseFallback = () => (
  <div className="suspense-loading">
    <div className="suspense-loading-spinner" />
    <span>Loading...</span>
  </div>
);

// â”€â”€ Page transition wrapper using framer-motion â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const PageTransition = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.22, ease: "easeOut" }}
    style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      minHeight: 0,
    }}
  >
    {children}
  </motion.div>
);



// â”€â”€ Bottom Navigation Bar (Mobile) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BottomNav = ({ navigate, pathname }) => {
  const navItems = [
    { to: '/menu',    icon: Layout,        label: 'Home',     color: '#ec4899' },
    { to: '/chat',    icon: MessageSquare, label: 'Chat',     color: '#3b82f6' },
    { to: '/images',  icon: Image,         label: 'Image',    color: '#f43f5e' },
    { to: '/code',    icon: Code,          label: 'Code',     color: '#10b981' },
    { to: '/settings',icon: Settings,      label: 'Settings', color: '#94a3b8' },
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

// â”€â”€ PWA Install Banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  const { sidebarCollapsed, setSidebarCollapsed } = useUIStore();
  const isSidebarOpen = !sidebarCollapsed;
  const setIsSidebarOpen = (val) => setSidebarCollapsed(!val);
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
      
      {/* â”€â”€ Mobile Sidebar Backdrop Overlay â”€â”€ */}
      <div
        className={`sidebar-overlay ${isMobileSidebarOpen ? 'visible' : ''}`}
        onClick={() => setIsMobileSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* â”€â”€ Sidebar â”€â”€ */}
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
          <SidebarItem to="/images" icon={Image} label="Image AI" isActive={location.pathname === "/images"} color="#f43f5e" onClick={handleMobileNav} />
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

      {/* â”€â”€ Main Content â”€â”€ */}
      <main className="main-content">
        {/* â”€â”€ Header â”€â”€ */}
        <header className="top-bar">
          <div className="header-left">
            {/* Mobile hamburger â€” always visible on mobile */}
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

        {/* â”€â”€ Routes Container â€” with lazy loading + transitions â”€â”€ */}
        <ErrorBoundary>
          <Suspense fallback={<SuspenseFallback />}>
            <AnimatePresence mode="wait">
              <Routes location={location} key={location.pathname}>
                <Route path="/" element={<PageTransition><Dashboard /></PageTransition>} />
                <Route path="/menu" element={<PageTransition><Dashboard /></PageTransition>} />
                <Route path="/chat" element={<PageTransition><Chat key={chatKey} /></PageTransition>} />
                <Route path="/code" element={<PageTransition><CodeGenerator /></PageTransition>} />
                <Route path="/content" element={<PageTransition><ContentGenerator /></PageTransition>} />
                <Route path="/images" element={<PageTransition><ImageGenerator /></PageTransition>} />
                <Route path="/prompts" element={<PageTransition><PromptManager /></PageTransition>} />
                <Route path="/projects" element={<PageTransition><ProjectsView projects={projects} setProjects={setProjects} /></PageTransition>} />
                <Route path="/settings" element={<PageTransition><SettingsView /></PageTransition>} />
              </Routes>
            </AnimatePresence>
          </Suspense>
        </ErrorBoundary>
      </main>

      {/* â”€â”€ Mobile Bottom Navigation â”€â”€ */}
      <BottomNav navigate={navigate} pathname={location.pathname} />

      {/* â”€â”€ PWA Install Banner â”€â”€ */}
      <PwaInstallBanner />
    </div>
  );
}

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("nexus_theme");
    return saved ? saved === "dark" : false; // Defaults to Light mode
  });
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
    localStorage.setItem("nexus_theme", darkMode ? "dark" : "light");
  }, [darkMode]);

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

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: darkMode ? "#0a0f1e" : "#f8fafc",
        color: darkMode ? "white" : "#0f172a",
        gap: "16px",
        fontFamily: "system-ui, -apple-system, sans-serif"
      }}>
        <div style={{
          width: "60px",
          height: "60px",
          borderRadius: "18px",
          background: "linear-gradient(135deg, #4f46e5, #9333ea)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 10px 25px -5px rgba(79, 70, 229, 0.4)"
        }}>
          <Sparkles size={32} color="white" />
        </div>
        <div style={{ fontSize: "15px", fontWeight: "500", color: darkMode ? "#94a3b8" : "#475569" }}>Loading Nexuss Workspace...</div>
      </div>
    );
  }

  return (
    <AppContext.Provider value={{ darkMode, setDarkMode, ttsEnabled, setTtsEnabled, recentChats, addRecentChat, user, loading, voicePreset, setVoicePreset, customVoiceUrl, setCustomVoiceUrl }}>
      <Router>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
          <Route path="/*" element={user ? <AppContent /> : <Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AppContext.Provider>
  );
}

export default App;

