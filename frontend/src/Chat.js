import React, { useState, useRef, useEffect, useContext } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Bot, ClipboardPaste, Mic, ExternalLink, Sparkles, Camera, X, Download } from "lucide-react";
import { AppContext } from "./App";
import { tableComponents } from "./utils/TableRenderer";
import { injectTableStyles } from "./utils/tableStyles";
import { speak as voiceSpeak, stopSpeaking, startKeepAlive, stopKeepAlive } from "./utils/voiceEngine";
import API_BASE_URL, { IS_MISCONFIGURED } from "./apiConfig";
import { PreRenderer } from "./utils/PreRenderer";

import { useLocation } from "react-router-dom";

// Inject table styles on component mount
injectTableStyles();


function detectRatioFromPrompt(promptText) {
  const p = promptText.toLowerCase();
  if (/\b16[:\sx]9\b/.test(p) || /\blandscape\s*ratio\b/.test(p) || /\bwidescreen\b/.test(p)) return "16:9";
  if (/\b9[:\sx]16\b/.test(p) || /\bportrait\s*ratio\b/.test(p) || /\bvertical\s*ratio\b/.test(p)) return "9:16";
  if (/\b4[:\sx]3\b/.test(p) || /\bclassic\s*ratio\b/.test(p)) return "4:3";
  if (/\b1[:\sx]1\b/.test(p) || /\bsquare\s*ratio\b/.test(p)) return "1:1";
  if (/\b(16x9|16[/]9)\b/.test(p)) return "16:9";
  if (/\b(9x16|9[/]16)\b/.test(p)) return "9:16";
  if (/\b(4x3|4[/]3)\b/.test(p)) return "4:3";
  return null;
}

// Strip safety rating labels that some AI models inject into responses
function cleanFrontendResponse(text) {
  if (!text) return text;
  return text
    .replace(/^(User Safety|Response Safety|Content Safety|Safety Rating|Input Safety|Output Safety)\s*:\s*.+$/gim, "")
    .replace(/\{?\s*"?(user_safety|response_safety|content_filter|safety_rating)"?\s*:\s*"?\w+"?\s*\}?,?/gi, "")
    .replace(/^\s*[\r\n]/gm, "")
    .trim();
}

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
    // Store image in user message so it renders in the chat bubble
    setMessages((prev) => [...prev, { id: userMsgId, text: text, sender: "user", image: imageToBeSent || null }, { id: aiMsgId, text: "", sender: "ai" }]);

    const isImageRequest = (promptText) => {
      const p = promptText.toLowerCase().trim();
      if (/\b(code|coding|script|program|programming|function|class|algorithm|html|css|javascript|js|python|java|c\+\+|c#|php|ruby|swift|golang|rust|typescript|ts|sql)\b/i.test(p)) {
        return false;
      }
      const triggers = [
        "generate image", "generate photo", "generate picture", "generate painting", "generate artwork", "generate sketch",
        "create image", "create photo", "create picture", "create painting", "create artwork", "create sketch",
        "make image", "make photo", "make picture", "make painting", "make artwork", "make sketch",
        "draw image", "draw photo", "draw picture", "draw painting", "draw artwork", "draw sketch",
        "paint image", "paint photo", "paint picture", "paint painting", "paint artwork", "paint sketch",
        "image generate", "photo generate", "picture generate", "painting generate", "artwork generate", "sketch generate",
        "image bana", "photo bana", "picture bana", "painting bana", "artwork bana", "sketch bana", "tasveer bana", "chitra bana",
        "generate an image", "generate a photo", "generate a picture", "generate a painting", "generate a sketch",
        "create an image", "create a photo", "create a picture", "create a painting", "create a sketch",
        "make an image", "make a photo", "make a picture", "make a painting", "make a sketch",
        "draw an image", "draw a photo", "draw a picture", "draw a painting", "draw a sketch",
        "paint an image", "paint a photo", "paint a picture", "paint a painting", "paint a sketch",
        "photo bana ke do", "image bana ke do", "picture bana ke do", "tasveer bana ke do",
        "photo bana do", "image bana do", "picture bana do", "tasveer bana do",
        "photo banake do", "image banake do", "picture banake do", "tasveer banake do"
      ];
      return triggers.some(t => p.includes(t)) || /^(generate|create|make|draw|paint)\s+(an?\s+)?(image|photo|picture|painting|artwork|sketch|portrait|illustration)\b/i.test(p);
    };

    const cleanImagePrompt = (promptText) => {
      let cleaned = promptText
        .replace(/^(generate|create|make|draw|paint|show|display|please|mujhhe|mujhe)\s+(an?\s+)?(image|photo|picture|painting|artwork|sketch|portrait|illustration)\s+(of|about|for)?\s+/i, "")
        .replace(/(image|photo|picture|painting|artwork|sketch|portrait|illustration)\s+(generate|create|make|draw|paint|bana)\s+(kar\s+)?(ke\s+)?(do|karo|de|dijiye)\s*/i, "")
        .trim();
      return cleaned || promptText;
    };

    if (isImageRequest(text)) {
      const cleanedPrompt = cleanImagePrompt(text);
      setMessages((prev) => 
        prev.map(msg => msg.id === aiMsgId ? { 
          ...msg, 
          text: "Generating your image...", 
          isImageResult: true, 
          imageLoading: true,
          promptText: cleanedPrompt
        } : msg)
      );

      const generate = async (retryCount = 0) => {
        try {
          const ratioStr = detectRatioFromPrompt(cleanedPrompt) || "1:1";
          // Use smaller dimensions on mobile for faster generation
          const isMobile = window.innerWidth <= 768;
          let width = isMobile ? 768 : 1024;
          let height = isMobile ? 768 : 1024;
          if (ratioStr === "16:9") { width = isMobile ? 960 : 1344; height = isMobile ? 540 : 768; }
          else if (ratioStr === "9:16") { width = isMobile ? 540 : 768; height = isMobile ? 960 : 1344; }
          else if (ratioStr === "4:3") { width = isMobile ? 800 : 1024; height = isMobile ? 600 : 768; }

          const seed = Math.floor(Math.random() * 999999);
          const genUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanedPrompt)}?width=${width}&height=${height}&model=flux&seed=${seed}&nologo=true&enhance=true`;

          // Use fetch instead of window.Image - much more reliable on mobile browsers
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 90000); // 90s timeout for image gen
          const response = await fetch(genUrl, { signal: controller.signal });
          clearTimeout(timer);

          if (response.ok) {
            // Convert blob to object URL for display - works perfectly on mobile
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            setMessages((prev) =>
              prev.map(msg => msg.id === aiMsgId ? {
                ...msg,
                text: "",
                imageUrl: objectUrl,
                imageDownloadUrl: genUrl, // keep original URL for download
                imageLoading: false,
                seed,
                ratio: ratioStr
              } : msg)
            );
            setLoading(false);
          } else {
            throw new Error(`Image service returned ${response.status}`);
          }
        } catch (err) {
          if (retryCount === 0 && err.name !== 'AbortError') {
            // Retry once with a different seed
            generate(1);
          } else {
            setMessages((prev) =>
              prev.map(msg => msg.id === aiMsgId ? {
                ...msg,
                text: "⚠️ Image generation failed. Please try again or use a simpler prompt.",
                imageLoading: false
              } : msg)
            );
            setLoading(false);
          }
        }
      };

      generate(0);
      return;
    }

    // Prepare history (last 10 messages for context)
    const history = messages.slice(-10).map(msg => ({
      role: msg.sender === "user" ? "user" : "assistant",
      content: msg.text
    })).filter(msg => msg.content); // Filter out empty messages (like the typing indicator)

    let finalMsg = text;

    const payload = {
      message: finalMsg,
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
        // Mobile gets 40s timeout, desktop 30s, image sends get 90s
        const timeoutMs = imageToBeSent ? 90000 : 40000;
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const r = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (r.ok) { response = r; break; }
        lastErr = `${endpoint} failed (${r.status})`;
        // Don't try more endpoints for server errors (4xx)
        if (r.status >= 400 && r.status < 500) break;
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
            if (data.replace) {
              // Backend sent a cleaned replacement (safety labels stripped)
              const cleaned = cleanFrontendResponse(data.replace);
              aiReply = cleaned;
              setMessages((prev) =>
                prev.map(msg => msg.id === aiMsgId ? { ...msg, text: cleaned } : msg)
              );
            } else if (data.content) {
                const content = data.content;
                aiReply += content;
                // Clean safety labels from the accumulated reply before displaying
                const displayText = cleanFrontendResponse(aiReply);
                setMessages((prev) => 
                  prev.map(msg => msg.id === aiMsgId ? { ...msg, text: displayText } : msg)
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
              <h2 style={{ fontSize: "32px", fontWeight: "800", color: "var(--text-primary)", letterSpacing: "-1px" }}>Welcome to Nexuss!</h2>
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
                    <>
                      {msg.image && (
                        <div style={{ marginBottom: "8px" }}>
                          <img
                            src={msg.image}
                            alt="Uploaded"
                            style={{ maxWidth: "220px", maxHeight: "180px", borderRadius: "10px", border: "2px solid #6366f1", objectFit: "cover", display: "block" }}
                          />
                        </div>
                      )}
                      {msg.text}
                    </>
                  ) : msg.isImageResult ? (
                    msg.imageLoading ? (
                      <div className="chat-image-loading">
                        <div className="spinner"></div>
                        <span>Generating image using Flux.1 AI...</span>
                      </div>
                    ) : msg.imageUrl ? (
                      <div className="chat-image-result-card">
                        <img src={msg.imageUrl} alt={msg.promptText} className="chat-image-result-img" />
                        <div className="chat-image-result-actions">
                          <button onClick={() => window.open(msg.imageUrl, '_blank')} className="chat-img-btn">
                            <ExternalLink size={14} /> Open
                          </button>
                          <a href={msg.imageDownloadUrl || msg.imageUrl} download={`nexuss-image-${msg.seed}.png`} target="_blank" rel="noopener noreferrer" className="chat-img-btn-link">
                            <Download size={14} style={{ marginRight: '4px' }} /> Download
                          </a>
                        </div>
                      </div>
                    ) : (
                      <span>{msg.text}</span>
                    )
                  ) : msg.text ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: LinkRenderer, pre: PreRenderer, ...tableComponents }}>{msg.text}</ReactMarkdown>
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
            placeholder={
              imagePreview 
                ? "Ask about the image..." 
                : "Ask anything..."
            }
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
