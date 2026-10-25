// Burrow Brawl — local accounts (localStorage only; hashing is NOT real security).
const ACC_KEY = 'burrowbrawl.accounts.v1';
const RUNS_KEY = 'burrowbrawl.runs.v1';
const OLD_META_KEY = 'burrowbrawl.meta.v1';
const GUEST = 'Guest';
const MAX_RUNS = 3000;

const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
function read(key, def) {
  try { const r = localStorage.getItem(key); if (r) { const v = JSON.parse(r); if (v != null) return v; } } catch (e) { /* */ }
  return def;
}
function write(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* */ } }

function emptyStats() {
  return { runs: 0, deaths: 0, victories: 0, quits: 0, segments: 0, kills: 0, timePlayed: 0, gold: 0, bossesKilled: 0,
    stagesCleared: 0, highestLevel: 0, bestScore: 0, damageDealt: 0, bestTimes: {}, characterRuns: {}, characterBest: {} };
}
function newUser(username, salt = null, hash = null) {
  return { username, salt, hash, createdAt: Date.now(), stats: emptyStats(), meta: null };
}

let db = read(ACC_KEY, null);
if (!db || typeof db !== 'object' || !db.users) db = { users: {}, current: null };
if (!db.users[GUEST]) db.users[GUEST] = newUser(GUEST);
// migrate legacy game meta into Guest (or the first account) if nobody has meta yet
(() => {
  const old = read(OLD_META_KEY, null);
  if (!old || db.migrated) return;
  const target = db.users[GUEST];
  if (!target.meta) target.meta = old;
  db.migrated = true;
})();
let runs = read(RUNS_KEY, []);
if (!Array.isArray(runs)) runs = [];
const save = () => write(ACC_KEY, db);
save();

const listeners = new Set();
const emit = () => { const c = Accounts.current(); for (const fn of listeners) { try { fn(c); } catch (e) { console.error(e); } } };

function curUser() { return db.users[db.current] || db.users[GUEST]; }
const norm = (u) => String(u || '').trim();
const findUser = (u) => { const l = norm(u).toLowerCase(); return Object.keys(db.users).find((k) => k.toLowerCase() === l); };

async function hash(salt, password) {
  const data = new TextEncoder().encode(salt + ':' + password);
  try {
    const buf = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (e) { // insecure context fallback (no subtle): simple FNV mix
    let h = 2166136261; for (const b of data) { h ^= b; h = Math.imul(h, 16777619) >>> 0; }
    return 'fnv' + h.toString(16);
  }
}
function makeSalt() {
  const a = new Uint8Array(16);
  try { crypto.getRandomValues(a); } catch (e) { for (let i = 0; i < 16; i++) a[i] = Math.random() * 256; }
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export function validateUsername(u) {
  u = norm(u);
  if (u.length < 3 || u.length > 16) return 'Username must be 3–16 characters.';
  if (!/^[A-Za-z0-9_ -]+$/.test(u)) return 'Use letters, numbers, spaces, _ or - only.';
  if (u.toLowerCase() === 'guest') return 'That name is reserved.';
  return null;
}

const stageIdx = (s) => (typeof s === 'number' ? s : (s && typeof s === 'object' ? s.index ?? s.id : s));

export const Accounts = {
  GUEST,
  validateUsername,
  current() {
    const u = curUser();
    return { username: u.username, createdAt: u.createdAt, stats: clone(u.stats), meta: clone(u.meta), guest: u.username === GUEST };
  },
  isGuest() { return curUser().username === GUEST; },
  async register(username, password) {
    const u = norm(username);
    const err = validateUsername(u); if (err) return { ok: false, error: err };
    if (findUser(u)) return { ok: false, error: 'That username is taken.' };
    if (!password || String(password).length < 4) return { ok: false, error: 'Password must be at least 4 characters.' };
    const salt = makeSalt();
    const user = newUser(u, salt, await hash(salt, password));
    db.users[u] = user; db.current = u; save(); emit();
    return { ok: true };
  },
  async login(username, password) {
    const k = findUser(username);
    const user = k && db.users[k];
    if (!user || k === GUEST || !user.hash) return { ok: false, error: 'Invalid username or password.' };
    if ((await hash(user.salt, password)) !== user.hash) return { ok: false, error: 'Invalid username or password.' };
    db.current = k; save(); emit();
    return { ok: true };
  },
  logout() { db.current = null; save(); emit(); },
  list() { return Object.keys(db.users).filter((k) => k !== GUEST); },

  recordRun(summary = {}) {
    try {
      const u = curUser(); const s = u.stats = { ...emptyStats(), ...(u.stats || {}) };
      const endedBy = summary.endedBy || 'death';
      const stage = stageIdx(summary.stage);
      const time = Math.floor(summary.time || 0);
      const ch = summary.character || 'unknown';
      const prior = u._segTime || 0; // timer continues across stage segments; count only new time
      const addTime = Math.max(0, time - prior);
      u._segTime = endedBy === 'nextStage' ? time : 0;
      const prevSeg = u._seg || { kills: 0, gold: 0, dmg: 0, bosses: 0 };
      const seg = { kills: summary.kills || 0, gold: summary.gold || 0, dmg: summary.damageDealt || 0, bosses: summary.bossesKilled || 0 };
      const d = (k) => Math.max(0, seg[k] - (prior ? prevSeg[k] : 0));
      u._seg = endedBy === 'nextStage' ? seg : null;
      if (endedBy === 'nextStage') { s.segments++; s.stagesCleared++; }
      else {
        s.runs++; s.characterRuns[ch] = (s.characterRuns[ch] || 0) + 1;
        if (endedBy === 'death') s.deaths++;
        else if (endedBy === 'victory') { s.victories++; s.stagesCleared++; }
        else if (endedBy === 'quit') s.quits++;
      }
      s.kills += d('kills'); s.gold += d('gold'); s.damageDealt += d('dmg'); s.bossesKilled += d('bosses');
      s.timePlayed += addTime;
      s.highestLevel = Math.max(s.highestLevel, summary.level || 0);
      s.bestScore = Math.max(s.bestScore || 0, summary.score || 0);
      if (stage != null && time > (s.bestTimes[stage] || 0)) s.bestTimes[stage] = time;
      if (time > (s.characterBest[ch] || 0)) s.characterBest[ch] = time;
      runs.push({ username: u.username, character: ch, stage, difficulty: summary.difficulty, score: Math.floor(summary.score || 0),
        time, kills: summary.kills || 0, level: summary.level || 0, endedBy, loop: summary.loop || 0, date: Date.now() });
      if (runs.length > MAX_RUNS) { runs.sort((a, b) => b.score - a.score); runs.length = MAX_RUNS; }
      write(RUNS_KEY, runs); save(); emit();
    } catch (e) { console.error('recordRun failed', e); }
  },
  getStats() { return clone({ ...emptyStats(), ...(curUser().stats || {}) }); },
  leaderboard(category = 'score', filter = {}) {
    const key = { score: 'score', time: 'time', kills: 'kills', level: 'level' }[category] || 'score';
    const f = filter || {};
    return runs.filter((r) => (f.stage == null || f.stage === '' || String(r.stage) === String(f.stage))
        && (!f.difficulty || r.difficulty === f.difficulty) && (!f.character || r.character === f.character))
      .sort((a, b) => (b[key] || 0) - (a[key] || 0) || (b.score || 0) - (a.score || 0) || a.date - b.date)
      .slice(0, 50).map((r) => ({ ...r }));
  },
  saveMeta(meta) { curUser().meta = clone(meta); save(); },
  loadMeta() { return clone(curUser().meta) || null; },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};
export default Accounts;
