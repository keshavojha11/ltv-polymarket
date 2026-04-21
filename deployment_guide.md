# Deployment Guide: Polymarket LTV Risk Simulator

Follow these steps to deploy your full-stack application to **Railway** (Backend) and **Vercel** (Frontend).

---

## Step 1: Push to GitHub

Ensure your project is in a GitHub repository.

```bash
git init
git add .
git commit -m "Initial commit for deployment"
# Create repo on GitHub and link it
git remote add origin https://github.com/yourusername/polymarket-ltv.git
git branch -M main
git push -u origin main
```

---

## Step 2: Deploy Backend to Railway

Railway is ideal for the Python FastAPI backend.

1.  **Login to Railway**: Go to [railway.app](https://railway.app).
2.  **New Project**: Select "Deploy from GitHub repo".
3.  **Configure**:
    *   Select your repository.
    *   **Root Directory**: Set this to `backend`.
    *   Railway will detect the `requirements.txt` and `Procfile` and deploy automatically.
4.  **Public URL**: Once deployed, go to the **Settings** tab and click **Generate Domain**.
    *   *Copy this URL (e.g., `https://polymarket-ltv-production.up.railway.app`). You will need it for the frontend.*

---

## Step 3: Deploy Frontend to Vercel

Vercel is the best platform for Vite/React applications.

1.  **Login to Vercel**: Go to [vercel.com](https://vercel.com).
2.  **New Project**: Click "Add New" -> "Project" and select your GitHub repo.
3.  **Configure**:
    *   **Root Directory**: Set this to `frontend`.
    *   **Framework Preset**: Should be auto-detected as "Vite".
4.  **Environment Variables**:
    *   Click the "Environment Variables" dropdown.
    *   Add a new variable:
        *   **Key**: `VITE_API_URL`
        *   **Value**: Paste your Railway Backend URL (without a trailing slash).
5.  **Deploy**: Click "Deploy".

---

## Step 4: Verification

Once both are deployed:

1.  Visit your Vercel URL.
2.  The dashboard should load. If you see data, it's successfully communicating with the Railway backend!
3.  **CORS**: The backend is configured with `allow_origins=["*"]`, so it will accept requests from your Vercel domain automatically.

---

## Troubleshooting

-   **Backend Failing**: Check Railway logs. Ensure the `Procfile` is in the `backend/` root.
-   **Frontend "Can't find data"**: Check if `VITE_API_URL` was set correctly. You can check the browser console to see if requests are hitting the wrong URL.
-   **Mock Data**: If Railway cannot reach the Polymarket API due to server-side restrictions, the backend will automatically serve mock data so the dashboard still works.
