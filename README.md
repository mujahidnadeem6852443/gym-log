# Gym Log

A fast, offline-first workout logger. Every set you log is saved on your phone
instantly, and — once you sign in with your own Google account — mirrored into
a **Google Sheet that lives in your own Google Drive**. No app store, no
server, no monthly cost.

---

## How it works

```
Your phone (browser)
   |
   |-- localStorage  (always-on local database — works with no internet)
   |
   `-- Google Sheets API  (direct browser -> Google, no middle server)
          |
          `-- "Gym Log Data" spreadsheet, created in *your* Drive
```

There is no backend server. Your browser talks straight to Google's API using
a Google Sign-In popup. Only you (or whoever signs in on a given phone) can
see or write to their own sheet — one Google account, one private spreadsheet.

### The spreadsheet layout

The first time you sign in, the app creates **"Gym Log Data"** in your Drive
with three tabs:

- **Log** — one row per *set*: `Date, Weekday, Month, Time, Workout ID,
  Exercise, Set #, Reps, Weight, Unit, Set Volume`. This is the raw data —
  every rep/weight you ever enter, exactly as recorded.
- **Sessions** — one row per *workout*: `Date, Weekday, Month, Start Time, End
  Time, Duration, Exercises, Sets, Total Volume, Workout ID`. Good for
  tracking session length and how much total weight you moved.
- **Summary** — a live formula (`QUERY`) that totals volume and sets per
  month automatically as new rows land in Log. Open it any time — no manual
  refresh needed.

Dates are written as real `YYYY-MM-DD` values and a separate `Month` column
(`YYYY-MM`) is included specifically so you can sort, filter, or pivot by
month cleanly — this is what makes "day and month aligned" analysis easy:
select any column in Sheets and use **Data > Create a filter**, or
**Insert > Pivot table**, to slice by exercise, month, or day.

---

## One-time setup: Google Client ID (free, ~5 minutes)

The app needs a **Google OAuth Client ID** so Google knows which app is
asking to write to your Sheet. This is free forever for personal use and
does not require publishing or verifying anything.

1. Go to [console.cloud.google.com](https://console.cloud.google.com/) and
   sign in with your Google account.
2. Create a new project (top-left project picker → **New Project**). Name it
   anything, e.g. "Gym Log".
3. Go to **APIs & Services → Library**, search for and **Enable**:
   - Google Sheets API
   - Google Drive API
4. Go to **APIs & Services → OAuth consent screen**.
   - User Type: **External**.
   - Fill in an app name ("Gym Log"), your email as support/contact email.
   - Scopes: you can skip adding any here (the app requests them at sign-in).
   - Under **Test users**, add your own Gmail address (and anyone else's who
     will use the app). While the app stays in "Testing" mode this is free
     and needs no Google review — you'll just see an "unverified app"
     warning on first sign-in, which is expected; click **Advanced → Go to
     Gym Log (unsafe)** to continue. It's safe because it's *your own app*.
5. Go to **APIs & Services → Credentials → + Create Credentials → OAuth
   client ID**.
   - Application type: **Web application**.
   - Name: "Gym Log Web".
   - Under **Authorized JavaScript origins**, add the exact URL you'll host
     the app at (see hosting options below), e.g.
     `https://yourname.github.io` or `http://localhost:8080`. You can add
     multiple origins.
   - Click **Create**. Copy the **Client ID** (ends in
     `.apps.googleusercontent.com`).
6. Paste that Client ID into the app's **Settings (⚙) → Google Client ID**
   field and tap **Save Client ID**, then **Sign in with Google**.

The Client ID is not a secret (it's meant to be public/embedded in
front-end apps like this one) — it's safe to leave saved in the app.

**Note:** each *user* of the app just signs in with their own Google
account and gets their own private "Gym Log Data" spreadsheet — you only do
the Client ID setup once, as the person hosting the app.

---

## Hosting it (needed for install + sign-in to work)

Google Sign-In requires the page to be served over **HTTPS** (or
`http://localhost` for local testing) — it won't work from a plain `file://`
double-click or a bare LAN IP address. Two free options:

### Option A — GitHub Pages (recommended, permanent, free)

```bash
cd gym-log-app
git init
git add .
git commit -m "Gym Log"
git branch -M main
git remote add origin https://github.com/<you>/gym-log.git
git push -u origin main
```

Then in the GitHub repo: **Settings → Pages → Deploy from branch → main →
/(root)**. Your app will be live at `https://<you>.github.io/gym-log/`.
Use that exact URL as the "Authorized JavaScript origin" in step 5 above
(scheme + host only, e.g. `https://<you>.github.io`).

### Option B — Local network, for testing on your own Wi-Fi

```bash
cd gym-log-app
python3 -m http.server 8080
```

Visit `http://localhost:8080` on the same Mac to test sign-in (add
`http://localhost:8080` as an authorized origin). This won't work from your
phone unless your phone can reach `localhost` on your Mac — for a phone you
need Option A (or Netlify/Vercel free static hosting, same idea).

---

## Installing on your phone (no App Store / Play Store)

Once hosted at a URL (Option A above):

**iPhone (Safari):**
1. Open the URL in Safari (must be Safari, not Chrome, for install to work).
2. Tap the **Share** icon (square with an arrow) → **Add to Home Screen**.
3. Tap **Add**. It now opens full-screen like a native app, works offline for
   the interface, and syncs to Sheets when online.

**Android (Chrome):**
1. Open the URL in Chrome.
2. Tap the **⋮** menu → **Install app** (or you may see an automatic
   "Add Gym Log to Home screen" banner).
3. Confirm. It installs like a native app icon.

Both are completely free — this is a **PWA (Progressive Web App)**, not an
App Store / Play Store listing, so there's no developer fee, no review
process, no cost.

---

## Security notes

- **Minimal scope**: the app only requests `drive.file` (it can only see/edit
  files *it* created — not your entire Drive) and `userinfo.email` (to show
  who's signed in and to keep each Google account's spreadsheet separate on
  a shared device). It never requests broad Drive or Gmail access.
- **No server, no stored secrets**: your Google access token lives only in
  memory in the browser tab and is never written to disk/localStorage. It
  expires automatically (~1 hour) and is silently renewed only while you're
  signed in and using the app.
- **Content-Security-Policy** is set in `index.html` to restrict which
  domains the page can load scripts from or send data to (only Google's
  sign-in and API domains) — this limits damage if any injected script
  somehow ended up on the page.
- **Your data, your account**: nothing passes through any third-party
  server. Traffic goes straight from your browser to `googleapis.com`.
- Deleting a workout in the app only removes it locally — it intentionally
  does **not** delete the corresponding rows from your Google Sheet, so your
  Sheet is safe from accidental taps. Delete rows in Sheets directly if you
  want them gone there too.

---

## What's deliberately not built yet

To keep this fast and simple, later ideas (exercise autocomplete, "last time
you did this" comparisons, personal records, rest timers, training
templates) are intentionally left for a future version — see
`Context.txt` in the original project notes for the full roadmap. The
current focus is: **reliable logging, your own Google Sheet as the real
database, and a phone-installable app — for free.**
