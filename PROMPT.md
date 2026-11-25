# PROMPT.md: Kabmeet shared work file

The communication link between the **Master** (Claude: planner, reviewer, approver), any **Executor** model Brian brings in, and **Brian** (project owner, the gate).

## 0. Executor quick start (read this first)

1. Read this whole file. Then read section 5 (status) and section 6 (known issues), because they save you from rediscovering things.
2. Take the **first task in the priority order of section 7 that is `OPEN`**. One task per round.
3. Work on a branch named `task-<number>-<short-name>`. **Never push to `main`.** The Master merges.
4. Install with `bun install`. Check with `npx tsc --noEmit && npx vite build && npm test`.
5. Write your report in section 10 using the template there. Change only the status word of your own task.
6. If something here is unclear, wrong, or conflicts with the code, **say so in your report and stop**. Do not guess on security, roles or data.

---

## 1. How this file works

1. **Master** writes tasks (section 7) and keeps status (section 5) current.
2. **Executor** does the task and reports (section 10). Executors do not edit sections 0 to 9.
3. **Master** re-runs the checks itself (never trusts the report alone), then marks the task `VERIFIED`, `REWORK` (with reasons) or `REJECTED`, merges, and adds follow-ups.
4. **Brian** starts every round by telling a model: *"Read PROMPT.md, analyze it as well as you can, and do the next open task."* Nothing runs unless Brian says so.

Status words: `OPEN` > `IN PROGRESS` > `READY FOR REVIEW` > `VERIFIED` (or `REWORK`). A task that needs Brian's decision first is `NEEDS DECISION` and must not be started.

**Every task below has the same four lines**, so reports can be checked quickly: *Goal*, *How to run and test*, *Not in scope*, *Verify with*. If you finish something outside the task (for example a bug you had to fix), name it in your report heading.

---

## 2. The project

**Kabmeet** is the live-session platform of the Kabale AI Club / IndabaX site (`ai.kab.ac.ug/indabax`), hosted on the university's own servers.

**Problem:** students, lecturers and clubs run their sessions on Google Meet or Zoom, so people leave our site and juggle links and logins.
**Solution:** one site, one login, where people can:
- find live sessions (YouTube Live style: live list, watch page, top chat, stickers, polls, Q&A),
- join interactive rooms (Google Meet style: camera, mic, screen share, raise hand, host controls, waiting room),
- run communities that host sessions,
- hold private virtual classes with attendance,
- work together in a shared workspace (notes, tasks, code).

**Standing rule from Brian:** never mention or compare with any existing university e-learning platform, in code, comments, UI text or docs. Treat them as if they never existed.

**Quality bar:** it must look and feel human-made, not generated. No filler copy, no lorem ipsum, no generic template look. Real Kabale content, real labels. Aim for the best result, then check it.

---

## 3. Design rules (do not break)

- **Colors:** CSS tokens only, never raw hex inside components. Indaba Deep Green `#065A4B`, Signal Green `#00E676`, KAB Blue `#0072BB`, Sun Yellow `#F5EC1E`, Amber Gold `#F6A623`, Live Red `#E5484D` (LIVE badge only), Night Forest `#0A1F1A`, Mist `#F2F7F5`, Line `#D5E3DE`. These hex values were read by eye from screenshots; verify against the live pages in DevTools and fix the tokens if they differ.
- **Fonts:** Oswald for headings, Poppins for body, JetBrains Mono for numbers and code.
- **Shape:** pill buttons, 12px cards, 8px spacing grid. Icons: `lucide-react`, one stroke width.
- **Emoji policy (replaces the old "no emojis" rule):** emojis are welcome as *content and personality*: reactions, stickers, greetings, empty states, achievement badges, chat. They are **not** used as icons in navigation, buttons, form labels, headings, tables, errors or anything about security. At most one emoji per message or label, and always paired with words. Every emoji that carries meaning has an `aria-label` and a tooltip.
- **Motion policy:** motion must help (show state, give feedback, guide the eye), never decorate for its own sake. Use only `transform` and `opacity`. Fast: 120 to 220 ms for feedback, up to 400 ms for entrances. Hover effects live inside `@media (hover: hover)`; touch devices get a press state instead. Respect `prefers-reduced-motion` (replace movement with a fade or nothing). Data Saver turns decorative motion off.
- **Never rely on color alone.** Pair status colors with a word or an icon.
- **Both light and dark theme** must work.
- **Phone first:** works at 360px width. Many users are on phones and weak networks.

## 4. Engineering rules (do not break)

- Every role and private-class check is enforced **on the server** (`server.ts`, `server/ws.ts`, `server/video.ts`). The client only hides buttons.
- No secrets in git. `.env` stays out of the repo.
- Validate every input with `zod` on the server. Cap sizes.
- Small commits, one purpose each. Message format: `Task N: what changed`.
- Add a test for every rule you add (`tests/`, run by `npm test`, also run by CI).
- Before you report: `npx tsc --noEmit`, `npx vite build` and `npm test` pass, and you ran the feature yourself in a browser when it has a screen. State what you ran and what you could **not** run.
- Do not claim something works if you did not run it. Half-done is fine; write it down honestly.

---

## 5. Status (kept by the Master)

**Last updated:** 2026-11-25 (Master).

**On `main` now**
- Security hardening: first-admin setup code, rate limits, security headers, safer tokens.
- Cleanup: Kabmeet `.env.example`, package name, unused SDK removed.
- Tests: `npm test` (18 tests, all pass) and a root CI workflow (`.github/workflows/ci.yml`; check the Actions tab on GitHub to confirm it runs green).
- **Real video (Task 1, verified):** camera, microphone and screen share between people, through self-hosted LiveKit behind an adapter. Without LiveKit settings the Room still works for chat, hands and the workspace.

**Verified working by the Master's own browser runs** (Playwright, fake cameras, real LiveKit 1.9.4 server): first-admin setup; sign-in; every page loads without script errors; no sideways scrolling on the Discover page at 360px; chat and websocket; waiting room; a student who is not approved publishes nothing; the student sees the admin's camera (640x360) and hears live audio; the admin's screen share reaches the student (1280x720); after the host approves a student as speaker *while connected*, the student's camera reaches the admin.

**Known not tested:** two real machines, phones, campus firewalls and TURN, more than two people, reconnect after a network drop, a real `wss://` reverse proxy, a real slow network, attendance by a real student, Admin page actions, PWA offline mode.

**Biggest remaining problems**
1. Refresh signs you out and the address never changes (Task 7).
2. Data is stored in a JSON file (Task 2).
3. Two codebases in one repo; README claims more than is built (Task 3).
4. The site feels plain: 8 reactions, few emojis, little hover feedback, loaders not matched to moments (Tasks 4, 9, 10).

## 6. Known cross-cutting issues (so nobody rediscovers them)

- Moderation uses the **global** role: a MODERATOR of one session counts as staff in all sessions.
- A private-class allowlist is matched on **email text only**; there is no check that the person owns that email.
- A speaker approval is lost when the person's websocket reconnects (the seat is rebuilt as non-speaker). The server updates LiveKit rights only on the next approve.
- When a websocket closes, the person's video connection is not closed from the server side (only host removal and "end for all" do that).
- The websocket token is in the URL query (Task 8).
- Class, session, audit and message IDs still use `Date.now()` in places (Task 8).
- `npm install` fails on a peer-dependency conflict (esbuild vs Vite 8). Use `bun install`.
- The browser LiveKit client (2.x) tries a newer signalling path first; against LiveKit server 1.9.4 it logs one harmless 404 and one WebSocket warning, then connects. Not a bug; use a current server in production and pin the version in `infra/livekit/docker-compose.yml` (now `v1.9.4`).
- Google Fonts are loaded from the internet (Task 8).

---

## 7. Task queue and priority order (kept by the Master)

**Order of work:** 7 > 8 > 1b > 4b > 9 > 10 > 15 > 6 > 11 > 13 > 12 > 14 > 16 > 2 > 3 (3 needs Brian). Reason: fix what hurts every user first (refresh, fonts), then polish video, then the feel of the site, then trustworthy data.

| Task | Name | Status |
|---|---|---|
| 1 | Real video behind an adapter | `VERIFIED` |
| 1b | Video polish and safety follow-ups | `OPEN` |
| 2 | Replace the JSON file store | `OPEN` |
| 3 | One codebase, honest README | `NEEDS DECISION` |
| 4 | Loading kit and slow-network stages | `VERIFIED` (follow-ups 4b below) |
| 5 | Tests for the rules that matter | `VERIFIED` (extend with every task) |
| 6 | Attendance you can trust | `OPEN` |
| 7 | Real URLs and staying signed in | `OPEN` |
| 8 | Small fixes from the debug run | `OPEN` |
| 9 | Campus emoji pack, stickers and microcopy | `OPEN` |
| 10 | A site that feels alive: hover and motion polish | `OPEN` |
| 11 | Recordings and replays (LiveKit Egress) | `OPEN` |
| 12 | Live captions and accessibility | `OPEN` |
| 13 | Notifications: "going live" push and reminders | `OPEN` |
| 14 | Engagement: badges, streaks, leaderboard, session analytics | `OPEN` |
| 15 | Offline-first: queue chat sends, cached lists | `OPEN` |
| 16 | Hackathon and IndabaX mode: schedule, teams, judges, certificates | `OPEN` |

---

### Task 1: Real video behind an adapter (`VERIFIED`)
Done by an Executor, verified by the Master on 2026-11-25. See the report in section 10 and the Master's review in section 9.

### Task 1b: Video polish and safety follow-ups (`OPEN`)
**Goal:** close the gaps the review found in Task 1.
1. **Stop the retry loop.** In `src/video/useRoomVideo.ts`, when the token route answers 403 (not in room, removed) or 409 (session ended), stop retrying and show a clear message ("You were removed from this room" / "This session has ended"). Today it retries every 3 to 5 seconds forever.
2. **Closing the page or websocket closes video.** In `server/ws.ts` on websocket close, if that person has no other seat in the room, call `removeParticipant`.
3. **Keep speaker approval across a websocket reconnect:** remember `isSpeaker` and `mutedByHost` per user per session (in memory is fine) and restore them on `room:join`; call `syncVideoRights`.
4. **Layout:** cap visible tiles at 12 (active speakers first, "+N more" tile), and when someone shares their screen, pin it large with the camera tiles in a strip. Keep the phone layout one column.
5. **No LiveKit configured:** the Cam button should still show the person's own preview and say once "Video is not set up, so others cannot see you." (today it shows an error and refuses).
6. **Hook hygiene:** `useRoomVideo` returns a new object each render, so `useCallback` lists containing `video` re-create every render. Memoize the returned object.
7. **Data Saver, sender side:** when on, publish camera at most 360p and 15 fps.
8. `docs/DEPLOYMENT.md`: add a section for putting LiveKit behind Nginx or Caddy with `wss://`, plus the ports that must be open.
**How to run and test:** `bun install`; run LiveKit (`infra/livekit/docker-compose.yml`, or `livekit-server --dev`); start the app with `LIVEKIT_URL=ws://127.0.0.1:7880 LIVEKIT_API_KEY=devkey LIVEKIT_API_SECRET=secret npx tsx server.ts`; use two Chromium windows with `--use-fake-device-for-media-stream`.
**Not in scope:** HLS broadcast mode, recording, captions.
**Verify with:** `npm test`; `npx tsc --noEmit && npx vite build`; screenshots of 1, 5 and 14 participants and of a pinned screen share.

### Task 2: Replace the JSON file store (`OPEN`)
**Goal:** safe, real storage.
1. **SQLite via Prisma** first (no extra server), written so switching the provider to PostgreSQL is one line.
2. Move users, tokens, sessions, communities, attendance, reports and the audit log. Chat and polls may stay in memory with periodic flush, but attendance and audit must be durable.
3. One-time import from the existing `data/` JSON so nothing is lost.
4. Keep the same API shapes so the client does not change.
**How to run and test:** copy a sample `data/` folder, run the import, restart the server, confirm the data is still there; register two people at once.
**Not in scope:** moving chat history to the database, search.
**Verify with:** `npm test` (add a restart-keeps-data test); migration steps written in `docs/DEPLOYMENT.md`.

### Task 3: One codebase, honest README (`NEEDS DECISION`)
Recommended to Brian: keep the root app as the product, delete the unused `kabmeet/` skeleton, move any still-true docs into the root `docs/`, and rewrite the README so every claim matches what runs. If Brian prefers the monorepo, the Master writes a migration plan first. **Do not start until the Master sets `OPEN`.**

### Task 4: Loading kit and slow-network stages (`VERIFIED`)
Done by the Master on 2026-11-25 from the Kabmeet Loading Kit artifact. Six moment loaders added and every `KabmeetLoadingCard` now follows the stages. Code: `src/hooks/useLoadingStage.ts`, `src/components/KabmeetMoments.tsx`, CSS under "Kabmeet moment loaders" in `src/index.css`.

**Stages (`useLoadingStage`, `[400, 3000, 8000, 20000]` ms):** under 0.4 s nothing; 0.4 s loader; 3 s "Your connection is slow. Still trying."; 8 s the AppShell banner's Data saver button is the offer (not repeated in the page); 20 s "Try again" with the content kept.

**Where each loader lives (one moment each, never two main loaders):**
| Loader | Component | Where |
|---|---|---|
| Card shimmer | `ShimmerGrid` | Discover list, Communities list |
| Pill pulse | `PillPulseButton` | Sign in / sign up, Create session, Save profile |
| Thread | `KabmeetLoadingCard variant="thread"` | Room and Watch while the session loads |
| Signal bars + word | `SignalBars` | Room and Watch headers (Synced, Weak signal, Reconnecting) |
| Lens | `LensLoader` | Own tile while the camera starts |
| Hop dots | `HopDots` | Above the chat box while chat reconnects |
| Signal Prism (kept) | `KabmeetSignalPrism` | The single page loader |
| Top thread | `TopNetworkBar` (existing) | Route/network activity; Beacon not adopted |

**Rules kept:** tokens only, transform/opacity animation, `prefers-reduced-motion` stops them, every loader has `role="status"` or `aria-label`, state is never colour alone.

**Follow-ups (Task 4b, small, do after Task 7):**
1. Use `PillPulseButton` on the other async buttons (join class, approve, end session, post in community).
2. Shimmer shapes for Watch list, Host dashboard and Admin tables (new `RowShimmer`).
3. Use `LensLoader` for screen share too (`mediaStarting === 'screen'` is already typed).
4. Show `HopDots` while a sticker or poll vote is sending.
5. Offline: show the banner and queue chat sends (still missing).
6. If a UI test setup is added, test `useLoadingStage` with fake timers.

### Task 11: Recordings and replays (`OPEN`)
**Goal:** a session that ended can still be watched, on a slow link too.
1. Use LiveKit Egress (record a room to MP4 or HLS; audio-only recording is cheaper and good for Data saver). Add it behind the `VideoProvider` adapter (`startRecording`, `stopRecording`), not directly in routes.
2. Host toggle "Record this session"; a visible recording indicator for everyone; store files on the server disk or S3-compatible storage, path from an env var.
3. Replay page with chapters (when polls, slides and Q&A happened). Only members allowed to watch live may watch the replay.
**Not in scope:** editing, public sharing.
**Verify with:** record 1 minute with two browsers; replay plays; non-members get 403; tests for the permission rule.

### Task 12: Live captions and accessibility (`OPEN`)
**Goal:** every student can follow, in any noise level.
1. Captions toggle in Room and Watch (start with browser speech recognition for the speaker's own mic; a server transcription service is a later option).
2. Text size and high-contrast switch saved per user; keyboard-only path through Room and Watch; skip links; focus rings.
3. Run an accessibility pass (WCAG 2.1 AA): contrast, touch targets, screen reader labels.
**Verify with:** keyboard-only walkthrough screenshots; contrast report.

### Task 13: Notifications (`OPEN`)
**Goal:** people come back when it matters. PWA is already set up.
1. Web Push (service worker) for: a session you follow goes live, a class starts in 10 minutes, a host approved your hand.
2. Settings page with per-type switches; quiet hours; never ask for permission on first load, ask after the first follow.
3. In-app bell with the same events (works when push is blocked).
**Verify with:** two browsers; follow, go live, notification arrives; unsubscribed user gets nothing.

### Task 14: Engagement: badges, streaks, leaderboard, analytics (`OPEN`)
**Goal:** friendly motivation for the club, plus numbers for hosts.
1. Badges as content (campus emoji from Task 9): First Session, Question Asker, Poll Master, Regular (streak of weeks), Host.
2. Club leaderboard, opt-in, weekly reset, never shows exact minutes of private classes.
3. Host dashboard per session: peak viewers, average watch time, questions, poll participation.
**Not in scope:** rewards with money value.

### Task 15: Offline-first (`OPEN`)
**Goal:** the site stays usable when the network drops (follow-up 5 of Task 4b).
1. Show an offline banner; queue chat messages and hand raises and send them in order on reconnect, with "Sending..." then "Sent" or "Not sent, tap to retry".
2. Cache the last Discover and Communities lists in the service worker so they open instantly and refresh quietly (stale-while-revalidate).
**Verify with:** DevTools Offline; send 3 messages; go online; they arrive once and in order (no duplicates).

### Task 16: Hackathon and IndabaX mode (`OPEN`)
**Goal:** run a whole event, not just a stream.
1. Event page: schedule of sessions, speakers, countdown, "Add to calendar" file (.ics).
2. Hackathon tools: teams (create, join by code), submission link and demo slot, judge scoring form, results reveal.
3. Certificates of attendance as a downloadable PDF with name, event and date (uses the attendance numbers from Task 6, so do Task 6 first).
**Verify with:** run a mock 2-session event with 3 teams and 2 judges.

### Task 5: Tests for the rules that matter (`VERIFIED`)
`tests/api.test.ts` and `tests/video.test.ts` run with `npm test` (18 tests) and in CI. Every task adds tests for its own rules. Still missing: websocket role checks, class attendance rules (Task 6).

### Task 6: Attendance you can trust (`OPEN`)
**Goal:** attendance numbers a lecturer can defend.
1. Check how join, leave and active minutes are measured (`/api/classes/:id/attendance/ping`). Fix double counting from several tabs and from reconnects.
2. CSV export includes join time, leave time, minutes and the student's university ID.
3. Show the lecturer a plain per-student summary (present, late, left early) with the thresholds written in the UI.
**How to run and test:** two browsers as two students in a private class; leave one tab open and one closed; compare minutes.
**Not in scope:** emailing attendance.
**Verify with:** a test that two tabs of one student count once; `npm test`.

### Task 7: Real URLs and staying signed in (`OPEN`, first in line)
**Goal:** refresh, Back and shared links work.
1. URL routing: `/`, `/communities`, `/watch/:id`, `/room/:id`, `/classes`, `/host`, `/profile`, `/admin`, `/auth`. The Express fallback to `index.html` already exists.
2. Stay signed in across refresh with an `httpOnly`, `SameSite=Lax`, `Secure` cookie session read by `resolveAuthUser`, with CSRF protection on state-changing routes. Do not put the token in `localStorage`.
3. A private-class link opened signed out sends you to sign in, then back to the link.
**How to run and test:** sign in, open a room, refresh: still signed in on the same page; Back works; sign out clears the cookie.
**Not in scope:** social login, password reset email.
**Verify with:** tests for cookie flags, CSRF refusal and sign-out; browser run; `npm test`.

### Task 8: Small fixes from the debug run (`OPEN`)
1. Websocket: authenticate with a first message, not the URL query. Keep the old way working during the change, then remove it.
2. Self-host Oswald, Poppins and JetBrains Mono (woff2 in `public/fonts`, `font-display: swap`) and remove the Google Fonts link. Keep real fallback stacks.
3. Class, session, audit and message IDs: use `randomUUID()`.
**How to run and test:** block `fonts.googleapis.com` in DevTools and confirm headings still use Oswald; check the websocket URL has no token.
**Not in scope:** new fonts, redesign.
**Verify with:** `npm test`, a screenshot with Google blocked.

### Task 9: Campus emoji pack, stickers and microcopy (`OPEN`)
**Goal:** the site shows personality and belongs to Kabale. Today there are only 8 reaction emojis and almost none elsewhere.

**A. Reaction pack: 8 existing + 17 campus (25 total).** The quick bar shows the first 8; a "more" button (hover or tap) opens a popover with three labelled groups.
- Keep: ❤️ Like, 🔥 Fire, 👏 Clap, 🙌 Celebrate, 😂 Laugh, 😮 Wow, 🚀 Launch, 💯 Hundred.
- **Campus life:** 🎓 Graduate (celebrate a milestone), 📚 Study (this helped me), ☕ Coffee break, 🎒 First day, 🙋 I have a question, 🏆 Win, 🤝 Collab.
- **Tech and AI club:** 🧠 Big brain, 💻 Code, 🤖 AI, 💡 Idea, 🐛 Bug found, ✅ Shipped.
- **Kabale and Africa pride:** ⛰️ Hills (Kabale sits in the hills), 🦍 Gorilla (south-west Uganda), 🌍 Africa. *(Do not use the 🇺🇬 flag: Windows shows it as the letters "UG".)*
- One source of truth: create `src/shared/reactions.ts` (emoji, label, group) imported by **both** the client (`src/components/EmojiReactions.tsx`) and the server whitelist `ALLOWED_REACTIONS` in `server/ws.ts`. Today the server silently turns an unknown reaction into a ❤️ and there is **no rate limit** on reactions, so a script can flood a room. Change it: refuse unknown reactions, and limit each person to about 5 reactions per second (add tests for both).
- Each button has `aria-label` and a tooltip with the label; the popover is keyboard reachable; `Esc` closes it. Cap floating emojis on screen at 30.
- Check the whole set renders on Windows, Android and iOS; if any glyph falls back to a box, drop it from the pack.

**B. Where else emojis belong (one per message, with words):**
- Greeting on Discover by time of day: "Good morning, Brian ☀️" / "Good afternoon ☕" / "Good evening 🌙", using the person's nickname.
- Empty states: no live sessions: "Quiet on campus right now ☕ The next session starts at 16:00."; empty chat: "Be the first to say hello 👋"; no communities joined: "Find your people 🤝".
- Moments: attendance marked: "You are in the register 🎓"; session ended: "Thanks for coming 👏 Replay and notes are ready."; poll sent: "Vote counted ✅".
- Small badges on the profile (first session, 5 questions asked, 10 sessions attended) with an emoji and a plain label.
- **Never** in errors, security messages, sign-in, admin tables, nav or buttons.

**C. Stickers ("swags"), original and hand-made, not emoji.** Draw 12 SVG stickers in the brand palette in `public/stickers/` (about 3 KB each): "Great talk", "Mind blown", "Slides please", "Louder please", "Need a break", "Thank you", "Ship it", "Kabale hills", "IndabaX", "KAB AI", "Cheers", "Well done". The Watch page already has a tray of 6 stickers (`STICKERS` in `WatchPage.tsx`), but they are only emoji with captions. Replace them with the drawn set and keep the existing send flow and types in `types/kabmeet.ts`. A sticker floats up and fades like a reaction, but larger, and shows the sender's name. Sticker ids go through a server whitelist and the same rate limit.
**How to run and test:** two browsers in one session; send each reaction and a sticker from one, see it on the other; run with Data Saver on.
**Not in scope:** user-uploaded stickers, GIF search, animated emoji packs.
**Verify with:** a test that unknown reactions are refused; screenshots of the popover on desktop and phone, of three empty states, of the sticker tray; `npm test`.

### Task 10: A site that feels alive: hover and motion polish (`OPEN`)
**Goal:** the site responds to every hover, tap and wait, without getting slow or noisy. Follow the motion policy in section 3. Test at 4x CPU throttle in DevTools.
1. **Session cards:** on hover lift 4 px with a soft green-tinted shadow; thumbnail zooms to 1.04 inside its frame; a bottom row slides up showing "Watch now" and the viewer count; the same appears on keyboard focus.
2. **LIVE badge** keeps its soft pulse; viewer counts roll to the new number instead of jumping.
3. **Buttons:** press scale 0.97; primary pill gets a Signal Green glow on hover; disabled and busy states are clear (pill pulse from Task 4).
4. **Navigation:** a green underline slides to the active item; the bottom-nav icon on phones bounces once on select.
5. **Room controls:** tooltips on hover and focus with the shortcut ("Mic, M"); active mic and camera get a gentle ring; tiles scale in from 0.96 and fade when a person joins; a raised hand wiggles once; the active-speaker ring eases in and out.
6. **Communities:** hover shows a chip "Next session in 2 h" and a "Join" button sliding up; the member avatar stack fans out slightly.
7. **Lists:** first-load stagger (40 ms per item, at most 8) once per visit; skeleton shimmer while loading (Task 4).
8. **Page changes:** 150 ms fade and 8 px slide between routes. Scroll reveals on the home page only, once.
9. **Numbers:** count up once for attendance and totals.
10. **Toasts:** slide in and out, with a thin progress line showing time left.
11. **Dark mode:** hover glows use Signal Green at about 20 percent alpha; check contrast.
12. Add a single `motion` section in the CSS tokens (durations, easings) so every effect uses the same values; add a Data Saver rule that disables items 1, 4, 8, 9 and 10.
**How to run and test:** desktop (mouse), phone emulation (touch, no hover), `prefers-reduced-motion: reduce`, Data Saver on; record screenshots or a short screen capture of each.
**Not in scope:** sound effects, 3D, custom cursors, parallax, confetti.
**Verify with:** no layout shift when hovering; 60 fps on the 4x throttle for the card grid; a screenshot set for reduced motion; `npx tsc --noEmit && npx vite build && npm test`.

### Later (the Master opens these when ready)
Broadcast mode for 150+ viewers (HLS for the audience), live captions (Whisper), host analytics, notification emails, accessibility audit, load test with `k6`, recording and replay storage.

---

## 8. Review checklist (what the Master checks before `VERIFIED`)

- [ ] The Master re-ran the checks, not only read the report.
- [ ] The server enforces the rule, not just the UI.
- [ ] Input validated and capped; no secrets committed.
- [ ] Works at 360px, light and dark, reduced motion, Data Saver.
- [ ] Uses tokens and the brand fonts; looks hand-made; emoji and motion policies followed.
- [ ] `npx tsc --noEmit`, `npx vite build` and `npm test` pass; CI is green.
- [ ] The report states what was run and what was not.
- [ ] Commits are small and clearly named; no unrelated changes.
- [ ] README and docs claim only what actually works.

---

## 9. Master notes and decisions log

- 2026-11-24: Master reviewed the repo; Phases A (hardening), B (cleanup), C (tests and CI) merged to `main`.
- 2026-11-24: Master's browser debug run found the missing video, the refresh sign-out and the websocket token in the URL; these became Tasks 1, 7 and 8.
- 2026-11-25: **Task 1 review (Master).** Branch `task-1-livekit-video` accepted and merged to `main`. Re-ran: typecheck clean, `npm test` 18 of 18, build ok, and my own two-browser end-to-end against a real LiveKit 1.9.4 (camera, microphone, screen share, non-speaker blocked, approve-while-connected). All the report's claims held. Good catches by the Executor: the websocket size limit I set in Phase A (64 KB) would have dropped slide sharing; now 640 KB with a test. Open items were turned into Task 1b and section 6.
- 2026-11-25: Adopted the Executor's suggestions: every task now has *How to run and test*, *Not in scope*, *Verify with*; known cross-cutting issues moved to section 6; reports must name side fixes; a quick start at the top.
- 2026-11-25: Emoji rule changed (section 3). Brian wants more campus personality, so emojis are welcome as content, not as icons. Added Tasks 9 (emoji pack, stickers, microcopy) and 10 (hover and motion).
- 2026-11-25: **Task 4 done by the Master** (Kabmeet Loading Kit artifact). Six moment loaders plus staged waits, checked in a browser with throttled APIs; typecheck, build and 18 of 18 tests pass. Decision: Signal Prism stays the single page loader, `TopNetworkBar` is the top thread, and slow-network messaging is not duplicated (AppShell banner owns the Data saver offer). Follow-ups in Task 4b.
- 2026-11-25: **New ideas added after research** (LiveKit Egress, higher-ed streaming feature lists, PWA offline and push practice, event engagement tools): Tasks 11 to 16. Order puts offline (15) before recordings (11) because campus networks drop first.
- Open decision for Brian: Task 3 (one codebase at the root, recommended).

---

## 10. Executor reports (executors write below this line)

Template, newest report on top. Be honest and specific.

```
### Report: Task <n>, <date>, <model name>
Branch: task-<n>-<name>
Side fixes outside the task (name them): ...
Done:
- ...
Half-done (and exactly where I stopped):
- ...
Could not run / not verified:
- ...
Problems or things that look wrong elsewhere:
- ...
Suggestions:
- ...
Verify with: <the exact commands>
Ready for review: yes / no
```

### Report: Task 1, 2026-11-24, Claude Sonnet 5.5 (Executor) | Master verdict: VERIFIED (2026-11-25)
Branch: task-1-livekit-video (from main 9a1dd14)
Side fixes outside the task: websocket `maxPayload` raised from 64 KB to 640 KB (slide sharing was dropping the connection).
Done:
- `server/video.ts`: provider-neutral `VideoProvider` interface + `LiveKitProvider` + `NoVideoProvider`. One LiveKit room per session (`kabmeet-<sessionId>`), identity = user id (two tabs replace each other), 10-minute tokens, `canPublishData:false`. Admin calls (update rights, remove, close room) are best effort with a 4 s timeout so a dead media server never blocks a host click.
- `POST /api/sessions/:id/video-token` in `server.ts` (auth, `canUserAccessSession`, rate limit 240/min). Order of checks: 404, 403 outsider, `{configured:false}` if no LiveKit, 409 session ended, 403 `WAITING` for waiting-room guests, 403 `NOT_IN_ROOM` for people who have not joined and are not auto-admitted. `canPublish` = host/moderator/lecturer/admin/SPEAKER, or a MEMBER only after `room:approve_speaker`. Host mute removes the MICROPHONE source (camera and screen stay).
- `server/ws.ts`: exported `isAutoAdmitted`, `getRoomSeat`; approve/demote/mute call `updateParticipant` live, remove_peer calls `removeParticipant`, end_for_all calls `deleteRoom`.
- Client: `src/video/useRoomVideo.ts` (connect, publish/unpublish, remote tracks per user id, active speakers, Data Saver = no video subscriptions, token retry) and `src/video/RemoteVideo.tsx`. `RoomPage.tsx` publishes the existing camera/mic/screen captures and shows remote tiles, active-speaker ring, and a status line. Waiting room, raise hand, host controls, shortcuts, slides, captions untouched. Turning the mic off now stops the mic track.
- `.env.example` (LIVEKIT_*), `infra/livekit/livekit.yaml` + `docker-compose.yml`, `docs/DEPLOYMENT.md` (ports, TURN on campus).
- `tests/video.test.ts` (11 tests): signed-out 401, unknown 404, outsider 403, enrolled student `canPublish:false`, NOT_IN_ROOM, 10-min expiry, WAITING then admit then approve then mute then demote read from the token claims, self-approve refused, 300 KB slide over ws, ended session 409, app with no LiveKit returns `{configured:false}`.
Half-done:
- Tile grid still uses the 1/2/3-column reflow; no cap at 12 tiles and no pinned screen-share layout (now Task 1b).
- Data Saver only stops video downloads, it does not lower what a speaker sends (now Task 1b).
Could not run / not verified: microphone and screen share end to end, two real machines, mobile browsers, TURN and campus firewalls, more than 2 people, reconnect after a network drop, a real `wss://` proxy. (The Master later ran microphone and screen share on one machine: both worked. The rest is still untested.)
Problems or things that look wrong elsewhere: moderation uses the global role; class allowlist matched on email text only; speaker approval lost on websocket reconnect; `package.json` esbuild conflicts with Vite 8 under npm. (All moved to section 6.)
Suggestions: add "how to run and test", "not in scope", "verify with" to each task, a known-issues section, and ask executors to name side fixes. (All adopted, see section 9.)
Verify with: `npm test` and `npx tsc --noEmit && npx vite build`.
Ready for review: yes
