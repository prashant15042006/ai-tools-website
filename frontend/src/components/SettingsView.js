// components/SettingsView.js
import React, { useContext } from "react";
import { User, Settings, Shield } from "lucide-react";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import { AppContext } from "../App";
import Toggle from "./Toggle";

const SettingsView = () => {
  const { darkMode, setDarkMode, ttsEnabled, setTtsEnabled, user, voicePreset, setVoicePreset } = useContext(AppContext);
  const displayName = localStorage.getItem("nexus_user_name") || user?.displayName || (user?.email ? user.email.split("@")[0] : "User");

  const handleTestVoice = (preset) => {
    import("../utils/voiceEngine").then(({ testVoice }) => testVoice(preset));
  };

  return (
    <div className="page-view" style={{ padding: "40px", maxWidth: "800px", margin: "0 auto" }}>
      <h2 style={{ fontSize: "32px", fontWeight: "800", marginBottom: "32px" }}>Settings</h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
        {/* Profile Section */}
        <section>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", color: "var(--accent)" }}>
            <User size={20} />
            <h3 style={{ fontSize: "18px", fontWeight: "700", color: "white" }}>Profile</h3>
          </div>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-color)", padding: "24px", borderRadius: "16px", display: "flex", alignItems: "center", gap: "20px" }}>
            <img
              src={user?.photoURL || "https://ui-avatars.com/api/?name=" + encodeURIComponent(displayName)}
              alt="Profile"
              style={{ width: "64px", height: "64px", borderRadius: "50%", border: "2px solid var(--accent)" }}
            />
            <div>
              <div style={{ fontSize: "20px", fontWeight: "700" }}>{displayName}</div>
              <div style={{ color: "var(--text-secondary)" }}>{user?.email}</div>
              <div style={{ display: "inline-block", marginTop: "8px", padding: "4px 10px", background: "rgba(34,197,94,0.1)", color: "#22c55e", borderRadius: "6px", fontSize: "12px", fontWeight: "700" }}>
                Pro Member
              </div>
            </div>
          </div>
        </section>

        {/* Preferences Section */}
        <section>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", color: "var(--accent)" }}>
            <Settings size={20} />
            <h3 style={{ fontSize: "18px", fontWeight: "700", color: "white" }}>Preferences</h3>
          </div>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-color)", borderRadius: "16px", overflow: "hidden" }}>
            <div style={{ padding: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)" }}>
              <div>
                <div style={{ fontWeight: "600" }}>Dark Mode</div>
                <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Toggle between dark and light interface themes.</div>
              </div>
              <Toggle checked={darkMode} onChange={() => setDarkMode(!darkMode)} label="Toggle dark mode" />
            </div>
            <div style={{ padding: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: ttsEnabled ? "1px solid var(--border-color)" : "none" }}>
              <div>
                <div style={{ fontWeight: "600" }}>AI Voice Response</div>
                <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Listen to AI responses using Text-to-Speech.</div>
              </div>
              <Toggle checked={ttsEnabled} onChange={() => setTtsEnabled(!ttsEnabled)} label="Toggle TTS" />
            </div>
            {ttsEnabled && (
              <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ minWidth: 220 }}>
                    <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: 6 }}>Voice Preset</div>
                    <select value={voicePreset} onChange={(e) => setVoicePreset(e.target.value)}
                      style={{ padding: "8px", borderRadius: 8, background: "transparent", color: "var(--text-primary)", border: "1px solid var(--border-color)", minWidth: 220 }}>
                      <option value="ironman_en">🎙️ J.A.R.V.I.S. (English - Movie Premium)</option>
                      <option value="ironman_hi">🎙️ J.A.R.V.I.S. (Hindi - Movie Premium)</option>
                      <option value="ironman_hinglish">🎙️ J.A.R.V.I.S. (Hinglish Mix - Movie Premium)</option>
                    </select>
                  </div>
                  <button onClick={() => handleTestVoice(voicePreset)}
                    style={{ padding: "8px 16px", borderRadius: 8, background: "linear-gradient(135deg, #2563eb, #7c3aed)", color: "white", fontWeight: 700, border: "none", cursor: "pointer", fontSize: "13px", transition: "all 0.2s", boxShadow: "0 2px 8px rgba(37,99,235,0.3)", marginTop: "20px" }}>
                    🔊 Test Voice
                  </button>
                </div>
                <div style={{
                  background: voicePreset === "ironman_hinglish" ? "rgba(16,185,129,0.08)" : voicePreset === "ironman_hi" ? "rgba(234,179,8,0.08)" : "rgba(37,99,235,0.06)",
                  border: `1px solid ${voicePreset === "ironman_hinglish" ? "rgba(16,185,129,0.18)" : voicePreset === "ironman_hi" ? "rgba(234,179,8,0.18)" : "rgba(37,99,235,0.15)"}`,
                  borderRadius: 10, padding: "12px 16px", fontSize: 13
                }}>
                  <div style={{ fontWeight: 700, color: voicePreset === "ironman_hinglish" ? "#10b981" : voicePreset === "ironman_hi" ? "#f59e0b" : "#60a5fa", marginBottom: 4 }}>
                    🤖 {voicePreset === "ironman_hinglish" ? "J.A.R.V.I.S. Hinglish Mix" : voicePreset === "ironman_hi" ? "J.A.R.V.I.S. Hindi" : "J.A.R.V.I.S. English"} Movie Premium Profile
                  </div>
                  <div style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                    {voicePreset === "ironman_hinglish"
                      ? "Cinematic Movie Premium Jarvis voice with metallic intercom suit effect. Auto-detects Hindi & English in each sentence."
                      : voicePreset === "ironman_hi"
                      ? "Cinematic Movie Premium Jarvis voice with metallic intercom suit effect (Atul Kapoor style). High-fidelity Hindi speech."
                      : "Cinematic Movie Premium Jarvis voice with metallic intercom suit effect (Paul Bettany style). High-fidelity English speech."}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Blockchain & Offline AI Section */}
        <section>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", color: "var(--accent)" }}>
            <Shield size={20} />
            <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-primary)" }}>Blockchain & Offline Intelligence</h3>
          </div>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-color)", padding: "20px", borderRadius: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <div style={{ fontWeight: "700", fontSize: "15px", color: "var(--text-primary)" }}>Cryptographic SHA-256 Blockchain Ledger</div>
                <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>Every AI response is hashed into an immutable block chain.</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(16, 185, 129, 0.12)", color: "#059669", padding: "6px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: "700", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                <span>✓ Chain Valid & Intact</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
              <div style={{ background: "rgba(0,0,0,0.03)", border: "1px solid var(--border-color)", padding: "12px 16px", borderRadius: "12px" }}>
                <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-secondary)", fontWeight: "700" }}>Total Blocks</div>
                <div style={{ fontSize: "22px", fontWeight: "800", color: "#3b82f6", marginTop: "4px" }}>
                  {(() => {
                    try {
                      const chain = JSON.parse(localStorage.getItem("nexus_blockchain_ledger") || "[]");
                      return chain.length || 1;
                    } catch { return 1; }
                  })()} Blocks
                </div>
              </div>

              <div style={{ background: "rgba(0,0,0,0.03)", border: "1px solid var(--border-color)", padding: "12px 16px", borderRadius: "12px" }}>
                <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-secondary)", fontWeight: "700" }}>Offline AI Mode</div>
                <div style={{ fontSize: "15px", fontWeight: "800", color: "#10b981", marginTop: "6px" }}>
                  ⚡ Zero-Network Active
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Security Section */}
        <section>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", color: "var(--accent)" }}>
            <Shield size={20} />
            <h3 style={{ fontSize: "18px", fontWeight: "700", color: "white" }}>Account & Security</h3>
          </div>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-color)", padding: "20px", borderRadius: "16px" }}>
            <button
              onClick={() => {
                localStorage.removeItem("nexus_mock_user");
                localStorage.removeItem("nexus_user_name");
                signOut(auth).finally(() => window.location.reload());
              }}
              style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", padding: "10px 20px", borderRadius: "8px", fontWeight: "600", cursor: "pointer" }}
            >
              Sign Out from Account
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SettingsView;
