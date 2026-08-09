# 🏋️ Gym Log

A fast, mobile-first, offline-first workout logger built for simple strength-training tracking.

Gym Log lets you record exercises, sets, reps, weights, muscle groups, and workout duration directly from your phone. Your workout is saved locally as you type, so the app continues working even without an internet connection. It also tells you whether you're actually progressing — every exercise you've logged more than once gets a trend chart comparing each session's total volume to the one before it.

Optionally, you can sign in with Google and sync your workout history to a private Google Sheet stored inside your own Google Drive.

No backend server.  
No database subscription.  
No App Store.  
No monthly cost.

---

## 🌐 Live App

**Gym Log:**  
https://mujahidnadeem6852443.github.io/gym-log/

The app can also be installed on your phone as a Progressive Web App (PWA).

---

## ✨ Features

### Workout Logging

Log:

- Exercise name
- Muscle group
- Sets
- Reps
- Weight
- Workout duration

Exercises can contain as many sets as needed.

Your current workout is automatically saved locally while you are entering it.

### ⏱ Workout Timer

Gym Log includes a built-in session stopwatch.

You can:

- Start the timer
- Stop the timer
- Reset it
- Save workout time independently from exercises

Workout duration is stored with the day's workout and can also be synchronized to Google Sheets.

### 📅 Workout Calendar

The calendar highlights days where workouts were recorded.

Workout days can show short muscle-group indicators such as:

- `C` — Chest
- `B` — Back
- `Bi` — Biceps
- `Tri` — Triceps
- `S` — Shoulders
- `L` — Legs
- `A` — Abs

For example:

```text
C/Tri
```

means Chest and Triceps were trained that day.

Tap a workout day to see the exercises and sets recorded for that date.

### 📖 Workout History

Gym Log keeps one main history record per calendar day.

If you:

1. Save part of a workout
2. Add more exercises later
3. Save again
4. Save additional workout time

the information is merged into that day's workout instead of creating unnecessary duplicate history entries.

Saved workouts can also be edited from history.

### 🚀 Launch Screen

On every open, Gym Log shows a brief (~2 second) splash screen with the app
logo before revealing the app — the same idea as a native app's launch
screen, so the app doesn't flash unstyled content while it loads.

### 📈 Progress & Progressive Overload

Gym Log tracks whether you're actually getting stronger at each exercise —
not just logging numbers, but telling you what they mean.

For every exercise you've logged **twice or more**, Gym Log computes that
session's **total volume** (reps × weight, summed across every set) and
compares it to your **previous session of that same exercise**:

| Change vs. last time | Status |
|---|---|
| More than +2% | 🟢 **Improved** |
| Within ±2% | 🔵 **Stable** |
| More than -2% | 🔴 **Declined** |

This is shown as a line chart — pick an exercise from the dropdown and see
every logged session plotted over time, with each segment colored by
whether that step improved, held steady, or dropped. The most recent value
is labeled directly on the chart, a legend keeps the colors unambiguous,
and a plain-language summary line spells it out either way:

```text
↑ up 6% vs last time (1958 kg)
```

Below the chart, every session for that exercise is also listed with its
date, total volume, and trend badge — the full detail behind the chart, not
just the picture.

A few things worth knowing:

- **Two sessions minimum.** An exercise you've only logged once has nothing
  to compare against yet, so it won't appear in the picker until you log it
  again.
- **This is entirely local.** Progress is computed from whatever is in your
  device's history — it doesn't read from or write to the Google Sheet, and
  it updates automatically the moment you save, edit, delete, or restore a
  workout, since it's always derived fresh from the same history those
  actions already keep in sync.
- **Exercise names are matched the same way autocomplete works** —
  case-insensitively, so "Bench Press" and "bench press" are tracked as the
  same exercise.

---

## 💾 Can I Use Gym Log Without Signing In?

**Yes.**

Google sign-in is not required for normal local workout logging.

Without signing in, Gym Log uses browser `localStorage`, so you can still:

- Log workouts
- Add exercises
- Record sets, reps, and weight
- Select muscle groups
- Use the workout timer
- Save workout duration
- View history
- Use the calendar
- Edit locally stored workouts
- See progressive-overload trend charts

### Limitation of local-only mode

Your workout data belongs to that browser/device.

If you clear site data, switch browsers, reset the phone, or lose the device, local-only history can be lost.

Google sign-in adds the cloud backup, sync, and restore layer.

---

## ☁️ Google Sheets Sync

When you sign in with Google, Gym Log can mirror your workout data into a private Google Sheet in your own Google Drive.

```text
Phone / Browser
      |
      |---- localStorage
      |
      |---- Google OAuth
                |
                v
        Google Drive API
        Google Sheets API
                |
                v
          Gym Log Data
          Google Sheet
```

There is no Gym Log backend server.

The browser communicates directly with Google's APIs.

---

## 👤 Separate Data for Every Google Account

Each Google account gets its own private spreadsheet.

```text
User A
   |
   v
User A's Google Drive
   |
   v
Gym Log Data
```

```text
User B
   |
   v
User B's Google Drive
   |
   v
Gym Log Data
```

Two users' workouts do not mix into one Sheet.

The same OAuth Client ID can be used by multiple authorized users, while each signed-in Google account accesses its own Drive and its own Gym Log data.

---

## 📊 Google Sheet Structure

The app creates a spreadsheet named:

```text
Gym Log Data
```

It contains an `Overview` tab, and every workout day gets its own date tab.

Example:

```text
Gym Log Data

├── Overview
├── 6 Aug 2026
├── 7 Aug 2026
├── 8 Aug 2026
└── ...
```

Each daily tab contains a simple workout table:

| Exercise | Sets | Reps | Weight (KG) | Muscle |
|----------|------|------|-------------|--------|
| Cable Rows | 3 | 12+12+10 | 60+55+55 | Back |
| Lat Pulldown | 3 | 10+10+8 | 65+65+70 | Back |
| Bicep Curl | 3 | 12+10+8 | 12+14+14 | Biceps |

Reps and weights correspond set-for-set.

Example:

```text
Reps:
12 + 12 + 10

Weight:
60 + 55 + 55
```

means:

```text
Set 1 → 12 reps × 60 kg
Set 2 → 12 reps × 55 kg
Set 3 → 10 reps × 55 kg
```

Workout duration is stored separately in the day's Sheet tab so that it can also be restored on another device.

---

## 🔄 Duplicate-Safe Sync

Gym Log is designed so that repeatedly pressing Sync does not keep appending the same workout again and again.

The sync behavior is intended to be idempotent:

```text
Workout created
      |
      v
Saved locally
      |
      v
Synced to Google Sheet
      |
      v
Already stored
```

When a workout is edited, its Sheet representation can be safely replaced rather than blindly appended.

The app also tracks workout IDs that were merged into a same-day history record so old IDs do not get resurrected repeatedly during restore.

---

## ♻️ Restore From Google Sheets

Google Sheets also acts as a backup.

If local browser data is lost, sign in with the same Google account and restore your workout history from its `Gym Log Data` spreadsheet.

```text
Google Sheet
     |
     v
Restore
     |
     v
Local Gym Log history
```

Restore is designed to avoid adding the same workout repeatedly if it already exists locally.

---

## 🔐 Google OAuth

Gym Log uses Google OAuth for Google Drive and Google Sheets access.

The app does not receive your Google password.

Authentication is handled by Google, and the browser uses the resulting OAuth access token to communicate directly with Google APIs.

The project is designed around limited access to:

- Files created by the application
- Google Sheets data used by Gym Log
- Basic signed-in account identification

Do not place an OAuth **Client Secret** inside the frontend.

A browser OAuth **Client ID** is expected to be public.

---

## 🛡 Privacy Architecture

Gym Log intentionally has no central application backend.

```text
You
 |
 |---- Local browser storage
 |
 `---- Google APIs
          |
          `---- Your Google Drive
```

Workout data stays either:

1. On your device
2. In your own Google Drive

There is no central Gym Log database collecting every user's workout history.

---

# ⚙️ Self-Hosting Setup

## 1. Create a Google Cloud Project

Open:

https://console.cloud.google.com/

Create a project such as:

```text
Gym Log
```

---

## 2. Enable Google APIs

Go to:

```text
APIs & Services
→ Library
```

Enable:

```text
Google Sheets API
Google Drive API
```

---

## 3. Configure Google Auth

Open:

```text
Google Auth Platform
```

For testing/personal use:

```text
Audience: External
Publishing status: Testing
```

Add the Google accounts that are allowed to use the app under:

```text
Audience
→ Test users
```

Example:

```text
youraccount@gmail.com
friend@gmail.com
anotheraccount@gmail.com
```

Multiple test users can use the same OAuth Client ID.

---

## 4. Create an OAuth Client

Go to:

```text
Google Auth Platform
→ Clients
→ Create Client
```

Choose:

```text
Application type:
Web application
```

---

## 5. Configure the Authorized JavaScript Origin

For GitHub Pages:

```text
https://YOUR_USERNAME.github.io
```

Example:

```text
https://mujahidnadeem6852443.github.io
```

Do not include the repository path in the JavaScript origin.

✅ Correct:

```text
https://mujahidnadeem6852443.github.io
```

❌ Incorrect:

```text
https://mujahidnadeem6852443.github.io/gym-log/
```

The app itself can still live at:

```text
https://mujahidnadeem6852443.github.io/gym-log/
```

---

## 6. Copy the OAuth Client ID

Google will generate a Client ID similar to:

```text
1234567890-xxxxxxxxxxxxxxxx.apps.googleusercontent.com
```

Use that Client ID in the app configuration.

The Client ID is not a password or secret.

Never expose the OAuth Client Secret in your HTML or JavaScript.

---

# 🚀 Deploy With GitHub Pages

```bash
git init
git add .
git commit -m "Initial Gym Log"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/gym-log.git
git push -u origin main
```

Then open:

```text
Repository
→ Settings
→ Pages
```

Choose:

```text
Deploy from branch
```

Then:

```text
main
/root
```

Your app will be published at:

```text
https://YOUR_USERNAME.github.io/gym-log/
```

---

# 🧪 Local Development

Do not rely on opening the HTML directly with `file://` if you want Google OAuth to work.

Serve the app locally:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

For local Google OAuth testing, also add:

```text
http://localhost:8080
```

to your OAuth client's Authorized JavaScript Origins.

---

# 📱 Install as an App

Gym Log can be installed as a PWA.

## iPhone

Open Gym Log in Safari:

```text
Share
→ Add to Home Screen
→ Add
```

## Android

Open Gym Log in Chrome:

```text
⋮
→ Install app
```

or:

```text
Add to Home screen
```

---

# 🧱 Technology Stack

Gym Log intentionally uses a small stack:

```text
HTML
CSS
Vanilla JavaScript
Browser localStorage
Google OAuth
Google Drive API
Google Sheets API
GitHub Pages
PWA
```

There is currently:

```text
No Node.js backend
No Express server
No PostgreSQL
No Firebase database
No AWS infrastructure
No monthly hosting bill
```

---

# 🏗 Architecture

```text
                   ┌────────────────────┐
                   │     Gym Log PWA    │
                   │   HTML / CSS / JS  │
                   └─────────┬──────────┘
                             │
             ┌───────────────┴───────────────┐
             │                               │
             ▼                               ▼
       localStorage                    Google OAuth
             │                               │
             │                         Access Token
             │                               │
             │                     ┌─────────┴─────────┐
             │                     ▼                   ▼
             │               Google Drive       Google Sheets
             │                    API                API
             │                     │                   │
             └─────────────────────┴─────────┬─────────┘
                                             │
                                             ▼
                                      Gym Log Data
                                        Spreadsheet
```

---

# 🎯 Design Goal

Gym Log focuses on one core idea:

> Make logging a workout fast enough that the tracker never gets in the way of the workout.

The current focus is:

- Fast exercise entry
- Reliable local storage
- One history record per day
- Workout calendar with muscle-group indicators
- Session duration, saved independently of exercises
- Progressive-overload trend tracking per exercise
- Google Sheets backup
- Restore capability
- Duplicate-safe synchronization
- Mobile installation

---

# 🔮 Future Ideas

Already shipped, despite once being on this list: exercise autocomplete,
"last time" values shown while logging, training-volume analytics, and
exercise progression charts (see **Progress & Progressive Overload** above).

Possible future improvements still on the table:

- Personal records (heaviest weight, best-rep-at-weight, per exercise)
- Estimated 1RM
- Active progressive-overload suggestions (a target weight/rep goal for your
  next session, not just a trend after the fact)
- Rest timer between sets
- Workout templates (e.g. Push / Pull / Legs)
- RPE / RIR tracking
- Body-weight tracking over time
- Per-exercise and per-workout notes

The goal is to add these features without sacrificing the simplicity and speed of the current app.

---

# 💰 Cost

Gym Log can run using free services:

- GitHub Pages
- Google OAuth
- Google Sheets
- Google Drive
- Browser localStorage

For normal personal use, no dedicated server is required.

---

# 👨‍💻 Author

**Mohammad Mujahid Nadeem**

Built as a personal strength-training tracker focused on simplicity, privacy, offline usability, and user-owned data.

---

## ⭐ Why Gym Log?

Most workout trackers require an account, backend database, subscription, or large mobile application.

Gym Log takes a simpler approach:

```text
Open it.
Log your workout.
Keep your data.
```

Use it locally with no account, or connect Google and keep a private backup in your own Drive.


## 📄 License

This project is licensed under the MIT License.

You are free to use, modify, and distribute Gym Log in accordance with the
terms of the license.
