# Nexuss AI Workspace 🚀

A premium, world-class AI dashboard featuring Chat, Code Generation, and Content Creation tools. Built with a focus on performance, aesthetics, and professional utility.

## 🌟 Key Features

- **🧠 Conversation Memory**: Nexuss AI now remembers your previous context, allowing for natural, multi-turn conversations.
- **💬 Executive Chat**: Professional, structured AI responses with Markdown support.
- **💻 Code Architect**: Dedicated tool for generating clean, optimized code across multiple languages.
- **✍️ Content Studio**: Generate high-quality blogs, emails, and creative content instantly.
- **🎙️ Voice Interface**: Integrated speech-to-text (STT) and text-to-speech (TTS) for hands-free interaction.
- **📱 PWA Optimized**: Fully responsive Progressive Web App with 100/100 PWABuilder score compatibility.
- **🛡️ Secure & Scalable**: Multi-model fallback strategy using OpenRouter API.

## 🏗️ Project Structure

```text
AI_window/
├── backend/                # Node.js Express Server
│   ├── server.js           # Main entry point & API logic
│   ├── .env                # Environment variables (API Keys)
│   ├── serviceAccountKey.json # Firebase Admin SDK key
│   └── package.json        # Backend dependencies
├── frontend/               # React Frontend (SPA)
│   ├── src/
│   │   ├── components/     # UI Components
│   │   ├── App.js          # Root Component & Context
│   │   ├── Chat.js         # Chat Interface with History
│   │   ├── CodeGenerator.js # Code Gen Logic
│   │   └── apiConfig.js    # API Endpoints configuration
│   ├── public/             # Static assets & PWA Manifest
│   └── package.json        # Frontend dependencies
└── README.md               # Project documentation
```

## 🛠️ Getting Started

### 1. Prerequisites
- Node.js (v16+)
- npm or yarn
- OpenRouter API Key

### 2. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure Environment Variables:
   Create a `.env` file in the `backend/` folder:
   ```env
   ZAI_API_KEY=your_openrouter_api_key_here
   PORT=5001
   ```
4. Start the server:
   ```bash
   npm start
   ```

### 3. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure Backend URL:
   Update `src/apiConfig.js` or set environment variable:
   ```env
   REACT_APP_BACKEND_URL=http://localhost:5001
   ```
4. Start the development server:
   ```bash
   npm start
   ```

## 🚀 Deployment

- **Frontend**: Best deployed on [Vercel](https://vercel.com).
- **Backend**: Best deployed on [Render](https://render.com).

> [!IMPORTANT]
> Never commit your `.env` or `serviceAccountKey.json` files to GitHub. They are included in `.gitignore` by default.

## 📄 License
MIT License - Feel free to use this project for your own AI workspace!
