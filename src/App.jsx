import { useState, useRef, useEffect, useMemo } from 'react';
import {
  MessageCircle, Users, Shield, User, Search, Send, ChevronLeft,
  MoreVertical, Check, CheckCheck, Plus, Heart, Lock, Bell, X,
  BadgeCheck, Phone, Video, AlertTriangle, Sparkles, EyeOff, LogOut
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Behna — a messaging app where women connect.
// Front-end prototype: all data lives in localStorage, replies are simulated.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'behna-app-v1'; // renamed from Sakhi — fresh key so everyone sees the new brand cleanly

const AVATAR_COLORS = ['#B85C8B', '#7C5CB8', '#5C8BB8', '#B8865C', '#5CB88A', '#B85C5C', '#8A5CB8'];

const seedContacts = [
  {
    id: 'c1', name: 'Priya Sharma', verified: true, online: true,
    tagline: 'Cramp survival expert · heat pad evangelist',
    replies: [
      "Heat pad + knees to chest. I swear by it 🔥",
      "Day two is always my worst too. You're not alone 💜",
      "Ginger tea helped me more than I expected, honestly.",
      "Rest tonight, okay? The laundry can wait.",
    ],
  },
  {
    id: 'c2', name: 'Ananya Iyer', verified: true, online: false,
    tagline: 'Endo warrior · 6 years since diagnosis',
    replies: [
      "I pushed for a scan for two years before anyone listened. Push.",
      "Pain that makes you cancel plans every month is NOT normal — worth checking.",
      "Sending you my gynae's number, she actually listens.",
      "Some months are just hard. Be soft with yourself 💛",
    ],
  },
  {
    id: 'c3', name: 'Meera Kapoor', verified: false, online: true,
    tagline: 'Big sister energy · ask me anything',
    replies: [
      "Okay first: that is SO normal, promise 🌸",
      "I was too scared to ask anyone at your age. Ask me everything.",
      "Cups take like three cycles to get used to — don't give up yet!",
      "Irregular in the first few years is really common, truly.",
    ],
  },
  {
    id: 'c4', name: 'Dr. Farah Khan', verified: true, online: false,
    tagline: 'Gynaecologist · Verified health mentor',
    replies: [
      "Good question — this is exactly what this space is for.",
      "Mild to moderate cramping is common, but severe pain that disrupts your day deserves a proper check-up.",
      "Track it for two cycles — dates, pain level, flow — and bring that to your doctor. It changes the conversation.",
      "Please don't diagnose yourself off the internet at 2am 😄 Note the symptoms and see someone. And keep asking here.",
    ],
  },
];

const seedCircles = [
  {
    id: 'g1', name: 'Cramps & Pain Relief', members: 214, emoji: '🔥',
    about: 'What actually helps — remedies, hacks, solidarity.',
    feed: [
      { author: 'Priya Sharma', text: 'Ranking my pain relief: 1) heat pad 2) mild walk (annoyingly, it works) 3) ginger-ajwain tea. What\'s yours?' },
      { author: 'Ritu M.', text: 'PSA: if painkillers barely touch your cramps every single month, please tell a doctor. I waited way too long.' },
      { author: 'Sneha P.', text: 'Day 1 club, who\'s with me today 🥲 Hot water bottle and this thread are getting me through.' },
    ],
  },
  {
    id: 'g2', name: 'PCOS Support', members: 156, emoji: '🎗️',
    about: 'Irregular cycles, diagnosis stories, living with PCOS.',
    feed: [
      { author: 'Dr. Farah Khan', text: 'Reminder: our free PCOS Q&A call is this Saturday at 11am. Bring every question, nothing is too small.' },
      { author: 'Ananya Iyer', text: 'Two years post-diagnosis update: cycles finally regular-ish. It\'s slow, but it does get better. Happy to share what worked.' },
    ],
  },
  {
    id: 'g3', name: 'Endo Warriors', members: 98, emoji: '💛',
    about: 'Endometriosis — getting heard, getting diagnosed, coping.',
    feed: [
      { author: 'Ananya Iyer', text: 'If a doctor says "period pain is just like that" and you\'re missing work every month — get a second opinion. That sentence delayed my diagnosis by 4 years.' },
    ],
  },
  {
    id: 'g4', name: 'First Periods & Teens', members: 67, emoji: '🌸',
    about: 'A gentle space for firsts. No question is silly here.',
    feed: [
      { author: 'Meera Kapoor', text: 'Starting a thread of things we wish someone had told us at 13. Mine: irregular cycles in the first couple of years are completely normal.' },
    ],
  },
  {
    id: 'g5', name: 'Cycle, Mood & Sleep', members: 132, emoji: '🌙',
    about: 'PMS, PMDD, energy dips — tracking the whole cycle.',
    feed: [
      { author: 'Ritu M.', text: 'Started tracking mood alongside my cycle and WOW the week-before pattern is real. Anyone else rage-cry at nothing on day 24? 😅' },
    ],
  },
];

// members + replies used to simulate life inside group chats
const GROUP_MEMBERS = ['Priya Sharma', 'Ananya Iyer', 'Meera Kapoor', 'Ritu M.', 'Sneha P.', 'Dr. Farah Khan'];
const GROUP_REPLIES = [
  'So glad you asked this — I had the exact same question and was too shy 💜',
  'Following this thread, I deal with this every cycle 👀',
  'Heat pad + rest + this circle. That\'s the whole survival kit honestly.',
  'Same here! You are so not alone in this.',
  'What helped me: tracking it for two cycles and showing my doctor the notes.',
  'Sending you the gentlest hug. Day 2 is the worst 🫂',
];

const CIRCLE_EMOJIS = ['💜', '🔥', '🎗️', '🌸', '🌙', '💧', '🫂', '🍵', '🏃‍♀️', '📚'];

const now = () => new Date().toISOString();

// convert the seeded feeds into chat messages so circles are live group chats
function seedCircleMsgs() {
  const msgs = {};
  for (const g of seedCircles) {
    msgs[g.id] = g.feed.map((p, i) => ({
      id: `${g.id}-seed-${i}`, author: p.author, text: p.text, at: now(),
    }));
  }
  return msgs;
}

function seedMessages() {
  return {
    c1: [
      { id: 'm1', from: 'them', text: 'Hey, how are the cramps today? Did the heat pad help last night?', at: now(), read: true },
      { id: 'm2', from: 'me', text: 'A little better! Still curled up though 🙃', at: now(), read: true },
      { id: 'm3', from: 'them', text: 'Ugh day 2. Want me to drop off some ginger tea on my way home?', at: now(), read: true },
    ],
    c2: [
      { id: 'm4', from: 'them', text: 'Saw your post in Endo Warriors — I went through exactly this before my diagnosis. Happy to talk whenever you\'re ready.', at: now(), read: true },
    ],
    c3: [
      { id: 'm5', from: 'them', text: 'Hi! Meera here from the First Periods circle 🌸 You mentioned your little sister just started hers — I put together a small starter kit list, want it?', at: now(), read: false },
    ],
    c4: [],
  };
}

const defaultState = {
  onboarded: false,
  profile: { name: '', vibe: 'Here to connect 💜' },
  settings: { readReceipts: true, lastSeen: true, verifiedOnly: false, disappearing: false },
  messages: null,   // seeded on first run
  circleMsgs: null, // seeded on first run
  myCircles: [],    // circles the user created
  blocked: [],
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...defaultState,
        ...parsed,
        messages: parsed.messages || seedMessages(),
        circleMsgs: parsed.circleMsgs || seedCircleMsgs(),
        myCircles: parsed.myCircles || [],
      };
    }
  } catch { /* corrupted storage — start fresh */ }
  return { ...defaultState, messages: seedMessages(), circleMsgs: seedCircleMsgs() };
}

const avatarColor = (name) => AVATAR_COLORS[(name || 'x').charCodeAt(0) % AVATAR_COLORS.length];
const initials = (name) => name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function Avatar({ name, size = 44, online, verified }) {
  return (
    <div className="avatar-wrap" style={{ width: size, height: size }}>
      <div className="avatar" style={{ background: avatarColor(name), fontSize: size * 0.36 }}>
        {initials(name || '?')}
      </div>
      {online && <span className="online-dot" />}
      {verified && <BadgeCheck size={Math.round(size * 0.4)} className="verified-badge" />}
    </div>
  );
}

export default function App() {
  const [state, setState] = useState(loadState);
  const [tab, setTab] = useState('chats');            // chats | circles | safety | profile
  const [activeChat, setActiveChat] = useState(null); // contact id
  const [activeCircle, setActiveCircle] = useState(null);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [typing, setTyping] = useState(false);
  const [circleTyping, setCircleTyping] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [showNewCircle, setShowNewCircle] = useState(false);
  const [newCircle, setNewCircle] = useState({ name: '', about: '', emoji: '💜' });
  const [anonPost, setAnonPost] = useState(false);
  const scrollRef = useRef(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage full */ }
  }, [state]);

  // keep chat scrolled to the newest message
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [activeChat, activeCircle, state.messages, state.circleMsgs, typing, circleTyping]);

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  };

  const contacts = useMemo(() =>
    seedContacts
      .filter(c => !state.blocked.includes(c.id))
      .filter(c => !state.settings.verifiedOnly || c.verified),
    [state.blocked, state.settings.verifiedOnly]);

  const contact = seedContacts.find(c => c.id === activeChat);
  const allCircles = useMemo(() => [...state.myCircles, ...seedCircles], [state.myCircles]);
  const circle = allCircles.find(g => g.id === activeCircle);

  const lastMessage = (id) => {
    const msgs = state.messages[id] || [];
    return msgs[msgs.length - 1];
  };
  const unreadCount = (id) =>
    (state.messages[id] || []).filter(m => m.from === 'them' && !m.read).length;

  const openChat = (id) => {
    setActiveChat(id);
    setMenuOpen(false);
    setState(s => ({
      ...s,
      messages: {
        ...s.messages,
        [id]: (s.messages[id] || []).map(m => ({ ...m, read: true })),
      },
    }));
  };

  const sendMessage = () => {
    const text = draft.trim();
    if (!text || !contact) return;
    const id = contact.id;
    const msg = { id: `m-${Date.now()}`, from: 'me', text, at: now(), read: false };
    setState(s => ({ ...s, messages: { ...s.messages, [id]: [...(s.messages[id] || []), msg] } }));
    setDraft('');

    // simulate the other side reading + replying
    setTimeout(() => {
      setState(s => ({
        ...s,
        messages: { ...s.messages, [id]: s.messages[id].map(m => m.from === 'me' ? { ...m, read: true } : m) },
      }));
      setTyping(true);
    }, 900);
    setTimeout(() => {
      setTyping(false);
      const pool = contact.replies;
      const count = ((state.messages[id] || []).length) % pool.length;
      const reply = { id: `m-${Date.now()}-r`, from: 'them', text: pool[count], at: now(), read: true };
      setState(s => ({ ...s, messages: { ...s.messages, [id]: [...s.messages[id], reply] } }));
    }, 2400);
  };

  const sendCirclePost = () => {
    const text = draft.trim();
    if (!text || !circle) return;
    const id = circle.id;
    const post = { id: `cp-${Date.now()}`, author: 'me', anon: anonPost, text, at: now() };
    setState(s => ({ ...s, circleMsgs: { ...s.circleMsgs, [id]: [...(s.circleMsgs[id] || []), post] } }));
    setDraft('');

    // simulate another member replying; in a brand-new circle, the first reply
    // comes with a join notice so the space doesn't feel empty
    const msgCount = (state.circleMsgs[id] || []).length;
    const author = GROUP_MEMBERS[msgCount % GROUP_MEMBERS.length];
    const isNewCircle = circle.mine && msgCount === 0;
    setTimeout(() => setCircleTyping(author), 1200);
    setTimeout(() => {
      setCircleTyping('');
      const text2 = isNewCircle
        ? `Just joined — love that you started this circle! 🎉`
        : GROUP_REPLIES[msgCount % GROUP_REPLIES.length];
      const reply = { id: `cp-${Date.now()}-r`, author, text: text2, at: now() };
      setState(s => ({
        ...s,
        circleMsgs: { ...s.circleMsgs, [id]: [...(s.circleMsgs[id] || []), reply] },
        myCircles: isNewCircle
          ? s.myCircles.map(g => g.id === id ? { ...g, members: g.members + 1 } : g)
          : s.myCircles,
      }));
    }, 3000);
  };

  const createCircle = () => {
    const name = newCircle.name.trim();
    if (!name) return;
    // eslint-disable-next-line react-hooks/purity -- event handler, not render
    const id = `my-${Date.now()}`;
    const g = {
      id,
      name,
      emoji: newCircle.emoji,
      about: newCircle.about.trim() || 'A brand-new circle. Say hello!',
      members: 1,
      mine: true,
    };
    setState(s => ({
      ...s,
      myCircles: [g, ...s.myCircles],
      circleMsgs: { ...s.circleMsgs, [g.id]: [] },
    }));
    setShowNewCircle(false);
    setNewCircle({ name: '', about: '', emoji: '💜' });
    setActiveCircle(g.id);
    showToast('Circle created! Post something to get it going 💜');
  };

  const blockContact = (id) => {
    setState(s => ({ ...s, blocked: [...new Set([...s.blocked, id])] }));
    setActiveChat(null);
    setMenuOpen(false);
    showToast('Blocked. They can no longer contact you.');
  };
  const unblockContact = (id) => {
    setState(s => ({ ...s, blocked: s.blocked.filter(b => b !== id) }));
    showToast('Unblocked.');
  };
  const toggleSetting = (key) =>
    setState(s => ({ ...s, settings: { ...s.settings, [key]: !s.settings[key] } }));

  const resetApp = () => {
    if (!window.confirm('Log out and clear all local data on this device?')) return;
    localStorage.removeItem(STORAGE_KEY);
    setState({ ...defaultState, messages: seedMessages(), circleMsgs: seedCircleMsgs() });
    setActiveChat(null); setActiveCircle(null); setTab('chats');
  };

  // ------------------------------ ONBOARDING ------------------------------
  if (!state.onboarded) {
    return (
      <div className="app onboarding">
        <div className="onboarding-card">
          <div className="logo-mark"><Heart size={28} strokeWidth={2.2} /></div>
          <h1>Behna<span className="accent">.</span></h1>
          <p className="tagline">The space to talk about periods — cramps, cycles, and everything nobody told us.</p>

          <div className="pledge">
            <div className="pledge-row"><Shield size={16} /><span>A women-only space with zero shame and zero taboo. Every member takes the pledge.</span></div>
            <div className="pledge-row"><EyeOff size={16} /><span>Ask anything anonymously in circles — sensitive questions don't need your name attached.</span></div>
            <div className="pledge-row"><BadgeCheck size={16} /><span>Verified health mentors (like real gynaecologists) carry a badge — but Behna is peer support, not a substitute for a doctor.</span></div>
            <div className="pledge-row"><Lock size={16} /><span>Your chats stay on your device in this prototype. Block anyone, anytime.</span></div>
          </div>

          <label className="field-label" htmlFor="name">What should we call you?</label>
          <input
            id="name"
            className="text-input"
            placeholder="Your first name"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && nameInput.trim()) setState(s => ({ ...s, onboarded: true, profile: { ...s.profile, name: nameInput.trim() } })); }}
          />
          <button
            className="btn-primary"
            disabled={!nameInput.trim()}
            onClick={() => setState(s => ({ ...s, onboarded: true, profile: { ...s.profile, name: nameInput.trim() } }))}
          >
            I'm in — take the pledge <Sparkles size={16} />
          </button>
          <p className="fine-print">Be kind. Lift each other up. What's shared here, stays here.</p>
        </div>
      </div>
    );
  }

  // ------------------------------ CHAT VIEW ------------------------------
  if (contact) {
    const msgs = state.messages[contact.id] || [];
    return (
      <div className="app">
        <header className="chat-header">
          <button className="icon-btn" onClick={() => { setActiveChat(null); setMenuOpen(false); }} aria-label="Back">
            <ChevronLeft size={22} />
          </button>
          <Avatar name={contact.name} size={40} online={contact.online} verified={contact.verified} />
          <div className="chat-header-info">
            <div className="chat-header-name">{contact.name}</div>
            <div className="chat-header-status">
              {typing ? <span className="typing-text">typing…</span> : contact.online ? 'online' : 'last seen recently'}
            </div>
          </div>
          <button className="icon-btn" onClick={() => showToast('Voice calls are coming soon 💜')} aria-label="Call"><Phone size={19} /></button>
          <button className="icon-btn" onClick={() => showToast('Video calls are coming soon 💜')} aria-label="Video call"><Video size={19} /></button>
          <div className="menu-anchor">
            <button className="icon-btn" onClick={() => setMenuOpen(o => !o)} aria-label="More options"><MoreVertical size={19} /></button>
            {menuOpen && (
              <div className="dropdown">
                <button onClick={() => { setMenuOpen(false); showToast('Report sent. Our team reviews every report within 24 hours.'); }}>
                  <AlertTriangle size={15} /> Report
                </button>
                <button className="danger" onClick={() => blockContact(contact.id)}>
                  <X size={15} /> Block {contact.name.split(' ')[0]}
                </button>
              </div>
            )}
          </div>
        </header>

        {state.settings.disappearing && (
          <div className="chat-notice"><EyeOff size={13} /> Disappearing messages are on — new messages vanish after 24h.</div>
        )}

        <div className="messages" ref={scrollRef}>
          <div className="chat-day-divider">Today</div>
          {msgs.map(m => (
            <div key={m.id} className={`bubble-row ${m.from === 'me' ? 'mine' : ''}`}>
              <div className={`bubble ${m.from === 'me' ? 'bubble-mine' : 'bubble-theirs'}`}>
                <span className="bubble-text">{m.text}</span>
                <span className="bubble-meta">
                  {fmtTime(m.at)}
                  {m.from === 'me' && state.settings.readReceipts && (
                    m.read ? <CheckCheck size={14} className="tick-read" /> : <Check size={14} />
                  )}
                </span>
              </div>
            </div>
          ))}
          {typing && (
            <div className="bubble-row">
              <div className="bubble bubble-theirs typing-bubble"><span /><span /><span /></div>
            </div>
          )}
        </div>

        <footer className="composer">
          <input
            className="composer-input"
            placeholder={`Message ${contact.name.split(' ')[0]}…`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
          />
          <button className="send-btn" onClick={sendMessage} disabled={!draft.trim()} aria-label="Send">
            <Send size={18} />
          </button>
        </footer>
        {toast && <div className="toast">{toast}</div>}
      </div>
    );
  }

  // ------------------------------ CIRCLE VIEW (group chat) ------------------------------
  if (circle) {
    const posts = state.circleMsgs[circle.id] || [];
    return (
      <div className="app">
        <header className="chat-header">
          <button className="icon-btn" onClick={() => { setActiveCircle(null); setCircleTyping(''); setAnonPost(false); }} aria-label="Back"><ChevronLeft size={22} /></button>
          <div className="circle-emoji">{circle.emoji}</div>
          <div className="chat-header-info">
            <div className="chat-header-name">{circle.name}{circle.mine && <span className="mine-tag">your circle</span>}</div>
            <div className="chat-header-status">
              {circleTyping ? <span className="typing-text">{circleTyping} is typing…</span> : `${circle.members} member${circle.members === 1 ? '' : 's'} · ${circle.about}`}
            </div>
          </div>
        </header>
        <div className="messages" ref={scrollRef}>
          {posts.length === 0 ? (
            <div className="empty-state">
              {circle.mine
                ? 'Your circle is live! Post the first message and watch it come alive.'
                : 'No messages yet — start the conversation.'}
            </div>
          ) : (
            <div className="chat-day-divider">Today</div>
          )}
          {posts.map(p => (
            <div key={p.id} className={`bubble-row ${p.author === 'me' ? 'mine' : ''}`}>
              <div className={`bubble circle-post ${p.author === 'me' ? 'bubble-mine' : 'bubble-theirs'}`}>
                {p.author !== 'me' && (
                  <span className="post-author" style={{ color: avatarColor(p.author) }}>{p.author}</span>
                )}
                {p.author === 'me' && p.anon && (
                  <span className="anon-label"><EyeOff size={11} /> posted anonymously — others see "A sister"</span>
                )}
                <span className="bubble-text">{p.text}</span>
                <span className="bubble-meta">{fmtTime(p.at)}</span>
              </div>
            </div>
          ))}
          {circleTyping && (
            <div className="bubble-row">
              <div className="bubble bubble-theirs typing-bubble"><span /><span /><span /></div>
            </div>
          )}
        </div>
        <footer className="composer-stack">
          {anonPost && (
            <div className="anon-banner"><EyeOff size={13} /> Anonymous mode — this message will show as "A sister"</div>
          )}
          <div className="composer">
            <button
              className={`anon-toggle ${anonPost ? 'on' : ''}`}
              onClick={() => setAnonPost(a => !a)}
              aria-label="Toggle anonymous posting"
              title="Post anonymously"
            >
              <EyeOff size={17} />
            </button>
            <input
              className="composer-input"
              placeholder={anonPost ? 'Ask anonymously…' : `Message ${circle.name}…`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') sendCirclePost(); }}
            />
            <button className="send-btn" onClick={sendCirclePost} disabled={!draft.trim()} aria-label="Send">
              <Send size={18} />
            </button>
          </div>
        </footer>
        {toast && <div className="toast">{toast}</div>}
      </div>
    );
  }

  // ------------------------------ MAIN TABS ------------------------------
  const filteredContacts = contacts.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title"><Heart size={20} strokeWidth={2.4} /> Behna<span className="accent">.</span></div>
        <button className="icon-btn" onClick={() => showToast('No new notifications — enjoy the quiet 🌙')} aria-label="Notifications">
          <Bell size={19} />
        </button>
      </header>

      <main className="tab-body">
        {tab === 'chats' && (
          <>
            <div className="search-bar">
              <Search size={16} />
              <input placeholder="Search sisters…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {state.settings.verifiedOnly && (
              <div className="filter-note"><BadgeCheck size={13} /> Showing verified members only</div>
            )}
            <div className="chat-list">
              {filteredContacts.map(c => {
                const last = lastMessage(c.id);
                const unread = unreadCount(c.id);
                return (
                  <button key={c.id} className="chat-list-item" onClick={() => openChat(c.id)}>
                    <Avatar name={c.name} online={c.online} verified={c.verified} />
                    <div className="chat-list-text">
                      <div className="chat-list-top">
                        <span className="chat-list-name">{c.name}</span>
                        {last && <span className="chat-list-time">{fmtTime(last.at)}</span>}
                      </div>
                      <div className="chat-list-bottom">
                        <span className="chat-list-preview">
                          {last ? `${last.from === 'me' ? 'You: ' : ''}${last.text}` : c.tagline}
                        </span>
                        {unread > 0 && <span className="unread-pill">{unread}</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
              {filteredContacts.length === 0 && (
                <div className="empty-state">No one matches that search.</div>
              )}
            </div>
            <button className="fab" onClick={() => showToast('Invites are coming soon — every new member joins vouched-for 💜')} aria-label="New chat">
              <Plus size={22} />
            </button>
          </>
        )}

        {tab === 'circles' && (
          <div className="circle-list">
            <p className="section-intro">Circles are group chats for every part of the cycle — pain, PCOS, endo, firsts, moods. Ask with your name or anonymously. Join one, or start your own.</p>
            {allCircles.map(g => {
              const posts = state.circleMsgs[g.id] || [];
              const last = posts[posts.length - 1];
              return (
                <button key={g.id} className="circle-card" onClick={() => setActiveCircle(g.id)}>
                  <div className="circle-emoji lg">{g.emoji}</div>
                  <div className="circle-card-text">
                    <div className="circle-card-name">{g.name}{g.mine && <span className="mine-tag">yours</span>}</div>
                    <div className="circle-card-about">
                      {last ? `${last.author === 'me' ? 'You' : last.author.split(' ')[0]}: ${last.text}` : g.about}
                    </div>
                    <div className="circle-card-members"><Users size={13} /> {g.members} member{g.members === 1 ? '' : 's'}</div>
                  </div>
                </button>
              );
            })}
            <button className="fab" onClick={() => setShowNewCircle(true)} aria-label="Start a circle">
              <Plus size={22} />
            </button>
          </div>
        )}

        {showNewCircle && (
          <div className="modal-overlay" onClick={() => setShowNewCircle(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <h2>Start a circle</h2>
                <button className="icon-btn" onClick={() => setShowNewCircle(false)} aria-label="Close"><X size={18} /></button>
              </div>
              <label className="field-label dark">Pick an emoji</label>
              <div className="emoji-row">
                {CIRCLE_EMOJIS.map(e => (
                  <button
                    key={e}
                    className={`emoji-pick ${newCircle.emoji === e ? 'selected' : ''}`}
                    onClick={() => setNewCircle(c => ({ ...c, emoji: e }))}
                  >{e}</button>
                ))}
              </div>
              <label className="field-label dark" htmlFor="circle-name">Circle name</label>
              <input
                id="circle-name"
                className="text-input bordered"
                placeholder="e.g. Day 1 Survival Club"
                value={newCircle.name}
                onChange={(e) => setNewCircle(c => ({ ...c, name: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') createCircle(); }}
                autoFocus
              />
              <label className="field-label dark" htmlFor="circle-about">What's it about? <span className="optional">(optional)</span></label>
              <input
                id="circle-about"
                className="text-input bordered"
                placeholder="One line so others know the vibe"
                value={newCircle.about}
                onChange={(e) => setNewCircle(c => ({ ...c, about: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') createCircle(); }}
              />
              <button className="btn-primary" disabled={!newCircle.name.trim()} onClick={createCircle}>
                Create circle <Sparkles size={16} />
              </button>
            </div>
          </div>
        )}

        {tab === 'safety' && (
          <div className="safety-panel">
            <div className="safety-hero">
              <Shield size={28} />
              <div>
                <h2>Your safety, your rules</h2>
                <p>Everything here is designed so you never have to tolerate anything that doesn't feel right.</p>
              </div>
            </div>

            <div className="setting-group">
              <div className="setting-row">
                <div>
                  <div className="setting-name"><BadgeCheck size={15} /> Verified members only</div>
                  <div className="setting-desc">Only members with a verified badge can appear in your chats.</div>
                </div>
                <button className={`switch ${state.settings.verifiedOnly ? 'on' : ''}`} onClick={() => toggleSetting('verifiedOnly')} aria-label="Toggle verified only" />
              </div>
              <div className="setting-row">
                <div>
                  <div className="setting-name"><EyeOff size={15} /> Disappearing messages</div>
                  <div className="setting-desc">New messages vanish after 24 hours.</div>
                </div>
                <button className={`switch ${state.settings.disappearing ? 'on' : ''}`} onClick={() => toggleSetting('disappearing')} aria-label="Toggle disappearing messages" />
              </div>
            </div>

            <h3 className="section-label">Blocked</h3>
            {state.blocked.length === 0 ? (
              <div className="empty-state small">You haven't blocked anyone. If you ever need to, it takes one tap and they're never told.</div>
            ) : (
              state.blocked.map(id => {
                const c = seedContacts.find(x => x.id === id);
                return (
                  <div key={id} className="blocked-row">
                    <Avatar name={c.name} size={36} />
                    <span className="blocked-name">{c.name}</span>
                    <button className="btn-ghost" onClick={() => unblockContact(id)}>Unblock</button>
                  </div>
                );
              })
            )}

            <h3 className="section-label">Your health</h3>
            <div className="sos-card">
              <AlertTriangle size={18} />
              <div>
                <strong>Peer support ≠ medical advice</strong>
                <p>Behna is sisters sharing experiences, and even our verified mentors can't examine you through a screen. Please see a doctor promptly if you have: pain that regularly makes you miss school/work, bleeding through a pad or tampon every hour, periods lasting more than 7 days, fainting or dizziness, or a sudden change in your cycle.</p>
              </div>
            </div>
          </div>
        )}

        {tab === 'profile' && (
          <div className="profile-panel">
            <div className="profile-hero">
              <Avatar name={state.profile.name || 'You'} size={72} verified />
              <input
                className="profile-name-input"
                value={state.profile.name}
                onChange={(e) => setState(s => ({ ...s, profile: { ...s.profile, name: e.target.value } }))}
                aria-label="Your name"
              />
              <input
                className="profile-vibe-input"
                value={state.profile.vibe}
                onChange={(e) => setState(s => ({ ...s, profile: { ...s.profile, vibe: e.target.value } }))}
                aria-label="Your status"
              />
            </div>

            <h3 className="section-label">Privacy</h3>
            <div className="setting-group">
              <div className="setting-row">
                <div>
                  <div className="setting-name"><CheckCheck size={15} /> Read receipts</div>
                  <div className="setting-desc">Others see when you've read their messages.</div>
                </div>
                <button className={`switch ${state.settings.readReceipts ? 'on' : ''}`} onClick={() => toggleSetting('readReceipts')} aria-label="Toggle read receipts" />
              </div>
              <div className="setting-row">
                <div>
                  <div className="setting-name"><Lock size={15} /> Last seen</div>
                  <div className="setting-desc">Share when you were last online.</div>
                </div>
                <button className={`switch ${state.settings.lastSeen ? 'on' : ''}`} onClick={() => toggleSetting('lastSeen')} aria-label="Toggle last seen" />
              </div>
            </div>

            <button className="btn-ghost logout" onClick={resetApp}><LogOut size={15} /> Log out & clear this device</button>
            <p className="fine-print center">Behna prototype · all data stays in your browser</p>
          </div>
        )}
      </main>

      <nav className="tab-bar">
        {[
          { key: 'chats', label: 'Chats', icon: MessageCircle },
          { key: 'circles', label: 'Circles', icon: Users },
          { key: 'safety', label: 'Safety', icon: Shield },
          { key: 'profile', label: 'You', icon: User },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} className={`tab-btn ${tab === key ? 'active' : ''}`} onClick={() => { setTab(key); setSearch(''); }}>
            <Icon size={21} strokeWidth={tab === key ? 2.4 : 1.8} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
