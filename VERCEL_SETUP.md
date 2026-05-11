# Deploying NextBench to Vercel

Vercel is a free hosting platform that connects directly to your GitHub repository. Every time you push code, Vercel automatically builds and deploys your site.

---

## Step 1: Push Your Code to GitHub

Make sure all your latest changes are pushed:

```bash
git add .
git commit -m "Production-ready: cleanup, verification flow, Vercel deployment"
git push origin main
```

---

## Step 2: Create a Vercel Account

1. Go to [vercel.com](https://vercel.com) and click **Sign Up**.
2. Sign up with your **GitHub account** (recommended — this connects them automatically).

---

## Step 3: Import Your Repository

1. On the Vercel dashboard, click **"Add New…"** → **"Project"**.
2. You'll see a list of your GitHub repositories. Find **nextbench-1** and click **Import**.

---

## Step 4: Configure Build Settings

Vercel usually auto-detects Vite projects, but verify these settings:

| Setting | Value |
|---------|-------|
| **Framework Preset** | Vite |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |

---

## Step 5: Add Environment Variables

This is the most important step. Click **"Environment Variables"** and add these:

| Key | Value | Notes |
|-----|-------|-------|
| `VITE_FIREBASE_API_KEY` | `AIzaSyB7EBZm...` | From Firebase Console → Project Settings |
| `VITE_FIREBASE_AUTH_DOMAIN` | `nextbench-a11ed.firebaseapp.com` | From Firebase Console |
| `VITE_FIREBASE_PROJECT_ID` | `nextbench-a11ed` | From Firebase Console |
| `VITE_CLOUDINARY_CLOUD_NAME` | `dfhvyago4` | From Cloudinary Dashboard |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | `nextbench_unsigned` | From Cloudinary → Upload Presets |
| `VITE_FIREBASE_FIRESTORE_DB` | `(default)` | Leave as-is unless you use a named database |

> **Important**: All environment variables must start with `VITE_` to be available in the frontend build.

---

## Step 6: Deploy

Click **"Deploy"**. Vercel will:
1. Clone your repo
2. Run `npm install`
3. Run `npm run build`
4. Deploy the `dist/` folder to their global CDN

This takes about 30–60 seconds. You'll get a live URL like `https://nextbench-1.vercel.app`.

---

## Step 7: Update Firebase Auth Domain

After deploying, you need to tell Firebase to accept login requests from your new Vercel domain:

1. Go to [Firebase Console](https://console.firebase.google.com) → **Authentication** → **Settings** → **Authorized domains**.
2. Click **Add domain** and add your Vercel URL (e.g., `nextbench-1.vercel.app`).
3. If you have a custom domain later, add that too.

---

## Step 8: Custom Domain (Optional)

If you have a custom domain (e.g., `nextbench.app`):

1. In Vercel dashboard → your project → **Settings** → **Domains**.
2. Add your custom domain.
3. Follow Vercel's instructions to update your DNS records.
4. Remember to also add this domain to Firebase's authorized domains list (Step 7).

---

## Automatic Deployments

After the initial setup, every time you push to `main`, Vercel will automatically rebuild and redeploy your site. No manual steps needed.

```bash
# Future deployments are just:
git add .
git commit -m "your changes"
git push origin main
# → Vercel deploys automatically in ~30 seconds
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| **White screen after deploy** | Check that all `VITE_*` environment variables are set in Vercel. Redeploy after adding them. |
| **Google Sign-In doesn't work** | Add your Vercel domain to Firebase → Authentication → Authorized domains. |
| **Images don't upload** | Verify `VITE_CLOUDINARY_CLOUD_NAME` and `VITE_CLOUDINARY_UPLOAD_PRESET` are correct. |
| **Firestore permission denied** | Make sure you published the `firestore.rules` from this repo in the Firebase Console. |
| **404 on page refresh** | This shouldn't happen with Vercel's SPA handling, but if it does, add a `vercel.json` (see below). |

### SPA Fallback (if needed)

If you get 404s on page refresh, create a `vercel.json` in the project root:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

This tells Vercel to always serve `index.html` and let React Router handle the routing.
