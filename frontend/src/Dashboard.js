import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Code, PenTool, ArrowRight, Sparkles } from 'lucide-react';
import './App.css';

const Dashboard = () => {
  const navigate = useNavigate();

  const tools = [
    {
      title: 'AI Chat',
      description: 'Interact with our advanced AI for brainstorming, analysis, and general assistance.',
      icon: MessageSquare,
      path: '/chat',
      bg: '/assets/chat_bg.png',
      color: '#06b6d4', // Cyan
    },
    {
      title: 'Code Generator',
      description: 'Generate high-quality code, debug snippets, and explain complex algorithms.',
      icon: Code,
      path: '/code',
      bg: '/assets/code_bg.png',
      color: '#8b5cf6', // Purple
    },
    {
      title: 'Content Writer',
      description: 'Create compelling articles, social media posts, and professional emails in seconds.',
      icon: PenTool,
      path: '/content',
      bg: '/assets/content_bg.png',
      color: '#f59e0b', // Orange
    }
  ];

  return (
    <div className="dashboard-page">
      <div 
        className="dashboard-hero"
        style={{ backgroundImage: "url('/assets/dashboard_hero.png')" }}
      >
        <div className="hero-content">
          <div className="badge">
            <Sparkles size={14} className="sparkle-icon" />
            <span>Next-Gen AI Workspace</span>
          </div>
          <h1>Welcome to Nexus AI</h1>
          <p>The all-in-one creative suite powered by state-of-the-art artificial intelligence.</p>
        </div>
      </div>

      <div className="dashboard-grid">
        {tools.map((tool, index) => (
          <div 
            key={index} 
            className="tool-card"
            onClick={() => navigate(tool.path)}
            style={{ 
              backgroundImage: `linear-gradient(to bottom, rgba(15, 23, 42, 0.4), rgba(15, 23, 42, 0.8)), url(${tool.bg})`
            }}
          >
            <div className="card-icon" style={{ backgroundColor: `${tool.color}22`, color: tool.color }}>
              <tool.icon size={28} />
            </div>
            <div className="card-info">
              <h3>{tool.title}</h3>
              <p>{tool.description}</p>
              <div className="card-action">
                <span>Launch Tool</span>
                <ArrowRight size={16} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
