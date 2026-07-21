import { useState, useRef, useEffect, useMemo } from 'react';
import {
  MessageCircle, Users, Shield, User, Search, Send, ChevronLeft,
  MoreVertical, Check, CheckCheck, Plus, Heart, Lock, Bell, X,
  BadgeCheck, Phone, Video, AlertTriangle, Sparkles, EyeOff, LogOut
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Sakhi — a messaging app where women connect.
// Front-end prototype: all data lives in localStorage, replies are simulated.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'sakhi-app-v1';

const AVATAR_COLORS = ['#B85C8B', '#7C5CB8', '#5C8BB8', '#B8865C', '#5CB88A', '#B85C5C', '#8A5CB8'];

const seedContacts = [
  {
    id: 'c1', name: 'Priya Sharma', verified: true, online: true,
    tagline: 'Product designer · Mumbai',
    replies: [
      "That sounds lovely! Count me in 💜",
      "Haha yes, exactly what I was thinking!",
      "Let's plan for the weekend then?",
      "You always know what to say 😊",
    ],
  },
  {
    id: 'c2', name: 'Ananya Iyer', verified: true, online: false,
    tagline: 'Founder · Bengaluru',
    replies: [
      "Just wrapped a call, tell me everything!",
      "That's a great idea. Want me to intro you to someone?",
      "Proud of you for asking. That took courage.",
      "Coffee next week? My treat ☕",
    ],
  },
  {
    id: 'c3', name: 'Meera Kapoor', verified: false, online: true,
    tagline: 'New in the city 🌸',
    replies: [
      "Thank you so much for the warm welcome!",
      "I'd love that! I barely know anyone here yet.",
      "Is the Sunday walking group still on?",
      "You're so kind, seriously 🥹",
    ],
  },
  {
    id: 'c4', name: 'Dr. Farah Khan', verified: true, online: false,
    tagline: 'Pediatrician · Verified mentor',
    replies: [
      "Happy to help — that's what this space is for.",
      "That's completely normal, don't worry.",
      "Send me the details and I'll take a look tonight.",
      "Take care of yourself first. Everything else follows.",
    ],
  },
];

const seedCircles = [
  {
    id: 'g1', name: 'Mumbai Women in Tech', members: 128, emoji: '💻',
    about: 'Careers, referrals, and honest advice.',
    feed: [
      { author: 'Priya Sharma', text: 'Anyone attending the design meetup at BKC on Friday?' },
      { author: 'Ananya Iyer', text: 'Hiring two frontend engineers at my startup — DM me, referrals welcome!' },
      { author: 'Ritu M.', text: 'Just negotiated a 30% raise using the script from last week\'s thread. Thank you all 🙏' },
    ],
  },
  {
    id: 'g2', name: 'New Moms Circle', members: 86, emoji: '🍼',
    about: 'Zero judgement. All questions welcome.',
    feed: [
      { author: 'Dr. Farah Khan', text: 'Reminder: our free Q&A call is this Saturday at 11am.' },
      { author: 'Sneha P.', text: 'Night three of no sleep. Tell me it gets better 😅' },
    ],
  },
  {
    id: 'g3', name: 'Weekend Book Club', members: 42, emoji: '📚',
    about: 'One book a month, chai included.',
    feed: [
      { author: 'Meera Kapoor', text: 'Voting for next month closes tonight — it\'s between Lessons in Chemistry and Tomb of Sand!' },
    ],
  },
  {
    id: 'g4', name: 'Safe Travels ✈️', members: 204, emoji: '🧳',
    about: 'Solo travel tips, trusted stays, live check-ins.',
    feed: [
      { author: 'Ananya Iyer', text: 'Sharing my vetted homestay list for Himachal — pinned above.' },
    ],
  },
];

const now = () => new Date().toISOString();

function seedMessages() {
  return {
    c1: [
      { id: 'm1', from: 'them', text: 'Hey! Are you coming to the Sakhi meetup this weekend?', at: now(), read: true },
      { id: 'm2', from: 'me', text: 'I was just about to ask you the same thing 😄', at: now(), read: true },
      { id: 'm3', from: 'them', text: 'Perfect, let\'s go together. I\'ll pick you up?', at: now(), read: true },
    ],
    c2: [
      { id: 'm4', from: 'them', text: 'Saw your note in the founders circle — let\'s talk, I think I can help.', at: now(), read: true },
    ],
    c3: [
      { id: 'm5', from: 'them', text: 'Hi! I just moved here and joined through the New in Town circle. Priya said I should say hello 🌸', at: now(), read: false },
    ],
    c4: [],
  };
}

const defaultState = {
  onboarded: false,
  profile: { name: '', vibe: 'Here to connect 💜' },
  settings: { readReceipts: true, lastSeen: true, verifiedOnly: false, disappearing: false },
  messages: null, // seeded on first run
  blocked: [],
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...defaultState, ...parsed, messages: parsed.messages || seedMessages() };
    }
  } catch { /* corrupted storage — start fresh */ }
  return { ...defaultState, messages: seedMessages() };
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [nameInput, setNameInput] = useState('');
  const scrollRef = useRef(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage full */ }
  }, [state]);

  // keep chat scrolled to the newest message
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [activeChat, state.messages, typing]);

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
  const circle = seedCircles.find(g => g.id === activeCircle);

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
    setState({ ...defaultState, messages: seedMessages() });
    setActiveChat(null); setActiveCircle(null); setTab('chats');
  };

  // ------------------------------ ONBOARDING ------------------------------
  if (!state.onboarded) {
    return (
      <div className="app onboarding">
        <div className="onboarding-card">
          <div className="logo-mark"><Heart size={28} strokeWidth={2.2} /></div>
          <h1>Sakhi<span className="accent">.</span></h1>
          <p className="tagline">Where women connect — safely, warmly, on your own terms.</p>

          <div className="pledge">
            <div className="pledge-row"><Shield size={16} /><span>A women-only space. Every member agrees to our community pledge.</span></div>
            <div className="pledge-row"><BadgeCheck size={16} /><span>Verified profiles get a badge, and you can choose to chat with verified members only.</span></div>
            <div className="pledge-row"><Lock size={16} /><span>Your chats stay on your device in this prototype. Block anyone, anytime, no questions asked.</span></div>
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

  // ------------------------------ CIRCLE VIEW ------------------------------
  if (circle) {
    return (
      <div className="app">
        <header className="chat-header">
          <button className="icon-btn" onClick={() => setActiveCircle(null)} aria-label="Back"><ChevronLeft size={22} /></button>
          <div className="circle-emoji">{circle.emoji}</div>
          <div className="chat-header-info">
            <div className="chat-header-name">{circle.name}</div>
            <div className="chat-header-status">{circle.members} members · {circle.about}</div>
          </div>
        </header>
        <div className="messages">
          <div className="chat-day-divider">Recent in this circle</div>
          {circle.feed.map((post, i) => (
            <div key={i} className="bubble-row">
              <div className="bubble bubble-theirs circle-post">
                <span className="post-author" style={{ color: avatarColor(post.author) }}>{post.author}</span>
                <span className="bubble-text">{post.text}</span>
              </div>
            </div>
          ))}
        </div>
        <footer className="composer">
          <input className="composer-input" placeholder="Posting in circles is coming soon…" disabled />
          <button className="send-btn" disabled aria-label="Send"><Send size={18} /></button>
        </footer>
      </div>
    );
  }

  // ------------------------------ MAIN TABS ------------------------------
  const filteredContacts = contacts.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title"><Heart size={20} strokeWidth={2.4} /> Sakhi<span className="accent">.</span></div>
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
            <p className="section-intro">Circles are group spaces built around what you care about. Join in, or just listen for a while.</p>
            {seedCircles.map(g => (
              <button key={g.id} className="circle-card" onClick={() => setActiveCircle(g.id)}>
                <div className="circle-emoji lg">{g.emoji}</div>
                <div className="circle-card-text">
                  <div className="circle-card-name">{g.name}</div>
                  <div className="circle-card-about">{g.about}</div>
                  <div className="circle-card-members"><Users size={13} /> {g.members} members</div>
                </div>
              </button>
            ))}
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

            <div className="sos-card">
              <AlertTriangle size={18} />
              <div>
                <strong>Need help right now?</strong>
                <p>In a real emergency, contact local emergency services. Sakhi's trusted-contact live location sharing is on our roadmap.</p>
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
            <p className="fine-print center">Sakhi prototype · all data stays in your browser</p>
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
