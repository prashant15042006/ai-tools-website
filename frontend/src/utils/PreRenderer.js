import React, { useState } from "react";
import {
  Copy,
  Check,
  Download,
  WrapText,
  ListOrdered,
  Type,
} from "lucide-react";

// Common language file extensions map
const EXT_MAP = {
  javascript: "js",
  js: "js",
  jsx: "jsx",
  typescript: "ts",
  ts: "ts",
  tsx: "tsx",
  python: "py",
  py: "py",
  html: "html",
  css: "css",
  scss: "scss",
  json: "json",
  sql: "sql",
  bash: "sh",
  sh: "sh",
  shell: "sh",
  c: "c",
  cpp: "cpp",
  csharp: "cs",
  java: "java",
  go: "go",
  rust: "rs",
  php: "php",
  ruby: "rb",
  yaml: "yaml",
  yml: "yml",
  markdown: "md",
  md: "md",
};

// Friendly language labels & icons
const LANG_DISPLAY = {
  javascript: { name: "JavaScript", icon: "⚡" },
  js: { name: "JavaScript", icon: "⚡" },
  jsx: { name: "React JSX", icon: "⚛️" },
  typescript: { name: "TypeScript", icon: "🔷" },
  ts: { name: "TypeScript", icon: "🔷" },
  tsx: { name: "React TSX", icon: "⚛️" },
  python: { name: "Python", icon: "🐍" },
  py: { name: "Python", icon: "🐍" },
  html: { name: "HTML", icon: "🌐" },
  css: { name: "CSS", icon: "🎨" },
  scss: { name: "SCSS", icon: "🎨" },
  json: { name: "JSON", icon: "📋" },
  sql: { name: "SQL", icon: "🗄️" },
  bash: { name: "Bash", icon: "🐚" },
  sh: { name: "Shell", icon: "🐚" },
  shell: { name: "Shell", icon: "🐚" },
  cpp: { name: "C++", icon: "⚙️" },
  c: { name: "C", icon: "⚙️" },
  java: { name: "Java", icon: "☕" },
  go: { name: "Go", icon: "🐹" },
  rust: { name: "Rust", icon: "🦀" },
  php: { name: "PHP", icon: "🐘" },
};

const FONT_SIZES = [
  { size: "12px", label: "Compact", lineH: 1.6 },
  { size: "13.5px", label: "Standard", lineH: 1.65 },
  { size: "15px", label: "Large", lineH: 1.7 },
];

export const PreRenderer = ({ children, className = "", ...props }) => {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [wrapLines, setWrapLines] = useState(false);
  const [showLineNumbers, setShowLineNumbers] = useState(false);

  // Read saved font size from localStorage (default: 13.5px)
  const [fontSizeIndex, setFontSizeIndex] = useState(() => {
    try {
      const saved = localStorage.getItem("nexus_code_font_index");
      return saved !== null ? parseInt(saved, 10) : 1; // 1 = Standard 13.5px
    } catch {
      return 1;
    }
  });

  const activeFont = FONT_SIZES[fontSizeIndex] || FONT_SIZES[1];

  // Helper to extract text from React tree
  const extractText = (node) => {
    if (!node) return "";
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(extractText).join("");
    if (node.props && node.props.children) return extractText(node.props.children);
    return "";
  };

  // Inspect children to find code element & language
  const codeElement = React.Children.toArray(children).find(
    (child) => React.isValidElement(child) && child.type === "code"
  ) || (React.isValidElement(children) && children.type === "code" ? children : null);

  const rawCode = extractText(codeElement?.props?.children || children).replace(/\n$/, "");
  const languageClass = codeElement?.props?.className || className || "";
  const matchLang = /language-(\w+)/.exec(languageClass);
  const detectedLang = (matchLang ? matchLang[1] : "").toLowerCase();

  // Try to extract filename from first line comment (e.g. `/* App.jsx */`, `// server.js`, `# app.py`)
  let detectedFilename = "";
  const firstLine = rawCode.split("\n")[0] || "";
  const filenameMatch = /^(?:\/\/|\/\*|#|<!--)\s*([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+)\s*(?:\*\/|-->)?/.exec(firstLine.trim());
  if (filenameMatch && filenameMatch[1]) {
    detectedFilename = filenameMatch[1].replace(/^[./\\]+/, "");
  }

  const langMeta = LANG_DISPLAY[detectedLang] || {
    name: detectedLang ? detectedLang.toUpperCase() : "Code",
    icon: "💻",
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (err) {
      console.error("Failed to copy code", err);
    }
  };

  const handleDownload = () => {
    try {
      const ext = EXT_MAP[detectedLang] || "txt";
      const filename = detectedFilename || `code_${Date.now()}.${ext}`;
      const blob = new Blob([rawCode], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2000);
    } catch (err) {
      console.error("Download failed", err);
    }
  };

  const cycleFontSize = () => {
    const next = (fontSizeIndex + 1) % FONT_SIZES.length;
    setFontSizeIndex(next);
    try {
      localStorage.setItem("nexus_code_font_index", String(next));
    } catch {}
  };

  const lines = rawCode.split("\n");

  return (
    <div className="nexus-code-card">
      {/* ── IDE Top Header Bar ── */}
      <div className="nexus-code-header">
        {/* Left: Mac window dots + Language/File Tab */}
        <div className="nexus-code-header-left">
          <div className="nexus-window-dots">
            <span className="dot red" />
            <span className="dot yellow" />
            <span className="dot green" />
          </div>

          <div className="nexus-code-tab">
            <span className="tab-icon">{langMeta.icon}</span>
            <span className="tab-lang">{detectedFilename || langMeta.name}</span>
          </div>
        </div>

        {/* Right: Actions (Font Size, Wrap, Line numbers, Download, Copy) */}
        <div className="nexus-code-header-actions">
          {/* Font Size Selector */}
          <button
            type="button"
            onClick={cycleFontSize}
            className="nexus-code-action-btn font-btn"
            title={`Font Size: ${activeFont.label} (${activeFont.size}). Click to toggle.`}
          >
            <Type size={12} />
            <span>{activeFont.size}</span>
          </button>

          {/* Line Numbers Toggle */}
          <button
            type="button"
            onClick={() => setShowLineNumbers(!showLineNumbers)}
            className={`nexus-code-action-btn ${showLineNumbers ? "active" : ""}`}
            title="Toggle line numbers"
          >
            <ListOrdered size={13} />
            <span className="btn-label-desktop">Lines</span>
          </button>

          {/* Word Wrap Toggle */}
          <button
            type="button"
            onClick={() => setWrapLines(!wrapLines)}
            className={`nexus-code-action-btn ${wrapLines ? "active" : ""}`}
            title="Toggle word wrap vs horizontal scroll"
          >
            <WrapText size={13} />
            <span className="btn-label-desktop">{wrapLines ? "Wrap" : "Scroll"}</span>
          </button>

          {/* Download File Button */}
          <button
            type="button"
            onClick={handleDownload}
            className={`nexus-code-action-btn ${downloaded ? "success" : ""}`}
            title="Download file directly"
          >
            {downloaded ? <Check size={13} color="#10b981" /> : <Download size={13} />}
            <span className="btn-label-desktop">{downloaded ? "Saved" : "Save"}</span>
          </button>

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className={`nexus-code-copy-btn ${copied ? "copied" : ""}`}
            title="Copy entire code to clipboard"
          >
            {copied ? (
              <>
                <Check size={13} color="#10b981" />
                <span>Copied! ✨</span>
              </>
            ) : (
              <>
                <Copy size={13} />
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── IDE Code Content Area ── */}
      <div
        className={`nexus-code-viewport ${wrapLines ? "wrap-active" : "scroll-active"} ${showLineNumbers ? "with-line-numbers" : ""}`}
        style={{
          fontSize: activeFont.size,
          lineHeight: activeFont.lineH,
        }}
      >
        {showLineNumbers ? (
          <div className="nexus-numbered-code">
            <div className="line-numbers-col" aria-hidden="true">
              {lines.map((_, i) => (
                <span key={i} className="line-num">{i + 1}</span>
              ))}
            </div>
            <pre className="code-text-col">
              <code>{rawCode}</code>
            </pre>
          </div>
        ) : (
          <pre className="code-plain-pre">
            <code>{rawCode}</code>
          </pre>
        )}
      </div>
    </div>
  );
};
