import React, { useState, useRef, useEffect, useContext } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send,
  ClipboardPaste,
  Mic,
  ExternalLink,
  Code2,
  X,
  FileText,
  Wand2,
  Trash2,
  Terminal,
} from "lucide-react";
import { tableComponents } from "./utils/TableRenderer";
import { injectTableStyles } from "./utils/tableStyles";
import { AppContext } from "./App";
import { speak as voiceSpeak, stopSpeaking, startKeepAlive, stopKeepAlive } from "./utils/voiceEngine";
import API_BASE_URL from "./apiConfig";
import { PreRenderer } from "./utils/PreRenderer";
import { generateOfflineResponse } from "./utils/offlineAiEngine";
import { cacheResponseForOffline } from "./utils/responseCache";
import { cleanFrontendResponse, getClientDevice } from "./utils/helpers";
import AttachmentMenu from "./components/AttachmentMenu";

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
  const [isArchitecting, setIsArchitecting] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [fileAttachment, setFileAttachment] = useState(null);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Auto-resize textarea as user types
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 180) + 'px';
    }
  }, [input]);

  const handleSpeak = async (text) => {
    await voiceSpeak(text, { voicePreset, customVoiceUrl, ttsEnabledRef });
  };

  // AI Architect Wand: Expands user prompt into a complete production-grade specification
  const handleArchitectPrompt = () => {
    if (!input.trim()) return;
    setIsArchitecting(true);
    const base = input.trim();
    const enriched = `Build a 100% production-ready, fully working implementation of: ${base}. Include complete code with all imports, state management, error handling, edge-case coverage, and terminal setup/run commands. Zero placeholders.`;
    setInput(enriched);
    setIsArchitecting(false);
  };

  const sendMessage = async (text = input) => {
    const rawText = text.trim();
    if ((!rawText && !imagePreview && !fileAttachment) || loading) return;

    const fileToBeSent = fileAttachment;
    setFileAttachment(null);
    const imageToBeSent = imagePreview;
    setImagePreview(null);

    const displayPrompt = rawText || (fileToBeSent ? `Analyze and review code file: ${fileToBeSent.name}` : "");
    addRecentChat("Code: " + displayPrompt);
    setInput("");
    setTimeout(() => { if (textareaRef.current) textareaRef.current.style.height = '40px'; }, 0);
    setLoading(true);

    const userMsgId = Date.now() + Math.random();
    const aiMsgId = Date.now() + Math.random();

    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        text: displayPrompt,
        sender: "user",
        image: imageToBeSent || null,
        fileName: fileToBeSent ? fileToBeSent.name : null,
      },
      { id: aiMsgId, text: "", sender: "ai" }
    ]);

    // Prepare conversation history
    const history = messages.slice(-10).map((msg) => ({
      role: msg.sender === "user" ? "user" : "assistant",
      content: msg.text
    })).filter((msg) => msg.content);

    // Build complete production prompt directive
    let finalPrompt = `Generate code: ${displayPrompt}`;
    finalPrompt += `\n[Requirement: Provide 100% complete, fully working, copy-pasteable production code with all imports, state, error handling, and terminal run instructions. Zero placeholders.]`;

    if (fileToBeSent) {
      finalPrompt += `\n\n[Attached Code / File: ${fileToBeSent.name}]\n${fileToBeSent.content}`;
    }

    const payload = {
      message: finalPrompt,
      userName: displayName,
      history: history,
      device: getClientDevice(),
      ...(imageToBeSent ? { image: imageToBeSent } : {})
    };

    const endpoints = [];
    if (API_BASE_URL) {
      endpoints.push(`${API_BASE_URL}/api/chat`);
    }
    endpoints.push("/api/chat");

    if (!navigator.onLine) {
      const offlineReply = generateOfflineResponse(text, "code");
      setMessages((prev) =>
        prev.map((msg) => msg.id === aiMsgId ? { ...msg, text: offlineReply, isOffline: true } : msg)
      );
      setLoading(false);
      handleSpeak(offlineReply);
      return;
    }

    let response = null;
    let lastErr = "";
    let aiReply = "";
    const timeoutMs = imageToBeSent ? 90000 : 45000;

    for (const endpoint of endpoints) {
      try {
        const controller = new AbortController();
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
        if (r.status >= 400 && r.status < 500) break;
      } catch (e) { lastErr = e.message; }
    }

    try {
      if (!response) {
        throw new Error(lastErr || "All streaming endpoints failed.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
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
              const cleaned = cleanFrontendResponse(data.replace);
              aiReply = cleaned;
              setMessages((prev) =>
                prev.map((msg) => msg.id === aiMsgId ? { ...msg, text: cleaned } : msg)
              );
            } else if (data.content) {
              aiReply += data.content;
              const displayText = cleanFrontendResponse(aiReply);
              setMessages((prev) =>
                prev.map((msg) => msg.id === aiMsgId ? { ...msg, text: displayText } : msg)
              );
            }
          } catch (e) {}
        }
      }

      if (aiReply && aiReply.trim()) {
        cacheResponseForOffline(text, aiReply);
        handleSpeak(aiReply);
        setLoading(false);
        return;
      }
      throw new Error("Empty streaming response");

    } catch (error) {
      console.warn("Code streaming fallback to complete:", error.message);

      const completeEndpoints = [];
      if (API_BASE_URL) completeEndpoints.push(`${API_BASE_URL}/api/chat/complete`);
      completeEndpoints.push("/api/chat/complete");

      let completeSuccess = false;
      for (const compEndpoint of completeEndpoints) {
        try {
          const compController = new AbortController();
          const compTimer = setTimeout(() => compController.abort(), timeoutMs);
          const compRes = await fetch(compEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: compController.signal,
          });
          clearTimeout(compTimer);
          if (compRes.ok) {
            const compData = await compRes.json();
            const textReply = compData.reply || compData.content;
            if (textReply && textReply.trim()) {
              const cleanReply = cleanFrontendResponse(textReply);
              setMessages((prev) =>
                prev.map((msg) => msg.id === aiMsgId ? { ...msg, text: cleanReply } : msg)
              );
              cacheResponseForOffline(text, cleanReply);
              handleSpeak(cleanReply);
              completeSuccess = true;
              break;
            }
          }
        } catch (cErr) {}
      }

      if (completeSuccess) {
        setLoading(false);
        return;
      }

      const offlineReply = generateOfflineResponse(text, "code");
      setMessages((prev) =>
        prev.map((msg) => msg.id === aiMsgId ? { ...msg, text: offlineReply, isOffline: !navigator.onLine } : msg)
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
      const transcript = Array.from(event.results).map((r) => r[0].transcript).join("");
      setInput(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const handleClearChat = () => {
    if (messages.length > 0 && window.confirm("Clear Code conversation?")) {
      setMessages([]);
      stopSpeaking();
    }
  };

  const LinkRenderer = ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: "#38bdf8", textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: "4px" }}
    >
      {children} <ExternalLink size={12} />
    </a>
  );

  return (
    <div className="chat-container">
      {/* ── TOP BAR: ACTIVE SESSION INDICATOR & CLEAR BUTTON (when messages exist) ── */}
      {messages.length > 0 && (
        <div className="code-studio-top-bar">
          <div className="code-session-indicator">
            <span className="session-dot" />
            <span>Active Code Session</span>
          </div>
          <button
            type="button"
            onClick={handleClearChat}
            className="code-clear-btn"
            title="Clear code conversation"
          >
            <Trash2 size={13} />
            <span>Clear Chat</span>
          </button>
        </div>
      )}

      {/* ── CONVERSATION STREAM ── */}
      <div className="chat-history-scroll">
        {messages.length === 0 && (
          <div className="code-studio-landing">
            <div className="code-studio-landing-badge">
              <div className="code-studio-icon-glow">
                <Code2 size={32} color="#10b981" />
              </div>
            </div>

            <div className="code-studio-hero-text">
              <h1 className="code-studio-title">Nexuss Code Studio</h1>
              <p className="code-studio-subtitle">
                Describe what you want to build or paste your code. Generates 100% complete, production-ready code with zero placeholders.
              </p>
            </div>

            <div className="code-studio-feature-row">
              <div className="code-feature-chip">
                <span className="feature-chip-icon">⚡</span>
                <span>Production Code</span>
              </div>
              <div className="code-feature-chip">
                <span className="feature-chip-icon">🧠</span>
                <span>Zero Placeholders</span>
              </div>
              <div className="code-feature-chip">
                <span className="feature-chip-icon">🌐</span>
                <span>All Frameworks</span>
              </div>
              <div className="code-feature-chip">
                <span className="feature-chip-icon">📎</span>
                <span>Code & File Analysis</span>
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, index) => (
          <React.Fragment key={index}>
            <div className={`chat-message-row ${msg.sender === "user" ? "user-row" : "ai-row"}`}>
              <div className={`message-avatar ${msg.sender === "user" ? "user-av" : "ai-av"}`} style={msg.sender === "user" ? { padding: 0, overflow: 'hidden' } : {}}>
                {msg.sender === "user" ? (
                  <img src={user?.photoURL || "https://ui-avatars.com/api/?name=" + encodeURIComponent(displayName)} alt="You" style={{ width: '100%', height: '100%' }} />
                ) : <Terminal size={20} color="white" />}
              </div>
              <div className="message-body">
                <div className="message-sender">
                  <span>{msg.sender === "user" ? "You" : "Nexuss Code AI"}</span>
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
                      {msg.fileName && (
                        <div style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          background: "rgba(16, 185, 129, 0.2)",
                          border: "1px solid rgba(16, 185, 129, 0.4)",
                          padding: "4px 10px",
                          borderRadius: "8px",
                          fontSize: "12px",
                          color: "#a7f3d0",
                          marginBottom: "8px"
                        }}>
                          <FileText size={14} color="#10b981" />
                          <span>{msg.fileName}</span>
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
                <Terminal size={20} color="white" />
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

      {/* ── INPUT COMMAND SECTION ── */}
      <div className="input-container">
        {/* Document attachment strip */}
        {fileAttachment && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 16px 0", flexWrap: "wrap" }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "rgba(16, 185, 129, 0.15)",
              border: "1px solid rgba(16, 185, 129, 0.35)",
              borderRadius: "10px",
              padding: "6px 12px",
              color: "var(--text-primary)",
              fontSize: "13px"
            }}>
              <FileText size={16} color="#10b981" />
              <span style={{ fontWeight: 600 }}>{fileAttachment.name}</span>
              <button
                onClick={() => setFileAttachment(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  padding: 0,
                  display: "flex",
                  alignItems: "center"
                }}
                title="Remove attached file"
              >
                <X size={14} />
              </button>
            </div>
            <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              Code file ready — ask to review, find bugs, or refactor.
            </span>
          </div>
        )}

        {imagePreview && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 16px 0", flexWrap: "wrap" }}>
            <div style={{ position: "relative", display: "inline-block" }}>
              <img src={imagePreview} alt="Attached" style={{ height: "64px", borderRadius: "10px", border: "2px solid #10b981", objectFit: "cover" }} />
              <button onClick={removeImage} style={{ position: "absolute", top: "-8px", right: "-8px", background: "#ef4444", border: "none", borderRadius: "50%", width: "20px", height: "20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "white", padding: 0 }} title="Remove image">
                <X size={12} />
              </button>
            </div>
            <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>UI screenshot attached — ask to convert to frontend code</span>
          </div>
        )}

        {/* Input Bar */}
        <div className="input-box-wrapper">
          {/* LEFT: Paste button */}
          <button className="action-btn" title="Paste from Clipboard" onClick={handlePaste}>
            <ClipboardPaste size={20} />
          </button>

          {/* AI Enhance Prompt Wand Button */}
          {input.trim() && (
            <button
              type="button"
              onClick={handleArchitectPrompt}
              disabled={isArchitecting}
              className="code-architect-btn"
              title="Enhance prompt with production-ready specifications"
            >
              <Wand2 size={14} />
              <span className="architect-btn-text">Enhance</span>
            </button>
          )}

          {/* CENTER: Textarea */}
          <textarea
            ref={textareaRef}
            autoFocus
            className="chat-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              fileAttachment
                ? `Ask anything about ${fileAttachment.name} (e.g. fix bugs, optimize performance)...`
                : imagePreview
                ? "Ask to convert this UI into frontend code..."
                : (isListening ? "Listening..." : "Ask Anything...")
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

          {/* RIGHT: Attachment + Voice + Send */}
          <div className="input-actions-right">
            <AttachmentMenu
              imagePreview={imagePreview}
              onImageSelect={(dataUrl) => setImagePreview(dataUrl)}
              onFileSelect={(content, fileName) => {
                setFileAttachment({ name: fileName, content });
              }}
              onFolderSelect={(summary) => {
                setFileAttachment({ name: "Uploaded Folder", content: summary });
              }}
              accentColor="#10b981"
              disabled={loading}
            />
            <button
              className={`action-btn ${isListening ? "listening" : ""}`}
              title={isListening ? "Listening..." : "Voice Input"}
              onClick={startListening}
            >
              <Mic size={20} color={isListening ? "#ef4444" : "var(--text-secondary)"} />
            </button>
            <button
              className="send-btn"
              onClick={() => sendMessage()}
              disabled={loading || (!input.trim() && !imagePreview && !fileAttachment)}
              title="Generate Code (Enter)"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CodeGenerator;
