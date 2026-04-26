# Public Link & Deployment Guide

To make your project accessible from any laptop and ensure the AI works, follow these steps.

## 1. Quick Public Link (Temporary)
You can use **Localtunnel** to share your local project instantly. This is great for a quick demo on another laptop.

### Steps:
1.  **Start your Backend**: 
    In your terminal, go to the `backend` folder and run:
    ```bash
    npm start
    ```
2.  **Start your Frontend**: 
    Open a new terminal, go to the `frontend` folder and run:
    ```bash
    npm start
    ```
3.  **Generate the Link**: 
    Open a *third* terminal and run:
    ```bash
    npx localtunnel --port 3000
    ```
    *This will give you a link like `https://funny-cats-jump.loca.lt`. Open this on any laptop.*

---

## 2. Permanent Public Deployment (Recommended)
For a permanent link that stays active even if your laptop is off, use these free platforms.

### Frontend (Vercel)
1.  Go to [Vercel](https://vercel.com).
2.  Connect your GitHub repository.
3.  Deploy the `frontend` folder.
4.  Vercel will give you a permanent `https://your-app.vercel.app` link.

### Backend (Render)
1.  Go to [Render](https://render.com).
2.  Create a "Web Service".
3.  Connect your GitHub repository and point it to the `backend` folder.
4.  Add your `.env` variables (like `ZAI_API_KEY`) in the Render dashboard.
5.  Render will give you a backend URL (e.g., `https://your-backend.onrender.com`).

> [!IMPORTANT]
> Once you have the Render URL, update the `fetch` calls in your `frontend/src/Chat.js` and other generators to point to the Render URL instead of `localhost:5000`.

---

## AI Troubleshooting
If the AI doesn't reply:
- Ensure the **Backend** is running.
- Check the **API Key** in the `.env` file.
- Ensure the model name is correct (I have already updated it to `google/gemini-2.0-flash-001`).
