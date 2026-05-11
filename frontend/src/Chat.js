import React, { useState, useRef, useEffect, useContext } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Bot, ClipboardPaste, Mic, ExternalLink, Sparkles } from "lucide-react";
import { AppContext } from "./App";
import API_BASE_URL, { IS_MISCONFIGURED } from "./apiConfig";
   

function Chat() {
  const { ttsEnabled, addRecentChat, user } = useContext(AppContext);
  const ttsEnabledRef = useRef(ttsEnabled);
  useEffect(() => {
    ttsEnabledRef.current = ttsEnabled;
    if (!ttsEnabled) window.speechSynthesis.cancel();
  }, [ttsEnabled]);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const speak = (text) => {
    if (!ttsEnabledRef.current) return;
    window.speechSynthesis.cancel();
    const cleaned = text.replace(/[#*`>_~[\]]/g, "").trim();
    const utterance = new SpeechSynthesisUtterance(cleaned);
    utterance.lang = "hi-IN";
    utterance.rate = 0.95;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  const sendMessage = async (text = input) => {
    if (!text.trim() || loading) return;
    addRecentChat(text);
    setLoading(true);
    setInput("");

    const userMsgId = Date.now() + Math.random();
    const aiMsgId = Date.now() + Math.random();
    setMessages((prev) => [...prev, { id: userMsgId, text: text, sender: "user" }, { id: aiMsgId, text: "", sender: "ai" }]);

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: text,
          userName: user?.displayName || user?.email?.split('@')[0] || "User"
        }),
      });

      if (!response.ok) throw new Error(`Backend connection failed (${response.status}). If you are on Vercel, make sure REACT_APP_BACKEND_URL is set.`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiReply = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          
          const dataStr = trimmed.slice(6);
          if (dataStr === "[DONE]") continue;

          try {
            const data = JSON.parse(dataStr);
            if (data.error) throw new Error(data.error);
              if (data.content) {
                const content = data.content;
                aiReply += content;
                
                setMessages((prev) => 
                  prev.map(msg => msg.id === aiMsgId ? { ...msg, text: msg.text + content } : msg)
                );
              }


          } catch (e) { }
        }
      }
      speak(aiReply);

    } catch (error) {
      let errorMsg = error.message;
      if (errorMsg === "Failed to fetch" && window.location.hostname !== "localhost" && API_BASE_URL.includes("localhost")) {
        errorMsg = "Backend is not configured! Please add your Render backend URL as REACT_APP_BACKEND_URL in Vercel settings.";
      }
      setMessages((prev) => 
        prev.map(msg => msg.id === aiMsgId ? { ...msg, text: `⚠️ **Error:** ${errorMsg}` } : msg)
      );
    }
    setLoading(false);
  };



  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInput((prev) => prev + text);
    } catch (err) {
      alert("Clipboard access denied. Please allow clipboard permissions.");
    }
  };

  const startListening = () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      alert("Speech recognition is not supported. Use Chrome or Edge.");
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "hi-IN";
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join("");
      setInput(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const LinkRenderer = ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: "#60a5fa", textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: "4px" }}
    >
      {children} <ExternalLink size={12} />
    </a>
  );

  return (
    <div className="chat-container">
      {IS_MISCONFIGURED && (
        <div style={{ background: '#ef444422', border: '1px solid #ef444444', padding: '12px', margin: '16px', borderRadius: '12px', color: '#f87171', fontSize: '13px', textAlign: 'center' }}>
          <strong>⚠️ Backend URL not set!</strong> Please add <code>REACT_APP_BACKEND_URL</code> in Vercel settings.
        </div>
      )}
      <div className="chat-history-scroll">
        {messages.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "16px", marginTop: "8vh" }}>
            <div style={{ width: "84px", height: "84px", borderRadius: "50%", background: "linear-gradient(135deg, #2563eb, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 30px rgba(37, 99, 235, 0.4)" }}>
              <Sparkles size={40} color="white" />
            </div>
            <div style={{ textAlign: "center" }}>
              <h2 style={{ fontSize: "32px", fontWeight: "800", color: "#ffffff", letterSpacing: "-1px" }}>Welcome to Nexus!</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "16px", marginTop: "8px" }}>Your intelligent AI workspace.</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginTop: "24px", maxWidth: "620px", width: "100%" }}>
              {[
                { title: "Quantum Computing", sub: "Explain it in simple terms" },
                { title: "Debug Code", sub: "Help me find bugs in my code" },
                { title: "Translation", sub: "Translate English to Spanish" },
                { title: "Email Writing", sub: "Write a professional email" },
              ].map((s, i) => (
                <div
                  key={i}
                  className="dashboard-card"
                  onClick={() => sendMessage(s.sub)}
                  style={{ 
                    padding: "18px", 
                    cursor: "pointer", 
                    background: "rgba(255, 255, 255, 0.05)", 
                    border: "1px solid rgba(255, 255, 255, 0.08)", 
                    borderRadius: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    transition: "all 0.3s ease"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                    e.currentTarget.style.borderColor = "var(--accent)";
                    e.currentTarget.style.transform = "translateY(-4px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                    e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  <div style={{ fontSize: "15px", fontWeight: "600", color: "#e2e8f0" }}>{s.title}</div>
                  <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, index) => (
          <React.Fragment key={index}>
            <div className={`chat-message-row ${msg.sender === "user" ? "user-row" : "ai-row"}`}>
              <div className={`message-avatar ${msg.sender === "user" ? "user-av" : "ai-av"}`} style={msg.sender === "user" ? { padding: 0, overflow: 'hidden' } : {}}>
                {msg.sender === "user" ? (
                  <img src={user?.photoURL || "https://ui-avatars.com/api/?name=" + (user?.displayName || user?.email)} alt="You" style={{ width: '100%', height: '100%' }} />
                ) : <Bot size={20} color="white" />}
              </div>
              <div className="message-body">
                <div className="message-sender">
                  {msg.sender === "user" ? "You" : "Nexus AI"}
                </div>
                <div className={`message-content ${msg.sender === "user" ? "user-text" : ""}`}>
                  {msg.sender === "user" ? (
                    msg.text
                  ) : msg.text ? (
                    <ReactMarkdown components={{ a: LinkRenderer }}>{msg.text}</ReactMarkdown>
                  ) : (
                    <div className="typing-indicator">
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <hr className="message-divider" />
          </React.Fragment>
        ))}

        <div ref={messagesEndRef} />
      </div>

      <div className="input-container">
        <div className="input-box-wrapper" style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', borderRadius: '24px', gap: '12px' }}>
          <button className="action-btn" title="Paste" onClick={handlePaste} style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ClipboardPaste size={20} />
          </button>
          
          <textarea
            className="chat-textarea"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '16px', color: 'var(--text-primary)', resize: 'none', padding: '8px 0' }}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Send a message..."
            rows="1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />

          <button 
            className={`action-btn ${isListening ? "listening" : ""}`} 
            title="Voice Input" 
            onClick={startListening} 
            style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Mic size={20} color={isListening ? "#ef4444" : "var(--text-secondary)"} />
          </button>

          <button 
            className="send-btn" 
            onClick={() => sendMessage()} 
            disabled={loading || !input.trim()}
            style={{ 
              width: '40px', 
              height: '40px', 
              borderRadius: '12px', 
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              color: 'white',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
            }}
          >
            <Send size={18} />
          </button>
        </div>
        <div className="disclaimer">Nexus ca make mistakes. Verify upload information.</div>
      </div>
    </div>
  );
}

export default Chat;
