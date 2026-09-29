import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Paperclip,
  Camera,
  Image as ImageIcon,
  FileText,
  Folder,
  X,
  RotateCcw,
  Check,
  SwitchCamera,
  AlertCircle
} from "lucide-react";

/**
 * Reusable Professional Attachment Menu & Live Camera Capture Component
 * Supports:
 * 1. Live Camera Snapshot with switch camera & retake
 * 2. Any Photo / Image upload from device gallery
 * 3. File upload (Code, Text, PDF, Docs) with direct AI analysis
 * 4. Folder upload with automated code/file parsing
 */
const AttachmentMenu = ({
  imagePreview,
  onImageSelect,
  onFileSelect,
  onFolderSelect,
  accentColor = "#6366f1",
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState("user"); // "user" or "environment"
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [isStreamReady, setIsStreamReady] = useState(false);

  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const imageInputRef = useRef(null);
  const nativeCameraInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const stopCameraTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsStreamReady(false);
  }, []);

  const closeCamera = useCallback(() => {
    stopCameraTracks();
    setCapturedPhoto(null);
    setCameraError(null);
    setIsCameraOpen(false);
  }, [stopCameraTracks]);

  const startCamera = useCallback(async (facing) => {
    stopCameraTracks();
    setCameraError(null);
    setIsStreamReady(false);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError("Camera access is not supported by your browser or connection. You can still use device camera directly.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch((e) => console.warn("Video play error:", e));
          setIsStreamReady(true);
        };
      }
    } catch (err) {
      console.error("Camera error:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCameraError("Camera permission denied. Please allow camera access in browser settings.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setCameraError("No camera device found on this system.");
      } else {
        setCameraError(`Camera error: ${err.message || "Failed to start camera."}`);
      }
    }
  }, [stopCameraTracks]);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (
        isOpen &&
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        if (isCameraOpen) closeCamera();
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isCameraOpen, closeCamera]);

  // Handle Live Camera stream lifecycle
  useEffect(() => {
    if (isCameraOpen && !capturedPhoto) {
      startCamera(cameraFacing);
    }
    return () => {
      stopCameraTracks();
    };
  }, [isCameraOpen, cameraFacing, capturedPhoto, startCamera, stopCameraTracks]);

  const switchCamera = () => {
    setCameraFacing((prev) => (prev === "user" ? "environment" : "user"));
  };

  const takeSnapshot = () => {
    const video = videoRef.current;
    if (!video || !isStreamReady) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");

    // Mirror image if front camera
    if (cameraFacing === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setCapturedPhoto(dataUrl);
    stopCameraTracks();
  };

  const retakeSnapshot = () => {
    setCapturedPhoto(null);
    startCamera(cameraFacing);
  };

  const confirmCapturedPhoto = () => {
    if (capturedPhoto && onImageSelect) {
      onImageSelect(capturedPhoto, `camera_capture_${Date.now()}.jpg`);
    }
    closeCamera();
  };

  // Image file handler
  const handleImageFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (onImageSelect) {
        onImageSelect(ev.target.result, file.name);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
    setIsOpen(false);
  };

  // Document/File handler
  const handleAnyFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (onImageSelect) onImageSelect(ev.target.result, file.name);
      };
      reader.readAsDataURL(file);
    } else {
      // Check if text/code file or binary
      const isTextOrCode =
        file.type.startsWith("text/") ||
        /\.(txt|js|jsx|ts|tsx|py|html|css|json|md|csv|xml|yaml|yml|sql|sh|log|java|c|cpp|cs|php|rb|go|rs|env)$/i.test(
          file.name
        );

      if (isTextOrCode) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const content = ev.target.result;
          if (onFileSelect) {
            onFileSelect(content, file.name);
          }
        };
        reader.readAsText(file);
      } else {
        // PDF or binary document
        const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
        if (onFileSelect) {
          onFileSelect(
            `[Document Attached: ${file.name} (${sizeMb} MB, ${file.type || "binary"})]`,
            file.name
          );
        }
      }
    }
    e.target.value = "";
    setIsOpen(false);
  };

  // Folder handler
  const handleFolderChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Filter relevant files (exclude node_modules, .git, etc.)
    const relevantFiles = files.filter((f) => {
      const path = f.webkitRelativePath || f.name;
      return !path.includes("node_modules") && !path.includes(".git") && !path.includes("build") && !path.includes("dist");
    });

    const folderName = (relevantFiles[0]?.webkitRelativePath || "").split("/")[0] || "Folder";
    
    // Pick first few text/code files to preview contents
    const textFiles = relevantFiles.filter(
      (f) =>
        f.type.startsWith("text/") ||
        /\.(txt|js|jsx|ts|tsx|py|html|css|json|md|csv|xml|yaml|yml|sql|sh|java|c|cpp|cs)$/i.test(f.name)
    ).slice(0, 5);

    let fileSummaries = [];
    for (const f of textFiles) {
      try {
        const text = await f.text();
        const snippet = text.slice(0, 600);
        fileSummaries.push(`--- ${f.webkitRelativePath || f.name} ---\n${snippet}${text.length > 600 ? "\n...(truncated)" : ""}`);
      } catch (err) {
        fileSummaries.push(`--- ${f.name} (unable to read content) ---`);
      }
    }

    const folderSummary = `[Uploaded Folder: "${folderName}" containing ${relevantFiles.length} files]\n\nKey Files Sample:\n${fileSummaries.join("\n\n")}`;
    if (onFolderSelect) {
      onFolderSelect(folderSummary);
    } else if (onFileSelect) {
      onFileSelect(folderSummary, folderName);
    }

    e.target.value = "";
    setIsOpen(false);
  };

  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleImageFileChange}
      />
      <input
        ref={nativeCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={handleImageFileChange}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="*/*"
        style={{ display: "none" }}
        onChange={handleAnyFileChange}
      />
      <input
        ref={folderInputRef}
        type="file"
        webkitdirectory="true"
        directory="true"
        multiple
        style={{ display: "none" }}
        onChange={handleFolderChange}
      />

      {/* Main Professional Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        className={`action-btn attachment-btn ${isOpen ? "active" : ""}`}
        title="Attach files, photos, or use camera"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={disabled}
        style={{
          position: "relative",
          color: imagePreview || isOpen ? accentColor : "var(--text-secondary)",
          background: isOpen ? "rgba(255,255,255,0.08)" : "transparent",
          transition: "all 0.2s ease",
        }}
      >
        <Paperclip size={20} style={{ transform: "rotate(-45deg)" }} />
        {imagePreview && (
          <span
            style={{
              position: "absolute",
              top: "4px",
              right: "4px",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: accentColor,
              boxShadow: `0 0 8px ${accentColor}`,
            }}
          />
        )}
      </button>

      {/* Modern Attachment Dropdown Menu */}
      {isOpen && (
        <div
          ref={menuRef}
          className="attachment-dropdown-menu"
          style={{
            position: "absolute",
            bottom: "calc(100% + 12px)",
            right: 0,
            minWidth: "220px",
            background: "var(--bg-sidebar, #0f172a)",
            border: "1px solid var(--border-color, rgba(255,255,255,0.12))",
            borderRadius: "14px",
            padding: "6px",
            boxShadow: "0 16px 36px rgba(0, 0, 0, 0.45), 0 4px 12px rgba(0, 0, 0, 0.25)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            zIndex: 1050,
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            animation: "attachmentFadeIn 0.18s ease-out",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.6px",
              color: "var(--text-secondary)",
              opacity: 0.75,
              padding: "6px 10px 4px",
            }}
          >
            Attach or Capture
          </div>

          {/* 1. Camera / Take Live Photo */}
          <button
            type="button"
            className="attachment-menu-item"
            onClick={() => {
              setIsOpen(false);
              setIsCameraOpen(true);
            }}
          >
            <div
              className="attachment-item-icon"
              style={{ background: "rgba(236, 72, 153, 0.15)", color: "#ec4899" }}
            >
              <Camera size={17} />
            </div>
            <div className="attachment-item-text">
              <span className="attachment-item-title">Camera</span>
              <span className="attachment-item-desc">Take live photo</span>
            </div>
          </button>

          {/* 2. Photos & Gallery */}
          <button
            type="button"
            className="attachment-menu-item"
            onClick={() => imageInputRef.current?.click()}
          >
            <div
              className="attachment-item-icon"
              style={{ background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6" }}
            >
              <ImageIcon size={17} />
            </div>
            <div className="attachment-item-text">
              <span className="attachment-item-title">Photos & Images</span>
              <span className="attachment-item-desc">Browse your pictures</span>
            </div>
          </button>

          {/* 3. Document / File */}
          <button
            type="button"
            className="attachment-menu-item"
            onClick={() => fileInputRef.current?.click()}
          >
            <div
              className="attachment-item-icon"
              style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}
            >
              <FileText size={17} />
            </div>
            <div className="attachment-item-text">
              <span className="attachment-item-title">Upload File</span>
              <span className="attachment-item-desc">Code, PDF, text & docs</span>
            </div>
          </button>

          {/* 4. Folder */}
          <button
            type="button"
            className="attachment-menu-item"
            onClick={() => folderInputRef.current?.click()}
          >
            <div
              className="attachment-item-icon"
              style={{ background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}
            >
              <Folder size={17} />
            </div>
            <div className="attachment-item-text">
              <span className="attachment-item-title">Upload Folder</span>
              <span className="attachment-item-desc">Project or data folder</span>
            </div>
          </button>
        </div>
      )}

      {/* Live Camera Capture Modal */}
      {isCameraOpen && (
        <div
          className="camera-modal-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "16px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeCamera();
          }}
        >
          <div
            className="camera-modal-card"
            style={{
              width: "100%",
              maxWidth: "540px",
              background: "var(--bg-sidebar, #0f172a)",
              border: "1px solid var(--border-color, rgba(255,255,255,0.12))",
              borderRadius: "20px",
              overflow: "hidden",
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.6)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid var(--border-color, rgba(255,255,255,0.08))",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "10px",
                    background: "rgba(236, 72, 153, 0.15)",
                    color: "#ec4899",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Camera size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
                    {capturedPhoto ? "Photo Preview" : "Take Photo"}
                  </h3>
                  <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                    {capturedPhoto ? "Review your photo before uploading" : "Point camera and click capture"}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {!capturedPhoto && isStreamReady && (
                  <button
                    type="button"
                    className="action-btn"
                    onClick={switchCamera}
                    title="Flip / Switch Camera"
                    style={{
                      width: "34px",
                      height: "34px",
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.08)",
                      border: "none",
                      color: "var(--text-primary)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <SwitchCamera size={18} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeCamera}
                  style={{
                    width: "34px",
                    height: "34px",
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.08)",
                    border: "none",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Video Viewport / Photo Viewport */}
            <div
              style={{
                position: "relative",
                width: "100%",
                height: "360px",
                background: "#000",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {cameraError ? (
                <div
                  style={{
                    padding: "24px",
                    textAlign: "center",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <AlertCircle size={40} color="#f87171" />
                  <p style={{ color: "#f87171", fontSize: "14px", margin: 0, maxWidth: "340px" }}>
                    {cameraError}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      closeCamera();
                      nativeCameraInputRef.current?.click();
                    }}
                    style={{
                      marginTop: "8px",
                      background: accentColor,
                      color: "white",
                      border: "none",
                      padding: "10px 18px",
                      borderRadius: "10px",
                      fontSize: "14px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <Camera size={16} /> Open Native Device Camera
                  </button>
                </div>
              ) : capturedPhoto ? (
                <img
                  src={capturedPhoto}
                  alt="Captured"
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      transform: cameraFacing === "user" ? "scaleX(-1)" : "none",
                    }}
                  />
                  {!isStreamReady && (
                    <div
                      style={{
                        position: "absolute",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "10px",
                        color: "#94a3b8",
                      }}
                    >
                      <div className="spinner" style={{ width: "28px", height: "28px" }} />
                      <span style={{ fontSize: "13px" }}>Starting camera...</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Bottom Controls */}
            <div
              style={{
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "14px",
                borderTop: "1px solid var(--border-color, rgba(255,255,255,0.08))",
              }}
            >
              {capturedPhoto ? (
                <>
                  <button
                    type="button"
                    onClick={retakeSnapshot}
                    style={{
                      padding: "10px 20px",
                      borderRadius: "12px",
                      background: "rgba(255,255,255,0.1)",
                      color: "var(--text-primary)",
                      border: "none",
                      fontSize: "14px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      transition: "background 0.2s",
                    }}
                  >
                    <RotateCcw size={16} /> Retake
                  </button>
                  <button
                    type="button"
                    onClick={confirmCapturedPhoto}
                    style={{
                      padding: "10px 24px",
                      borderRadius: "12px",
                      background: accentColor,
                      color: "white",
                      border: "none",
                      fontSize: "14px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      boxShadow: `0 4px 16px ${accentColor}66`,
                      transition: "transform 0.15s",
                    }}
                  >
                    <Check size={17} /> Use Photo
                  </button>
                </>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
                  <button
                    type="button"
                    onClick={takeSnapshot}
                    disabled={!isStreamReady}
                    style={{
                      width: "60px",
                      height: "60px",
                      borderRadius: "50%",
                      background: "white",
                      border: `4px solid ${accentColor}`,
                      cursor: isStreamReady ? "pointer" : "not-allowed",
                      opacity: isStreamReady ? 1 : 0.5,
                      boxShadow: "0 0 20px rgba(255,255,255,0.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                      transition: "transform 0.1s ease",
                    }}
                    title="Capture Photo"
                  >
                    <div
                      style={{
                        width: "46px",
                        height: "46px",
                        borderRadius: "50%",
                        background: accentColor,
                      }}
                    />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttachmentMenu;
