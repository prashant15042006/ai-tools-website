// components/Toggle.js — Reusable accessible toggle switch
import React from "react";

const Toggle = ({ checked, onChange, label }) => (
  <div
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={onChange}
    tabIndex={0}
    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onChange()}
    style={{
      width: "52px",
      height: "28px",
      background: checked ? "var(--accent)" : "#334155",
      borderRadius: "14px",
      position: "relative",
      cursor: "pointer",
      transition: "background 0.3s",
      flexShrink: 0,
      outline: "none",
    }}
  >
    <div
      style={{
        width: "22px",
        height: "22px",
        background: "white",
        borderRadius: "50%",
        position: "absolute",
        top: "3px",
        left: checked ? "27px" : "3px",
        transition: "left 0.3s",
        boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
      }}
    />
  </div>
);

export default Toggle;
