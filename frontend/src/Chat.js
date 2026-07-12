import React, { useState, useRef, useEffect, useContext } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Bot, ClipboardPaste, Mic, ExternalLink, Sparkles, Camera, X } from "lucide-react";
import { AppContext } from "./App";
import { tableComponents } from "./utils/TableRenderer";
import { injectTableStyles } from "./utils/tableStyles";
import { speak as voiceSpeak, stopSpeaking, startKeepAlive, stopKeepAlive } from "./utils/voiceEngine";
import API_BASE_URL, { IS_MISCONFIGURED } from "./apiConfig";
import { PreRenderer } from "./utils/PreRenderer";

import { useLocation } from "react-router-dom";

// Inject table styles on component mount
injectTableStyles();


function Chat() {
  const location = useLocation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState(() => {
    const transfer = localStorage.getItem("prefilled_prompt_transfer");
    if (transfer) {
      localStorage.removeItem("prefilled_prompt_transfer");
      return transfer;
    }
    return location.state?.prefilledPrompt || "";
  });

  useEffect(() => {
    const transfer = localStorage.getItem("prefilled_prompt_transfer");
    if (transfer) {
      setInput(transfer);
      localStorage.removeItem("prefilled_prompt_transfer");
    } else if (location.state?.prefilledPrompt) {
      setInput(location.state.prefilledPrompt);
    }
  }, [location.state]);
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [imagePreview, setImagePreview] = useState(null); // base64 data URL for preview & sending
  const imageInputRef = useRef(null);
  const { ttsEnabled, addRecentChat, user, voicePreset, customVoiceUrl } = useContext(AppContext);
  const displayName = localStorage.getItem("nexus_user_name") || user?.displayName || (user?.email ? user.email.split('@')[0] : "User");
  const ttsEnabledRef = useRef(ttsEnabled);
  useEffect(() => {
    ttsEnabledRef.current = ttsEnabled;
    if (!ttsEnabled) {
      stopSpeaking();
      stopKeepAlive();
    } else {
      startKeepAlive();
    }
    return () => stopKeepAlive();
  }, [ttsEnabled]);

  const storageKey = user?.email ? `nexus_chat_history_${user.email}` : 'nexus_chat_history_anonymous';

  // Load persisted chat history for this session on component mount or when user changes
  useEffect(() => {
    const legacy = localStorage.getItem('nexus_chat_history');
    if (legacy) {
      localStorage.removeItem('nexus_chat_history');
    }

    const stored = sessionStorage.getItem(storageKey);
    if (stored) {
      try {
        setMessages(JSON.parse(stored));
      } catch (e) {
        console.warn('Failed to parse chat history', e);
      }
    }
  }, [storageKey]);

  // Persist chat history in sessionStorage so it survives route switches but clears when the browser/tab closes
  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify(messages));
  }, [messages, storageKey]);


  // prompt modal moved to dedicated Prompt Manager page
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSpeak = async (text) => {
    await voiceSpeak(text, { voicePreset, customVoiceUrl, ttsEnabledRef });
  };

  const sendMessage = async (text = input) => {
    if (!text.trim() || loading) return;
    addRecentChat(text);
    setLoading(true);
    setInput("");
    const imageToBeSent = imagePreview;
    setImagePreview(null); // clear preview after capturing

    const userMsgId = Date.now() + Math.random();
    const aiMsgId = Date.now() + Math.random();
    setMessages((prev) => [...prev, { id: userMsgId, text: text, sender: "user" }, { id: aiMsgId, text: "", sender: "ai" }]);

    // Prepare history (last 10 messages for context)
    const history = messages.slice(-10).map(msg => ({
      role: msg.sender === "user" ? "user" : "assistant",
      content: msg.text
    })).filter(msg => msg.content); // Filter out empty messages (like the typing indicator)

    const payload = {
      message: text,
      userName: displayName,
      userEmail: user?.email || localStorage.getItem("nexus_mock_user") || "Anonymous",
      history: history,
      ...(imageToBeSent ? { image: imageToBeSent } : {})
    };

    // ── Dual-endpoint fallback ──
    // 1st try: Render backend (API_BASE_URL)
    // 2nd try: Vercel same-origin /api/chat (always available)
    const endpoints = [];
    if (API_BASE_URL && !API_BASE_URL.includes("localhost")) {
      endpoints.push(`${API_BASE_URL}/api/chat`);
    }
    // Always add Vercel same-origin as fallback (works on Vercel deployment)
    endpoints.push("/api/chat");
    // If on localhost, also try local backend
    if (API_BASE_URL && API_BASE_URL.includes("localhost")) {
      endpoints.unshift(`${API_BASE_URL}/api/chat`);
    }

    let response = null;
    let lastErr = "";

    for (const endpoint of endpoints) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12000); // 12s timeout
        const r = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (r.ok) { response = r; break; }
        lastErr = `${endpoint} failed (${r.status})`;
      } catch (e) {
        lastErr = e.message;
        console.warn(`⚠️ Endpoint failed: ${endpoint} —`, e.message);
      }
    }

    try {
      if (!response) throw new Error(lastErr || "All endpoints failed.");

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
      await handleSpeak(aiReply);

    } catch (error) {
      let errorMsg = error.message;
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

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("Please select an image file."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
    // Reset input so the same file can be re-selected
    e.target.value = "";
  };

  const removeImage = () => setImagePreview(null);

  const startListening = () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      alert("Speech recognition is not supported. Use Chrome or Edge.");
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    // Use Hindi recognition when the user has selected the Hindi Jarvis voice preset.
    recognition.lang = voicePreset === 'ironman_hi' ? 'hi-IN' : 'en-IN';
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
                  <img src={user?.photoURL || "https://ui-avatars.com/api/?name=" + encodeURIComponent(displayName)} alt="You" style={{ width: '100%', height: '100%' }} />
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
                    <ReactMarkdown components={{ a: LinkRenderer, pre: PreRenderer, ...tableComponents }}>{msg.text}</ReactMarkdown>
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
        {/* Image preview strip */}
        {imagePreview && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 16px 0", flexWrap: "wrap" }}>
            <div style={{ position: "relative", display: "inline-block" }}>
              <img src={imagePreview} alt="Attached" style={{ height: "64px", borderRadius: "10px", border: "2px solid #6366f1", objectFit: "cover" }} />
              <button
                onClick={removeImage}
                style={{ position: "absolute", top: "-8px", right: "-8px", background: "#ef4444", border: "none", borderRadius: "50%", width: "20px", height: "20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "white", padding: 0 }}
                title="Remove image"
              >
                <X size={12} />
              </button>
            </div>
            <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Image attached — ask anything about it</span>
          </div>
        )}
        <div className="input-box-wrapper">
          {/* Hidden file input */}
          <input ref={imageInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageSelect} />

          {/* LEFT: Paste button */}
          <button className="action-btn" title="Paste" onClick={handlePaste}>
            <ClipboardPaste size={20} />
          </button>

          {/* CENTER: Textarea */}
          <textarea
            className="chat-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={imagePreview ? "Ask about the image..." : "Send a message..."}
            rows="1"
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !loading) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />

          {/* RIGHT: Camera + Mic + Send */}
          <div className="input-actions-right">
            <button
              className="action-btn"
              title="Upload Image"
              onClick={() => imageInputRef.current?.click()}
              style={imagePreview ? { color: "#6366f1" } : {}}
            >
              <Camera size={20} color={imagePreview ? "#6366f1" : "var(--text-secondary)"} />
            </button>
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
              disabled={loading || (!input.trim() && !imagePreview)}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Chat;
