import React, { useState } from "react";
import { auth, googleProvider } from "./firebase";
import { signInWithPopup, updateProfile } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { Sparkles, Mail, ArrowRight, User } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      await signInWithPopup(auth, googleProvider);
      navigate("/");
    } catch (err) {
      setError("Google Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    if (!email || !name) {
      setError("Please enter both email and name.");
      return;
    }
    
    setError("");
    setLoading(true);
    
    try {
      // MOCK LOGIN: Save email and name to localStorage
      localStorage.setItem("nexus_mock_user", email);
      localStorage.setItem("nexus_mock_name", name);
      
      await new Promise(resolve => setTimeout(resolve, 800));
      window.location.href = "/";
    } catch (err) {
      console.error("Auth Error:", err);
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0f1e] p-4 font-sans">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      
      <div className="relative w-full max-w-[420px] bg-[#162033]/80 backdrop-blur-xl p-8 rounded-[32px] border border-white/10 shadow-2xl">
        
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
            <Sparkles size={34} className="text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">Welcome to Nexus</h1>
          <p className="text-slate-400 text-base">The future of professional AI Workspace</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
            <input 
              type="text" 
              placeholder="Your Full Name" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-[#0a0f1e] border border-slate-700/50 rounded-2xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
              required
              disabled={loading}
            />
          </div>

          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
            <input 
              type="email" 
              placeholder="Enter your email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-[#0a0f1e] border border-slate-700/50 rounded-2xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
              required
              disabled={loading}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 group disabled:opacity-70"
          >
            {loading ? "Signing in..." : "Continue to Dashboard"}
            {!loading && <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />}
          </button>
        </form>

        <div className="my-8 flex items-center gap-4">
          <div className="flex-1 h-[1px] bg-slate-800"></div>
          <span className="text-slate-500 text-xs font-bold tracking-widest">OR</span>
          <div className="flex-1 h-[1px] bg-slate-800"></div>
        </div>

        <button 
          onClick={handleGoogleLogin} 
          disabled={loading}
          className="w-full py-4 bg-white hover:bg-slate-50 text-slate-900 font-bold rounded-2xl transition-all flex items-center justify-center gap-3 shadow-md disabled:opacity-70"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
          Sign in with Google
        </button>

        <p className="text-center mt-8 text-slate-500 text-sm">
          By continuing, you agree to our <span className="text-indigo-400 cursor-pointer hover:underline">Terms of Service</span>
        </p>
      </div>
    </div>
  );
}
