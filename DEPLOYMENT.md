# Tessera Deployment Guide

## Quick Deploy (Simplest Method)

This guide deploys your app for **free** using:
- **Backend**: Render (free tier)
- **Frontend**: Vercel (free tier)

---

## Step 1: Deploy Backend to Render

### 1.1 Push your code to GitHub
```bash
cd /Users/hein.htet/tessera
git add .
git commit -m "Prepare for deployment"
git push origin main
```

### 1.2 Create Render Account
1. Go to [render.com](https://render.com) and sign up with GitHub
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repo (`tessera`)

### 1.3 Configure the Service
| Setting | Value |
|---------|-------|
| **Name** | `tessera-backend` |
| **Root Directory** | `backend` |
| **Runtime** | Python 3 |
| **Build Command** | `pip install -r requirements.txt && python init_db.py` |
| **Start Command** | `gunicorn app:app` |

### 1.4 Add Environment Variables
Click **"Environment"** and add:

| Key | Value |
|-----|-------|
| `JWT_SECRET_KEY` | (generate a random string, e.g., use `python -c "import secrets; print(secrets.token_hex(32))"`) |
| `STRIPE_SECRET_KEY` | `sk_test_...` (your Stripe test key) |
| `DATABASE_PATH` | `tessera.db` |
| `FLASK_DEBUG` | `false` |

### 1.5 Deploy
Click **"Create Web Service"**. Wait 2-3 minutes for deployment.

📝 **Copy your backend URL** (e.g., `https://tessera-backend.onrender.com`)

---

## Step 2: Deploy Frontend to Vercel

### 2.1 Create Vercel Account
1. Go to [vercel.com](https://vercel.com) and sign up with GitHub
2. Click **"Add New..."** → **"Project"**
3. Import your `tessera` repo

### 2.2 Configure the Project
| Setting | Value |
|---------|-------|
| **Framework Preset** | Vite |
| **Root Directory** | `frontend` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |

### 2.3 Add Environment Variable
In the **"Environment Variables"** section, add:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://tessera-backend.onrender.com` ← your Render URL |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` (your Stripe publishable key) |

### 2.4 Deploy
Click **"Deploy"**. Wait 1-2 minutes.

🎉 **Your app is live!** Your URL will be `https://tessera-xxx.vercel.app`

---

## Important Notes

### ⚠️ Free Tier Limitations

**Render Free Tier:**
- Server spins down after 15 minutes of inactivity
- First request after sleep takes ~30 seconds to wake up
- SQLite data persists ONLY during the service lifetime (resets on redeploy)

**Vercel Free Tier:**
- Great for frontend, no major limitations for demo use

### 🔑 Test Credentials

After deployment, create a user account through the Register page. For testing payments, use Stripe test card:
- Card: `4242 4242 4242 4242`
- Expiry: Any future date
- CVC: Any 3 digits

### 🔄 Updating Your Deployment

Just push to GitHub:
```bash
git add .
git commit -m "Update feature X"
git push origin main
```
Both Render and Vercel auto-deploy on push.

---

## Troubleshooting

### Backend not responding
- Check Render dashboard for errors
- Verify environment variables are set
- Check the logs in Render

### CORS errors
- Make sure `VITE_API_URL` in Vercel matches your exact Render URL
- URL should NOT have a trailing slash

### Database issues
- Render's free tier filesystem is ephemeral
- For persistent data, upgrade to paid tier or use a cloud database

---

## Alternative: One-Click Deploy (Even Simpler)

### Railway.app
If you have GitHub Student Pack, Railway gives you $5/month free credit:
1. Go to [railway.app](https://railway.app)
2. Click "Start a New Project" → "Deploy from GitHub repo"
3. Select your repo
4. Railway auto-detects Python and deploys both services

---

## Local Development Reference

```bash
# Backend
cd backend
source venv/bin/activate
python app.py

# Frontend (separate terminal)
cd frontend
npm run dev
```
