import React, { useState, useRef, useEffect, useContext } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send,
  ClipboardPaste,
  Mic,
  ExternalLink,
  Code2,
  Sparkles,
  X,
  FileText,
  Wand2,
  Trash2,
  Terminal,
  Cpu,
} from "lucide-react";
import { tableComponents } from "./utils/TableRenderer";
import { injectTableStyles } from "./utils/tableStyles";
import { AppContext } from "./App";
import { speak as voiceSpeak, stopSpeaking, startKeepAlive, stopKeepAlive } from "./utils/voiceEngine";
import API_BASE_URL from "./apiConfig";
import { PreRenderer } from "./utils/PreRenderer";
import { generateOfflineResponse } from "./utils/offlineAiEngine";
import { cacheResponseForOffline } from "./utils/responseCache";
import { cleanFrontendResponse } from "./utils/helpers";
import AttachmentMenu from "./components/AttachmentMenu";

// Inject table styles on component mount
injectTableStyles();

const TECH_STACKS = [
  { id: "auto", label: "Auto-Detect", icon: "⚡" },
  { id: "react", label: "React / Next.js", icon: "⚛️" },
  { id: "python", label: "Python", icon: "🐍" },
  { id: "node", label: "Node.js / Express", icon: "🟢" },
  { id: "html", label: "HTML & Tailwind", icon: "🎨" },
  { id: "ts", label: "TypeScript", icon: "🔷" },
  { id: "sql", label: "SQL & DB", icon: "🗄️" },
  { id: "cpp", label: "C++ / Java", icon: "☕" },
  { id: "mobile", label: "Flutter / Mobile", icon: "📱" },
];

const ENGINEERING_GOALS = [
  { id: "full_app", label: "Full Production App", prompt: "Build a 100% complete, fully working production application. Provide every single file with imports, state, error handling, and terminal run commands. Zero placeholders." },
  { id: "debug", label: "Bug Fix & Debug", prompt: "Deeply inspect the code for bugs, edge cases, or logical flaws. Clearly explain the root cause and provide the complete fixed production code." },
  { id: "refactor", label: "Refactor & Clean", prompt: "Refactor for clean architecture, SOLID principles, high performance, and modularity. Provide full refactored code." },
  { id: "api", label: "REST / Backend API", prompt: "Build robust backend API endpoints with schema validation, status codes, error middleware, and database integration." },
  { id: "component", label: "UI Component", prompt: "Build a modern, accessible, beautiful UI component with responsive design, smooth transitions, and clean props." },
  { id: "script", label: "Automation Script", prompt: "Write a high-performance automation script with CLI arguments, logging, and error retry logic." },
];

const PROMPT_SUGGESTIONS = [
  { title: "JWT Auth & RBAC API", sub: "Node.js + Express + bcrypt + refresh tokens", stack: "node", goal: "api" },
  { title: "Modern Analytics Dashboard", sub: "React + Tailwind CSS + responsive charts", stack: "react", goal: "component" },
  { title: "Async Web Scraper", sub: "Python + BeautifulSoup + proxy & retry logic", stack: "python", goal: "script" },
  { title: "Realtime WebSocket Chat", sub: "React + Socket.io + typing indicators", stack: "react", goal: "full_app" },
];

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
  const [selectedTech, setSelectedTech] = useState("auto");
  const [selectedGoal, setSelectedGoal] = useState("full_app");
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

  // AI Architect Wand: Expands user prompt into a senior architectural specification
  const handleArchitectPrompt = () => {
    if (!input.trim()) return;
    setIsArchitecting(true);

    const activeStackObj = TECH_STACKS.find((s) => s.id === selectedTech);
    const activeGoalObj = ENGINEERING_GOALS.find((g) => g.id === selectedGoal);

    const base = input.trim();
    const stackPart = activeStackObj && activeStackObj.id !== "auto" ? ` in ${activeStackObj.label}` : "";
    const goalPart = activeGoalObj ? ` [Objective: ${activeGoalObj.label}]` : "";

    const enriched = `Build a production-ready, fully working ${base}${stackPart}.${goalPart}
Include complete error handling, all imports, clean modular architecture, and step-by-step setup and execution instructions. Do not use placeholders.`;

    setInput(enriched);
    setIsArchitecting(false);
  };

  const sendMessage = async (text = input, overrideStack = null, overrideGoal = null) => {
    const rawText = text.trim();
    if ((!rawText && !imagePreview && !fileAttachment) || loading) return;

    const fileToBeSent = fileAttachment;
    setFileAttachment(null);
    const imageToBeSent = imagePreview;
    setImagePreview(null);

    const currentStack = overrideStack || selectedTech;
    const currentGoal = overrideGoal || selectedGoal;
    const stackObj = TECH_STACKS.find((s) => s.id === currentStack);
    const goalObj = ENGINEERING_GOALS.find((g) => g.id === currentGoal);

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
        tech: stackObj?.label || "Auto",
        goal: goalObj?.label || "Production",
      },
      { id: aiMsgId, text: "", sender: "ai" }
    ]);

    // Prepare conversation history
    const history = messages.slice(-10).map((msg) => ({
      role: msg.sender === "user" ? "user" : "assistant",
      content: msg.text
    })).filter((msg) => msg.content);

    // Build the high-specification architectural prompt
    let finalPrompt = `Generate code: ${displayPrompt}`;
    if (currentStack && currentStack !== "auto" && stackObj) {
      finalPrompt += `\n[Target Technology Stack: ${stackObj.label}]`;
    }
    if (goalObj && goalObj.prompt) {
      finalPrompt += `\n[Engineering Goal: ${goalObj.label} - ${goalObj.prompt}]`;
    }
    finalPrompt += `\n[Requirement: Provide 100% complete, fully working, copy-pasteable production code with all imports, state, error handling, and terminal run instructions. Zero placeholders.]`;

    if (fileToBeSent) {
      finalPrompt += `\n\n[Attached Code / File: ${fileToBeSent.name}]\n${fileToBeSent.content}`;
    }

    const payload = {
      message: finalPrompt,
      userName: displayName,
      history: history,
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
    if (messages.length > 0 && window.confirm("Clear Code Studio workspace conversation?")) {
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
      {/* ── TOP DEVELOPER BAR (Tech Stack & Architecture Goal) ── */}
      <div className="code-studio-bar">
        {/* Technology Stack Selector Pills */}
        <div className="code-pill-row">
          {TECH_STACKS.map((stack) => (
            <button
              key={stack.id}
              type="button"
              onClick={() => setSelectedTech(stack.id)}
              className={`code-tech-pill ${selectedTech === stack.id ? "active" : ""}`}
            >
              <span>{stack.icon}</span>
              <span>{stack.label}</span>
            </button>
          ))}
          <span style={{ width: "1px", height: "18px", background: "rgba(255, 255, 255, 0.15)", margin: "0 4px" }} />
          {ENGINEERING_GOALS.map((goal) => (
            <button
              key={goal.id}
              type="button"
              onClick={() => setSelectedGoal(goal.id)}
              className={`code-tech-pill ${selectedGoal === goal.id ? "active" : ""}`}
              style={selectedGoal === goal.id ? { borderColor: "#a855f7", color: "#d8b4fe", background: "rgba(168, 85, 247, 0.2)" } : {}}
            >
              <span>{goal.label}</span>
            </button>
          ))}
        </div>

        {/* Clear Workspace Button */}
        {messages.length > 0 && (
          <button
            type="button"
            onClick={handleClearChat}
            className="nexus-code-action-btn"
            style={{ color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.3)" }}
            title="Clear code conversation"
          >
            <Trash2 size={13} />
            <span>Clear Workspace</span>
          </button>
        )}
      </div>

      {/* ── CONVERSATION STREAM ── */}
      <div className="chat-history-scroll">
        {messages.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "16px", marginTop: "4vh" }}>
            <div style={{ flexShrink: 0, width: "68px", height: "68px", borderRadius: "18px", background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 30px rgba(16, 185, 129, 0.3)" }}>
              <Code2 size={36} color="white" />
            </div>

            <div style={{ textAlign: "center" }}>
              <h2 style={{ fontSize: "26px", fontWeight: "700", color: "var(--text-primary)", letterSpacing: "-0.5px" }}>
                Nexuss Code Studio
              </h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "14px", maxWidth: "520px", marginTop: "6px", lineHeight: 1.5 }}>
                Production-ready code architecture with zero placeholders. Ask for full apps, APIs, algorithms, or attach files to debug.
              </p>
            </div>

            {/* Senior Architect Badge */}
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "rgba(16, 185, 129, 0.12)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              padding: "6px 14px",
              borderRadius: "20px",
              fontSize: "12px",
              color: "#6ee7b7",
              fontWeight: 600,
            }}>
              <Cpu size={14} />
              <span>⚡ Powered by NVIDIA Nemotron & Llama 3.3 70B • Production Standards</span>
            </div>

            {/* Smart Project Starters */}
            <div className="chat-suggestions-grid code-suggestions" style={{ marginTop: "18px" }}>
              {PROMPT_SUGGESTIONS.map((s, i) => (
                <div
                  key={i}
                  className="suggestion-card"
                  onClick={() => sendMessage(`Build a production-ready ${s.title}: ${s.sub}. Provide complete files with imports, error handling, and run instructions.`, s.stack, s.goal)}
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
                ) : <Terminal size={20} color="white" />}
              </div>
              <div className="message-body">
                <div className="message-sender" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>{msg.sender === "user" ? "You" : "Nexuss Code AI"}</span>
                  {msg.sender === "user" && msg.tech && (
                    <span style={{ fontSize: "11px", background: "rgba(16, 185, 129, 0.15)", color: "#34d399", padding: "2px 8px", borderRadius: "10px", fontWeight: 600 }}>
                      {msg.tech}
                    </span>
                  )}
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

          {/* AI Architect Prompt Enhancer Button */}
          {input.trim() && (
            <button
              type="button"
              onClick={handleArchitectPrompt}
              disabled={isArchitecting}
              className="code-architect-btn"
              title="Enhance prompt with senior developer specifications"
            >
              <Wand2 size={14} />
              <span>Architect</span>
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
                ? "Ask to convert this UI into React / Tailwind code..."
                : (isListening ? "Listening..." : "Describe what you want to code (e.g. 'Build a React auth modal with Zod validation')...")
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
