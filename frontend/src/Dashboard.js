import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Code, PenTool, ArrowRight, Sparkles, Zap, Brain } from 'lucide-react';
import { auth } from './firebase';
import { AppContext } from './App';
import API_BASE_URL from './apiConfig';
import './App.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const { darkMode } = useContext(AppContext);

  const tools = [
    {
      title: 'AI Chat',
      description: 'Interact with our advanced AI for brainstorming, analysis, and general assistance.',
      icon: MessageSquare,
      path: '/chat',
      bgDark: 'linear-gradient(135deg, #0f172a, #1e293b)',
      bgLight: 'linear-gradient(135deg, #dbeafe, #eff6ff)',
      color: '#3b82f6',
      glow: 'rgba(59, 130, 246, 0.4)'
    },
    {
      title: 'Code Generator',
      description: 'Generate high-quality code, debug snippets, and explain complex algorithms.',
      icon: Code,
      path: '/code',
      bgDark: 'linear-gradient(135deg, #1e1b4b, #312e81)',
      bgLight: 'linear-gradient(135deg, #ede9fe, #f5f3ff)',
      color: '#8b5cf6',
      glow: 'rgba(139, 92, 246, 0.4)'
    },
    {
      title: 'Content Writer',
      description: 'Create compelling articles, social media posts, and professional emails in seconds.',
      icon: PenTool,
      path: '/content',
      bgDark: 'linear-gradient(135deg, #2d1b0b, #452e13)',
      bgLight: 'linear-gradient(135deg, #fef3c7, #fffbeb)',
      color: '#f59e0b',
      glow: 'rgba(245, 158, 11, 0.4)'
    },
    {
      title: 'Image Studio',
      description: 'Generate stunning AI images with FLUX.1 — photorealistic, anime, 3D and more.',
      icon: Brain,
      path: '/images',
      bgDark: 'linear-gradient(135deg, #1a0533, #2d0a52)',
      bgLight: 'linear-gradient(135deg, #fce7f3, #fdf2f8)',
      color: '#ec4899',
      glow: 'rgba(236, 72, 153, 0.4)'
    },
    {
      title: 'Prompts',
      description: 'Manage and reuse prompts across chats and generators.',
      icon: Zap,
      path: '/prompts',
      bgDark: 'linear-gradient(135deg, #071029, #10233a)',
      bgLight: 'linear-gradient(135deg, #cffafe, #ecfeff)',
      color: '#06b6d4',
      glow: 'rgba(6, 182, 212, 0.18)'
    }
  ];

  const [projectCount, setProjectCount] = React.useState(0);

  React.useEffect(() => {
    let email = localStorage.getItem("nexus_mock_user");
    if (!email && auth.currentUser) {
      email = auth.currentUser.email;
    }

    if (email) {
      // 1. Check local cache first
      const saved = localStorage.getItem(`nexus_projects_${email}`);
      if (saved) {
        setProjectCount(JSON.parse(saved).length);
      }

      // 2. Fetch latest count from server
      const loadCount = async () => {
        try {

          const response = await fetch(`${API_BASE_URL}/api/projects?email=${encodeURIComponent(email)}`);
          if (response.ok) {
            const data = await response.json();
            setProjectCount(data.length);
            localStorage.setItem(`nexus_projects_${email}`, JSON.stringify(data));
          }
        } catch (err) {
          console.warn("Dashboard count fetch failed:", err.message);
        }
      };
      loadCount();
    } else {
      const saved = localStorage.getItem("nexus_projects");
      if (saved) {
        setProjectCount(JSON.parse(saved).length);
      }
    }
  }, []);

  const stats = [
    { label: 'Projects', value: projectCount > 0 ? projectCount.toString() : '0', icon: Sparkles, color: '#a855f7' },
    { label: 'AI Models', value: '10+', icon: Brain, color: '#3b82f6' },
    { label: 'Unlimited', icon: Zap, color: '#10b981', value: 'Responses' },
  ];

  return (
    <div className="dashboard-page">
      <div className="dashboard-inner">
        
        {/* ── Hero Banner ── */}
        <div className="dashboard-hero">
          {/* Ambient glow spheres for glossy glassmorphic depth */}
          <div style={{
            position: 'absolute',
            top: '-40%',
            right: '-10%',
            width: '600px',
            height: '600px',
            background: 'radial-gradient(circle, rgba(37, 99, 235, 0.28) 0%, transparent 70%)',
            filter: 'blur(70px)',
            zIndex: 1,
            pointerEvents: 'none'
          }}></div>
          <div style={{
            position: 'absolute',
            bottom: '-20%',
            left: '-10%',
            width: '450px',
            height: '450px',
            background: 'radial-gradient(circle, rgba(168, 85, 247, 0.22) 0%, transparent 70%)',
            filter: 'blur(60px)',
            zIndex: 1,
            pointerEvents: 'none'
          }}></div>
          <div style={{
            position: 'absolute',
            top: '15%',
            right: '25%',
            width: '400px',
            height: '400px',
            background: 'radial-gradient(circle, rgba(236, 72, 153, 0.18) 0%, transparent 70%)',
            filter: 'blur(60px)',
            zIndex: 1,
            pointerEvents: 'none'
          }}></div>

          <div className="hero-content">
            <div className="badge">
              <Sparkles size={14} className="sparkle-icon" />
              <span>v2.0 Intelligent Workspace</span>
            </div>
            <h1>Welcome, {localStorage.getItem("nexus_user_name") || "User"}!</h1>
            <p>Your all-in-one creative companion for code, content, and conversation.</p>
          </div>
        </div>

        {/* ── Stats Row ── */}
        <div className="dashboard-stats">
          {stats.map((stat, i) => (
            <div key={i} className="stat-card">
              <div className="stat-icon" style={{ background: `${stat.color}22`, color: stat.color }}>
                <stat.icon size={20} />
              </div>
              <div>
                <div className="stat-value" style={{ color: stat.color }}>{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Tool Cards ── */}
        <div className="dashboard-tools-grid">
          {tools.map((tool, index) => (
            <div 
              key={index} 
              className="tool-card"
              onClick={() => navigate(tool.path)}
              style={{ 
                background: darkMode ? tool.bgDark : tool.bgLight,
                boxShadow: `0 10px 30px -10px ${tool.glow}`,
              }}
            >
              <div className="card-icon" style={{ backgroundColor: `${tool.color}22`, color: tool.color, borderColor: `${tool.color}44` }}>
                <tool.icon size={26} />
              </div>
              <div className="card-info">
                <h3 style={{ fontSize: '20px' }}>{tool.title}</h3>
                <p style={{ fontSize: '14px' }}>{tool.description}</p>
                <div className="card-action">
                  <span style={{ color: tool.color }}>Launch Workspace</span>
                  <ArrowRight size={15} style={{ color: tool.color }} />
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
