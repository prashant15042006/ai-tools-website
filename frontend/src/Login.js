import React, { useState, useEffect } from "react";
import { auth, googleProvider, db } from "./firebase";
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  Mail,
  ArrowRight,
  User,
  CheckCircle,
  Loader,
  AlertCircle,
} from "lucide-react";

// ── Save Google user → Firestore + localStorage → navigate to dashboard ──────
async function finalizeGoogleUser(user, navigateFn) {
  const userName = user.displayName || user.email?.split("@")[0] || "User";
  localStorage.setItem("nexus_user_name", userName);
  if (user?.email) {
    try {
      setDoc(
        doc(db, "users", user.email),
        {
          name: userName,
          email: user.email,
          lastLogin: serverTimestamp(),
          authProvider: "google",
        },
        { merge: true }
      ).catch((e) => console.warn("Firestore:", e));
    } catch (e) {
      console.warn("Firestore error:", e);
    }
  }
  navigateFn("/", { replace: true });
}

// ── Human-readable error messages ────────────────────────────────────────────
function getErrorMessage(code) {
  const messages = {
    "auth/api-key-not-valid":
      "Firebase API key valid nahi hai. Frontend build/configuration check karein.",
    "auth/invalid-api-key":
      "Firebase API key valid nahi hai. Frontend build/configuration check karein.",
    "auth/unauthorized-domain":
      "Yeh domain Firebase mein authorized nahi hai. Firebase Console → Authentication → Settings → Authorized Domains mein apna domain URL add karein.",
    "auth/operation-not-allowed":
      "Google Sign-In enable nahi hai. Firebase Console → Authentication → Sign-in method → Google ko Enable karein.",
    "auth/popup-blocked":
      "Browser ne popup block kar diya. Redirect method se login kar rahe hain...",
    "auth/network-request-failed":
      "Network error. Check your internet connection.",
    "auth/internal-error":
      "Firebase internal error. Please try again in a moment.",
    "auth/cancelled-popup-request": null, // silent — user opened another popup
    "auth/popup-closed-by-user": null,    // silent — user closed popup
  };
  return messages[code] ?? `Google login failed (${code}). Please try again.`;
}

export default function Login() {
  const [email, setEmail]           = useState("");
  const [name, setName]             = useState("");
  const [googleLoading, setGoogleLoading] = useState(false); // only for Google button
  const [emailLoading, setEmailLoading]   = useState(false); // only for email button
  const [error, setError]           = useState("");
  const [step, setStep]             = useState("auth"); // "auth" | "confirm-name"
  const navigate = useNavigate();

  // ── 1. Check if returning from Google redirect (runs once on mount) ─────────
  useEffect(() => {
    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          await finalizeGoogleUser(result.user, navigate);
        }
      })
      .catch((err) => {
        console.error("[Google Redirect] Error:", err.code, err.message);
        if (!auth.currentUser) {
          const msg = getErrorMessage(err.code);
          if (msg) setError(msg);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 2. Already logged-in user listener ───────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        const saved = localStorage.getItem("nexus_user_name");
        const nameToUse = saved || user.displayName || user.email?.split("@")[0];
        if (nameToUse) {
          localStorage.setItem("nexus_user_name", nameToUse);
          navigate("/", { replace: true });
        } else if (step !== "confirm-name") {
          setName("");
          setStep("confirm-name");
        }
      }
    });
    return () => unsub();
  }, [navigate, step]);

  // ── 3. Google Login handler ───────────────────────────────────────────────────
  const handleGoogleLogin = async () => {
    setError("");
    setGoogleLoading(true);

    try {
      // 1. Try popup first (works directly upon user click/touch gesture)
      const result = await signInWithPopup(auth, googleProvider);
      if (result?.user) {
        await finalizeGoogleUser(result.user, navigate);
      } else {
        setGoogleLoading(false);
      }
    } catch (popupErr) {
      console.warn("[Google Popup] Failed:", popupErr.code, popupErr.message);

      // Silent cancellation — user closed popup/dialog
      if (
        popupErr.code === "auth/popup-closed-by-user" ||
        popupErr.code === "auth/cancelled-popup-request"
      ) {
        setGoogleLoading(false);
        return;
      }

      // 2. If popup was blocked or failed, try redirect as fallback
      console.log("[Google] Trying redirect fallback...");
      try {
        await signInWithRedirect(auth, googleProvider);
        // Page will reload for redirect
      } catch (redirectErr) {
        console.error("[Google Redirect Fallback] Failed:", redirectErr.code, redirectErr.message);
        const msg = getErrorMessage(redirectErr.code);
        if (msg) setError(msg);
        setGoogleLoading(false);
      }
    }
  };

  // ── 4. Finalize (confirm-name step) ───────────────────────────────────────────
  const finalizeLogin = async (e) => {
    if (e) e.preventDefault();
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    try {
      const currentUser = auth.currentUser;
      const userEmail = currentUser?.email || email;
      if (userEmail) {
        setDoc(
          doc(db, "users", userEmail),
          {
            name,
            email: userEmail,
            lastLogin: serverTimestamp(),
            authProvider: currentUser ? "google" : "email_mock",
          },
          { merge: true }
        ).catch((e) => console.warn("Firestore:", e));
      }
    } catch (_) {}
    localStorage.setItem("nexus_user_name", name);
    navigate("/");
  };

  // ── 5. Email (mock) login ─────────────────────────────────────────────────────
  const handleEmailAuth = async (e) => {
    e.preventDefault();
    if (!email.trim() || !name.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    setError("");
    setEmailLoading(true);
    try {
      setDoc(
        doc(db, "users", email),
        {
          name,
          email,
          lastLogin: serverTimestamp(),
          authProvider: "email_mock",
        },
        { merge: true }
      ).catch((e) => console.warn("Firestore:", e));
      localStorage.setItem("nexus_mock_user", email);
      localStorage.setItem("nexus_user_name", name);
      await new Promise((r) => setTimeout(r, 500));
      window.location.href = "/";
    } catch (err) {
      setError("Login failed. Please try again.");
      setEmailLoading(false);
    }
  };

  // ── Screens ───────────────────────────────────────────────────────────────────

  // Confirm name step
  if (step === "confirm-name") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0f1e] p-4">
        <div className="w-full max-w-[420px] bg-[#162033]/80 backdrop-blur-xl p-8 rounded-[32px] border border-white/10 shadow-2xl text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={34} className="text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">One last thing!</h2>
          <p className="text-slate-400 mb-8 text-sm">
            What should we call you on the dashboard?
          </p>
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}
          <form onSubmit={finalizeLogin} className="space-y-4">
            <div className="relative">
              <User
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                size={20}
              />
              <input
                type="text"
                autoFocus
                placeholder="Your Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-[#0a0f1e] border border-slate-700/50 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
            >
              Go to Dashboard <ArrowRight size={20} />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Main login screen
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0f1e] p-4 font-sans">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative w-full max-w-[420px] bg-[#162033]/80 backdrop-blur-xl p-8 rounded-[32px] border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
            <Sparkles size={34} className="text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
            Welcome to Nexuss
          </h1>
          <p className="text-slate-400 text-base">Professional AI Workspace</p>
        </div>

        {/* Error box */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm leading-relaxed flex items-start gap-2">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Email login form */}
        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div className="relative">
            <User
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
              size={20}
            />
            <input
              type="text"
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-[#0a0f1e] border border-slate-700/50 rounded-2xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              required
              disabled={emailLoading || googleLoading}
            />
          </div>
          <div className="relative">
            <Mail
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
              size={20}
            />
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-[#0a0f1e] border border-slate-700/50 rounded-2xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              required
              disabled={emailLoading || googleLoading}
            />
          </div>
          <button
            type="submit"
            disabled={emailLoading || googleLoading}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 group disabled:opacity-60"
          >
            {emailLoading ? (
              <Loader size={20} className="animate-spin" />
            ) : (
              <>
                Continue
                <ArrowRight
                  size={20}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="my-8 flex items-center gap-4">
          <div className="flex-1 h-[1px] bg-slate-800" />
          <span className="text-slate-500 text-xs font-bold tracking-widest">OR</span>
          <div className="flex-1 h-[1px] bg-slate-800" />
        </div>

        {/* Google button — NEVER disabled on initial load */}
        <button
          onClick={handleGoogleLogin}
          disabled={googleLoading || emailLoading}
          className="w-full py-4 bg-white hover:bg-slate-100 text-slate-900 font-bold rounded-2xl transition-all flex items-center justify-center gap-3 shadow-md disabled:opacity-60"
        >
          {googleLoading ? (
            <>
              <Loader size={20} className="animate-spin text-slate-500" />
              <span>Connecting to Google...</span>
            </>
          ) : (
            <>
              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                alt="Google"
                className="w-5 h-5"
              />
              Sign in with Google
            </>
          )}
        </button>

        <p className="text-center mt-8 text-slate-500 text-xs">
          Secure, fast, and encrypted.
        </p>
      </div>
    </div>
  );
}
