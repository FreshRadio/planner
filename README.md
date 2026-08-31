# Fall 2026 Planner

A web app, not a Chrome extension. Works on your phone, installs to the home
screen, and runs offline.

## Put it online (once, ~5 minutes)

1. Create a GitHub repo called `planner`. Public.
2. Upload every file in this folder to the root of the repo.
3. Repo → Settings → Pages → Source: `Deploy from a branch`, branch `main`, folder `/ (root)`. Save.
4. Wait about a minute. Your app is at `https://<your-username>.github.io/planner/`

## Install it on your phone

- **iPhone:** open the link in Safari (it must be Safari) → Share → Add to Home Screen.
- **Android:** open in Chrome → menu → Install app / Add to Home screen.

It then opens full screen with no browser bar, and works with no signal.

## Two ways to update it

**Fast, one device — the Sync tab.**
Ask Claude for a planner update. It gives you a JSON block. Copy it, open the
Sync tab, paste, tap Apply. Changes are live instantly and stay on that phone.

**Permanent, every device — the repo.**
Edit `data.json` on github.com (pencil icon, works fine in a phone browser) and
commit. Every device picks it up next time it opens with a connection.
Tap "Reset to published" on the Sync tab to drop a local paste and go back to
the repo version.

## What's in data.json

- `semester`   — end date and what the countdown points at
- `dayPlan`    — your seven daily schedules, keys 0 (Sunday) to 6 (Saturday)
- `events`     — every exam, quiz, deadline, lecture topic and career milestone
- `weekPlan`   — the 15-week build curriculum with weekly targets
- `grades`     — grade weights per course
- `courses`    — rooms, office hours, AI policies
- `books`      — the reading list

Bump `version` and `updated` whenever it changes so the Sync tab tells the truth.

## Your progress is separate from your data

Ticks, task checkoffs and books read live in your browser's local storage under
`fp_ticks`, `fp_done`, `fp_books`. Updating `data.json` never wipes them.
Clearing site data does.
