import React, { useState, useRef, useEffect, useContext } from "react";
import ReactMarkdown from "react-markdown";
import { Send, ClipboardPaste, Mic, ExternalLink, Code, Sparkles } from "lucide-react";

import { AppContext } from "./App";
import API_BASE_URL from "./apiConfig";

function CodeGenerator() {
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
    addRecentChat("Code: " + text);
    setInput("");
    setLoading(true);

    const userMsgId = Date.now() + Math.random();
    const aiMsgId = Date.now() + Math.random();
    setMessages((prev) => [...prev, { id: userMsgId, text: text, sender: "user" }, { id: aiMsgId, text: "", sender: "ai" }]);

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: "Generate code: " + text,
          userName: user?.displayName || user?.email?.split('@')[0] || "User"
        }),
      });

      if (!response.ok) throw new Error("Backend connection failed");

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
      setMessages((prev) => 
        prev.map(msg => msg.id === aiMsgId ? { ...msg, text: `⚠️ **Error:** ${error.message}` } : msg)
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
      <div className="chat-history-scroll">
        {messages.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "16px", marginTop: "8vh" }}>
            <div style={{ flexShrink: 0, width: "64px", height: "64px", borderRadius: "50%", background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
              <Code size={32} color="white" />
            </div>
            <h2 style={{ fontSize: "28px", fontWeight: "700", color: "var(--text-primary)" }}>Code Generator</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "16px", maxWidth: "480px", textAlign: "center" }}>
              Generate, explain, and debug code instantly. Type your requirements below.
            </p>
            <div className="chat-suggestions-grid code-suggestions" style={{ marginTop: "16px" }}>
              {[
                { title: "React Counter", sub: "with hooks and styling" },
                { title: "Python Web Scraper", sub: "using BeautifulSoup" },
                { title: "Responsive Navbar", sub: "with glassmorphism effect" },
                { title: "Node.js Auth API", sub: "using JWT and Express" },
              ].map((s, i) => (
                <div
                  key={i}
                  className="suggestion-card"
                  onClick={() => sendMessage("Generate: " + s.title + " " + s.sub)}
                >
                  <div className="suggestion-card-content">
                    <div className="suggestion-card-title">{s.title}</div>
                    <div className="suggestion-card-sub">{s.sub}</div>
                  </div>
                  <Sparkles size={16} className="suggestion-card-icon" />
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
                ) : <Code size={20} color="white" />}
              </div>
              <div className="message-body">
                <div className="message-sender">
                  {msg.sender === "user" ? "You" : "Nexuss Code AI"}
                </div>
                <div className={`message-content ${msg.sender === "user" ? "user-text" : ""}`}>
                  {msg.sender === "user" ? (
                    msg.text
                  ) : (
                    <ReactMarkdown components={{ a: LinkRenderer }}>{msg.text}</ReactMarkdown>
                  )}
                </div>
              </div>
            </div>
            <hr className="message-divider" />
          </React.Fragment>
        ))}

        {loading && (
          <>
            <div className="chat-message-row ai-row">
              <div className="message-avatar ai-av">
                <Code size={20} color="white" />
              </div>
              <div className="message-body">
                <div className="message-sender">Nexuss Code AI</div>
                <div className="typing-indicator">
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                </div>
              </div>
            </div>
            <hr className="message-divider" />
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-container">
        <div className="input-box-wrapper">
          <button className="action-btn" title="Paste from Clipboard" onClick={handlePaste}>
            <ClipboardPaste size={20} />
          </button>
          <textarea
            className="chat-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isListening ? "Listening..." : "send a message..."}
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
            title={isListening ? "Listening..." : "Voice Input"}
            onClick={startListening}
          >
            <Mic size={20} color={isListening ? "#ef4444" : "var(--text-secondary)"} />
          </button>
          <button className="send-btn" onClick={() => sendMessage()} disabled={loading || !input.trim()}>
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default CodeGenerator;
