import React, { useState, useRef, useEffect, useContext } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Bot, ClipboardPaste, Mic, ExternalLink, Sparkles } from "lucide-react";
import { AppContext } from "./App";
import { tableComponents } from "./components/TableRenderer";
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
  // prompt modal moved to dedicated Prompt Manager page
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

    // Prepare history (last 10 messages for context)
    const history = messages.slice(-10).map(msg => ({
      role: msg.sender === "user" ? "user" : "assistant",
      content: msg.text
    })).filter(msg => msg.content); // Filter out empty messages (like the typing indicator)

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: text,
          userName: localStorage.getItem("nexus_user_name") || user?.displayName || user?.email?.split('@')[0] || "User",
          history: history
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
            <div style={{ flexShrink: 0, width: "64px", height: "64px", borderRadius: "50%", background: "linear-gradient(135deg, #2563eb, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 30px rgba(37, 99, 235, 0.4)", margin: "0 auto" }}>
              <Sparkles size={32} color="white" />
            </div>
            <div style={{ textAlign: "center" }}>
              <h2 style={{ fontSize: "32px", fontWeight: "800", color: "#ffffff", letterSpacing: "-1px" }}>Welcome to Nexuss!</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "16px", marginTop: "8px" }}>Your intelligent AI workspace.</p>
            </div>
            <div className="chat-suggestions-grid chat-suggestions">
              {[
                { title: "Quantum Computing", sub: "Explain it in simple terms" },
                { title: "Debug Code", sub: "Help me find bugs in my code" },
                { title: "Translation", sub: "Translate English to Spanish" },
                { title: "Email Writing", sub: "Write a professional email" },
              ].map((s, i) => {
                return (
                  <div 
                    key={i} 
                    className="suggestion-card" 
                    onClick={() => sendMessage(s.sub)}
                  >
                    <div className="suggestion-card-content">
                      <div className="suggestion-card-title">{s.title}</div>
                      <div className="suggestion-card-sub">{s.sub}</div>
                    </div>
                    <Sparkles size={16} className="suggestion-card-icon" />
                  </div>
                );
              })}
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
                  {msg.sender === "user" ? "You" : "Nexuss AI"}
                </div>
                <div className={`message-content ${msg.sender === "user" ? "user-text" : ""}`}>
                  {msg.sender === "user" ? (
                    msg.text
                  ) : msg.text ? (
                    <ReactMarkdown components={{ a: LinkRenderer, ...tableComponents }}>{msg.text}</ReactMarkdown>
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

      {/* Prompt editing moved to the Prompts page in the sidebar */}

      <div className="input-container">
        <div className="input-box-wrapper">
          <button className="action-btn" title="Paste" onClick={handlePaste}>
            <ClipboardPaste size={20} />
          </button>
          
          <textarea
            className="chat-textarea"
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
          >
            <Mic size={20} color={isListening ? "#ef4444" : "var(--text-secondary)"} />
          </button>

          <button 
            className="send-btn" 
            onClick={() => sendMessage()} 
            disabled={loading || !input.trim()}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default Chat;
