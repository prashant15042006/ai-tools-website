import React, { useState, useRef, useEffect, useContext } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, ClipboardPaste, Mic, ExternalLink, Code, Sparkles, Camera, X } from "lucide-react";
import { tableComponents } from "./utils/TableRenderer";
import { injectTableStyles } from "./utils/tableStyles";
import { AppContext } from "./App";
import { speak as voiceSpeak, stopSpeaking, startKeepAlive, stopKeepAlive } from "./utils/voiceEngine";
import API_BASE_URL, { IS_PROD } from "./apiConfig";
import { PreRenderer } from "./utils/PreRenderer";
import { generateOfflineResponse } from "./utils/offlineAiEngine";
import { addBlockToLedger, cacheResponseForOffline } from "./utils/blockchainLedger";

// Inject table styles on component mount
injectTableStyles();

function CodeGenerator() {
  const { ttsEnabled, addRecentChat, user, voicePreset, customVoiceUrl } = useContext(AppContext);
  const displayName = user?.displayName || (user?.email ? user.email.split('@')[0] : "User");
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

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const imageInputRef = useRef(null);
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
    addRecentChat("Code: " + text);
    setInput("");
    setLoading(true);
    const imageToBeSent = imagePreview;
    setImagePreview(null);

    const userMsgId = Date.now() + Math.random();
    const aiMsgId = Date.now() + Math.random();
    // Store image in user message so it renders in the chat bubble
    setMessages((prev) => [...prev, { id: userMsgId, text: text, sender: "user", image: imageToBeSent || null }, { id: aiMsgId, text: "", sender: "ai" }]);

    // Prepare conversation history (last 10 messages) so AI remembers context
    const history = messages.slice(-10).map(msg => ({
      role: msg.sender === "user" ? "user" : "assistant",
      content: msg.text
    })).filter(msg => msg.content);

    const payload = {
      message: "Generate code: " + text,
      userName: displayName,
      history: history,
      ...(imageToBeSent ? { image: imageToBeSent } : {})
    };
    const endpoints = [];
    if (IS_PROD) {
      if (API_BASE_URL) endpoints.push(`${API_BASE_URL}/api/chat`);
      endpoints.push("/api/chat");
    } else {
      if (API_BASE_URL) endpoints.push(`${API_BASE_URL}/api/chat`);
    }

    // ── Instant Offline Check ──
    if (!navigator.onLine) {
      const offlineReply = generateOfflineResponse(text, "code");
      const block = await addBlockToLedger(text, offlineReply, true);
      setMessages((prev) =>
        prev.map(msg => msg.id === aiMsgId ? {
          ...msg,
          text: offlineReply,
          isOffline: true,
          blockchainBlock: block
        } : msg)
      );
      setLoading(false);
      handleSpeak(offlineReply);
      return;
    }

    let response = null;
    let lastErr = "";
    for (const endpoint of endpoints) {
      try {
        const controller = new AbortController();
        const timeoutMs = imageToBeSent ? 60000 : 2000;
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: controller.signal });
        clearTimeout(timer);
        if (r.ok) { response = r; break; }
        lastErr = `${endpoint} failed (${r.status})`;
      } catch (e) { lastErr = e.message; }
    }

    try {
      if (!response || !navigator.onLine) {
        throw new Error(lastErr || "Offline / Network unavailable");
      }

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
            if (data.replace) {
              // Backend sent a cleaned replacement (safety labels stripped)
              aiReply = data.replace;
              setMessages((prev) =>
                prev.map(msg => msg.id === aiMsgId ? { ...msg, text: data.replace } : msg)
              );
            } else if (data.content) {
                const content = data.content;
                aiReply += content;
                
                setMessages((prev) => 
                  prev.map(msg => msg.id === aiMsgId ? { ...msg, text: msg.text + content } : msg)
                );
              }


          } catch (e) { }
        }
      }
      cacheResponseForOffline(text, aiReply);
      const block = await addBlockToLedger(text, aiReply, false);
      setMessages((prev) =>
        prev.map(msg => msg.id === aiMsgId ? { ...msg, blockchainBlock: block } : msg)
      );
      handleSpeak(aiReply);
    } catch (error) {
      console.warn("Code Generator API failed, triggering Nexuss Offline AI Engine:", error.message);
      const offlineReply = generateOfflineResponse(text, "code");
      const block = await addBlockToLedger(text, offlineReply, true);

      setMessages((prev) => 
        prev.map(msg => msg.id === aiMsgId ? { 
          ...msg, 
          text: offlineReply,
          isOffline: true,
          blockchainBlock: block
        } : msg)
      );
      handleSpeak(offlineReply);
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
    recognition.lang = "en-IN";
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
                   <img src={user?.photoURL || "https://ui-avatars.com/api/?name=" + encodeURIComponent(displayName)} alt="You" style={{ width: '100%', height: '100%' }} />
                ) : <Code size={20} color="white" />}
              </div>
              <div className="message-body">
                <div className="message-sender">
                  {msg.sender === "user" ? "You" : "Nexuss Code AI"}
                </div>
                <div className={`message-content ${msg.sender === "user" ? "user-text" : ""}`}>
                  {msg.sender === "user" ? (
                    <>
                      {msg.image && (
                        <div style={{ marginBottom: "8px" }}>
                          <img
                            src={msg.image}
                            alt="Uploaded"
                            style={{ maxWidth: "220px", maxHeight: "180px", borderRadius: "10px", border: "2px solid #10b981", objectFit: "cover", display: "block" }}
                          />
                        </div>
                      )}
                      {msg.text}
                    </>
                  ) : (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: LinkRenderer, pre: PreRenderer, ...tableComponents }}>{msg.text}</ReactMarkdown>
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
        {imagePreview && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 16px 0", flexWrap: "wrap" }}>
            <div style={{ position: "relative", display: "inline-block" }}>
              <img src={imagePreview} alt="Attached" style={{ height: "64px", borderRadius: "10px", border: "2px solid #10b981", objectFit: "cover" }} />
              <button onClick={removeImage} style={{ position: "absolute", top: "-8px", right: "-8px", background: "#ef4444", border: "none", borderRadius: "50%", width: "20px", height: "20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "white", padding: 0 }} title="Remove image">
                <X size={12} />
              </button>
            </div>
            <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Image attached — ask about the code/UI</span>
          </div>
        )}
        <div className="input-box-wrapper">
          <input ref={imageInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageSelect} />
          {/* LEFT: Paste button */}
          <button className="action-btn" title="Paste from Clipboard" onClick={handlePaste}>
            <ClipboardPaste size={20} />
          </button>
          {/* CENTER: Textarea */}
          <textarea
            className="chat-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={imagePreview ? "Describe the code or ask about the image..." : (isListening ? "Listening..." : "send a message...")}
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
            <button className="action-btn" title="Upload Image" onClick={() => imageInputRef.current?.click()}>
              <Camera size={20} color={imagePreview ? "#10b981" : "var(--text-secondary)"} />
            </button>
            <button
              className={`action-btn ${isListening ? "listening" : ""}`}
              title={isListening ? "Listening..." : "Voice Input"}
              onClick={startListening}
            >
              <Mic size={20} color={isListening ? "#ef4444" : "var(--text-secondary)"} />
            </button>
            <button className="send-btn" onClick={() => sendMessage()} disabled={loading || (!input.trim() && !imagePreview)}>
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CodeGenerator;
