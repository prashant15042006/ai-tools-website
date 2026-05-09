import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Code, PenTool, ArrowRight, Sparkles, Zap, Brain } from 'lucide-react';
import './App.css';

const Dashboard = () => {
  const navigate = useNavigate();

  const tools = [
    {
      title: 'AI Chat',
      description: 'Interact with our advanced AI for brainstorming, analysis, and general assistance.',
      icon: MessageSquare,
      path: '/chat',
      bg: 'linear-gradient(135deg, #0f172a, #1e293b)',
      color: '#3b82f6',
      glow: 'rgba(59, 130, 246, 0.4)'
    },
    {
      title: 'Code Generator',
      description: 'Generate high-quality code, debug snippets, and explain complex algorithms.',
      icon: Code,
      path: '/code',
      bg: 'linear-gradient(135deg, #1e1b4b, #312e81)',
      color: '#8b5cf6',
      glow: 'rgba(139, 92, 246, 0.4)'
    },
    {
      title: 'Content Writer',
      description: 'Create compelling articles, social media posts, and professional emails in seconds.',
      icon: PenTool,
      path: '/content',
      bg: 'linear-gradient(135deg, #2d1b0b, #452e13)',
      color: '#f59e0b',
      glow: 'rgba(245, 158, 11, 0.4)'
    }
  ];

  const stats = [
    { label: 'AI Models', value: '3+', icon: Brain, color: '#3b82f6' },
    { label: 'Responses', value: '∞', icon: Zap, color: '#10b981' },
    { label: 'Tools', value: '3', icon: Sparkles, color: '#a855f7' },
  ];

  return (
    <div className="dashboard-page">
      <div className="dashboard-inner">
        
        {/* ── Hero Banner ── */}
        <div 
          className="dashboard-hero"
          style={{ 
            background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '20px',
            flexShrink: 0
          }}
        >
          {/* Ambient glow */}
          <div style={{
            position: 'absolute',
            top: '-50%',
            right: '-10%',
            width: '500px',
            height: '500px',
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)',
            filter: 'blur(60px)',
            zIndex: 1
          }}></div>
          <div style={{
            position: 'absolute',
            bottom: '-30%',
            left: '10%',
            width: '300px',
            height: '300px',
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, transparent 70%)',
            filter: 'blur(50px)',
            zIndex: 1
          }}></div>

          <div className="hero-content">
            <div className="badge">
              <Sparkles size={14} className="sparkle-icon" />
              <span>v2.0 Intelligent Workspace</span>
            </div>
            <h1>Explore the Power of Nexus AI</h1>
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
                background: tool.bg,
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
