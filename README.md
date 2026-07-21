# Behna 💜 — period talk, together

A messaging app prototype (think WhatsApp / Messenger) built as a safe, shame-free space for women to discuss period pains and period concerns. Built with React + Vite.

## What's inside

- **Onboarding pledge** — every member joins by agreeing to the community pledge: zero shame, zero taboo.
- **Chats** — 1:1 conversations with typing indicators, read receipts, unread badges, online status, and simulated replies. Seed contacts include friends who get it and a verified gynaecologist mentor.
- **Circles** — group chats for every part of the cycle: Cramps & Pain Relief, PCOS Support, Endo Warriors, First Periods & Teens, and Cycle, Mood & Sleep. Chat inside any circle, or create your own with a name, emoji, and description — simulated members join in and reply.
- **Anonymous posting** — a one-tap toggle in any circle lets you ask sensitive questions as "A sister" instead of your name.
- **Safety center** — verified-members-only mode, disappearing messages, one-tap block (they're never told), report flow, a blocked list, and a clear "peer support ≠ medical advice" card listing symptoms that deserve a doctor's visit.
- **Profile & privacy** — edit your name/status, toggle read receipts and last seen, log out and wipe the device.

This is a front-end prototype: all data lives in your browser's `localStorage` and the people/replies are simulated. No accounts, no server, nothing leaves your device.

## Run it

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

Other scripts: `npm run build` (production build), `npm run preview` (serve the build), `npm run lint`.

## Roadmap ideas

- Real backend (auth + verification flow, message sync, push notifications)
- End-to-end encryption
- Cycle tracking with pain/mood logging you can share with a doctor
- Verified health-mentor program (licensed gynaecologists)
- Voice/video calls
- Trusted-contact live location sharing
