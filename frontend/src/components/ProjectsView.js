// components/ProjectsView.js
import React, { useState, useContext } from "react";
import { Plus, Search, Trash2, FolderOpen, ChevronLeft, CheckCircle2, RotateCw, AlertCircle, Save, FileText } from "lucide-react";
import { AppContext } from "../App";
import API_BASE_URL from "../apiConfig";

const ProjectsView = ({ projects, setProjects }) => {
  const { user } = useContext(AppContext);
  const [selectedProject, setSelectedProject] = useState(null);
  const [notes, setNotes] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [syncStatus, setSyncStatus] = useState("saved"); // 'saved' | 'saving' | 'offline'
  const [searchQuery, setSearchQuery] = useState("");
  const autoSaveTimerRef = React.useRef(null);

  const openProject = (proj) => {
    setSelectedProject(proj);
    setNotes(proj.notes || "");
    setSyncStatus("saved");
  };

  const closeProject = () => {
    setSelectedProject(null);
    setNotes("");
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
  };

  const addProject = async () => {
    if (!newName.trim() || !user?.email) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, name: newName, desc: newDesc || "New workspace project" }),
      });
      if (response.ok) {
        const created = await response.json();
        const updatedList = [...projects, created];
        setProjects(updatedList);
        localStorage.setItem(`nexus_projects_${user.email}`, JSON.stringify(updatedList));
      } else throw new Error("API call failed");
    } catch (err) {
      console.warn("API add failed, saving locally:", err.message);
      const id = Date.now().toString();
      const created = { id, email: user.email, name: newName, desc: newDesc || "New workspace project", notes: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      const updatedList = [...projects, created];
      setProjects(updatedList);
      localStorage.setItem(`nexus_projects_${user.email}`, JSON.stringify(updatedList));
    }
    setNewName(""); setNewDesc(""); setIsAdding(false);
  };

  const deleteProject = async (id) => {
    if (!window.confirm("Delete this project? This action cannot be undone.")) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/projects/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("API call failed");
    } catch (err) { console.warn("API delete failed, updating local state:", err.message); }
    const updatedList = projects.filter((p) => p.id !== id);
    setProjects(updatedList);
    localStorage.setItem(`nexus_projects_${user.email}`, JSON.stringify(updatedList));
    if (selectedProject?.id === id) closeProject();
  };

  const saveNotes = async (currentNotes = notes, silent = false) => {
    if (!selectedProject || !user?.email) return;
    if (!silent) setSyncStatus("saving");
    try {
      const response = await fetch(`${API_BASE_URL}/api/projects/${selectedProject.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: currentNotes }),
      });
      setSyncStatus(response.ok ? "saved" : "offline");
      if (!response.ok) throw new Error("Server error");
    } catch (err) {
      console.warn("Auto-save to server failed:", err.message);
      setSyncStatus("offline");
    }
    const updatedProjects = projects.map((p) =>
      p.id === selectedProject.id ? { ...p, notes: currentNotes, updatedAt: new Date().toISOString() } : p
    );
    setProjects(updatedProjects);
    localStorage.setItem(`nexus_projects_${user.email}`, JSON.stringify(updatedProjects));
    setSelectedProject((prev) => (prev ? { ...prev, notes: currentNotes } : null));
  };

  const handleNotesChange = (e) => {
    const val = e.target.value;
    setNotes(val);
    setSyncStatus("saving");
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => saveNotes(val, true), 1500);
  };

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.desc && p.desc.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // ── Project editor view ────────────────────────────────────────────
  if (selectedProject) {
    const wordCount = notes.trim() === "" ? 0 : notes.trim().split(/\s+/).length;
    const charCount = notes.length;
    const syncColor = { saved: "#4ade80", saving: "#60a5fa", offline: "#fbbf24" }[syncStatus];
    const syncBg = { saved: "rgba(34,197,94,0.1)", saving: "rgba(59,130,246,0.1)", offline: "rgba(245,158,11,0.1)" }[syncStatus];
    const syncBorder = { saved: "rgba(34,197,94,0.2)", saving: "rgba(59,130,246,0.2)", offline: "rgba(245,158,11,0.2)" }[syncStatus];

    return (
      <div className="page-view" style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", height: "calc(100vh - 120px)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <button onClick={closeProject} className="back-btn" style={{ background: "rgba(255,255,255,0.05)", color: "white", border: "1px solid var(--border-color)", padding: "8px 16px", borderRadius: "10px", display: "flex", alignItems: "center", gap: "6px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s" }}>
              <ChevronLeft size={16} /> Back to Projects
            </button>
            <h2 style={{ fontSize: "26px", fontWeight: "800", background: "linear-gradient(135deg, #60a5fa, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              {selectedProject.name}
            </h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 14px", borderRadius: "10px", background: syncBg, border: `1px solid ${syncBorder}`, fontSize: "13px", color: syncColor, fontWeight: "600" }}>
              {syncStatus === "saved" && <><CheckCircle2 size={15} /><span>All changes synced</span></>}
              {syncStatus === "saving" && <><RotateCw size={15} style={{ animation: "spin 1s linear infinite" }} /><span>Saving changes...</span></>}
              {syncStatus === "offline" && <><AlertCircle size={15} /><span>Saved locally (Offline)</span></>}
            </div>
            <button onClick={() => saveNotes(notes, false)} style={{ background: "var(--accent)", color: "white", border: "none", padding: "9px 18px", borderRadius: "10px", display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", cursor: "pointer", transition: "all 0.2s" }}>
              <Save size={16} /> Save Now
            </button>
          </div>
        </div>
        {selectedProject.desc && (
          <div style={{ padding: "0 4px", marginBottom: "20px", color: "var(--text-secondary)", fontSize: "15px" }}>
            <strong>Description:</strong> {selectedProject.desc}
          </div>
        )}
        <div style={{ flex: 1, position: "relative", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", borderRadius: "18px", padding: "24px", boxShadow: "0 8px 32px rgba(0,0,0,0.2)", backdropFilter: "blur(10px)", display: "flex", flexDirection: "column", minHeight: "300px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "12px", color: "#a78bfa" }}>
            <FileText size={18} />
            <span style={{ fontSize: "14px", fontWeight: "700", letterSpacing: "0.5px", textTransform: "uppercase" }}>Workspace Notebook</span>
          </div>
          <textarea value={notes} onChange={handleNotesChange} placeholder="Write your ideas, code snippets, notes, prompts... Auto-saves as you type!"
            style={{ width: "100%", flex: 1, background: "transparent", border: "none", color: "#f8fafc", fontSize: "16px", lineHeight: "1.6", resize: "none", outline: "none", fontFamily: "Outfit, sans-serif" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "16px", marginTop: "16px", fontSize: "13px", color: "var(--text-secondary)", flexWrap: "wrap", gap: "8px" }}>
            <span style={{ fontStyle: "italic" }}>AI-compatible notepad. Everything is stored under your email profile.</span>
            <div style={{ display: "flex", gap: "16px", fontWeight: "600" }}>
              <span>{wordCount} words</span>
              <span>{charCount} characters</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Projects list view ─────────────────────────────────────────────
  return (
    <div className="page-view" style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h2 style={{ fontSize: "32px", fontWeight: "800" }}>Projects</h2>
          <p style={{ color: "var(--text-secondary)" }}>Manage your AI workspaces, documentation, and notes.</p>
        </div>
        <button onClick={() => setIsAdding(true)} style={{ background: "var(--accent)", color: "white", border: "none", padding: "12px 24px", borderRadius: "12px", display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", cursor: "pointer" }}>
          <Plus size={20} /> New Project
        </button>
      </div>

      {isAdding && (
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-color)", padding: "24px", borderRadius: "16px", marginBottom: "32px" }}>
          <h3 style={{ marginBottom: "16px", fontSize: "18px", fontWeight: "700" }}>Create New Project</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <input type="text" placeholder="Project Name" value={newName} onChange={(e) => setNewName(e.target.value)}
              style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-color)", borderRadius: "8px", padding: "12px", color: "white", fontSize: "14px" }} />
            <input type="text" placeholder="Project Description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
              style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-color)", borderRadius: "8px", padding: "12px", color: "white", fontSize: "14px" }} />
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button onClick={() => setIsAdding(false)} style={{ background: "transparent", border: "1px solid var(--border-color)", padding: "10px 20px", borderRadius: "8px", color: "white", cursor: "pointer" }}>Cancel</button>
              <button onClick={addProject} style={{ background: "var(--accent)", border: "none", padding: "10px 24px", borderRadius: "8px", color: "white", fontWeight: "600", cursor: "pointer" }}>Create Project</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ position: "relative", marginBottom: "32px" }}>
        <Search size={18} style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
        <input type="text" placeholder="Search projects..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: "100%", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "12px 12px 12px 48px", color: "white", fontSize: "15px" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "24px" }}>
        {filteredProjects.length === 0 ? (
          <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "60px", color: "var(--text-secondary)", background: "rgba(255,255,255,0.01)", border: "1px dashed var(--border-color)", borderRadius: "16px" }}>
            No projects found. Create one to get started!
          </div>
        ) : (
          filteredProjects.map((p) => {
            const wordCount = p.notes ? p.notes.trim().split(/\s+/).filter(Boolean).length : 0;
            return (
              <div key={p.id} onClick={() => openProject(p)} className="dashboard-card"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", padding: "24px", borderRadius: "16px", position: "relative", transition: "all 0.3s", cursor: "pointer", overflow: "hidden" }}>
                <div style={{ position: "absolute", right: -20, top: -20, width: 120, height: 120, borderRadius: "50%", background: "radial-gradient(circle, rgba(96,165,250,0.04) 0%, transparent 60%)", pointerEvents: "none" }} />
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", alignItems: "center" }}>
                  <div style={{ background: "rgba(37,99,235,0.1)", color: "#3b82f6", padding: "8px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <FolderOpen size={20} />
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); deleteProject(p.id); }} className="delete-project-btn"
                    style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", padding: "4px", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.8, transition: "all 0.2s" }} title="Delete Project">
                    <Trash2 size={16} />
                  </button>
                </div>
                <h3 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "8px", color: "#f8fafc" }}>{p.name}</h3>
                <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.5", marginBottom: "20px", display: "-webkit-box", WebkitLineClamp: "2", WebkitBoxOrient: "vertical", overflow: "hidden", height: "42px" }}>
                  {p.desc || "No description provided."}
                </p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: "14px", fontSize: "12px", color: "var(--text-secondary)" }}>
                  <span>{wordCount} words stored</span>
                  <span style={{ color: "var(--accent)", fontWeight: "700" }}>Open Workspace &rarr;</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ProjectsView;
