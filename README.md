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

### ⤵ Drop Sets

Any set can be marked as a drop set — you finish it, drop the weight, and
keep going without resting, and Gym Log tracks every stage of it.

Tap **Drop Set** on a set to add a continuation (its own reps and weight),
and **+ Add Drop** for another stage after that. Each stage shows inline
everywhere sets are displayed:

```text
Set 1: 12 reps × 60 kg  ⤵ 8×50 kg  ⤵ 5×40 kg
```

Every stage counts toward that set's total volume, so a drop set correctly
adds more to your Progress trend and weekly/monthly Attendance load than a
plain set with the same top-line reps and weight would.

### 🏋️ Bodyweight Exercises

Push-ups, pull-ups, dips, and anything else where your body is the
resistance get their own toggle. Check **Bodyweight Exercise** on any
exercise and its weight field relabels to **Added Weight** — for sets
where you're not adding anything extra, just leave it blank.

Because Gym Log doesn't track your body weight itself (see **Future
Ideas** below), a bodyweight set with no added weight counts its reps
directly as its training load, so it still shows up meaningfully in
Progress and Attendance instead of contributing zero. A set with added
weight (e.g. a weighted pull-up) uses the normal reps × weight math on
just that added weight.

### ⏱ Workout Timer

Gym Log includes a built-in session stopwatch.

You can:

- Start the timer
- Stop the timer
- Reset it
- Save workout time independently from exercises

Workout duration is stored with the day's workout and can also be synchronized to Google Sheets.

### ⏲ Per-Set Timing

Independent of the overall session stopwatch above, Gym Log can time each
individual set and the rest before it.

Tap **Start Set** when you begin a set and **Stop** when you finish — the
button live-updates while running. The moment you stop, a **Resting**
countdown appears on whichever set you're about to do next — even the
first set of a new exercise — so rest is tracked continuously through your
whole workout, not just within one exercise. Starting that next set
finalizes the rest time.

Every exercise shows a running summary once at least one of its sets has
been timed:

```text
Set time: 03:12 · Rest time: 08:45
```

A few things worth knowing:

- **Fully optional, and independent of each other.** Drop sets, bodyweight
  exercises, and per-set timing don't depend on one another — use whichever
  fit how you train, ignore the rest, and everything else behaves exactly
  as it always did.
- **Only one set can be timed at a time.** Starting a set automatically
  stops whatever else was running, so there's never any ambiguity about
  which set is currently being timed.
- **Only the most recently stopped set can be resumed.** Once you've moved
  on to a different set or exercise, the earlier one locks — it shows its
  finalized time as plain text, so you can never accidentally resume
  something you've already moved past.

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

The list defaults to your **last 4 weeks** of workouts, with a **Load older
workouts** button at the bottom to reveal earlier ones 4 weeks at a time —
after months of consistent logging this keeps the list scannable instead of
scrolling forever. Typing in the search box bypasses the window entirely and
searches your **complete** history, since searching means you're looking for
something specific, not browsing what's recent.

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
- **Shows the last 4 weeks by default.** Months of logging the same
  exercise would otherwise cram the chart and the session list with more
  points than you can read at a glance, so both default to a rolling
  28-day window anchored to that exercise's most recent session. A **Load
  older sessions** button at the bottom of the list extends the window
  another 4 weeks each time you press it — the trend badges (Improved /
  Stable / Declined) are always computed against your full history first,
  so they're correct even for a session whose actual "previous session"
  has scrolled out of view.
- **Big totals are compacted.** Once total volume climbs past 1,000, it's
  shown like `34.9K` instead of `34932` — same number, just easier to read
  at a glance. This applies everywhere a total shows up: the chart's axis
  and endpoint label, the summary line, and the session list.

### 📅 Attendance Progress

Separate from per-exercise Progress above, Gym Log also tracks how
consistently you're training overall — how many days you went, and how much
total work you did, week to week, month to month, and year to year.

Switch between three views:

- **Weekly** — attendance and total training load for each week, with weeks
  starting on **Sunday**
- **Monthly** — the same two numbers rolled up by calendar month
- **Yearly** — the same two numbers rolled up by calendar year

Each view shows two charts sharing the same time periods on their x-axis:

- A **line chart** of total training load (reps × weight, summed across
  every set of every exercise, every day in the period)
- A **bar chart** of days attended, with a dashed reference line at the
  maximum possible days in that period (7 for a week, 28–31 for a month,
  365/366 for a year)

Each period is compared to the one before it and colored the same way as
Progress — improved, stable, or declined — with a plain-language summary:

```text
↑ up 6% load vs last week · up on attendance (5/7 days)
```

Below the charts, every period is also listed with its date range, days
attended, and total load.

A few things worth knowing:

- **Fully independent from per-exercise Progress.** Attendance Progress has
  its own data, its own charts, and its own Google Sheet tabs — it never
  reads or affects exercise-level trend tracking, and vice versa.
- **This is entirely local**, same as Progress — it's derived fresh from
  your device's workout history every time you save, edit, delete, or
  restore a workout.
- **Google Sheets sync** writes Attendance Progress to its own tabs (see
  **Google Sheet Structure** below) so weekly/monthly/yearly history
  survives a restore on another device, same as your workouts.
- **Each view opens on a compact window, not your full history:**
  - **Weekly** shows the last **4 weeks** — about a month at a glance.
  - **Monthly** shows just the **current calendar year's** months, and
    resets to a fresh, short list the moment a new year starts — last
    December doesn't linger in view once January arrives.
  - **Yearly** shows the last **5 years**.

  A **Load older** button at the bottom of the list reveals the next chunk
  (4 more weeks, a full prior year's worth of months, or 5 more years) each
  time it's pressed. Trend badges are always computed against the complete,
  unwindowed history first, so a week's Improved/Stable/Declined status is
  correct even across a month boundary — the first week of a new month
  still compares against the real last week of the month before, whether or
  not that earlier week is currently on screen.
- **Big totals are compacted** the same way as Progress — `34.9K` instead
  of `34932` — in the chart, the summary line, and every row of the list.

### 👋 Your Name

Gym Log can greet you by name — a small personal touch, not an account
system.

The very first time you open the app, the Settings panel opens automatically
and asks:

```text
👋 Welcome! What should we call you?
```

Enter a name once and save it. From then on, it's shown right under the
logo:

```text
Gym·Log
Hi, Bruce Wayne
```

You can change it anytime from **Settings → Your Name**.

A few things worth knowing:

- **Stored locally first.** Your name is saved on the device the moment you
  save it — no sign-in required.
- **Follows your Google account, not the device.** If you're signed in,
  saving or editing your name also writes it to the `Overview` tab of your
  Google Sheet. Signing in on a new device with no local name yet adopts
  whatever's already saved in the Sheet, so your name follows you rather
  than resetting per device.
- **Falls back to your Google account's name** only if the Sheet has no name
  saved yet (e.g. brand new spreadsheet) — after that, the Sheet's value
  takes over as the source of truth.
- **A name already entered on a device is never silently overwritten** by
  sign-in — the auto-adopt only fills in a name when the device doesn't
  have one yet.

### 🔒 Staying Signed In

Signing in with Google stays signed in across reloads and closing/reopening
the app — no repeated "Reconnect" taps just from putting your phone down
mid-workout.

- Your session lasts **up to 3 hours** from when you sign in — long enough
  to cover a full workout — after which Gym Log automatically signs you
  out and you'll need to sign in again.
- Behind the scenes, the access token itself is reused across reloads
  while it's still valid (usually under an hour), and Gym Log attempts a
  silent, no-popup refresh past that — falling back to a manual
  "Reconnect Google Account" tap only if your browser blocks the silent
  attempt.

---

## 💾 Can I Use Gym Log Without Signing In?

**Yes.**

Google sign-in is not required for normal local workout logging.

Without signing in, Gym Log uses browser `localStorage`, so you can still:

- Log workouts
- Add exercises
- Record sets, reps, and weight
- Select muscle groups
- Log drop sets and bodyweight exercises
- Use the workout timer, and time individual sets and rest
- Save workout duration
- View history
- Use the calendar
- Edit locally stored workouts
- See progressive-overload trend charts
- See weekly and monthly attendance progress
- Set and edit your display name

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

### Switching accounts on the same device

That same separation holds on-device too, if more than one Google account
signs into Gym Log in the same browser — not just in the Sheet each
account owns.

- **Switching accounts automatically loads that account's data.** Sign
  out of Account A and into Account B, and the app fetches Account B's
  own Sheet and shows it — no confirmation prompt, and Account A's
  workouts are never visible while Account B is signed in.
- **Nothing is ever lost in the switch.** Account A's local data is set
  aside (not deleted) the moment you switch away, and comes right back
  the next time you sign into Account A on that device.
- **Logging locally before your first sign-in still works exactly as
  before.** If you use Gym Log without signing in and then sign in for
  the first time, that local history becomes the new account's history
  (and syncs up to its Sheet) rather than being treated as some other
  account's leftover data.

---

## 📊 Google Sheet Structure

The app creates a spreadsheet named:

```text
Gym Log Data
```

It contains an `Overview` tab, a `Weekly Progress` tab, a `Monthly Progress`
tab, a `Yearly Progress` tab, and every workout day gets its own date tab.

Example:

```text
Gym Log Data

├── Overview
├── Weekly Progress
├── Monthly Progress
├── Yearly Progress
├── 6 Aug 2026
├── 7 Aug 2026
├── 8 Aug 2026
└── ...
```

The `Overview` tab also holds your display name, in cell `B4` (with the
label `Name` in `A4`, right below the intro text in `A1`/`A2`) — this is
what lets your name follow your account across devices.

Each daily tab holds one row **per set**, not per exercise, so every cell
holds exactly one value:

| Exercise | Set | Reps | Weight (KG) | Set Time | Rest Time | Muscle | Type |
|----------|-----|------|-------------|----------|-----------|--------|------|
| Bench Press | 1 | 12/8/5 | 60/50/40 | 0:32 | - | Chest | |
| Bench Press | 2 | 10 | 65 | 0:28 | 1:35 | Chest | |
| Push Ups | 1 | 20 | - | - | - | Chest | Bodyweight |
| Push Ups | 2 | 15 | 10 | - | - | Chest | Bodyweight |

Reading this table: **Bench Press, Set 1** was a drop set — 12 reps at 60 kg,
dropped to 8 at 50 kg, dropped to 5 at 40 kg (the `/`-joined stages within
that one set's own Reps/Weight cell — a drop set is still one set, just with
continuations). It took 32 seconds. **Set 2** was a plain 10 reps at 65 kg,
with 1 minute 35 seconds of rest beforehand. **Push Ups** is a separate
exercise marked `Bodyweight`, so its first set (no added weight) shows a
plain `-` in Weight.

**Set Time** and **Rest Time** read `-` for a set the timer wasn't used on.
The very first set logged that day always has no Rest Time (nothing to rest
from yet) — every set after does, including the first set of a new exercise,
since rest is tracked continuously through the whole workout, not reset at
each exercise boundary.

Workout duration is stored separately (`Duration` in column J of the tab) so
it can also be restored on another device.

### Existing data migrates automatically

Gym Log used to store one row per **exercise**, with every set's reps and
weight packed into the same cell (`"12+10"`, `"60+65"`). Any tab still in
that older format is detected and converted the next time you sign in or
sync — automatically, with no button to press and no data lost:

1. **Detect** — each tab's header is checked; an old-format tab is
   recognized immediately and left alone otherwise.
2. **Read everything** — every row is parsed, including the hidden tags
   that let Edit and Delete find the right rows later.
3. **Rewrite in a staging copy** — the converted, one-row-per-set version
   is written to a temporary tab first and fully verified.
4. **Swap in** — only once that's confirmed complete does the old tab get
   removed and the staging tab renamed into its place.

If a migration is ever interrupted partway (lost connection, closed app),
nothing is corrupted — either the original tab is untouched, or a
retryable staging copy is sitting alongside it. The next sign-in or sync
picks up cleanly from there. Once migrated, a tab is simply a normal
current-format tab — there's no ongoing "legacy mode" to think about, and
your History and Calendar look exactly as they did before migrating:
same exercises, same sets, no duplicates, no missing workouts, just
different cells behind the scenes.

The `Weekly Progress` tab holds one row per week, including the week's date range:

| Week Start | Week End | Days Attended | Total Load |
|------------|----------|----------------|------------|
| 2026-08-02 | 2026-08-08 | 5 | 7200 |

The `Monthly Progress` tab holds one row per calendar month:

| Month | Days Attended | Total Load |
|-------|----------------|------------|
| Aug 2026 | 7 | 9440 |

The `Yearly Progress` tab holds one row per calendar year:

| Year | Days Attended | Total Load |
|------|----------------|------------|
| 2026 | 192 | 721600 |

Unlike the daily workout tabs, these three tabs are derived summaries, not
an append-only log — each sync recomputes them from your full history and
rewrites the tab, so they always reflect the current state rather than
accumulating stale rows. They also always hold your **complete** history —
the 4-week/current-year/5-year windows and "Load older" button described
under **Attendance Progress** above are a UI convenience for the app screen
only, not a limit on what's synced or storable.

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
- Weekly and monthly attendance and training-load tracking
- A personal touch (display name) that follows your account
- Drop sets, bodyweight exercises, and per-set/rest timing — each optional
- A persistent, 3-hour signed-in session
- Google Sheets backup
- Restore capability
- Duplicate-safe synchronization
- Mobile installation

---

# 🔮 Future Ideas

Already shipped, despite once being on this list: exercise autocomplete,
"last time" values shown while logging, training-volume analytics, exercise
progression charts (see **Progress & Progressive Overload** above), and a
rest timer between sets (see **Per-Set Timing** above).

Possible future improvements still on the table:

- Personal records (heaviest weight, best-rep-at-weight, per exercise)
- Estimated 1RM
- Active progressive-overload suggestions (a target weight/rep goal for your
  next session, not just a trend after the fact)
- Workout templates (e.g. Push / Pull / Legs)
- RPE / RIR tracking
- Body-weight tracking over time (your own weight on the scale — distinct
  from bodyweight *exercises*, which Gym Log already tracks)
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

Gym Log was originally created by **Mohammad Mujahid Nadeem**.

This project is licensed under the MIT License. If you copy, modify, or
redistribute substantial portions of the project, the original copyright
and license notice must be preserved.

See [LICENSE](LICENSE) for details.

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
