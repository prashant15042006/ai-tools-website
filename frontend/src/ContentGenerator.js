import React, { useState, useRef, useEffect, useContext } from "react";
import ReactMarkdown from "react-markdown";
import { Send, ClipboardPaste, Mic, ExternalLink, PenTool } from "lucide-react";

import { AppContext } from "./App";

function ContentGenerator() {
  const { ttsEnabled, addRecentChat } = useContext(AppContext);
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
    addRecentChat("Write: " + text);

    const userMsgId = Date.now() + Math.random();
    const aiMsgId = Date.now() + Math.random();
    setMessages((prev) => [...prev, { id: userMsgId, text: text, sender: "user" }, { id: aiMsgId, text: "", sender: "ai" }]);

    try {
      const response = await fetch("http://localhost:5001/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Write: " + text }),
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
            <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "linear-gradient(135deg, #f59e0b, #ef4444)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <PenTool size={32} color="white" />
            </div>
            <h2 style={{ fontSize: "28px", fontWeight: "700", color: "var(--text-primary)" }}>Writing Assistant</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "16px", maxWidth: "480px", textAlign: "center" }}>
              Draft emails, blogs, essays and more. Professional content at your fingertips.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginTop: "16px", maxWidth: "620px", width: "100%" }}>
              {[
                { title: "Professional Email", sub: "requesting for a leave" },
                { title: "Tech Blog Post", sub: "about AI trends in 2024" },
                { title: "Product Description", sub: "for a premium smartwatch" },
                { title: "Short Story", sub: "set in a cyberpunk city" },
              ].map((s, i) => (
                <div
                  key={i}
                  className="dashboard-card"
                  onClick={() => sendMessage("Write: " + s.title + " " + s.sub)}
                  style={{ padding: "18px", cursor: "pointer" }}
                >
                  <div style={{ fontSize: "15px", fontWeight: "600" }}>{s.title}</div>
                  <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, index) => (
          <React.Fragment key={index}>
            <div className={`chat-message-row ${msg.sender === "user" ? "user-row" : "ai-row"}`}>
              <div className={`message-avatar ${msg.sender === "user" ? "user-av" : "ai-av"}`}>
                {msg.sender === "user" ? "You" : <PenTool size={20} color="white" />}
              </div>
              <div className="message-body">
                <div className="message-sender">
                  {msg.sender === "user" ? "You" : "Nexus Writer AI"}
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
                <PenTool size={20} color="white" />
              </div>
              <div className="message-body">
                <div className="message-sender">Nexus Writer AI</div>
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
            <ClipboardPaste size={24} />
          </button>
          <textarea
            className="chat-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isListening ? "Listening..." : "Tell me what you want to write..."}
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
            style={{ marginRight: "10px" }}
            onClick={startListening}
          >
            <Mic size={24} />
          </button>
          <button className="send-btn" onClick={() => sendMessage()} disabled={loading || !input.trim()}>
            <Send size={22} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default ContentGenerator;
