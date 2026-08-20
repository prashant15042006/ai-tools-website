# Nexuss AI Workspace 🚀

<div align="center">

![React](https://img.shields.io/badge/React-18.3.1-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%26%20Firestore-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![Blockchain](https://img.shields.io/badge/Cryptography-SHA--256%20Ledger-6366F1?style=for-the-badge&logo=blockchaindotcom&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-100%2F100-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)
![Deployment](https://img.shields.io/badge/Deploy-Vercel%20%2B%20Render-000000?style=for-the-badge&logo=vercel&logoColor=white)

**An intelligent, tamper-proof AI Workspace featuring Instant Dashboard Restoration, High-Performance Multi-Model AI Routing, Photorealistic Image Studio, and a Local Cryptographic SHA-256 Blockchain Ledger.**

</div>

---

## ⛓️ Blockchain Ledger & Cryptographic Verification Deep-Dive

Nexuss AI incorporates a **client-side immutable cryptographic ledger** designed to secure, verify, and timestamp prompt-response transactions directly within browser memory and local storage.

### 📐 Anatomy of a Nexuss Block

```text
┌────────────────────────────────────────────────────────────────────────┐
│                              BLOCK #N                                  │
├────────────────────────────────────────────────────────────────────────┤
│  index         : 12                                                    │
│  timestamp     : 2026-08-20T12:00:00.000Z                              │
│  prompt        : "Write a React Hook for responsive layout"            │
│  responseHash  : e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca4... │
│  previousHash  : 406307f4c2ddba99671dac1837b9570b568af9cdcf744c1d...  │
│  nonce         : 0                                                     │
│  isOffline     : false                                                 │
├────────────────────────────────────────────────────────────────────────┤
│  hash          : 1e4071c23343c3a3e1d99be9f493c75676baef97ae23309d...  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Links to Block #N+1 previousHash)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                             BLOCK #N+1                                 │
├────────────────────────────────────────────────────────────────────────┤
│  index         : 13                                                    │
│  previousHash  : 1e4071c23343c3a3e1d99be9f493c75676baef97ae23309d...  │
│  hash          : 8dcca20f188339ab42b109e9f493c75676baef97ae23309d...  │
└────────────────────────────────────────────────────────────────────────┘
```

### 🛡️ Cryptographic Mechanism & Features
1. **Dual Hashing Strategy**:
   - **Primary Engine**: Web Cryptography API (`window.crypto.subtle.digest("SHA-256", buffer)`) producing standard 256-bit hexadecimal digests.
   - **Fault-Tolerant Fallback**: Custom 64-character deterministic polynomial bitwise hash (`jsHashFallback`) for non-secure HTTP local contexts and older mobile webviews.
2. **Immutable Chaining**:
   - Block $N$ computes its hash as:
     $$\text{Hash}_N = \text{SHA256}(\text{Index} + \text{Timestamp} + \text{Prompt} + \text{ResponseHash} + \text{Hash}_{N-1} + \text{Nonce})$$
   - Any modification to past queries, timestamps, or AI responses immediately breaks the hash chain for all subsequent blocks.
3. **Live Tamper Detection**:
   - `verifyBlockchainIntegrity()` iterates across the entire ledger and asserts that $\text{Block}[i].\text{previousHash} \equiv \text{Block}[i-1].\text{hash}$.
   - Live security status is surfaced in the Settings View (`✓ Chain Valid & Intact` vs `⚠ Integrity Tampered`).
4. **Memory-Optimized Rolling Window**:
   - Retains an active window of the latest **150 blocks**, ensuring zero storage bloat or browser performance lag.

---

## 🌟 Sequence-wise Feature Showcase

### 1. ⚡ Instant Dashboard & Optimistic Authentication
- **Zero-Flicker Session Restoration**: Synchronously initializes user state from cached local storage credentials, eliminating login redirect flashes when reopening the app.
- **Fast SPA Login (<50ms)**: Instant pure client-side transition to the dashboard without page refreshes.
- **Dual Authentication**: Google OAuth via Firebase Authentication alongside quick Email Profile access with cloud Firestore synchronization.

### 2. 💬 Multi-Turn Intelligent AI Chat
- **Conversational Context**: Preserves the last 10 turns of dialogue for coherent, multi-step assistance.
- **Multi-Modal Vision Analysis**: Pre-processes uploaded screenshots, documents, and charts via vision models.
- **Rich Output Rendering**: Native Markdown parsing, responsive tables with custom borders, and code blocks with one-click copy.
- **Voice Engine**: Integrated Text-to-Speech (TTS) and Speech-to-Text (STT) with customizable voice presets (including Ironman Hindi/English).

### 3. 🎨 Image Studio (FLUX.1 Photorealistic AI)
- **FLUX.1 Generation Engine**: Text-to-image generator supporting `flux-realism`, `flux`, and `turbo` models.
- **AI Prompt Enhancer**: Automatically enriches short or Hinglish prompts into photorealistic descriptive English prompts.
- **Aspect Ratio Control**: 1:1 (Square), 16:9 (Landscape), 9:16 (Portrait/Story), and 4:3 ratios.
- **Asset History & Quick Download**: Download images directly or reload prompt seeds for instant re-generations.

### 4. 💻 Code Architect & Debugger
- **Multi-Language Generation**: Clean, production-ready code in React, Python, JavaScript, Java, C++, TypeScript, and SQL.
- **PreRenderer & Syntax Highlighting**: Dark-mode code cards with instant copy functionality.

### 5. ✍️ Content Writing Studio
- **Professional Templates**: Instant generation of corporate emails, essays, SEO blog posts, social media captions, and video scripts.

### 6. 📁 Projects & Prompt Manager
- **Prompt Library**: Save, search, categorize, and transfer custom prompts into Chat, Code, or Content tools in one click.
- **Cloud Project Storage**: Sync project assets with backend and local device storage.

### 7. ⚡ Smart Dynamic Routing & Fail-Safe AI Chain
- **Health-Aware Routing**: Bypasses sleeping backend containers to route queries directly to Vercel Serverless when the backend is booting.
- **Multi-Provider AI Fallback**:
  1. **Groq / Cerebras** (Ultra-fast completions)
  2. **OpenRouter Key Pool** (Llama 3.3, Nemotron, Gemma, DeepSeek)
  3. **Pollinations AI** (Keyless emergency backup)
- **100% Uptime Guarantee**: Delivers live AI responses under all network conditions.

### 8. 📶 Offline Intelligence Engine
- **Zero-Network Fallbacks**: Delivers responses even when completely disconnected from the internet.
- **Session Cache Search**: Matches previous online conversations from local cache.
- **Built-in Rule Engine & Math Solver**: Offline templates for code, email writing, greetings, and math expressions (e.g., `25 * 4`).

### 9. 📱 Mobile First & Progressive Web App (PWA)
- **Bottom Navigation**: Ergonomic mobile bottom bar for one-thumb navigation.
- **PWA Ready**: Add to Home Screen banner with offline Service Worker support (`sw.js`).
- **Theme Persistence**: Smooth Dark and Light modes with ambient glassmorphic background depth.

---

## 🔄 Dynamic Request & Fail-Safe Routing Architecture

```text
                        ┌────────────────────────┐
                        │   User Prompt Input    │
                        └───────────┬────────────┘
                                    │
                        ┌───────────▼────────────┐
                        │  Device Online Check   │
                        └─────┬────────────┬─────┘
                  Offline     │            │  Online
         ┌────────────────────┘            └────────────────────┐
         ▼                                                      ▼
┌───────────────────────────────┐              ┌─────────────────────────────────┐
│   Offline Intelligence Engine │              │      Connection Health Check    │
│  - Response Cache Search      │              └───────┬─────────────────┬───────┘
│  - Pre-compiled Templates     │         Online (Warm)│                 │ Slow/Connecting
│  - Local Math Solver          │                      ▼                 ▼
└───────────────┬───────────────┘             ┌────────────────┐ ┌────────────────┐
                │                             │ Render Backend │ │ Vercel Function│
                │                             │ (SSE Stream)   │ │  (/api/chat)   │
                │                             └───────┬────────┘ └───────┬────────┘
                │                                     │ Timeout (6s)     │
                │                                     └─────────►────────┘
                │                                                        │
                │                                       ┌────────────────┴───────────────┐
                │                                       │ 1. Cerebras (Ultra-Fast)       │
                │                                       │ 2. OpenRouter Key Pool         │
                │                                       │ 3. Keyless Pollinations AI     │
                │                                       └────────────────┬───────────────┘
                │                                                        │
                ▼                                                        ▼
        ┌────────────────────────────────────────────────────────────────────────┐
        │                 Record Response to SHA-256 Blockchain                  │
        │                    Render in Real-Time UI Bubble                       │
        └────────────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Project Architecture

```text
ai-tools-website/
├── api/                    # Vercel Serverless Functions
│   ├── chat.js             # Vercel Serverless chat handler with Pollinations fallback
│   ├── embed.js            # Embedding endpoint
│   └── chat/complete.js    # Non-streaming chat endpoint
├── backend/                # Node.js / Express Backend (Render)
│   ├── server.js           # Multi-provider streaming server
│   ├── .env                # Backend environment configuration
│   └── serviceAccountKey.json # Firebase Admin SDK configuration
├── frontend/               # React Application (SPA)
│   ├── public/             # PWA assets, icons, manifest.json, sw.js
│   ├── src/
│   │   ├── components/     # UI Views (Dashboard, Settings, Projects, ErrorBoundary)
│   │   ├── utils/          # Blockchain ledger, Offline AI, Voice Engine, Table renderer
│   │   ├── App.js          # App shell, context provider, and routing
│   │   ├── Chat.js         # AI Chat interface
│   │   ├── CodeGenerator.js# Code Generator
│   │   ├── ContentGenerator.js # Content Writer
│   │   ├── ImageGeneratorPro.js # FLUX.1 Image Studio
│   │   ├── PromptManager.js# Prompts library
│   │   └── firebase.js     # Firebase client configuration
│   └── package.json
└── README.md
```

---

## 🛠️ Getting Started

### 1. Prerequisites
- **Node.js**: v18+ recommended
- **npm** or **yarn**

### 2. Backend Setup
```bash
cd backend
npm install
npm start
```
*Backend runs on `http://localhost:5001`.*

### 3. Frontend Setup
```bash
cd frontend
npm install
npm start
```
*Frontend runs on `http://localhost:3000`.*

### 4. Build for Production
```bash
npm run build
```

---

## 🚀 Deployment

- **Frontend & Serverless APIs**: Deployed on [Vercel](https://vercel.com).
- **Backend Streaming Service**: Deployed on [Render](https://render.com).

---

## 📄 License
MIT License. Created for **Nexuss AI Workspace**.


