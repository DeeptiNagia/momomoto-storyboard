# Sakhi 💜 — where women connect

A messaging app prototype (think WhatsApp / Messenger) built as a safe, warm space for women to connect. Built with React + Vite.

## What's inside

- **Onboarding pledge** — every member joins by agreeing to the community pledge (be kind, lift each other up).
- **Chats** — 1:1 conversations with typing indicators, read receipts, unread badges, online status, and simulated replies so the flow is testable without a backend.
- **Circles** — group chats around shared interests (careers, new moms, book club, solo travel). Chat inside any circle, or create your own with a name, emoji, and description — simulated members join in and reply.
- **Safety center** — verified-members-only mode, disappearing messages, one-tap block (they're never told), report flow, and a blocked list you control.
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
- Voice/video calls
- Trusted-contact live location sharing
