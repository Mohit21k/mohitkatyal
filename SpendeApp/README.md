# Spende Together 💸

Spende Together is a React Native Web companion app designed for couples to seamlessly track, categorize, and sync their household transactions and bank SMS alerts in real-time. It runs cross-platform on web browsers, iOS, and Android using Expo and a Supabase backend.

---

## ✨ Features

- **Real-Time Synchronized Dashboard:** Combined family balance and individual spending totals dynamically updating via Supabase real-time subscriptions.
- **Inbox & SMS Processing:** Paste manual bank transaction SMS text and automatically parse details (amount, vendor, spender) using Supabase Deno Edge Functions.
- **Optimistic UI:** Instant approval and discarding of pending expenses with animations.
- **Easy Re-categorization:** Modal bottom sheets let you tap any transaction to immediately change the spender or category.
- **Offline Mode:** Seamless caching using `AsyncStorage` with a visual connectivity status badge (`🟢 Synced` / `🟡 Offline`).
- **One-Click Vercel Deploy:** Fast static deployment with Single Page Application routing support (no 404s on browser reload).

---

## 🛠 Prerequisites

Before starting, make sure you have the following installed on your machine:
- **Node.js** (v18 or higher recommended)
- **npm** (comes with Node)
- **Supabase CLI** (optional, for deploying/modifying Edge Functions)

---

## 🚀 Installation & Local Setup

### 1. Clone the repository and navigate to the directory
```bash
git clone https://github.com/Mohit21k/mohitkatyal.git
cd mohitkatyal/SpendeApp
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a file named `.env` in the root of the `SpendeApp` directory:
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-public-key
```

---

## 💻 Running the App Locally

### Start Expo Dev Server
Start the bundler to run on your web browser or test on a physical mobile device:
```bash
npm run start
```

* **For Web:** Press `w` in the terminal to launch the web client on `http://localhost:8081`.
* **For Mobile (Expo Go):** Install the **Expo Go** app on your iPhone or Android, and scan the QR code printed in the terminal.

---

## ⚡️ Database & Edge Functions Setup

The app relies on a Supabase database and Edge Functions for automated parsing.

### 1. Deploy the SMS Parsing Edge Function
Deploy the Deno serverless function to parse raw SMS copy-pastes:
```bash
npx supabase functions deploy process-sms --project-ref your-project-ref
```

### 2. Edge Function Environment Variables
Make sure to set the environment secrets inside your Supabase project dashboard so the function can connect back to your database:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

---

## 🌐 Deploying to Vercel (Production)

The web client can be deployed as a static Single Page Application (SPA) to Vercel.

### 1. Build the production static web bundle
This generates the optimized web assets and copies the routing file `vercel.json` into the output folder:
```bash
npx expo export
```

### 2. Deploy to Vercel
Deploy the compiled `dist` directory directly:
```bash
npx vercel deploy dist --prod
```
*(If this is the first deployment, Vercel will guide you through authenticating in your browser and automatically linking the project.)*
