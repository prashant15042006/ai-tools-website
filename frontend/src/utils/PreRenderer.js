import React, { useState } from "react";
import { Copy, CheckCircle2 } from "lucide-react";

export const PreRenderer = ({ children, className = "", ...props }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    let codeText = "";

    const extractText = (node) => {
      if (!node) return "";
      if (typeof node === "string" || typeof node === "number") return String(node);
      if (Array.isArray(node)) return node.map(extractText).join("");
      if (node.props && node.props.children) return extractText(node.props.children);
      return "";
    };

    codeText = extractText(children) || children?.toString() || "";

    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy!", err);
    }
  };

  return (
    <pre {...props} className={`code-block-pre ${className}`.trim()} style={{ position: "relative", ...(props.style || {}) }}>
      <button
        type="button"
        onClick={handleCopy}
        className={`code-copy-btn ${copied ? "copied" : ""}`}
        aria-label="Copy code"
      >
        {copied ? (
          <>
            <CheckCircle2 size={13} />
            <span>Copied</span>
          </>
        ) : (
          <>
            <Copy size={13} />
            <span>Copy</span>
          </>
        )}
      </button>
      {children}
    </pre>
  );
};
