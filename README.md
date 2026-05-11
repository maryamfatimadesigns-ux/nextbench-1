# NextBench — Verified Student Marketplace

A premium, luxury student-to-student marketplace where verified students buy, sell, and exchange books, notes, uniforms, and more within a trusted campus ecosystem.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 + TypeScript + Vite |
| **Styling** | Tailwind CSS v4 |
| **Auth & Database** | Firebase (Auth + Firestore) |
| **Image Hosting** | Cloudinary (free tier) |
| **Animations** | Motion (Framer Motion) |
| **Icons** | Lucide React |
| **PWA** | vite-plugin-pwa + Workbox |
| **Hosting** | Vercel (free) |

## Features

- **Student Verification** — ID card + selfie upload, admin-gated approval flow
- **Real-time Chat** — Firebase Firestore realtime listeners for instant messaging
- **Admin Panel** — Approve/reject students, manage listings and reports
- **Product Marketplace** — List, browse, filter, wishlist, and reserve items
- **Progressive Web App** — Installable on mobile with offline caching
- **Security** — Firestore Security Rules enforce schema validation and access control

## Getting Started

### Prerequisites
- Node.js 20+
- A Firebase project ([firebase.google.com](https://firebase.google.com))
- A Cloudinary account ([cloudinary.com](https://cloudinary.com))

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd nextbench-1
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

You need:
- **Firebase**: Go to Firebase Console → Project Settings → Your App → SDK Config. Copy `apiKey`, `authDomain`, and `projectId`.
- **Cloudinary**: Go to Cloudinary Dashboard → Settings → Upload. Create an unsigned upload preset and copy your Cloud Name + Preset Name.

### 3. Firebase Setup

1. Enable **Google Sign-In** in Firebase Console → Authentication → Sign-in method.
2. Create a **Firestore Database** in Firebase Console → Firestore Database.
3. Go to Firestore → **Rules** tab and paste the contents of `firestore.rules` from this repo. Click **Publish**.

### 4. First Admin Account

After your first user signs up:
1. Go to Firebase Console → Firestore Database → `users` collection.
2. Find the user document and manually set:
   - `isAdmin: true`
   - `verified: true`
   - `verificationStatus: "approved"`

### 5. Run Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Deployment

See [VERCEL_SETUP.md](./VERCEL_SETUP.md) for step-by-step deployment instructions.

## Project Structure

```
src/
├── App.tsx                    # Routes
├── main.tsx                   # Entry point
├── index.css                  # Global styles & design tokens
├── mockData.ts                # Category list for product forms
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   └── Footer.tsx
│   └── ui/
│       ├── Loader.tsx         # Reusable loading spinner
│       ├── NotificationBell.tsx
│       └── ProtectedRoute.tsx # Auth/role guard
├── lib/
│   ├── firebase.ts            # Firebase init
│   ├── AuthContext.tsx         # Auth state provider
│   ├── ToastContext.tsx        # Toast notification system
│   ├── storage.ts             # Cloudinary upload helpers
│   ├── notifications.ts       # In-app notification helpers
│   ├── firestore-errors.ts    # Firestore error handler
│   └── utils.ts               # Misc utilities
└── pages/
    ├── LandingPage.tsx
    ├── Auth/
    │   ├── Login.tsx
    │   ├── Signup.tsx
    │   └── Verification.tsx   # ID upload + selfie flow
    └── Dashboard/
        ├── Marketplace.tsx
        ├── ProductDetail.tsx
        ├── SellItem.tsx
        ├── Profile.tsx
        ├── ChatList.tsx
        ├── ChatRoom.tsx
        ├── Wishlist.tsx
        ├── Notifications.tsx
        └── AdminPanel.tsx     # User verification + listing moderation
```

## License

Private project. All rights reserved.
