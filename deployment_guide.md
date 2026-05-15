# 🚀 Nexuss AI: Deployment & GitHub Guide

This guide explains how to manage your project structure, keep it professional, and host it online.

## 📂 1. Project Structure
Your project is now organized into two main folders. This is the "Best Practice" for professional developers:
- **`frontend/`**: All visual code (React, CSS, Assets).
- **`backend/`**: All logic code (Node.js, AI API logic).

## 📤 2. Push to GitHub
To show your project on your GitHub profile, follow these steps:

1. **Create a New Repo**: Go to [GitHub](https://github.com/new) and create a repository named `AI_window`.
2. **Connect & Push**: Open your terminal in the `AI_window` folder and run these commands:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/AI_window.git
   git branch -M main
   git push -u origin main
   ```
   *(Replace `YOUR_USERNAME` with your actual GitHub username)*

## 🌐 3. Permanent Public Links (Hosting)

### Frontend (Vercel)
1. Go to [Vercel](https://vercel.com).
2. Click **Add New Project**.
3. Import your GitHub `AI_window` repo.
4. Set the **Root Directory** to `frontend`.
5. Deploy! Vercel will give you a permanent link (e.g., `https://nexuss-ai.vercel.app`).

### Backend (Render)
1. Go to [Render](https://render.com).
2. Create a **Web Service**.
3. Connect your GitHub `AI_window` repo.
4. Set **Root Directory** to `backend`.
5. Add your `ZAI_API_KEY` in the **Environment Variables** section.
6. Deploy! Render will give you a backend URL.

> [!IMPORTANT]
> Once you have the Render URL, update the `fetch` calls in `frontend/src/Chat.js` and other files to use your Render URL instead of `localhost:5000`.

## 🎨 4. Latest UI Updates
- **Rounded Corners**: All chat messages now have a professional "bubble" design with 24px rounding.
- **Large Text**: Font sizes increased for better readability on all screens.
- **Executive AI**: The AI now speaks in a formal, professional, and highly competent tone.
