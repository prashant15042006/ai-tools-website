import React, { useState } from "react";
import { Copy, CheckCircle2 } from "lucide-react";

export const PreRenderer = ({ children, ...props }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    let codeText = "";
    
    // Attempt to extract text from React children
    if (children && children.props && children.props.children) {
      codeText = children.props.children;
    } else {
      codeText = children?.toString() || "";
    }

    if (Array.isArray(codeText)) {
      codeText = codeText.join("");
    } else if (typeof codeText !== "string") {
      codeText = codeText?.toString() || "";
    }

    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy!", err);
    }
  };

  return (
    <pre {...props} style={{ position: "relative" }}>
      <button
        onClick={handleCopy}
        style={{
          position: "absolute",
          top: "8px",
          right: "8px",
          background: "rgba(255, 255, 255, 0.05)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "6px",
          padding: "5px 10px",
          color: copied ? "#10b981" : "#c084fc",
          fontSize: "12px",
          fontWeight: "600",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "5px",
          zIndex: 10,
          fontFamily: "Outfit, sans-serif",
          transition: "all 0.2s",
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
          e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
          e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
        }}
      >
        {copied ? (
          <>
            <CheckCircle2 size={12} color="#10b981" /> Copied
          </>
        ) : (
          <>
            <Copy size={12} /> Copy
          </>
        )}
      </button>
      {children}
    </pre>
  );
};
