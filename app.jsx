// SPA CRM — STEP-01 + STEP-02 + STEP-03: Foundation + Onboarding + Settings
// Single-file React JSX artifact
// Stack: React (hooks), Tailwind CSS, Lucide-react

const { useState, useEffect, useCallback, useRef } = React;
const { Gem, Settings, Calendar, BookOpen, LayoutDashboard, Loader2, Plus, Trash2, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Check, X, Moon, Phone, Search, Users, LogOut, Shield, Eye, EyeOff, ClipboardList, UserPlus, Lock } = lucide;

// ─── Storage Layer ────────────────────────────────────────────────────────────

const Storage = {
  async get(key) {
    try {
      const result = await window.storage.get(key);
      return result ? JSON.parse(result.value) : null;
    } catch { return null; }
  },
  async set(key, value) {
    try {
      await window.storage.set(key, JSON.stringify(value));
      return true;
    } catch { return false; }
  },
  async delete(key) {
    try {
      await window.storage.delete(key);
      return true;
    } catch { return false; }
  },
  async list(prefix) {
    try {
      const result = await window.storage.list(prefix);
      return result?.keys || [];
    } catch { return []; }
  }
};

// Storage key constants
const KEYS = {
  salons: "spa-crm:salons",
  procedures: (salonId) => `spa-crm:procedures:${salonId}`,
  combos: (salonId) => `spa-crm:combos:${salonId}`,
  bookings: (salonId, yearMonth) => `spa-crm:bookings:${salonId}:${yearMonth}`,
};

// ─── User Storage Layer (Supabase Auth + profiles) ──────────────────────────

const sb = window.supabaseClient;

const UserStorage = {
  async getUsers() {
    const { data, error } = await sb.from("profiles").select("*");
    if (error) { console.error("getUsers error:", error); return []; }
    return (data || []).map(p => ({
      id: p.id, name: p.name, login: p.login,
      password: "••••••", role: p.role, createdAt: p.created_at,
    }));
  },

  async saveUser(user) {
    // For existing user: update profile (name, role)
    const { error } = await sb.from("profiles")
      .update({ name: user.name, role: user.role })
      .eq("id", user.id);
    if (error) console.error("saveUser error:", error);
    return user;
  },

  async createUser(login, password, name, role) {
    // Create via Supabase Auth signUp with metadata
    // Use a secondary client to avoid logging out current admin
    const tempClient = supabase.createClient(
      window.SUPABASE_URL || 'https://uzjeunhutriqalzucgpe.supabase.co',
      window.SUPABASE_ANON_KEY || sb.supabaseKey
    );
    const email = login + "@example.com";
    const { data, error } = await tempClient.auth.signUp({
      email,
      password,
      options: {
        data: { name, login, role },
      },
    });
    if (error) return { error: error.message };
    return { user: { id: data.user.id, name, login, role } };
  },

  async deleteUser(userId) {
    // Delete profile (auth user remains but profile is gone = effectively disabled)
    const { error } = await sb.from("profiles").delete().eq("id", userId);
    if (error) console.error("deleteUser error:", error);
  },

  async updatePassword(userId, newPassword) {
    // Only works for current user via Supabase Auth
    const { error } = await sb.auth.updateUser({ password: newPassword });
    if (error) return { error: error.message };
    return { ok: true };
  },

  async getLogs() {
    const { data, error } = await sb.from("activity_logs")
      .select("*").order("timestamp", { ascending: false });
    if (error) { console.error("getLogs error:", error); return []; }
    return (data || []).map(l => ({
      id: l.id, userId: l.user_id, userName: l.user_name,
      action: l.action, targetDate: l.target_date, targetTime: l.target_time,
      clientName: l.client_name, details: l.details, timestamp: l.timestamp,
    }));
  },

  async saveLog(log) {
    const { error } = await sb.from("activity_logs").insert({
      id: log.id, user_id: log.userId, user_name: log.userName,
      action: log.action, target_date: log.targetDate, target_time: log.targetTime,
      client_name: log.clientName, details: log.details, timestamp: log.timestamp,
    });
    if (error) console.error("saveLog error:", error);
  },

  async getCurrentUser() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return null;
    const { data: profile } = await sb.from("profiles")
      .select("*").eq("id", session.user.id).single();
    if (!profile) return null;
    return { id: profile.id, name: profile.name, login: profile.login, role: profile.role };
  },

  async setCurrentUser(_user) {
    // No-op: Supabase Auth handles session persistence
  },

  async clearCurrentUser() {
    await sb.auth.signOut();
  },

  async initDefaultAdmin() {
    // Check if any profiles exist; if not, create default admin via signUp
    const { count } = await sb.from("profiles").select("*", { count: "exact", head: true });
    if (count === 0) {
      const email = "admin@example.com";
      const tempClient = supabase.createClient(
        'https://uzjeunhutriqalzucgpe.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6amV1bmh1dHJpcWFsenVjZ3BlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MDAxNzYsImV4cCI6MjA4OTI3NjE3Nn0._17Iv4Vav439wpzEUD8jsQ8UoflBKMh1e-EqyWmwPt4'
      );
      const { error } = await tempClient.auth.signUp({
        email,
        password: "admin123",
        options: { data: { name: "Администратор", login: "admin", role: "admin" } },
      });
      if (error) console.error("initDefaultAdmin error:", error);
    }
  },

  async authenticate(login, password) {
    const email = login + "@example.com";
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error || !data.user) return null;
    const { data: profile } = await sb.from("profiles")
      .select("*").eq("id", data.user.id).single();
    if (!profile) return null;
    return { id: profile.id, name: profile.name, login: profile.login, role: profile.role };
  },
};

// ─── Data Types (JSDoc) ───────────────────────────────────────────────────────

/**
 * @typedef {Object} Room
 * @property {string} id
 * @property {string} name
 * @property {1|2} beds
 */

/**
 * @typedef {Object} Salon
 * @property {string} id                    - "salon-1" | "salon-2"
 * @property {string} name
 * @property {Room[]} rooms
 * @property {number} therapistCount
 * @property {boolean} hasSauna
 * @property {number} saunaCapacity
 * @property {boolean} hasPeeling
 * @property {number} peelingMaxPerHour
 * @property {number} peelingMastersMax
 * @property {number} peelingTimePerPerson  - minutes (default 30)
 * @property {number} saunaDuration         - minutes (default 60)
 * @property {string} workStart             - "HH:MM"
 * @property {string} workEnd              - "HH:MM"
 * @property {string} dayOff               - e.g. "monday"
 * @property {number} bufferMinutes        - default 15
 */

/**
 * @typedef {Object} Procedure
 * @property {string} id
 * @property {string} salonId
 * @property {string} name
 * @property {"massage"|"sauna"|"peeling"} category
 * @property {number} duration             - minutes
 * @property {number} price
 * @property {number} therapistsRequired   - per client (default 1; 4-hands = 2)
 * @property {boolean} isActive
 */

/**
 * @typedef {{ procedureId: string, order: number }} ComboStep
 *
 * @typedef {Object} ComboPackage
 * @property {string} id
 * @property {string} salonId
 * @property {string} name
 * @property {ComboStep[]} steps
 * @property {number} totalDuration        - auto-calculated sum of step durations
 * @property {number} price
 * @property {boolean} isActive
 */

/**
 * @typedef {Object} BookingSegment
 * @property {string} procedureId
 * @property {string} procedureName
 * @property {string} startTime            - "HH:MM"
 * @property {string} endTime             - "HH:MM"
 * @property {string|null} roomId
 * @property {number} therapistCount
 * @property {"room"|"sauna"|"peeling"} resourceType
 */

/**
 * @typedef {Object} Booking
 * @property {string} id
 * @property {string} salonId
 * @property {string} date                 - "YYYY-MM-DD"
 * @property {string} clientName
 * @property {string} clientPhone
 * @property {number} clientCount
 * @property {"single_procedure"|"combo"} bookingType
 * @property {string|null} procedureId
 * @property {string|null} comboId
 * @property {BookingSegment[]} segments
 * @property {string} totalStartTime       - "HH:MM"
 * @property {string} totalEndTime         - "HH:MM" (includes buffer)
 * @property {number} totalPrice
 * @property {"booked"|"completed"|"cancelled_refund"|"cancelled_no_refund"|"no-show"} status
 * @property {string} createdAt            - ISO date string
 * @property {string} notes
 */

// ─── Default Data ─────────────────────────────────────────────────────────────

const makeId = () => Math.random().toString(36).slice(2, 10);

const makeDefaultProcedures = (salonId) => [
  // Тайский массаж
  { id: makeId(), salonId, name: "Тайский массаж 1ч",    category: "massage", duration: 60,  price: 5000, therapistsRequired: 1, isActive: true },
  { id: makeId(), salonId, name: "Тайский массаж 1.5ч",  category: "massage", duration: 90,  price: 7000, therapistsRequired: 1, isActive: true },
  { id: makeId(), salonId, name: "Тайский массаж 2ч",    category: "massage", duration: 120, price: 9000, therapistsRequired: 1, isActive: true },
  // Ойл массаж
  { id: makeId(), salonId, name: "Ойл массаж 1ч",        category: "massage", duration: 60,  price: 5000, therapistsRequired: 1, isActive: true },
  { id: makeId(), salonId, name: "Ойл массаж 1.5ч",      category: "massage", duration: 90,  price: 7000, therapistsRequired: 1, isActive: true },
  { id: makeId(), salonId, name: "Ойл массаж 2ч",        category: "massage", duration: 120, price: 9000, therapistsRequired: 1, isActive: true },
  // Массаж в 4 руки
  { id: makeId(), salonId, name: "Массаж в 4 руки 1ч",   category: "massage", duration: 60,  price: 9000,  therapistsRequired: 2, isActive: true },
  { id: makeId(), salonId, name: "Массаж в 4 руки 1.5ч", category: "massage", duration: 90,  price: 13000, therapistsRequired: 2, isActive: true },
  { id: makeId(), salonId, name: "Массаж в 4 руки 2ч",   category: "massage", duration: 120, price: 17000, therapistsRequired: 2, isActive: true },
  // Сауна и пиллинг
  { id: makeId(), salonId, name: "Сауна",                 category: "sauna",   duration: 60,  price: 3000, therapistsRequired: 0, isActive: true },
  { id: makeId(), salonId, name: "Пиллинг",               category: "peeling", duration: 30,  price: 2000, therapistsRequired: 1, isActive: true },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (date = new Date()) => {
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
};

const currentYearMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// ─── Colors / Design Tokens ───────────────────────────────────────────────────

const C = {
  bg:        "#0F1419",
  card:      "#1A2332",
  gridBg:    "#151E2B",
  border:    "#2A3A4E",
  textMain:  "#E8E0D6",
  textSub:   "#8A9AAE",
  accent:    "#D4A84B",
  accentHov: "#E6BE6A",
  header:    "#141B24",
};

// ─── UI Components ────────────────────────────────────────────────────────────

function Header({ salons, activeSalonId, onSalonChange }) {
  return (
    <header style={{
      position: "fixed", top: 0, left: 0, right: 0, height: 56, zIndex: 50,
      backgroundColor: C.header, borderBottom: `1px solid ${C.border}`,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 24px",
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Gem size={22} color={C.accent} />
        <span style={{ color: C.textMain, fontWeight: 600, fontSize: 16, letterSpacing: "0.5px" }}>
          SPA CRM
        </span>
      </div>

      {/* Salon switcher */}
      <div style={{ display: "flex", gap: 8 }}>
        {salons.map((salon) => {
          const isActive = salon.id === activeSalonId;
          return (
            <button
              key={salon.id}
              onClick={() => onSalonChange(salon.id)}
              style={{
                padding: isActive ? "8px 24px" : "6px 16px",
                borderRadius: 8,
                border: isActive ? `2px solid ${C.accent}` : `1px solid ${C.accent}55`,
                backgroundColor: isActive ? C.accent : "transparent",
                color: isActive ? C.bg : C.accent,
                fontWeight: isActive ? 700 : 500,
                fontSize: isActive ? 15 : 13,
                cursor: "pointer",
                transition: "all 150ms",
                boxShadow: isActive ? `0 0 12px ${C.accent}44` : "none",
              }}
            >
              {salon.name}
            </button>
          );
        })}
      </div>

      {/* Date */}
      <span style={{ color: C.textSub, fontSize: 13 }}>
        {formatDate()}
      </span>
    </header>
  );
}

const TABS = [
  { id: "schedule",  label: "Расписание",    icon: Calendar },
  { id: "services",  label: "Услуги и цены", icon: BookOpen },
  { id: "dashboard", label: "Дашборд",       icon: LayoutDashboard },
  { id: "journal",   label: "Журнал",        icon: BookOpen },
  { id: "settings",  label: "Настройки",     icon: Settings },
];

function TabBar({ activeTab, onTabChange }) {
  return (
    <nav style={{
      position: "fixed", top: 56, left: 0, right: 0, height: 44, zIndex: 49,
      backgroundColor: C.header, borderBottom: `1px solid ${C.border}`,
      display: "flex", alignItems: "center",
      padding: "0 24px", gap: 0,
    }}>
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "0 16px", height: "100%",
              background: "none", border: "none",
              borderBottom: isActive ? `2px solid ${C.accent}` : "2px solid transparent",
              color: isActive ? C.accent : C.textSub,
              fontSize: 14, fontWeight: isActive ? 600 : 400,
              cursor: "pointer",
              transition: "all 150ms",
              letterSpacing: "0.3px",
            }}
          >
            <Icon size={15} />
            {label && <span>{label}</span>}
          </button>
        );
      })}
    </nav>
  );
}

function LoadingScreen() {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "100vh", gap: 16,
      color: C.textSub, backgroundColor: C.bg,
    }}>
      <Loader2 size={32} color={C.accent} style={{ animation: "spin 1s linear infinite" }} />
      <span style={{ fontSize: 14 }}>Загрузка данных…</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Login Screen ────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }) {
  const [roleTab, setRoleTab] = useState("admin");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!login.trim() || !password.trim()) {
      setError("Введите логин и пароль");
      return;
    }
    setLoading(true);
    setError("");
    const user = await UserStorage.authenticate(login.trim(), password);
    if (user) {
      await UserStorage.setCurrentUser({ id: user.id, name: user.name, login: user.login, role: user.role });
      onLogin(user);
    } else {
      setError("Неверный логин или пароль");
    }
    setLoading(false);
  };

  const tabStyle = (active) => ({
    flex: 1, padding: "10px 0", borderRadius: 8, border: "none",
    fontSize: 13, fontWeight: active ? 700 : 400, cursor: "pointer",
    backgroundColor: active ? C.accent : "transparent",
    color: active ? C.bg : C.textSub,
    transition: "all 150ms",
  });

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", backgroundColor: C.bg,
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <form onSubmit={handleSubmit} style={{
        width: 380, padding: 36, borderRadius: 16,
        backgroundColor: C.card, border: `1px solid ${C.border}`,
        boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Gem size={36} color={C.accent} />
          <h1 style={{ margin: "12px 0 4px", fontSize: 22, fontWeight: 700, color: C.textMain }}>SPA CRM</h1>
          <p style={{ fontSize: 13, color: C.textSub, margin: 0 }}>Войдите в систему</p>
        </div>

        {/* Role tab switcher */}
        <div style={{
          display: "flex", gap: 4, padding: 4, borderRadius: 10, marginBottom: 24,
          backgroundColor: C.gridBg, border: `1px solid ${C.border}`,
        }}>
          <button type="button" onClick={() => { setRoleTab("admin"); setError(""); }} style={tabStyle(roleTab === "admin")}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Shield size={14} /> Администратор
            </span>
          </button>
          <button type="button" onClick={() => { setRoleTab("worker"); setError(""); }} style={tabStyle(roleTab === "worker")}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Users size={14} /> Работник
            </span>
          </button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, color: C.textSub, marginBottom: 6, fontWeight: 500 }}>Логин</label>
          <input
            type="text" value={login} onChange={e => setLogin(e.target.value)}
            autoFocus placeholder={roleTab === "admin" ? "admin" : "worker1"}
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 14,
              border: `1px solid ${C.border}`, backgroundColor: C.gridBg,
              color: C.textMain, outline: "none",
            }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 12, color: C.textSub, marginBottom: 6, fontWeight: 500 }}>Пароль</label>
          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••"
              style={{
                width: "100%", padding: "10px 40px 10px 12px", borderRadius: 8, fontSize: 14,
                border: `1px solid ${C.border}`, backgroundColor: C.gridBg,
                color: C.textMain, outline: "none",
              }}
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} style={{
              position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer", color: C.textSub, padding: 4,
            }}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {error && (
          <div style={{
            padding: "8px 12px", borderRadius: 8, marginBottom: 16,
            backgroundColor: "#EF444422", border: "1px solid #EF444444",
            color: "#F87171", fontSize: 13,
          }}>{error}</div>
        )}

        <button type="submit" disabled={loading} style={{
          width: "100%", padding: "11px 0", borderRadius: 8, border: "none",
          backgroundColor: C.accent, color: C.bg, fontSize: 14, fontWeight: 600,
          cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1,
        }}>
          {loading ? "Вход…" : "Войти"}
        </button>
      </form>
    </div>
  );
}

// ─── Onboarding Wizard ────────────────────────────────────────────────────────

const DAYS_OF_WEEK = [
  { value: "monday",    label: "Понедельник" },
  { value: "tuesday",   label: "Вторник"     },
  { value: "wednesday", label: "Среда"       },
  { value: "thursday",  label: "Четверг"     },
  { value: "friday",    label: "Пятница"     },
  { value: "saturday",  label: "Суббота"     },
  { value: "sunday",    label: "Воскресенье" },
];

const makeInitialSalonConfig = (id) => ({
  id,
  name: "",
  rooms: [{ id: `${id}-room-1`, name: "Кабинка 1", beds: 2 }],
  therapistCount: 6,
  hasSauna: true,
  saunaCapacity: 4,
  saunaDuration: 60,
  hasPeeling: true,
  peelingMaxPerHour: 4,
  peelingMastersMax: 2,
  peelingTimePerPerson: 30,
  workStart: "10:00",
  workEnd: "22:00",
  dayOff: "monday",
  bufferMinutes: 15,
});

// Shared input styles
const inputStyle = (focused = false) => ({
  width: "100%",
  boxSizing: "border-box",
  height: 40,
  padding: "8px 12px",
  borderRadius: 8,
  backgroundColor: C.bg,
  border: `1px solid ${focused ? C.accent : C.border}`,
  boxShadow: focused ? `0 0 0 2px ${C.accent}33` : "none",
  color: C.textMain,
  fontSize: 13,
  outline: "none",
});

const labelStyle = { display: "block", color: C.textSub, fontSize: 12, marginBottom: 6 };

function Toggle({ checked, onChange }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: 44, height: 24, borderRadius: 12, cursor: "pointer",
        backgroundColor: checked ? C.accent : C.border,
        position: "relative", transition: "background 200ms", flexShrink: 0,
      }}
    >
      <div style={{
        position: "absolute", top: 3, left: checked ? 23 : 3,
        width: 18, height: 18, borderRadius: "50%",
        backgroundColor: checked ? C.bg : C.textSub,
        transition: "left 200ms",
      }} />
    </div>
  );
}

function NumberInput({ value, onChange, min, max, label }) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(null);
  const displayValue = draft !== null ? draft : value;
  return (
    <div>
      {label && <label style={labelStyle}>{label}</label>}
      <input
        type="number" min={min} max={max} value={displayValue}
        onChange={e => {
          const raw = e.target.value;
          setDraft(raw);
          const v = parseInt(raw, 10);
          if (!isNaN(v) && v >= min && v <= max) onChange(v);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); setDraft(null); }}
        style={inputStyle(focused)}
      />
    </div>
  );
}

function TextInput({ value, onChange, placeholder, label }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      {label && <label style={labelStyle}>{label}</label>}
      <input
        type="text" value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={inputStyle(focused)}
      />
    </div>
  );
}

function TimeInput({ value, onChange, label }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      {label && <label style={labelStyle}>{label}</label>}
      <input
        type="time" value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ ...inputStyle(focused), colorScheme: "dark" }}
      />
    </div>
  );
}

function SelectInput({ value, onChange, options, label }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      {label && <label style={labelStyle}>{label}</label>}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ ...inputStyle(focused), cursor: "pointer" }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value} style={{ backgroundColor: C.card }}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function RoomsEditor({ rooms, onChange }) {
  const updateRoom = (idx, patch) => {
    const next = rooms.map((r, i) => i === idx ? { ...r, ...patch } : r);
    onChange(next);
  };
  const addRoom = () => {
    if (rooms.length >= 6) return;
    const n = rooms.length + 1;
    const salonId = rooms[0]?.id.split("-room-")[0] || "salon-1";
    onChange([...rooms, { id: `${salonId}-room-${n}`, name: `Кабинка ${n}`, beds: 2 }]);
  };
  const removeRoom = (idx) => {
    if (rooms.length <= 1) return;
    onChange(rooms.filter((_, i) => i !== idx));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rooms.map((room, idx) => (
        <div key={room.id} style={{
          display: "flex", alignItems: "center", gap: 10,
          backgroundColor: C.bg, borderRadius: 8, padding: "10px 12px",
          border: `1px solid ${C.border}`,
        }}>
          <span style={{ color: C.textSub, fontSize: 13, minWidth: 24 }}>{idx + 1}</span>
          <div style={{ flex: 1 }}>
            <input
              type="text" value={room.name}
              onChange={e => updateRoom(idx, { name: e.target.value })}
              style={{ ...inputStyle(), height: 32, fontSize: 13 }}
            />
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {[1, 2].map(b => (
              <button
                key={b}
                onClick={() => updateRoom(idx, { beds: b })}
                style={{
                  padding: "4px 12px", borderRadius: 6, fontSize: 12,
                  border: `1px solid ${room.beds === b ? C.accent : C.border}`,
                  backgroundColor: room.beds === b ? C.accent : "transparent",
                  color: room.beds === b ? C.bg : C.textSub,
                  cursor: "pointer",
                }}
              >
                {b} кр.
              </button>
            ))}
          </div>
          {rooms.length > 1 && (
            <button
              onClick={() => removeRoom(idx)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", padding: 4 }}
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      ))}
      {rooms.length < 6 && (
        <button
          onClick={addRoom}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "8px", borderRadius: 8, border: `1px dashed ${C.border}`,
            background: "none", color: C.textSub, fontSize: 13, cursor: "pointer",
          }}
        >
          <Plus size={14} /> Добавить кабинку
        </button>
      )}
    </div>
  );
}

function SaunaFields({ config, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: C.textMain, fontSize: 13 }}>Есть сауна</span>
        <Toggle checked={config.hasSauna} onChange={v => onChange({ hasSauna: v })} />
      </div>
      {config.hasSauna && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <NumberInput
            label="Вместимость (чел.)" value={config.saunaCapacity}
            min={1} max={20} onChange={v => onChange({ saunaCapacity: v })}
          />
          <NumberInput
            label="Длительность (мин)" value={config.saunaDuration}
            min={30} max={180} onChange={v => onChange({ saunaDuration: v })}
          />
        </div>
      )}
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ color: C.textMain, fontSize: 13 }}>Есть пиллинг</span>
          <Toggle checked={config.hasPeeling} onChange={v => onChange({ hasPeeling: v })} />
        </div>
        {config.hasPeeling && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <NumberInput
              label="Макс мастеров" value={config.peelingMastersMax}
              min={1} max={10} onChange={v => onChange({ peelingMastersMax: v })}
            />
            <NumberInput
              label="Мин на человека" value={config.peelingTimePerPerson}
              min={10} max={60} onChange={v => onChange({ peelingTimePerPerson: v })}
            />
            <NumberInput
              label="Макс людей/час" value={config.peelingMaxPerHour}
              min={1} max={20} onChange={v => onChange({ peelingMaxPerHour: v })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ScheduleFields({ config, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <NumberInput
        label="Массажистки (кол-во)" value={config.therapistCount}
        min={1} max={15} onChange={v => onChange({ therapistCount: v })}
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <TimeInput label="Начало работы" value={config.workStart} onChange={v => onChange({ workStart: v })} />
        <TimeInput label="Конец работы"  value={config.workEnd}   onChange={v => onChange({ workEnd: v })} />
      </div>
      <SelectInput
        label="Выходной день" value={config.dayOff}
        options={DAYS_OF_WEEK} onChange={v => onChange({ dayOff: v })}
      />
      <NumberInput
        label="Буфер между записями (мин)" value={config.bufferMinutes}
        min={5} max={60} onChange={v => onChange({ bufferMinutes: v })}
      />
    </div>
  );
}

function ProgressBar({ current, total }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          flex: 1, height: 4, borderRadius: 2,
          backgroundColor: i < current ? C.accent : C.border,
          transition: "background 200ms",
        }} />
      ))}
    </div>
  );
}

function OnboardingWizard({ onComplete }) {
  const TOTAL_STEPS = 5;
  const [step, setStep] = useState(0);
  const [s1, setS1] = useState(makeInitialSalonConfig("salon-1"));
  const [s2, setS2] = useState(makeInitialSalonConfig("salon-2"));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const patchS1 = (patch) => setS1(prev => ({ ...prev, ...patch }));
  const patchS2 = (patch) => setS2(prev => ({ ...prev, ...patch }));

  const validate = () => {
    if (step === 0 && !s1.name.trim()) return "Введите название салона";
    if (step === 1 && (s1.rooms.length < 1 || s1.rooms.length > 6))
      return "Кол-во кабинок должно быть от 1 до 6";
    if (step === 1 && s1.rooms.some(r => !r.name.trim()))
      return "Укажите название каждой кабинки";
    if (step === 2 && (s1.therapistCount < 1 || s1.therapistCount > 15))
      return "Кол-во мастеров: от 1 до 15";
    if (step === 4 && !s2.name.trim()) return "Введите название второго салона";
    return "";
  };

  const next = () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError("");
    if (step < TOTAL_STEPS - 1) setStep(s => s + 1);
  };

  const back = () => { setError(""); setStep(s => s - 1); };

  const finish = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    const salons = [s1, s2];
    await Storage.set(KEYS.salons, salons);
    for (const salon of salons) {
      await Storage.set(KEYS.procedures(salon.id), makeDefaultProcedures(salon.id));
      await Storage.set(KEYS.combos(salon.id), []);
    }
    onComplete(salons);
  };

  const STEP_TITLES = [
    "Название салона 1",
    "Кабинки салона 1",
    "Массажистки и часы салона 1",
    "Сауна и пиллинг салона 1",
    "Настройка салона 2",
  ];

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <TextInput
            label='Как называется ваш первый салон?'
            value={s1.name}
            placeholder="Thai Orchid"
            onChange={v => patchS1({ name: v })}
          />
        );
      case 1:
        return (
          <div>
            <p style={{ margin: "0 0 12px", color: C.textSub, fontSize: 13 }}>
              Добавьте кабинки (1–6) и укажите количество кроватей.
            </p>
            <RoomsEditor rooms={s1.rooms} onChange={rooms => patchS1({ rooms })} />
          </div>
        );
      case 2:
        return <ScheduleFields config={s1} onChange={patchS1} />;
      case 3:
        return <SaunaFields config={s1} onChange={patchS1} />;
      case 4:
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <TextInput
              label="Название второго салона"
              value={s2.name}
              placeholder="Thai Orchid 2"
              onChange={v => patchS2({ name: v })}
            />
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
              <p style={{ margin: "0 0 10px", color: C.textSub, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Кабинки
              </p>
              <RoomsEditor rooms={s2.rooms} onChange={rooms => patchS2({ rooms })} />
            </div>
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
              <p style={{ margin: "0 0 10px", color: C.textSub, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Мастера и часы
              </p>
              <ScheduleFields config={s2} onChange={patchS2} />
            </div>
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
              <p style={{ margin: "0 0 10px", color: C.textSub, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Сауна и пиллинг
              </p>
              <SaunaFields config={s2} onChange={patchS2} />
            </div>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      backgroundColor: C.bg,
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      padding: "40px 16px",
      overflowY: "auto",
    }}>
      <div style={{
        width: "100%", maxWidth: 480,
        backgroundColor: C.card, borderRadius: 12, padding: 32,
      }}>
        {/* Progress bar */}
        <ProgressBar current={step + 1} total={TOTAL_STEPS} />
        <p style={{ margin: "6px 0 24px", color: C.textSub, fontSize: 12 }}>
          Шаг {step + 1} из {TOTAL_STEPS}
        </p>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
          <Gem size={20} color={C.accent} />
          <span style={{ color: C.textMain, fontWeight: 600, fontSize: 15 }}>SPA CRM</span>
        </div>

        <h2 style={{ margin: "0 0 4px", fontWeight: 600, fontSize: 20, color: C.textMain }}>
          {STEP_TITLES[step]}
        </h2>
        <p style={{ margin: "0 0 24px", color: C.textSub, fontSize: 13 }}>
          {step < 4 ? "Настроим ваш первый салон." : "Настроим второй салон."}
        </p>

        {/* Step content */}
        <div style={{ marginBottom: 24 }}>
          {renderStep()}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: "8px 12px", borderRadius: 6, marginBottom: 16,
            backgroundColor: "#EF444422", border: "1px solid #EF4444",
            color: "#F87171", fontSize: 12,
          }}>
            {error}
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {step > 0 ? (
            <button
              onClick={back}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                background: "none", border: "none", color: C.textSub,
                fontSize: 13, cursor: "pointer", padding: 0,
              }}
            >
              <ChevronLeft size={15} /> Назад
            </button>
          ) : <span />}

          {step < TOTAL_STEPS - 1 ? (
            <button
              onClick={next}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "10px 24px", borderRadius: 8,
                backgroundColor: C.accent, color: C.bg,
                fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer",
              }}
            >
              Далее <ChevronRight size={15} />
            </button>
          ) : (
            <button
              onClick={finish}
              disabled={saving}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "10px 24px", borderRadius: 8,
                backgroundColor: saving ? C.border : C.accent,
                color: saving ? C.textSub : C.bg,
                fontWeight: 600, fontSize: 14, border: "none",
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Сохранение…" : "Завершить настройку"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ContentPlaceholder({ tab }) {
  const labels = {
    schedule:  "Расписание",
    services:  "Услуги и цены",
    dashboard: "Дашборд",
    journal:   "Журнал клиентов",
    settings:  "Настройки",
  };
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "60vh", gap: 12,
      color: C.textSub,
    }}>
      <span style={{ fontSize: 48 }}>🚧</span>
      <p style={{ margin: 0, fontSize: 16, color: C.textMain }}>{labels[tab]}</p>
      <p style={{ margin: 0, fontSize: 13 }}>Раздел будет реализован в следующих шагах.</p>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      zIndex: 200, display: "flex", alignItems: "center", gap: 8,
      backgroundColor: C.card, border: `1px solid ${C.accent}`,
      borderRadius: 8, padding: "10px 18px",
      boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
      animation: "slideUp 200ms ease-out",
    }}>
      <Check size={15} color={C.accent} />
      <span style={{ color: C.textMain, fontSize: 13 }}>{message}</span>
      <style>{`@keyframes slideUp { from { opacity:0; transform:translateX(-50%) translateY(10px) } to { opacity:1; transform:translateX(-50%) translateY(0) } }`}</style>
    </div>
  );
}

// ─── Settings Screen ──────────────────────────────────────────────────────────

// Generate half-hour time slots between startHour and endHour (inclusive)
const TIME_OPTIONS = (() => {
  const opts = [];
  for (let h = 7; h <= 23; h++) {
    for (let m = 0; m < 60; m += 30) {
      const label = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      opts.push({ value: label, label });
    }
  }
  return opts;
})();

const BUFFER_OPTIONS = [5, 10, 15, 20, 30, 45, 60].map(v => ({ value: v, label: `${v} мин` }));

function SalonSettingsCard({ salon, onChange }) {
  const roomCount = salon.rooms.length;

  const handleRoomCountChange = (newCount) => {
    const clamped = Math.max(1, Math.min(6, newCount));
    if (clamped === roomCount) return;
    let rooms;
    if (clamped > roomCount) {
      const extra = Array.from({ length: clamped - roomCount }, (_, i) => ({
        id: `${salon.id}-room-${roomCount + i + 1}-${makeId()}`,
        name: `Кабинка ${roomCount + i + 1}`,
        beds: 2,
      }));
      rooms = [...salon.rooms, ...extra];
    } else {
      rooms = salon.rooms.slice(0, clamped);
    }
    onChange({ rooms });
  };

  const updateRoom = (idx, patch) => {
    const rooms = salon.rooms.map((r, i) => i === idx ? { ...r, ...patch } : r);
    onChange({ rooms });
  };

  return (
    <div style={{
      backgroundColor: C.card, borderRadius: 12, padding: 24,
      border: `1px solid ${C.border}`,
    }}>
      <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 600, color: C.textMain }}>
        {salon.name || `Салон ${salon.id.replace("salon-", "")}`}
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Название */}
        <Row label="Название">
          <InlineText value={salon.name} onChange={v => onChange({ name: v })} />
        </Row>

        {/* Кол-во кабинок */}
        <Row label="Кабинок">
          <InlineNumber value={roomCount} min={1} max={6} onChange={handleRoomCountChange} />
        </Row>

        {/* Список кабинок */}
        <div style={{ paddingLeft: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {salon.rooms.map((room, idx) => (
            <div key={room.id} style={{
              display: "flex", alignItems: "center", gap: 12,
              backgroundColor: C.gridBg, borderRadius: 8, padding: "8px 12px",
              border: `1px solid ${C.border}`,
            }}>
              <span style={{ color: C.textSub, fontSize: 12, minWidth: 16 }}>•</span>
              <InlineText
                value={room.name}
                onChange={v => updateRoom(idx, { name: v })}
                style={{ flex: 1, fontSize: 13 }}
              />
              <span style={{ color: C.textSub, fontSize: 12 }}>—</span>
              <div style={{ display: "flex", gap: 4 }}>
                {[1, 2].map(b => (
                  <button
                    key={b}
                    onClick={() => updateRoom(idx, { beds: b })}
                    style={{
                      padding: "3px 10px", borderRadius: 5, fontSize: 12,
                      border: `1px solid ${room.beds === b ? C.accent : C.border}`,
                      backgroundColor: room.beds === b ? C.accent : "transparent",
                      color: room.beds === b ? C.bg : C.textSub,
                      cursor: "pointer",
                    }}
                  >
                    {b} кр.
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Массажистки */}
        <Row label="Массажистки">
          <InlineNumber value={salon.therapistCount} min={1} max={15} onChange={v => onChange({ therapistCount: v })} />
        </Row>

        {/* Сауна */}
        <Row label="Вместимость сауны">
          <InlineNumber value={salon.saunaCapacity || 4} min={1} max={20} onChange={v => onChange({ saunaCapacity: v })} />
        </Row>

        {/* Мастера по пиллингу */}
        <Row label="Мастера пиллинга">
          <InlineNumber value={salon.peelingMastersMax || 2} min={1} max={10} onChange={v => onChange({ peelingMastersMax: v })} />
        </Row>

        {/* Рабочие часы */}
        <Row label="Часы работы">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <InlineSelect
              value={salon.workStart}
              options={TIME_OPTIONS}
              onChange={v => onChange({ workStart: v })}
            />
            <span style={{ color: C.textSub }}>—</span>
            <InlineSelect
              value={salon.workEnd}
              options={TIME_OPTIONS.filter(o => o.value > salon.workStart)}
              onChange={v => onChange({ workEnd: v })}
            />
          </div>
        </Row>

        {/* Выходной */}
        <Row label="Выходной день">
          <InlineSelect
            value={salon.dayOff}
            options={DAYS_OF_WEEK}
            onChange={v => onChange({ dayOff: v })}
          />
        </Row>

        {/* Буфер */}
        <Row label="Буфер">
          <InlineSelect
            value={salon.bufferMinutes}
            options={BUFFER_OPTIONS}
            onChange={v => onChange({ bufferMinutes: Number(v) })}
          />
        </Row>
      </div>
    </div>
  );
}

// Small layout helpers for settings rows
function Row({ label, children }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
      <span style={{ color: C.textSub, fontSize: 13, minWidth: 120, paddingTop: 10 }}>{label}</span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function InlineText({ value, onChange, style: extraStyle }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type="text" value={value}
      onChange={e => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{ ...inputStyle(focused), ...extraStyle }}
    />
  );
}

function InlineNumber({ value, min, max, onChange }) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(null);
  const displayValue = draft !== null ? draft : value;
  return (
    <input
      type="number" value={displayValue} min={min} max={max}
      onChange={e => {
        const raw = e.target.value;
        setDraft(raw);
        const v = parseInt(raw, 10);
        if (!isNaN(v) && v >= min && v <= max) onChange(v);
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); setDraft(null); }}
      style={{ ...inputStyle(focused), width: 80 }}
    />
  );
}

function InlineSelect({ value, options, onChange }) {
  const [focused, setFocused] = useState(false);
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{ ...inputStyle(focused), width: "auto", minWidth: 120, cursor: "pointer" }}
    >
      {options.map(o => (
        <option key={o.value} value={o.value} style={{ backgroundColor: C.card }}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function PasswordChangeBlock({ currentUser, onShowToast }) {
  const [curPwd, setCurPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [newPwd2, setNewPwd2] = useState("");
  const [saving, setSaving] = useState(false);

  const inputStyle = {
    width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 14,
    border: `1px solid ${C.border}`, backgroundColor: C.gridBg,
    color: C.textMain, outline: "none",
  };

  const handleChange = async () => {
    if (!curPwd || !newPwd || !newPwd2) { onShowToast("Заполните все поля"); return; }
    if (newPwd !== newPwd2) { onShowToast("Пароли не совпадают"); return; }
    if (newPwd.length < 6) { onShowToast("Минимум 6 символов"); return; }
    setSaving(true);
    // Re-authenticate with current password first to verify it
    const check = await sb.auth.signInWithPassword({
      email: currentUser.login + "@example.com",
      password: curPwd,
    });
    if (check.error) {
      onShowToast("Неверный текущий пароль");
      setSaving(false);
      return;
    }
    const result = await UserStorage.updatePassword(currentUser.id, newPwd);
    if (result.error) {
      onShowToast("Ошибка: " + result.error);
      setSaving(false);
      return;
    }
    setCurPwd(""); setNewPwd(""); setNewPwd2("");
    setSaving(false);
    onShowToast("Пароль изменён");
  };

  return (
    <div style={{ backgroundColor: C.card, borderRadius: 12, padding: 24, border: `1px solid ${C.border}` }}>
      <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600, color: C.textMain }}>Безопасность</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ display: "block", fontSize: 12, color: C.textSub, marginBottom: 4 }}>Текущий пароль</label>
          <input type="password" value={curPwd} onChange={e => setCurPwd(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, color: C.textSub, marginBottom: 4 }}>Новый пароль</label>
          <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, color: C.textSub, marginBottom: 4 }}>Повтор нового пароля</label>
          <input type="password" value={newPwd2} onChange={e => setNewPwd2(e.target.value)} style={inputStyle} />
        </div>
      </div>
      <button onClick={handleChange} disabled={saving} style={{
        padding: "8px 20px", borderRadius: 8, border: "none",
        backgroundColor: C.accent, color: C.bg, fontSize: 13, fontWeight: 600,
        cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1,
      }}>{saving ? "Сохранение…" : "Сменить пароль"}</button>
    </div>
  );
}

function SettingsScreen({ salons, onSalonsChange, onShowToast, onReset, onImportComplete, currentUser }) {
  const isFirstRender = useRef(true);
  const fileInputRef = useRef(null);
  const [confirmModal, setConfirmModal] = useState(null); // { type, message, onConfirm }
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [resetStep, setResetStep] = useState(0); // 0=none, 1=first confirm, 2=second confirm

  // Debounced auto-save
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    const timer = setTimeout(async () => {
      // Validate before saving
      for (const s of salons) {
        if (!s.name.trim()) return;
        if (s.rooms.length < 1 || s.rooms.length > 6) return;
        if (s.therapistCount < 1 || s.therapistCount > 15) return;
        if (s.bufferMinutes < 5 || s.bufferMinutes > 60) return;
        if (s.workStart >= s.workEnd) return;
      }
      await Storage.set(KEYS.salons, salons);
      onShowToast("Сохранено");
    }, 500);
    return () => clearTimeout(timer);
  }, [salons, onShowToast]);

  const updateSalon = (salonId, patch) => {
    onSalonsChange(salons.map(s => s.id === salonId ? { ...s, ...patch } : s));
  };

  // ── Export ──
  const handleExport = async () => {
    setExporting(true);
    try {
      const salonsData = await Storage.get(KEYS.salons);
      const procedures = {};
      const combos = {};
      for (const s of (salonsData || [])) {
        procedures[s.id] = await Storage.get(KEYS.procedures(s.id)) || [];
        combos[s.id] = await Storage.get(KEYS.combos(s.id)) || [];
      }
      const bookingKeys = await Storage.list("spa-crm:bookings:");
      const bookingsData = {};
      for (const key of bookingKeys) {
        const suffix = key.replace("spa-crm:bookings:", "");
        const val = await Storage.get(key);
        if (val) bookingsData[suffix] = val;
      }
      const exportObj = {
        version: "v4",
        exportDate: new Date().toISOString(),
        salons: salonsData,
        procedures,
        combos,
        bookings: bookingsData,
      };
      const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const today = new Date().toISOString().slice(0, 10);
      a.download = `spa-crm-backup-${today}.json`;
      a.click();
      URL.revokeObjectURL(url);
      onShowToast("Данные экспортированы");
    } catch (e) {
      onShowToast("Ошибка экспорта");
    } finally {
      setExporting(false);
    }
  };

  // ── Import ──
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      // Validate structure
      if (!data.salons || !data.procedures || !data.combos) {
        onShowToast("Невалидный файл: отсутствуют обязательные данные");
        setImporting(false);
        return;
      }
      if (!data.version) {
        onShowToast("Невалидный файл: отсутствует версия");
        setImporting(false);
        return;
      }
      // Show confirmation
      setConfirmModal({
        title: "Импорт данных",
        message: "Импорт перезапишет ВСЕ текущие данные. Продолжить?",
        confirmLabel: "Да, импортировать",
        onConfirm: async () => {
          setConfirmModal(null);
          try {
            // Delete all existing keys
            const existingKeys = await Storage.list("spa-crm:");
            for (const key of existingKeys) {
              await Storage.delete(key);
            }
            // Write salons
            await Storage.set(KEYS.salons, data.salons);
            // Write procedures
            for (const [salonId, procs] of Object.entries(data.procedures || {})) {
              await Storage.set(KEYS.procedures(salonId), procs);
            }
            // Write combos
            for (const [salonId, cmbs] of Object.entries(data.combos || {})) {
              await Storage.set(KEYS.combos(salonId), cmbs);
            }
            // Write bookings
            for (const [suffix, bkgs] of Object.entries(data.bookings || {})) {
              await Storage.set(`spa-crm:bookings:${suffix}`, bkgs);
            }
            onShowToast("Данные импортированы");
            onImportComplete(data.salons);
          } catch {
            onShowToast("Ошибка при записи данных");
          }
          setImporting(false);
        },
        onCancel: () => { setConfirmModal(null); setImporting(false); },
      });
    } catch {
      onShowToast("Ошибка чтения файла");
      setImporting(false);
    }
  };

  // ── Reset ──
  const handleReset = () => {
    if (resetStep === 0) {
      setConfirmModal({
        title: "Сброс данных",
        message: "Вы уверены? Это удалит ВСЕ данные.",
        confirmLabel: "Да",
        confirmDanger: true,
        onConfirm: () => { setConfirmModal(null); setResetStep(1); },
        onCancel: () => { setConfirmModal(null); setResetStep(0); },
      });
    }
  };

  const onResetRef = useRef(onReset);
  onResetRef.current = onReset;

  useEffect(() => {
    if (resetStep === 1) {
      setConfirmModal({
        title: "Последнее предупреждение",
        message: "Это действие необратимо. Последний шанс.",
        confirmLabel: "Удалить всё",
        confirmDanger: true,
        onConfirm: async () => {
          setConfirmModal(null);
          setResetStep(0);
          const allKeys = await Storage.list("spa-crm:");
          for (const key of allKeys) {
            await Storage.delete(key);
          }
          onShowToast("Все данные удалены");
          onResetRef.current();
        },
        onCancel: () => { setConfirmModal(null); setResetStep(0); },
      });
    }
  }, [resetStep, onShowToast]);

  const btnBase = {
    padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600,
    cursor: "pointer", border: "none", display: "inline-flex", alignItems: "center", gap: 8,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 720 }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: C.textMain }}>Настройки салонов</h2>

      {salons.map(salon => (
        <SalonSettingsCard
          key={salon.id}
          salon={salon}
          onChange={patch => updateSalon(salon.id, patch)}
        />
      ))}

      {/* Password change */}
      {currentUser && (
        <PasswordChangeBlock currentUser={currentUser} onShowToast={onShowToast} />
      )}

      {/* Data management — STEP-12 */}
      <div style={{
        backgroundColor: C.card, borderRadius: 12, padding: 24,
        border: `1px solid ${C.border}`,
      }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600, color: C.textMain }}>Данные</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          {/* Export */}
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{
              ...btnBase,
              backgroundColor: "transparent",
              border: `1px solid ${C.gold}`,
              color: C.gold,
              opacity: exporting ? 0.5 : 1,
            }}
          >
            📥 {exporting ? "Экспорт..." : "Экспорт JSON"}
          </button>
          {/* Import */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            style={{
              ...btnBase,
              backgroundColor: "transparent",
              border: `1px solid ${C.border}`,
              color: C.textMain,
              opacity: importing ? 0.5 : 1,
            }}
          >
            📤 {importing ? "Импорт..." : "Импорт JSON"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          {/* Reset — visually separated */}
          <button
            onClick={handleReset}
            style={{
              ...btnBase,
              backgroundColor: "transparent",
              border: "1px solid #F87171",
              color: "#F87171",
              marginLeft: "auto",
            }}
          >
            🗑 Сброс
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal && (
        <div style={{
          position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400,
        }} onClick={() => confirmModal.onCancel()}>
          <div style={{
            backgroundColor: C.card, borderRadius: 12, padding: 24,
            width: 400, maxWidth: "90vw",
            border: `1px solid ${C.border}`,
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 600, color: C.textMain }}>
              {confirmModal.title}
            </h3>
            <p style={{ margin: "0 0 24px", color: C.textSub, fontSize: 14, lineHeight: 1.5 }}>
              {confirmModal.message}
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={confirmModal.onCancel}
                style={{
                  ...btnBase, backgroundColor: "transparent",
                  border: `1px solid ${C.border}`, color: C.textSub,
                }}
              >Отмена</button>
              <button
                onClick={confirmModal.onConfirm}
                style={{
                  ...btnBase,
                  backgroundColor: confirmModal.confirmDanger ? "#F87171" : C.gold,
                  color: confirmModal.confirmDanger ? "#fff" : "#1A1A2E",
                }}
              >{confirmModal.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Services Screen (STEP-04) ────────────────────────────────────────────────

const CATEGORY_ICONS  = { massage: "💆", sauna: "🧖", peeling: "🧖" };
const CATEGORY_LABEL  = { massage: "Массаж", sauna: "Сауна и пиллинг", peeling: "Сауна и пиллинг" };
const CATEGORY_OPTIONS = [
  { value: "massage", label: "💆 Массаж"  },
  { value: "sauna",   label: "🧖 Сауна и пиллинг" },
];

function SubTabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
      {tabs.map(t => {
        const isActive = t.id === active;
        return (
          <button key={t.id} onClick={() => onChange(t.id)} style={{
            padding: "5px 14px", borderRadius: 6, fontSize: 13,
            border: `1px solid ${C.accent}`,
            backgroundColor: isActive ? C.accent : "transparent",
            color: isActive ? C.bg : C.accent,
            cursor: "pointer", fontWeight: isActive ? 600 : 400,
            transition: "all 150ms",
          }}>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

const EMPTY_PROC = { name: "", category: "massage", duration: 60, therapistsRequired: 1, price: 5000 };

// Renders as a <tr> — must be placed inside <tbody>
function ProcedureFormRow({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || EMPTY_PROC);
  const [err, setErr] = useState("");
  const patch = (p) => setForm(f => ({ ...f, ...p }));

  const handleSave = () => {
    if (!form.name.trim())  { setErr("Введите название"); return; }
    if (form.duration <= 0) { setErr("Укажите длительность"); return; }
    setErr("");
    onSave(form);
  };

  const inCell = { padding: "12px 8px", verticalAlign: "bottom" };

  return (
    <>
      <tr style={{ backgroundColor: "#1D2A3A" }}>
        <td style={inCell}>
          <label style={labelStyle}>Название</label>
          <input type="text" value={form.name} placeholder="Тайский массаж 1ч"
            onChange={e => patch({ name: e.target.value })}
            style={{ ...inputStyle(), height: 36 }} />
        </td>
        <td style={inCell}>
          <label style={labelStyle}>Категория</label>
          <select value={form.category} onChange={e => patch({ category: e.target.value })}
            style={{ ...inputStyle(), height: 36, cursor: "pointer" }}>
            {CATEGORY_OPTIONS.map(o => (
              <option key={o.value} value={o.value} style={{ backgroundColor: C.card }}>{o.label}</option>
            ))}
          </select>
        </td>
        <td style={inCell}>
          <label style={labelStyle}>Длит. (мин)</label>
          <input type="number" value={form.duration} min={5} max={480}
            onChange={e => patch({ duration: parseInt(e.target.value, 10) || 0 })}
            style={{ ...inputStyle(), height: 36 }} />
        </td>
        <td style={inCell}>
          <label style={labelStyle}>Мастеров</label>
          <input type="number" value={form.therapistsRequired} min={0} max={4}
            onChange={e => patch({ therapistsRequired: parseInt(e.target.value, 10) || 0 })}
            style={{ ...inputStyle(), height: 36 }} />
        </td>
        <td style={inCell}>
          <label style={labelStyle}>Цена (₸)</label>
          <input type="number" value={form.price} min={0}
            onChange={e => patch({ price: parseInt(e.target.value, 10) || 0 })}
            style={{ ...inputStyle(), height: 36 }} />
        </td>
        <td style={{ ...inCell, verticalAlign: "bottom" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 18 }}>
            <button onClick={handleSave} style={{
              padding: "6px 12px", borderRadius: 6, border: "none",
              backgroundColor: C.accent, color: C.bg,
              fontWeight: 600, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap",
            }}>Сохранить</button>
            <button onClick={onCancel} style={{
              padding: "6px 12px", borderRadius: 6,
              border: `1px solid ${C.border}`, backgroundColor: "transparent",
              color: C.textSub, fontSize: 12, cursor: "pointer",
            }}>Отмена</button>
          </div>
        </td>
      </tr>
      {err && (
        <tr style={{ backgroundColor: "#1D2A3A" }}>
          <td colSpan={6} style={{ padding: "0 12px 10px", color: "#F87171", fontSize: 12 }}>{err}</td>
        </tr>
      )}
    </>
  );
}

function ProceduresTab({ procedures, activeSalonId, onProceduresChange, onShowToast }) {
  const [editing, setEditing] = useState(null); // null | "new" | proc.id

  const persist = async (updated) => {
    await Storage.set(KEYS.procedures(activeSalonId), updated);
    onProceduresChange(updated);
  };

  const handleAdd = async (form) => {
    await persist([...procedures, { id: makeId(), salonId: activeSalonId, ...form, isActive: true }]);
    setEditing(null);
    onShowToast("Процедура добавлена");
  };

  const handleEdit = async (id, form) => {
    await persist(procedures.map(p => p.id === id ? { ...p, ...form } : p));
    setEditing(null);
    onShowToast("Сохранено");
  };

  const handleToggle = (id) => {
    persist(procedures.map(p => p.id === id ? { ...p, isActive: !p.isActive } : p));
  };

  const thStyle = {
    padding: "10px 14px", textAlign: "left",
    color: C.textSub, fontSize: 11, fontWeight: 600,
    textTransform: "uppercase", letterSpacing: "0.5px",
    borderBottom: `1px solid ${C.border}`,
    backgroundColor: C.card,
  };

  return (
    <div>
      {/* Add button */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button
          onClick={() => setEditing(editing === "new" ? null : "new")}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 8,
            border: `1px solid ${C.accent}`, backgroundColor: "transparent",
            color: C.accent, fontSize: 13, cursor: "pointer",
          }}
        >
          <Plus size={14} /> Добавить процедуру
        </button>
      </div>

      {/* Table */}
      <div style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Название</th>
              <th style={{ ...thStyle, width: 110 }}>Категория</th>
              <th style={{ ...thStyle, width: 100 }}>Длит.</th>
              <th style={{ ...thStyle, width: 90 }}>Мастеров</th>
              <th style={{ ...thStyle, width: 120 }}>Цена</th>
              <th style={{ ...thStyle, width: 80, textAlign: "center" }}>Активна</th>
            </tr>
          </thead>
          <tbody>
            {editing === "new" && (
              <ProcedureFormRow onSave={handleAdd} onCancel={() => setEditing(null)} />
            )}
            {procedures.map((proc, idx) => {
              const rowBg = idx % 2 === 0 ? C.card : C.gridBg;
              const td = (center = false) => ({
                padding: "10px 14px",
                color: proc.isActive ? C.textMain : C.textSub,
                fontSize: 13, verticalAlign: "middle",
                borderBottom: `1px solid ${C.border}`,
                textAlign: center ? "center" : "left",
              });
              if (editing === proc.id) {
                return (
                  <ProcedureFormRow
                    key={proc.id}
                    initial={{ name: proc.name, category: proc.category, duration: proc.duration, therapistsRequired: proc.therapistsRequired, price: proc.price }}
                    onSave={(form) => handleEdit(proc.id, form)}
                    onCancel={() => setEditing(null)}
                  />
                );
              }
              return (
                <tr
                  key={proc.id}
                  onClick={() => setEditing(proc.id)}
                  style={{ backgroundColor: rowBg, cursor: "pointer", transition: "background 100ms", opacity: proc.isActive ? 1 : 0.6 }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = "#1D2A3A"}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = rowBg}
                >
                  <td style={td()}>{proc.name}</td>
                  <td style={td()}>
                    <span title={CATEGORY_LABEL[proc.category]}>{CATEGORY_ICONS[proc.category]} {CATEGORY_LABEL[proc.category]}</span>
                  </td>
                  <td style={td()}>{proc.duration} мин</td>
                  <td style={td()}>{proc.therapistsRequired}</td>
                  <td style={td()}>{proc.price.toLocaleString("ru-RU")} ₸</td>
                  <td style={td(true)} onClick={e => { e.stopPropagation(); handleToggle(proc.id); }}>
                    <Toggle checked={proc.isActive} onChange={() => handleToggle(proc.id)} />
                  </td>
                </tr>
              );
            })}
            {procedures.length === 0 && editing !== "new" && (
              <tr>
                <td colSpan={6} style={{ padding: 24, textAlign: "center", color: C.textSub, fontSize: 13 }}>
                  Нет процедур. Нажмите «Добавить процедуру».
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SaunaPeelingTab({ salon, onSalonChange, onShowToast }) {
  const toastTimer = useRef(null);
  const debouncedToast = useCallback(() => {
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => onShowToast("Сохранено"), 600);
  }, [onShowToast]);

  const handleChange = (patch) => {
    onSalonChange(patch);
    debouncedToast();
  };

  const maxPeeling = salon.hasSauna && salon.hasPeeling
    ? Math.floor(salon.saunaDuration / salon.peelingTimePerPerson) * salon.peelingMastersMax
    : 0;

  return (
    <div style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Сауна */}
      <div style={{ backgroundColor: C.card, borderRadius: 12, padding: 24, border: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: salon.hasSauna ? 20 : 0 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: C.textMain }}>Сауна</h3>
          <Toggle checked={salon.hasSauna} onChange={v => handleChange({ hasSauna: v })} />
        </div>
        {salon.hasSauna && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={labelStyle}>Вместимость (чел.)</label>
              <input type="number" value={salon.saunaCapacity} min={1} max={20}
                onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 1 && v <= 20) handleChange({ saunaCapacity: v }); }}
                style={inputStyle()} />
            </div>
            <div>
              <label style={labelStyle}>Длительность сеанса (мин)</label>
              <input type="number" value={salon.saunaDuration} min={30} max={180}
                onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 30 && v <= 180) handleChange({ saunaDuration: v }); }}
                style={inputStyle()} />
            </div>
          </div>
        )}
      </div>

      {/* Пиллинг */}
      <div style={{
        backgroundColor: C.card, borderRadius: 12, padding: 24,
        border: `1px solid ${C.border}`,
        opacity: salon.hasSauna ? 1 : 0.5,
        pointerEvents: salon.hasSauna ? "auto" : "none",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: salon.hasPeeling && salon.hasSauna ? 20 : 0 }}>
          <div>
            <h3 style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 600, color: C.textMain }}>Пиллинг</h3>
            {!salon.hasSauna && (
              <p style={{ margin: 0, color: C.textSub, fontSize: 12 }}>Требуется включённая сауна</p>
            )}
          </div>
          <Toggle checked={salon.hasPeeling} onChange={v => handleChange({ hasPeeling: v })} />
        </div>
        {salon.hasSauna && salon.hasPeeling && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Макс. мастеров одновременно</label>
                <input type="number" value={salon.peelingMastersMax} min={1} max={10}
                  onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 1 && v <= 10) handleChange({ peelingMastersMax: v }); }}
                  style={inputStyle()} />
              </div>
              <div>
                <label style={labelStyle}>Время на 1 человека (мин)</label>
                <input type="number" value={salon.peelingTimePerPerson} min={10} max={60}
                  onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 10 && v <= 60) handleChange({ peelingTimePerPerson: v }); }}
                  style={inputStyle()} />
              </div>
            </div>
            <div style={{
              backgroundColor: C.gridBg, borderRadius: 8, padding: "10px 14px",
              border: `1px solid ${C.border}`, color: C.textSub, fontSize: 12,
            }}>
              💡 Макс. людей за сеанс: ({salon.saunaDuration} ÷ {salon.peelingTimePerPerson}) × {salon.peelingMastersMax} мастера
              = <strong style={{ color: C.accent }}>{maxPeeling} чел.</strong>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Combos Tab (STEP-05) ─────────────────────────────────────────────────────

function ComboModal({ combo, procedures, onSave, onClose }) {
  const activeProcedures = procedures.filter(p => p.isActive);

  const [name, setName] = useState(combo?.name || "");
  const [steps, setSteps] = useState(combo?.steps ? combo.steps.map(s => ({ ...s })) : []);
  const [price, setPrice] = useState(combo?.price || 0);
  const [priceManual, setPriceManual] = useState(!!combo);
  const [err, setErr] = useState("");

  const totalDuration = steps.reduce((s, step) => s + step.duration, 0);
  const autoPrice = steps.reduce((s, step) => s + step.price, 0);

  useEffect(() => {
    if (!priceManual) setPrice(autoPrice);
  }, [autoPrice, priceManual]);

  const addStep = (procId) => {
    const proc = activeProcedures.find(p => p.id === procId);
    if (!proc) return;
    const newStep = { procId: proc.id, name: proc.name, duration: proc.duration, price: proc.price, category: proc.category };

    if (proc.category === "peeling") {
      const hasSauna = steps.some(s => s.category === "sauna");
      if (!hasSauna) { setErr("Пиллинг можно добавить только если сауна уже есть в комбо"); return; }
    }

    let newSteps = [...steps, newStep];

    if (proc.category === "sauna") {
      newSteps = [newStep, ...steps];
    } else if (proc.category === "peeling") {
      newSteps = steps.filter(s => s.category !== "peeling");
      const saunaIdx = newSteps.findIndex(s => s.category === "sauna");
      newSteps.splice(saunaIdx + 1, 0, newStep);
    }

    setErr("");
    setSteps(newSteps);
  };

  const removeStep = (idx) => {
    const removing = steps[idx];
    let newSteps = steps.filter((_, i) => i !== idx);
    if (removing.category === "sauna") {
      newSteps = newSteps.filter(s => s.category !== "peeling");
    }
    setSteps(newSteps);
  };

  const moveUp = (idx) => {
    if (idx === 0) return;
    const s = [...steps];
    [s[idx - 1], s[idx]] = [s[idx], s[idx - 1]];
    setSteps(s);
  };

  const moveDown = (idx) => {
    if (idx === steps.length - 1) return;
    const s = [...steps];
    [s[idx], s[idx + 1]] = [s[idx + 1], s[idx]];
    setSteps(s);
  };

  const handleSave = () => {
    if (!name.trim()) { setErr("Введите название"); return; }
    if (steps.length < 2) { setErr("Минимум 2 шага в комбо"); return; }
    setErr("");
    onSave({ name: name.trim(), steps, totalDuration, price });
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      backgroundColor: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>
      <div style={{
        width: "100%", maxWidth: 520,
        backgroundColor: C.card, borderRadius: 12, padding: 28,
        maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: C.textMain }}>
            {combo ? "Редактировать комбо" : "Новый комбо-пакет"}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textSub, padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Name */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Название</label>
          <input type="text" value={name} placeholder="Тайский релакс"
            onChange={e => setName(e.target.value)} style={inputStyle()} />
        </div>

        {/* Steps list */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Шаги ({steps.length})</label>
          {steps.length === 0 && (
            <div style={{
              padding: 20, textAlign: "center", color: C.textSub, fontSize: 13,
              border: `1px dashed ${C.border}`, borderRadius: 8,
            }}>
              Добавьте процедуры ниже
            </div>
          )}
          {steps.map((step, idx) => (
            <div key={idx}>
              {idx > 0 && (
                <div style={{ textAlign: "center", color: C.textSub, fontSize: 16, lineHeight: "18px", margin: "2px 0" }}>→</div>
              )}
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                backgroundColor: C.gridBg, borderRadius: 8, padding: "10px 12px",
                border: `1px solid ${C.border}`,
              }}>
                <div style={{ flex: 1 }}>
                  <span style={{ color: C.textMain, fontSize: 13 }}>{CATEGORY_ICONS[step.category]} {step.name}</span>
                  <span style={{ color: C.textSub, fontSize: 12, marginLeft: 8 }}>{step.duration} мин</span>
                </div>
                <button onClick={() => moveUp(idx)} disabled={idx === 0} style={{
                  background: "none", border: "none", padding: 2,
                  cursor: idx === 0 ? "default" : "pointer",
                  color: idx === 0 ? C.border : C.textSub,
                }}>
                  <ChevronUp size={14} />
                </button>
                <button onClick={() => moveDown(idx)} disabled={idx === steps.length - 1} style={{
                  background: "none", border: "none", padding: 2,
                  cursor: idx === steps.length - 1 ? "default" : "pointer",
                  color: idx === steps.length - 1 ? C.border : C.textSub,
                }}>
                  <ChevronDown size={14} />
                </button>
                <button onClick={() => removeStep(idx)} style={{
                  background: "none", border: "none", padding: 2, cursor: "pointer", color: "#EF4444",
                }}>
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add step dropdown */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Добавить шаг</label>
          <select defaultValue="" onChange={e => { if (e.target.value) { addStep(e.target.value); e.target.value = ""; } }}
            style={{ ...inputStyle(), cursor: "pointer" }}>
            <option value="" style={{ backgroundColor: C.card }}>— выберите процедуру —</option>
            {activeProcedures.map(p => (
              <option key={p.id} value={p.id} style={{ backgroundColor: C.card }}>
                {CATEGORY_ICONS[p.category]} {p.name} ({p.duration} мин)
              </option>
            ))}
          </select>
        </div>

        {/* Total time + Price */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Общее время</label>
            <div style={{ ...inputStyle(), display: "flex", alignItems: "center", color: C.textSub }}>
              {totalDuration} мин
            </div>
          </div>
          <div>
            <label style={labelStyle}>Цена (₸)</label>
            <input type="number" value={price} min={0}
              onChange={e => { setPriceManual(true); setPrice(parseInt(e.target.value, 10) || 0); }}
              style={inputStyle()} />
          </div>
        </div>

        {priceManual && autoPrice > 0 && price !== autoPrice && (
          <div style={{ marginBottom: 16, color: C.textSub, fontSize: 12 }}>
            💡 Сумма процедур: {autoPrice.toLocaleString("ru-RU")} ₸
            <button onClick={() => { setPriceManual(false); setPrice(autoPrice); }} style={{
              marginLeft: 8, background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 12,
            }}>Сбросить</button>
          </div>
        )}

        {/* Error */}
        {err && (
          <div style={{
            padding: "8px 12px", borderRadius: 6, marginBottom: 16,
            backgroundColor: "#EF444422", border: "1px solid #EF4444", color: "#F87171", fontSize: 12,
          }}>
            {err}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "8px 20px", borderRadius: 8,
            border: `1px solid ${C.border}`, backgroundColor: "transparent",
            color: C.textSub, fontSize: 13, cursor: "pointer",
          }}>Отмена</button>
          <button onClick={handleSave} style={{
            padding: "8px 20px", borderRadius: 8,
            border: "none", backgroundColor: C.accent,
            color: C.bg, fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>Сохранить</button>
        </div>
      </div>
    </div>
  );
}

function CombosTab({ combos, activeSalonId, onCombosChange, procedures, onShowToast }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCombo, setEditingCombo] = useState(null);

  const persist = async (updated) => {
    await Storage.set(KEYS.combos(activeSalonId), updated);
    onCombosChange(updated);
  };

  const handleSave = async (form) => {
    if (editingCombo) {
      await persist(combos.map(c => c.id === editingCombo.id ? { ...editingCombo, ...form } : c));
      onShowToast("Сохранено");
    } else {
      await persist([...combos, { id: makeId(), salonId: activeSalonId, ...form, isActive: true }]);
      onShowToast("Комбо добавлено");
    }
    setModalOpen(false);
    setEditingCombo(null);
  };

  const handleToggle = (id) => {
    persist(combos.map(c => c.id === id ? { ...c, isActive: !c.isActive } : c));
  };

  const thStyle = {
    padding: "10px 14px", textAlign: "left",
    color: C.textSub, fontSize: 11, fontWeight: 600,
    textTransform: "uppercase", letterSpacing: "0.5px",
    borderBottom: `1px solid ${C.border}`,
    backgroundColor: C.card,
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button onClick={() => { setEditingCombo(null); setModalOpen(true); }} style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "8px 16px", borderRadius: 8,
          border: `1px solid ${C.accent}`, backgroundColor: "transparent",
          color: C.accent, fontSize: 13, cursor: "pointer",
        }}>
          <Plus size={14} /> Создать комбо
        </button>
      </div>

      <div style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Название</th>
              <th style={thStyle}>Состав</th>
              <th style={{ ...thStyle, width: 110 }}>Общее время</th>
              <th style={{ ...thStyle, width: 120 }}>Цена</th>
              <th style={{ ...thStyle, width: 80, textAlign: "center" }}>Активен</th>
            </tr>
          </thead>
          <tbody>
            {combos.map((combo, idx) => {
              const rowBg = idx % 2 === 0 ? C.card : C.gridBg;
              const td = (center = false) => ({
                padding: "10px 14px",
                color: combo.isActive ? C.textMain : C.textSub,
                fontSize: 13, verticalAlign: "middle",
                borderBottom: `1px solid ${C.border}`,
                textAlign: center ? "center" : "left",
              });
              return (
                <tr key={combo.id}
                  onClick={() => { setEditingCombo(combo); setModalOpen(true); }}
                  style={{ backgroundColor: rowBg, cursor: "pointer", transition: "background 100ms", opacity: combo.isActive ? 1 : 0.6 }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = "#1D2A3A"}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = rowBg}
                >
                  <td style={td()}>{combo.name}</td>
                  <td style={{ ...td(), fontSize: 12, color: C.textSub }}>
                    {combo.steps.map(s => s.name).join(" → ")}
                  </td>
                  <td style={td()}>{combo.totalDuration} мин</td>
                  <td style={td()}>{combo.price.toLocaleString("ru-RU")} ₸</td>
                  <td style={td(true)} onClick={e => { e.stopPropagation(); handleToggle(combo.id); }}>
                    <Toggle checked={combo.isActive} onChange={() => handleToggle(combo.id)} />
                  </td>
                </tr>
              );
            })}
            {combos.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 24, textAlign: "center", color: C.textSub, fontSize: 13 }}>
                  Нет комбо-пакетов. Нажмите «Создать комбо».
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <ComboModal
          combo={editingCombo}
          procedures={procedures}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditingCombo(null); }}
        />
      )}
    </div>
  );
}

function ServicesScreen({ procedures, onProceduresChange, combos, onCombosChange, activeSalonId, salons, onSalonsChange, onShowToast }) {
  const SERVICE_TABS = [
    { id: "procedures", label: "Процедуры"    },
    { id: "combos",     label: "Комбо-пакеты" },
    { id: "sauna",      label: "Сауна и пиллинг" },
  ];
  const [subTab, setSubTab] = useState("procedures");

  const activeSalon = salons.find(s => s.id === activeSalonId);

  const handleSalonPatch = async (patch) => {
    const updated = salons.map(s => s.id === activeSalonId ? { ...s, ...patch } : s);
    onSalonsChange(updated);
    await Storage.set(KEYS.salons, updated);
  };

  return (
    <div>
      <SubTabBar tabs={SERVICE_TABS} active={subTab} onChange={setSubTab} />

      {subTab === "procedures" && (
        <ProceduresTab
          procedures={procedures}
          activeSalonId={activeSalonId}
          onProceduresChange={onProceduresChange}
          onShowToast={onShowToast}
        />
      )}

      {subTab === "combos" && (
        <CombosTab
          combos={combos}
          activeSalonId={activeSalonId}
          onCombosChange={onCombosChange}
          procedures={procedures}
          onShowToast={onShowToast}
        />
      )}

      {subTab === "sauna" && activeSalon && (
        <SaunaPeelingTab
          salon={activeSalon}
          onSalonChange={handleSalonPatch}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
}

// ─── Booking Modal (STEP-07) ─────────────────────────────────────────────────

// ─── Booking Validation (STEP-08) ──────────────────────────────────────────

function validateBooking(booking, existingBookings, salon) {
  const errors = [];
  const others = existingBookings.filter(b => b.id !== booking.id && b.date === booking.date);

  // 1. Day off
  const d = parseLocal(booking.date);
  if (JS_DAY_KEY[d.getDay()] === salon.dayOff) {
    errors.push({ field: "date", message: `Выбран выходной день (${RU_WEEKDAY[d.getDay()]})` });
  }

  // 2. Work hours
  if (booking.totalStartTime < salon.workStart) {
    errors.push({ field: "time", message: `Начало (${booking.totalStartTime}) раньше рабочего дня (${salon.workStart})` });
  }
  if (booking.totalEndTime > salon.workEnd) {
    errors.push({ field: "time", message: `Запись выходит за рабочие часы (до ${salon.workEnd})` });
  }

  // 3. Room conflicts
  const roomConflictKeys = new Set();
  for (const seg of booking.segments) {
    if (seg.resourceType !== "room" || !seg.roomId) continue;
    for (const ob of others) {
      for (const os of ob.segments) {
        if (os.roomId === seg.roomId && os.startTime < seg.endTime && os.endTime > seg.startTime) {
          const key = `${seg.roomId}:${os.startTime}-${os.endTime}`;
          if (!roomConflictKeys.has(key)) {
            roomConflictKeys.add(key);
            const room = salon.rooms.find(r => r.id === seg.roomId);
            errors.push({ field: "room", message: `${room?.name || "Кабинка"} занята с ${os.startTime} до ${os.endTime}` });
          }
        }
      }
    }
  }

  // 4. Sauna conflicts
  for (const seg of booking.segments) {
    if (seg.resourceType !== "sauna") continue;
    for (const ob of others) {
      for (const os of ob.segments) {
        if (os.resourceType === "sauna" && os.startTime < seg.endTime && os.endTime > seg.startTime) {
          errors.push({ field: "sauna", message: `Сауна занята с ${os.startTime} до ${os.endTime}` });
          return { valid: false, errors };
        }
      }
    }
  }

  // 5. Sauna capacity
  if (booking.segments.some(s => s.resourceType === "sauna") && booking.clientCount > (salon.saunaCapacity || 4)) {
    errors.push({ field: "sauna", message: `Превышена вместимость сауны (макс. ${salon.saunaCapacity || 4} чел.)` });
  }

  // 6. Therapists — check each 15-min slot covered by new booking
  const therapistSegs = booking.segments.filter(s => s.therapistCount > 0);
  if (therapistSegs.length > 0) {
    let minM = Infinity, maxM = 0;
    for (const s of therapistSegs) {
      const sm = timeToMins(s.startTime);
      const em = timeToMins(s.endTime);
      if (sm < minM) minM = sm;
      if (em > maxM) maxM = em;
    }
    for (let m = minM; m < maxM; m += 15) {
      const slotS = minsToTime(m);
      const slotE = minsToTime(m + 15);
      // Load from new booking
      let newLoad = 0;
      for (const s of booking.segments) {
        if (s.startTime < slotE && s.endTime > slotS) newLoad += (s.therapistCount || 0);
      }
      if (newLoad === 0) continue;
      // Load from existing bookings
      let existingLoad = 0;
      for (const ob of others) {
        for (const os of ob.segments) {
          if (os.startTime < slotE && os.endTime > slotS) existingLoad += (os.therapistCount || 0);
        }
      }
      if (existingLoad + newLoad > salon.therapistCount) {
        const free = Math.max(0, salon.therapistCount - existingLoad);
        errors.push({ field: "therapists", message: `Недостаточно массажисток (нужно ${newLoad}, свободно ${free} в ${slotS})` });
        break;
      }
    }
  }

  // 7. Beds check — room capacity vs clients assigned
  if (booking.clientCount >= 2) {
    // Count clients per room from segments
    const roomClientMap = {};
    for (const seg of booking.segments) {
      if (seg.resourceType === "room" && seg.roomId) {
        roomClientMap[seg.roomId] = (roomClientMap[seg.roomId] || 0) + (seg.clientsInRoom || booking.clientCount);
      }
    }
    for (const [rid, count] of Object.entries(roomClientMap)) {
      const room = salon.rooms.find(r => r.id === rid);
      if (room && count > room.beds) {
        errors.push({ field: "room", message: `${room.name}: ${count} клиентов, но только ${room.beds} кровать(и)` });
        break;
      }
    }
    // Also check total bed capacity
    const totalBeds = salon.rooms.reduce((sum, r) => sum + r.beds, 0);
    if (booking.clientCount > totalBeds) {
      errors.push({ field: "room", message: `Всего ${totalBeds} кроватей — недостаточно для ${booking.clientCount} клиентов` });
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── Booking Modal (STEP-07) ───────────────────────────────────────────────

function BookingModal({ salon, procedures, combos, initialDate, initialTime, initialRoomId, onSave, onClose }) {
  const activeProcedures = procedures.filter(p => p.isActive);
  const bookableProcedures = activeProcedures.filter(p => p.category !== "peeling");
  const activeCombos = combos.filter(c => c.isActive);

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientCount, setClientCount] = useState(1);
  const [bookingType, setBookingType] = useState("single");
  const [procedureId, setProcedureId] = useState(bookableProcedures[0]?.id || "");
  const [comboId, setComboId] = useState(activeCombos[0]?.id || "");
  const [date, setDate] = useState(initialDate || toDateStr(new Date()));
  const [startTime, setStartTime] = useState(initialTime || "");
  const [roomId, setRoomId] = useState(initialRoomId || "");
  const [peelingCount, setPeelingCount] = useState(1);
  const [withPeeling, setWithPeeling] = useState(false);
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [existingBookings, setExistingBookings] = useState([]);

  const selectedProc = bookableProcedures.find(p => p.id === procedureId) || bookableProcedures[0];
  const selectedCombo = activeCombos.find(c => c.id === comboId) || activeCombos[0];

  const hasSaunaInSelection = bookingType === "single"
    ? selectedProc?.category === "sauna"
    : selectedCombo?.steps.some(s => s.category === "sauna");

  const hasPeelingInCombo = bookingType === "combo"
    && selectedCombo?.steps.some(s => s.category === "peeling");

  const totalBeds = salon.rooms.reduce((sum, r) => sum + r.beds, 0);
  const saunaOnly = bookingType === "single" && selectedProc?.category === "sauna";
  const maxClients = saunaOnly
    ? (salon.saunaCapacity || 4)
    : hasSaunaInSelection
      ? Math.min(salon.saunaCapacity || 4, totalBeds)
      : totalBeds;

  // Clamp clientCount if maxClients drops below current value (e.g. switching to sauna)
  useEffect(() => {
    if (clientCount > maxClients) setClientCount(maxClients);
  }, [maxClients]);

  // Reset peeling when not sauna
  useEffect(() => {
    if (bookingType !== "single" || selectedProc?.category !== "sauna") setWithPeeling(false);
  }, [bookingType, selectedProc]);

  // Load existing bookings for validation
  useEffect(() => {
    let cancelled = false;
    const ym = date.slice(0, 7);
    (async () => {
      const bkgs = await Storage.get(KEYS.bookings(salon.id, ym)) || [];
      if (!cancelled) setExistingBookings(bkgs);
    })();
    return () => { cancelled = true; };
  }, [date, salon.id]);

  // Effective duration — peeling is parallel to sauna, doesn't add time
  const effectiveDuration = (() => {
    if (bookingType === "single") return selectedProc?.duration || 0;
    if (!selectedCombo) return 0;
    return selectedCombo.steps
      .filter(s => s.category !== "peeling")
      .reduce((acc, s) => acc + s.duration, 0);
  })();

  const wStartM = timeToMins(salon.workStart);
  const wEndM   = timeToMins(salon.workEnd);

  // 15-min time slots
  const timeSlots = (() => {
    const slots = [];
    const maxStart = wEndM - effectiveDuration - salon.bufferMinutes;
    for (let m = wStartM; m <= maxStart; m += 15) slots.push(minsToTime(m));
    return slots;
  })();

  // Clamp startTime to valid slots
  const validStartTime = timeSlots.includes(startTime) ? startTime : (timeSlots[0] || salon.workStart);

  // Eligible rooms
  const needsRoom = bookingType === "single"
    ? selectedProc?.category !== "sauna"
    : selectedCombo?.steps.some(s => s.category !== "sauna" && s.category !== "peeling");
  const eligibleRooms = clientCount >= 2 ? salon.rooms.filter(r => r.beds >= 2) : salon.rooms;
  const validRoomId = eligibleRooms.find(r => r.id === roomId)?.id || eligibleRooms[0]?.id || "";

  // Multi-room allocation for 3+ clients
  const roomAllocation = (() => {
    if (clientCount <= 2) return null;
    const result = [];
    let remaining = clientCount;
    for (const r of [...salon.rooms].sort((a, b) => b.beds - a.beds)) {
      if (remaining <= 0) break;
      const take = Math.min(r.beds, remaining);
      result.push({ room: r, count: take });
      remaining -= take;
    }
    return result;
  })();

  // Therapist count
  const therapistCount = (() => {
    if (bookingType === "single") {
      let t = clientCount * (selectedProc?.therapistsRequired || 0);
      if (withPeeling && selectedProc?.category === "sauna" && salon.hasPeeling)
        t += Math.min(peelingCount, salon.peelingMastersMax || 2);
      return t;
    }
    if (!selectedCombo) return 0;
    let total = 0;
    for (const step of selectedCombo.steps) {
      const proc = activeProcedures.find(p => p.id === step.procId);
      if (!proc) continue;
      if (proc.category === "sauna") continue;
      if (proc.category === "peeling") { total += Math.min(peelingCount, salon.peelingMastersMax || 2); continue; }
      total += clientCount * (proc.therapistsRequired || 1);
    }
    return total;
  })();

  // Price
  const peelingProc = activeProcedures.find(p => p.category === "peeling");
  const peelingExtra = (withPeeling && bookingType === "single" && selectedProc?.category === "sauna" && salon.hasPeeling)
    ? (peelingProc?.price || 0) * peelingCount : 0;
  const totalPrice = bookingType === "single"
    ? (selectedProc?.price || 0) * clientCount + peelingExtra
    : (selectedCombo?.price || 0) * clientCount;

  // Combo timeline with actual times
  const comboTimeline = (() => {
    if (!selectedCombo) return [];
    let currentM = timeToMins(validStartTime);
    return selectedCombo.steps.map(step => {
      if (step.category === "peeling") return { ...step, label: step.name, parallel: true };
      const endM = currentM + step.duration;
      const item = { ...step, label: `${step.name} (${minsToTime(currentM)}–${minsToTime(endM)})`, parallel: false };
      currentM = endM;
      return item;
    });
  })();

  const generateSegments = () => {
    const startM = timeToMins(validStartTime);
    const effectiveRoom = clientCount >= 3 ? (roomAllocation?.[0]?.room.id || "") : validRoomId;

    if (bookingType === "single") {
      if (!selectedProc) return null;
      const endM = startM + selectedProc.duration;
      const isSauna = selectedProc.category === "sauna";
      const segs = [{
        procedureId: selectedProc.id, procedureName: selectedProc.name,
        startTime: validStartTime, endTime: minsToTime(endM),
        roomId: isSauna ? null : effectiveRoom,
        therapistCount: clientCount * selectedProc.therapistsRequired,
        resourceType: isSauna ? "sauna" : "room",
      }];
      // Add peeling segment if sauna + peeling checkbox
      if (isSauna && withPeeling && salon.hasPeeling) {
        const pEndM = startM + peelingCount * (salon.peelingTimePerPerson || 30);
        segs.push({
          procedureId: "__peeling__", procedureName: "Пиллинг",
          startTime: validStartTime, endTime: minsToTime(pEndM),
          roomId: null,
          therapistCount: Math.min(peelingCount, salon.peelingMastersMax || 2),
          resourceType: "peeling",
        });
      }
      return {
        segments: segs,
        totalStartTime: validStartTime,
        totalEndTime: minsToTime(endM + salon.bufferMinutes),
      };
    }

    if (!selectedCombo) return null;
    let currentM = startM;
    const segments = [];
    let saunaStartM = null;

    for (const step of selectedCombo.steps) {
      const proc = activeProcedures.find(p => p.id === step.procId);
      if (!proc) continue;

      if (proc.category === "peeling") {
        if (saunaStartM !== null) {
          const pEndM = saunaStartM + peelingCount * (salon.peelingTimePerPerson || 30);
          segments.push({
            procedureId: proc.id, procedureName: proc.name,
            startTime: minsToTime(saunaStartM), endTime: minsToTime(pEndM),
            roomId: null, therapistCount: Math.min(peelingCount, salon.peelingMastersMax || 2),
            resourceType: "peeling",
          });
        }
        continue;
      }

      const endM = currentM + proc.duration;
      const isSauna = proc.category === "sauna";
      if (isSauna) saunaStartM = currentM;

      segments.push({
        procedureId: proc.id, procedureName: proc.name,
        startTime: minsToTime(currentM), endTime: minsToTime(endM),
        roomId: isSauna ? null : effectiveRoom,
        therapistCount: isSauna ? 0 : clientCount * (proc.therapistsRequired || 1),
        resourceType: isSauna ? "sauna" : "room",
      });
      currentM = endM;
    }

    return {
      segments,
      totalStartTime: validStartTime,
      totalEndTime: minsToTime(currentM + salon.bufferMinutes),
    };
  };

  // Reactive validation (STEP-08)
  const segResult = generateSegments();
  const validationErrors = (() => {
    if (!segResult) return [];
    const tempBooking = {
      id: "__new__", date, clientCount,
      segments: segResult.segments,
      totalStartTime: segResult.totalStartTime,
      totalEndTime: segResult.totalEndTime,
    };
    return validateBooking(tempBooking, existingBookings, salon).errors;
  })();
  const fieldErrors = (field) => validationErrors.filter(e => e.field === field);
  const hasValidationErrors = validationErrors.length > 0;

  // Step 1: validate, then show confirm dialog
  const handleSave = () => {
    if (!clientName.trim())           { setErr("Введите имя клиента"); return; }
    if (!clientPhone.trim())          { setErr("Введите телефон"); return; }
    if (bookingType === "single" && !selectedProc)  { setErr("Выберите процедуру"); return; }
    if (bookingType === "combo"  && !selectedCombo) { setErr("Выберите комбо-пакет"); return; }
    if (timeSlots.length === 0) { setErr("Нет доступных временных слотов для этой процедуры"); return; }
    if (needsRoom && eligibleRooms.length === 0 && clientCount < 3)
      { setErr("Нет кабинок с 2 кроватями для " + clientCount + " клиентов"); return; }
    if (hasValidationErrors) { setErr("Исправьте ошибки валидации"); return; }
    if (!segResult) { setErr("Ошибка генерации записи"); return; }
    setShowConfirm(true);
  };

  // Step 2: confirmed — actually save
  const handleConfirmedSave = async () => {
    setShowConfirm(false);
    setSaving(true);
    const ym = date.slice(0, 7);
    const existing = await Storage.get(KEYS.bookings(salon.id, ym)) || [];
    const booking = {
      id: makeId(), salonId: salon.id, date,
      clientName: clientName.trim(), clientPhone: clientPhone.trim(), clientCount,
      bookingType: bookingType === "single" ? "single_procedure" : "combo",
      procedureId: bookingType === "single" ? (selectedProc?.id || null) : null,
      comboId:     bookingType === "combo"  ? (selectedCombo?.id || null) : null,
      segments: segResult.segments,
      totalStartTime: segResult.totalStartTime,
      totalEndTime: segResult.totalEndTime,
      totalPrice,
      status: "booked",
      createdAt: new Date().toISOString(),
      notes: notes.trim(),
    };
    const updated = [...existing, booking];
    await Storage.set(KEYS.bookings(salon.id, ym), updated);
    setSaving(false);
    onSave(booking, ym, updated);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      backgroundColor: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>
      <div style={{
        width: "100%", maxWidth: 520,
        backgroundColor: C.card, borderRadius: 12, padding: 28,
        maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: C.textMain }}>Новая запись</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textSub }}>
            <X size={18} />
          </button>
        </div>
        {/* Salon indicator */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 14px", borderRadius: 8, marginBottom: 20,
          backgroundColor: `${C.accent}15`, border: `1px solid ${C.accent}44`,
        }}>
          <Gem size={16} color={C.accent} />
          <span style={{ color: C.accent, fontWeight: 600, fontSize: 14 }}>{salon.name}</span>
        </div>

        {/* Client info */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Имя клиента *</label>
            <input type="text" value={clientName} placeholder="Иван Иванов"
              onChange={e => setClientName(e.target.value)} style={inputStyle()} />
          </div>
          <div>
            <label style={labelStyle}>Телефон *</label>
            <input type="text" value={clientPhone} placeholder="+7 700 123 45 67"
              onChange={e => setClientPhone(e.target.value)} style={inputStyle()} />
          </div>
        </div>

        {/* Client count */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Кол-во клиентов</label>
          <select value={clientCount} onChange={e => setClientCount(Number(e.target.value))}
            style={{ ...inputStyle(), width: "auto", minWidth: 100, cursor: "pointer" }}>
            {Array.from({ length: maxClients }, (_, i) => i + 1).map(n => (
              <option key={n} value={n} style={{ backgroundColor: C.card }}>{n}</option>
            ))}
          </select>
        </div>

        {/* Booking type */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Тип записи</label>
          <div style={{ display: "flex", gap: 20 }}>
            {[["single", "Одна процедура"], ["combo", "Комбо-пакет"]].map(([val, lbl]) => (
              <label key={val} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: C.textMain, fontSize: 13 }}>
                <input type="radio" name="btype" value={val} checked={bookingType === val}
                  onChange={() => setBookingType(val)} style={{ accentColor: C.accent }} />
                {lbl}
              </label>
            ))}
          </div>
        </div>

        {/* Procedure selector */}
        {bookingType === "single" && (
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Процедура</label>
            {bookableProcedures.length === 0 ? (
              <div style={{ color: "#F87171", fontSize: 12 }}>Нет активных процедур</div>
            ) : (
              <>
                <select value={selectedProc?.id || ""} onChange={e => setProcedureId(e.target.value)}
                  style={{ ...inputStyle(), cursor: "pointer" }}>
                  {bookableProcedures.map(p => (
                    <option key={p.id} value={p.id} style={{ backgroundColor: C.card }}>
                      {CATEGORY_ICONS[p.category]} {p.name} ({p.duration} мин)
                    </option>
                  ))}
                </select>
                {selectedProc?.therapistsRequired >= 2 && (
                  <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 6,
                    backgroundColor: "#D4A84B22", border: `1px solid ${C.accent}66`,
                    color: C.accent, fontSize: 12 }}>
                    ⚠ Требуется {selectedProc.therapistsRequired} мастера на клиента
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Peeling checkbox for sauna */}
        {bookingType === "single" && selectedProc?.category === "sauna" && salon.hasPeeling && (
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
              color: C.textMain, fontSize: 13,
            }}>
              <input
                type="checkbox" checked={withPeeling}
                onChange={e => setWithPeeling(e.target.checked)}
                style={{ accentColor: C.accent, width: 16, height: 16 }}
              />
              Добавить пиллинг
            </label>
            {withPeeling && (
              <div style={{ marginTop: 10, paddingLeft: 26 }}>
                <label style={labelStyle}>Кол-во человек на пиллинг (макс {salon.peelingMaxPerHour || 4})</label>
                <select value={peelingCount} onChange={e => setPeelingCount(Number(e.target.value))}
                  style={{ ...inputStyle(), width: "auto", minWidth: 80, cursor: "pointer" }}>
                  {Array.from({ length: salon.peelingMaxPerHour || 4 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n} style={{ backgroundColor: C.card }}>{n}</option>
                  ))}
                </select>
                {peelingProc && (
                  <div style={{ marginTop: 6, color: C.textSub, fontSize: 12 }}>
                    +{(peelingProc.price * peelingCount).toLocaleString("ru-RU")} ₸ · {peelingCount * (salon.peelingTimePerPerson || 30)} мин
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Combo selector */}
        {bookingType === "combo" && (
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Комбо-пакет</label>
            {activeCombos.length === 0 ? (
              <div style={{ color: "#F87171", fontSize: 12 }}>Нет активных комбо-пакетов</div>
            ) : (
              <>
                <select value={selectedCombo?.id || ""} onChange={e => setComboId(e.target.value)}
                  style={{ ...inputStyle(), cursor: "pointer" }}>
                  {activeCombos.map(c => (
                    <option key={c.id} value={c.id} style={{ backgroundColor: C.card }}>
                      {c.name} ({c.totalDuration} мин · {c.price.toLocaleString("ru-RU")} ₸)
                    </option>
                  ))}
                </select>

                {/* Timeline */}
                {comboTimeline.length > 0 && (
                  <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4 }}>
                    {comboTimeline.map((item, i) => {
                      const color = SEG_COLORS[item.category] || SEG_COLORS.massage;
                      return (
                        <React.Fragment key={i}>
                          {i > 0 && !item.parallel && (
                            <span style={{ color: C.textSub, fontSize: 12 }}>→</span>
                          )}
                          {item.parallel && (
                            <span style={{ color: C.textSub, fontSize: 11 }}>⟺</span>
                          )}
                          <span style={{
                            backgroundColor: color + "33", border: `1px solid ${color}66`,
                            borderRadius: 4, padding: "2px 7px", fontSize: 11, color: "#fff",
                          }}>
                            {item.label}
                          </span>
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}

                {/* Peeling count */}
                {hasPeelingInCombo && (
                  <div style={{ marginTop: 10 }}>
                    <label style={labelStyle}>Кол-во человек на пиллинг (макс {salon.peelingMaxPerHour || 4})</label>
                    <select value={peelingCount} onChange={e => setPeelingCount(Number(e.target.value))}
                      style={{ ...inputStyle(), width: "auto", minWidth: 80, cursor: "pointer" }}>
                      {Array.from({ length: salon.peelingMaxPerHour || 4 }, (_, i) => i + 1).map(n => (
                        <option key={n} value={n} style={{ backgroundColor: C.card }}>{n}</option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Date + Time */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Дата</label>
            <input type="date" value={date}
              onChange={e => { if (e.target.value) { setDate(e.target.value); setErr(""); } }}
              style={{ ...inputStyle(), colorScheme: "dark", cursor: "pointer" }} />
            {fieldErrors("date").map((e, i) => (
              <div key={i} style={{ color: "#F87171", fontSize: 12, marginTop: 4 }}>{e.message}</div>
            ))}
          </div>
          <div>
            <label style={labelStyle}>Время начала (шаг 15 мин)</label>
            {timeSlots.length > 0 ? (
              <select value={validStartTime} onChange={e => { setStartTime(e.target.value); setErr(""); }}
                style={{ ...inputStyle(), cursor: "pointer" }}>
                {timeSlots.map(t => (
                  <option key={t} value={t} style={{ backgroundColor: C.card }}>{t}</option>
                ))}
              </select>
            ) : (
              <div style={{ ...inputStyle(), display: "flex", alignItems: "center", color: "#F87171", fontSize: 12 }}>
                Нет доступных слотов
              </div>
            )}
            {fieldErrors("time").map((e, i) => (
              <div key={i} style={{ color: "#F87171", fontSize: 12, marginTop: 4 }}>{e.message}</div>
            ))}
          </div>
        </div>

        {/* Room */}
        {needsRoom && (
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Кабинка</label>
            {clientCount >= 3 && roomAllocation ? (
              <div style={{ padding: "8px 12px", borderRadius: 8, backgroundColor: C.gridBg,
                border: `1px solid ${C.border}`, color: C.textMain, fontSize: 13 }}>
                {roomAllocation.map((a, i) => (
                  <span key={i}>{i > 0 && " + "}{a.room.name} ({a.count} чел.)</span>
                ))}
              </div>
            ) : eligibleRooms.length > 0 ? (
              <select value={validRoomId} onChange={e => setRoomId(e.target.value)}
                style={{ ...inputStyle(), cursor: "pointer" }}>
                {eligibleRooms.map(r => (
                  <option key={r.id} value={r.id} style={{ backgroundColor: C.card }}>
                    {r.name} ({r.beds} кр.) {r.id === eligibleRooms[0]?.id ? "— авто" : ""}
                  </option>
                ))}
              </select>
            ) : (
              <div style={{ padding: "8px 12px", borderRadius: 8, backgroundColor: "#EF444411",
                border: "1px solid #EF4444", color: "#F87171", fontSize: 12 }}>
                Нет кабинок с 2 кроватями для {clientCount} клиентов
              </div>
            )}
            {fieldErrors("room").map((e, i) => (
              <div key={i} style={{ color: "#F87171", fontSize: 12, marginTop: 4 }}>{e.message}</div>
            ))}
          </div>
        )}

        {/* Sauna / Therapist validation warnings */}
        {(fieldErrors("sauna").length > 0 || fieldErrors("therapists").length > 0) && (
          <div style={{
            padding: "8px 12px", borderRadius: 6, marginBottom: 16,
            backgroundColor: "#EF444422", border: "1px solid #EF4444",
          }}>
            {[...fieldErrors("sauna"), ...fieldErrors("therapists")].map((e, i) => (
              <div key={i} style={{ color: "#F87171", fontSize: 12, marginTop: i > 0 ? 4 : 0 }}>{e.message}</div>
            ))}
          </div>
        )}

        {/* Summary */}
        <div style={{
          backgroundColor: C.gridBg, borderRadius: 8, padding: "12px 16px",
          border: `1px solid ${C.border}`, marginBottom: 16,
          display: "flex", gap: 24, flexWrap: "wrap",
        }}>
          <div>
            <div style={{ color: C.textSub, fontSize: 11, marginBottom: 2 }}>Длительность</div>
            <div style={{ color: C.textMain, fontSize: 13, fontWeight: 500 }}>
              {effectiveDuration} мин + {salon.bufferMinutes} мин буфер
            </div>
          </div>
          <div>
            <div style={{ color: C.textSub, fontSize: 11, marginBottom: 2 }}>Мастеров</div>
            <div style={{ color: C.textMain, fontSize: 13, fontWeight: 500 }}>{therapistCount}</div>
          </div>
          <div>
            <div style={{ color: C.textSub, fontSize: 11, marginBottom: 2 }}>Цена</div>
            <div style={{ color: C.accent, fontSize: 14, fontWeight: 600 }}>
              {totalPrice.toLocaleString("ru-RU")} ₸
            </div>
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Заметки</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Дополнительная информация..."
            style={{ ...inputStyle(), height: 68, resize: "vertical", lineHeight: 1.5, paddingTop: 10 }}
          />
        </div>

        {/* Error */}
        {err && (
          <div style={{
            padding: "8px 12px", borderRadius: 6, marginBottom: 16,
            backgroundColor: "#EF444422", border: "1px solid #EF4444", color: "#F87171", fontSize: 12,
          }}>
            {err}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "8px 20px", borderRadius: 8,
            border: `1px solid ${C.border}`, backgroundColor: "transparent",
            color: C.textSub, fontSize: 13, cursor: "pointer",
          }}>Отмена</button>
          <button onClick={handleSave} disabled={saving || hasValidationErrors} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 20px", borderRadius: 8,
            border: "none",
            backgroundColor: (saving || hasValidationErrors) ? C.border : C.accent,
            color: (saving || hasValidationErrors) ? C.textSub : C.bg,
            fontSize: 13, fontWeight: 600,
            cursor: (saving || hasValidationErrors) ? "not-allowed" : "pointer",
            opacity: hasValidationErrors ? 0.6 : 1,
          }}>
            {saving
              ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
              : <Check size={14} />}
            {saving ? "Сохранение…" : "Записать"}
          </button>
        </div>
      </div>

      {/* Confirm dialog */}
      {showConfirm && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 400,
          backgroundColor: "rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            width: 400, backgroundColor: C.card, borderRadius: 12, padding: 28,
            boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
          }}>
            <h4 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600, color: C.textMain }}>
              Подтвердите запись
            </h4>
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "12px 16px", borderRadius: 8, marginBottom: 16,
              backgroundColor: `${C.accent}15`, border: `1px solid ${C.accent}44`,
            }}>
              <Gem size={20} color={C.accent} />
              <span style={{ color: C.accent, fontWeight: 700, fontSize: 16 }}>{salon.name}</span>
            </div>
            <div style={{ fontSize: 13, color: C.textSub, marginBottom: 6 }}>
              {clientName.trim()} — {date}, {startTime || segResult?.totalStartTime}
            </div>
            <div style={{ fontSize: 13, color: C.textSub, marginBottom: 20 }}>
              {bookingType === "single" ? selectedProc?.name : selectedCombo?.name} — {totalPrice.toLocaleString("ru-RU")} ₸
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowConfirm(false)} style={{
                padding: "8px 20px", borderRadius: 8,
                border: `1px solid ${C.border}`, backgroundColor: "transparent",
                color: C.textSub, fontSize: 13, cursor: "pointer",
              }}>Отмена</button>
              <button onClick={handleConfirmedSave} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 24px", borderRadius: 8, border: "none",
                backgroundColor: C.accent, color: C.bg,
                fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>
                <Check size={14} />
                Подтвердить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Booking Details Panel (STEP-09) ───────────────────────────────────────

const STATUS_CFG = {
  booked:              { label: "Забронировано",      color: "#D4A84B" },
  completed:           { label: "Завершено",          color: "#34D399" },
  "cancelled_refund":  { label: "Отменено (возврат)", color: "#F87171" },
  "cancelled_no_refund": { label: "Отменено (без возврата)", color: "#E85D5D" },
  "no-show":           { label: "Неявка",             color: "#FBBF24" },
};

function BookingDetailsPanel({ booking, salon, procedures, onStatusChange, onDelete, onClose }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Close on outside click (stable ref avoids re-attaching on every render)
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onCloseRef.current();
    };
    const timer = setTimeout(() => document.addEventListener("mousedown", handler), 10);
    return () => { clearTimeout(timer); document.removeEventListener("mousedown", handler); };
  }, []);

  const isCombo = booking.bookingType === "combo";
  const segments = booking.segments || [];
  const statusCfg = STATUS_CFG[booking.status] || STATUS_CFG.booked;

  // For single procedure — find room name
  const roomSeg = segments.find(s => s.resourceType === "room" && s.roomId);
  const roomName = roomSeg ? (salon.rooms.find(r => r.id === roomSeg.roomId)?.name || roomSeg.roomId) : null;

  const divider = <div style={{ height: 1, backgroundColor: C.border, margin: "16px 0" }} />;

  return (
    <div ref={panelRef} style={{
      position: "fixed", top: 0, right: 0, bottom: 0, width: 360, zIndex: 300,
      backgroundColor: C.card, borderLeft: `2px solid ${C.accent}`,
      display: "flex", flexDirection: "column",
      boxShadow: "-4px 0 24px rgba(0,0,0,0.4)",
      animation: "slideInRight 250ms ease-out",
      overflowY: "auto",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 0" }}>
        <span style={{ color: C.textSub, fontSize: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Детали записи
        </span>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textSub }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ padding: "16px 20px", flex: 1 }}>
        {/* Client info */}
        <div style={{ fontSize: 16, fontWeight: 600, color: C.textMain, marginBottom: 4 }}>
          {booking.clientName}
        </div>
        <a href={`tel:${booking.clientPhone}`} style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          color: C.textSub, fontSize: 14, textDecoration: "none",
        }}>
          <Phone size={13} />
          {booking.clientPhone}
        </a>

        {divider}

        {/* Booking info */}
        {isCombo ? (
          <>
            <div style={{ color: C.textSub, fontSize: 11, marginBottom: 10, textTransform: "uppercase" }}>Комбо-пакет</div>
            {segments.filter(s => s.resourceType !== "peeling").map((seg, i) => {
              const proc = procedures.find(p => p.id === seg.procedureId);
              const cat = proc?.category || "massage";
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: SEG_COLORS[cat] || SEG_COLORS.massage, flexShrink: 0 }} />
                  <span style={{ color: C.textMain, fontSize: 13, flex: 1 }}>{seg.procedureName}</span>
                  <span style={{ color: C.textSub, fontSize: 12 }}>{seg.startTime}–{seg.endTime}</span>
                </div>
              );
            })}
            {segments.some(s => s.resourceType === "peeling") && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: SEG_COLORS.peeling, flexShrink: 0 }} />
                <span style={{ color: C.textMain, fontSize: 13, flex: 1 }}>
                  {segments.find(s => s.resourceType === "peeling")?.procedureName || "Пиллинг"}
                </span>
                <span style={{ color: C.textSub, fontSize: 12 }}>параллельно сауне</span>
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 12px", fontSize: 13 }}>
              <span style={{ color: C.textSub }}>Процедура:</span>
              <span style={{ color: C.textMain }}>{segments[0]?.procedureName || "—"}</span>
              <span style={{ color: C.textSub }}>Время:</span>
              <span style={{ color: C.textMain }}>{booking.totalStartTime} — {segments[0]?.endTime || booking.totalEndTime}</span>
              {roomName && <>
                <span style={{ color: C.textSub }}>Кабинка:</span>
                <span style={{ color: C.textMain }}>{roomName}</span>
              </>}
              <span style={{ color: C.textSub }}>Мастеров:</span>
              <span style={{ color: C.textMain }}>{segments[0]?.therapistCount || 0}</span>
              <span style={{ color: C.textSub }}>Клиентов:</span>
              <span style={{ color: C.textMain }}>{booking.clientCount}</span>
            </div>
          </>
        )}

        {divider}

        {/* Price */}
        <div style={{ fontSize: 18, fontWeight: 700, color: C.accent, marginBottom: 4 }}>
          {(booking.totalPrice || 0).toLocaleString("ru-RU")} ₸
        </div>

        {divider}

        {/* Status */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: C.textSub, fontSize: 11, marginBottom: 6, textTransform: "uppercase" }}>Статус</div>
          <select
            value={booking.status}
            onChange={e => onStatusChange(booking.id, e.target.value)}
            style={{
              ...inputStyle(), cursor: "pointer", width: "100%",
              borderColor: statusCfg.color + "66",
              color: statusCfg.color,
            }}
          >
            {Object.entries(STATUS_CFG).map(([val, cfg]) => (
              <option key={val} value={val} style={{ backgroundColor: C.card, color: C.textMain }}>
                {cfg.label}
              </option>
            ))}
          </select>
        </div>

        {/* Notes */}
        {booking.notes && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: C.textSub, fontSize: 11, marginBottom: 4, textTransform: "uppercase" }}>Заметки</div>
            <div style={{ color: C.textMain, fontSize: 13, lineHeight: 1.5, padding: "8px 10px",
              backgroundColor: C.gridBg, borderRadius: 6, border: `1px solid ${C.border}` }}>
              {booking.notes}
            </div>
          </div>
        )}
      </div>

      {/* Delete */}
      {(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const bDate = new Date(booking.date + "T00:00:00");
        const isPast = bDate < today;
        return (
          <div style={{ padding: "16px 20px", borderTop: `1px solid ${C.border}` }}>
            {isPast ? (
              <div style={{ color: C.textSub, fontSize: 12, textAlign: "center", padding: "8px 0" }}>
                Удаление невозможно — дата записи уже прошла
              </div>
            ) : confirmDelete ? (
              <div>
                <div style={{ color: C.textMain, fontSize: 13, marginBottom: 10 }}>
                  Удалить запись {booking.clientName} на {booking.totalStartTime}?
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => onDelete(booking.id)} style={{
                    flex: 1, padding: "8px 0", borderRadius: 8, border: "none",
                    backgroundColor: "#EF4444", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}>Да, удалить</button>
                  <button onClick={() => setConfirmDelete(false)} style={{
                    flex: 1, padding: "8px 0", borderRadius: 8,
                    border: `1px solid ${C.border}`, backgroundColor: "transparent",
                    color: C.textSub, fontSize: 13, cursor: "pointer",
                  }}>Отмена</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                width: "100%", padding: "8px 0", borderRadius: 8,
                border: "1px solid #EF444466", backgroundColor: "#EF444411",
                color: "#F87171", fontSize: 13, cursor: "pointer",
              }}>
                <Trash2 size={14} /> Удалить запись
              </button>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ─── Schedule Screen (STEP-06) ────────────────────────────────────────────────

const CELL_W = 80;   // px per 30-min slot
const ROW_H  = 60;   // px per grid row
const COL_W  = 120;  // px for fixed left label column

const SEG_COLORS = { massage: "#2D6A4F", sauna: "#B85C38", peeling: "#7B68AE" };

const JS_DAY_KEY = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
const RU_WEEKDAY = ["Воскресенье","Понедельник","Вторник","Среда","Четверг","Пятница","Суббота"];
const RU_WEEKDAY_SHORT = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"];
const RU_MONTH   = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
const RU_MONTH_NOM = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

const timeToMins = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const minsToTime = (m) => `${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;
const toDateStr  = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const toYM       = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
const addDays    = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const parseLocal = (s) => { const [y,m,d] = s.split("-").map(Number); return new Date(y, m-1, d); };

function ScheduleScreen({ activeSalonId, salons, procedures, combos, onShowToast, currentUser }) {
  const salon = salons.find(s => s.id === activeSalonId);
  const [viewMonth, setViewMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [monthBookings, setMonthBookings] = useState([]);
  const [expandedDates, setExpandedDates] = useState({}); // dates user manually expanded
  const [bookingModal, setBookingModal] = useState(null);
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  // View filter: "month" | "2weeks" | "week" | "custom"
  const [viewMode, setViewMode] = useState("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const ym = `${viewMonth.getFullYear()}-${String(viewMonth.getMonth()+1).padStart(2,"0")}`;

  // Load bookings when salon or month changes
  useEffect(() => {
    if (!salon) return;
    let cancelled = false;
    (async () => {
      const bkgs = await Storage.get(KEYS.bookings(activeSalonId, ym));
      if (!cancelled) setMonthBookings(bkgs || []);
    })();
    return () => { cancelled = true; };
  }, [activeSalonId, ym]);

  if (!salon) return null;

  // Generate all days of the month
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const allDays = Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1));

  // Filter days based on view mode
  const today = new Date();
  const todayStr = toDateStr(today);
  const visibleDays = (() => {
    if (viewMode === "week") {
      // Current week (Mon–Sun) that contains today or first of month
      const ref = (viewMonth.getMonth() === today.getMonth() && viewMonth.getFullYear() === today.getFullYear()) ? today : allDays[0];
      const dayOfWeek = ref.getDay() === 0 ? 6 : ref.getDay() - 1; // Mon=0
      const weekStart = addDays(ref, -dayOfWeek);
      const weekEnd = addDays(weekStart, 6);
      return allDays.filter(d => d >= weekStart && d <= weekEnd);
    }
    if (viewMode === "2weeks") {
      const ref = (viewMonth.getMonth() === today.getMonth() && viewMonth.getFullYear() === today.getFullYear()) ? today : allDays[0];
      const dayOfWeek = ref.getDay() === 0 ? 6 : ref.getDay() - 1;
      const weekStart = addDays(ref, -dayOfWeek);
      const weekEnd = addDays(weekStart, 13);
      return allDays.filter(d => d >= weekStart && d <= weekEnd);
    }
    if (viewMode === "custom" && customFrom && customTo) {
      const from = parseLocal(customFrom);
      const to = parseLocal(customTo);
      return allDays.filter(d => d >= from && d <= to);
    }
    return allDays; // month
  })();

  const handleBookingCreated = async (_booking, bookingYm, updatedBookings) => {
    if (bookingYm === ym) setMonthBookings(updatedBookings);
    setBookingModal(null);
    if (currentUser) {
      await UserStorage.saveLog({
        id: makeId(), userId: currentUser.id, userName: currentUser.name,
        action: "create", targetDate: _booking.date, targetTime: _booking.totalStartTime,
        clientName: _booking.clientName,
        details: `Услуга: ${_booking.segments?.[0]?.procedureName || "комбо"}, Цена: ${_booking.totalPrice}₸`,
        timestamp: new Date().toISOString(),
      });
    }
    if (onShowToast) onShowToast("Запись создана");
  };

  const handleStatusChange = async (bookingId, newStatus) => {
    const all = await Storage.get(KEYS.bookings(activeSalonId, ym)) || [];
    const booking = all.find(b => b.id === bookingId);
    const updated = all.map(b => b.id === bookingId ? { ...b, status: newStatus } : b);
    await Storage.set(KEYS.bookings(activeSalonId, ym), updated);
    setMonthBookings(updated);
    if (currentUser && booking) {
      await UserStorage.saveLog({
        id: makeId(), userId: currentUser.id, userName: currentUser.name,
        action: "edit", targetDate: booking.date, targetTime: booking.totalStartTime,
        clientName: booking.clientName,
        details: `Статус: ${booking.status} → ${newStatus}`,
        timestamp: new Date().toISOString(),
      });
    }
    if (onShowToast) onShowToast("Статус изменён");
  };

  const handleDeleteBooking = async (bookingId) => {
    const all = await Storage.get(KEYS.bookings(activeSalonId, ym)) || [];
    const target = all.find(b => b.id === bookingId);
    if (target) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const bDate = new Date(target.date + "T00:00:00");
      if (bDate < today) {
        if (onShowToast) onShowToast("Нельзя удалить — дата уже прошла");
        return;
      }
    }
    const updated = all.filter(b => b.id !== bookingId);
    await Storage.set(KEYS.bookings(activeSalonId, ym), updated);
    setMonthBookings(updated);
    setSelectedBookingId(null);
    if (currentUser && target) {
      await UserStorage.saveLog({
        id: makeId(), userId: currentUser.id, userName: currentUser.name,
        action: "delete", targetDate: target.date, targetTime: target.totalStartTime,
        clientName: target.clientName,
        details: `Услуга: ${target.segments?.[0]?.procedureName || "комбо"}, Цена: ${target.totalPrice}₸`,
        timestamp: new Date().toISOString(),
      });
    }
    if (onShowToast) onShowToast("Запись удалена");
  };

  const selectedBooking = selectedBookingId ? monthBookings.find(b => b.id === selectedBookingId) : null;

  const wStartM  = timeToMins(salon.workStart);
  const wEndM    = timeToMins(salon.workEnd);
  const slotCount = Math.max(0, (wEndM - wStartM) / 30);
  const slots    = Array.from({ length: slotCount }, (_, i) => wStartM + i * 30);
  const totalGridW = slotCount * CELL_W;

  const rows = [
    ...salon.rooms.map(r => ({ id: r.id, label: r.name, type: "room" })),
    ...(salon.hasSauna ? [{ id: "__sauna__", label: "Сауна", type: "sauna" }] : []),
  ];

  const segLeft  = (t) => (timeToMins(t) - wStartM) / 30 * CELL_W;
  const segWidth = (s, e) => (timeToMins(e) - timeToMins(s)) / 30 * CELL_W;

  const monthLabel = `${RU_MONTH_NOM[viewMonth.getMonth()]} ${viewMonth.getFullYear()}`;

  const pillStyle = (active) => ({
    padding: "5px 14px", borderRadius: 6, fontSize: 12, fontWeight: active ? 600 : 400,
    border: `1px solid ${active ? C.accent : C.border}`,
    backgroundColor: active ? C.accent : "transparent",
    color: active ? C.bg : C.textSub,
    cursor: "pointer",
  });

  const btnStyle = (extra = {}) => ({
    display: "flex", alignItems: "center", padding: "6px 10px", borderRadius: 6,
    border: `1px solid ${C.border}`, background: "none", color: C.textSub, cursor: "pointer",
    ...extra,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Top bar: month nav + view mode + new booking ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button onClick={() => setViewMonth(new Date(year, month - 1, 1))} style={btnStyle()}>
          <ChevronLeft size={15} />
        </button>
        <span style={{ color: C.textMain, fontSize: 15, fontWeight: 600, minWidth: 180, textAlign: "center", textTransform: "capitalize" }}>
          {monthLabel}
        </span>
        <button onClick={() => setViewMonth(new Date(year, month + 1, 1))} style={btnStyle()}>
          <ChevronRight size={15} />
        </button>

        <div style={{ width: 1, height: 24, backgroundColor: C.border, margin: "0 4px" }} />

        {/* View mode pills */}
        {[["month","Месяц"],["2weeks","2 недели"],["week","Неделя"],["custom","Период"]].map(([val,lbl]) => (
          <button key={val} onClick={() => setViewMode(val)} style={pillStyle(viewMode === val)}>{lbl}</button>
        ))}

        {/* Custom date range */}
        {viewMode === "custom" && (
          <>
            <input type="date" value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              style={{ ...inputStyle(), width: 140, height: 30, fontSize: 11, colorScheme: "dark" }}
            />
            <span style={{ color: C.textSub, fontSize: 12 }}>—</span>
            <input type="date" value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              style={{ ...inputStyle(), width: 140, height: 30, fontSize: 11, colorScheme: "dark" }}
            />
          </>
        )}

        <div style={{ flex: 1 }} />

        <button
          onClick={() => setBookingModal({ initialTime: null, initialRoomId: null })}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 8,
            backgroundColor: C.accent, color: C.bg,
            fontWeight: 600, fontSize: 13, border: "none", cursor: "pointer",
          }}>
          <Plus size={14} /> Новая запись
        </button>
      </div>

      {/* ── Days list grouped by weeks ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {(() => {
          // Group visible days by week number (Mon=start)
          const weeks = [];
          let currentWeek = null;
          visibleDays.forEach(day => {
            // Week number within month: based on Monday as start
            const firstOfMonth = new Date(year, month, 1);
            const firstMonday = addDays(firstOfMonth, (8 - firstOfMonth.getDay()) % 7 || 7);
            let weekNum;
            if (day < firstMonday) weekNum = 1;
            else weekNum = Math.floor((day - firstMonday) / (7 * 86400000)) + 2;
            if (!currentWeek || currentWeek.num !== weekNum) {
              currentWeek = { num: weekNum, days: [] };
              weeks.push(currentWeek);
            }
            currentWeek.days.push(day);
          });
          return weeks.map(week => (
            <div key={week.num}>
              {/* Week header */}
              <div style={{
                padding: "16px 16px", marginTop: week.num > 1 ? 24 : 0,
                borderBottom: `1px solid ${C.border}`,
                display: "flex", alignItems: "baseline", gap: 12,
              }}>
                <span style={{ fontSize: 32, fontWeight: 700, color: C.accent, textTransform: "uppercase", letterSpacing: "1px" }}>
                  Неделя {week.num}
                </span>
                <span style={{ fontSize: 28, color: C.textSub }}>
                  {week.days[0].getDate()} — {week.days[week.days.length - 1].getDate()} {RU_MONTH[month]}
                </span>
              </div>

              {/* Days in this week */}
              {week.days.map(day => {
                const ds = toDateStr(day);
                const isDayOff = JS_DAY_KEY[day.getDay()] === salon.dayOff;
                const dayBkgs = monthBookings.filter(b => b.date === ds);
                const isExpanded = !!expandedDates[ds];
                const isT = ds === todayStr;

                // Day KPI
                const active = dayBkgs.filter(b => b.status !== "cancelled_refund" && b.status !== "cancelled_no_refund");
                const paid = dayBkgs.filter(b => b.status === "completed" || b.status === "no-show" || b.status === "cancelled_no_refund");
                const booked = dayBkgs.filter(b => b.status === "booked").length;
                const completed = dayBkgs.filter(b => b.status === "completed").length;
                const clients = active.reduce((s, b) => s + (b.clientCount || 1), 0);
                const revenue = paid.reduce((s, b) => s + (b.totalPrice || 0), 0);

                // Room utilization for this day
                let roomBusy = 0;
                const wMins = wEndM - wStartM;
                const roomTotal = salon.rooms.length * wMins;
                for (const b of active) {
                  for (const seg of (b.segments || [])) {
                    if (seg.resourceType === "room" && seg.roomId) {
                      roomBusy += timeToMins(seg.endTime) - timeToMins(seg.startTime);
                    }
                  }
                }
                const roomPct = roomTotal > 0 ? Math.round(roomBusy / roomTotal * 100) : 0;

                // Therapist utilization for this day
                let therBusy = 0;
                const therTotal = ((salon.therapistCount || 1) + (salon.hasPeeling ? (salon.peelingMastersMax || 2) : 0)) * wMins;
                for (const b of active) {
                  for (const seg of (b.segments || [])) {
                    therBusy += (seg.therapistCount || 0) * (timeToMins(seg.endTime) - timeToMins(seg.startTime));
                  }
                }
                const therPct = therTotal > 0 ? Math.round(therBusy / therTotal * 100) : 0;

                return (
                  <div key={ds} style={{ borderBottom: `1px solid ${C.border}22` }}>
                    {/* Day header with date + KPI bar */}
                    <div
                      onClick={() => setExpandedDates(prev => ({ ...prev, [ds]: !prev[ds] }))}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "8px 16px", cursor: "pointer",
                        backgroundColor: isT ? `${C.accent}11` : "transparent",
                        border: isT ? `1px solid ${C.accent}33` : `1px solid transparent`,
                        borderRadius: 6, margin: "2px 0",
                        transition: "background 150ms",
                      }}
                    >
                      {/* Date block */}
                      <div style={{ minWidth: 48, textAlign: "center" }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: isDayOff ? C.textSub : (isT ? C.accent : C.textMain) }}>
                          {day.getDate()}
                        </div>
                        <div style={{ fontSize: 10, color: isDayOff ? "#F8717166" : C.textSub, textTransform: "uppercase" }}>
                          {RU_WEEKDAY_SHORT[day.getDay()]}
                        </div>
                      </div>

                      {/* KPI mini-bar */}
                      {isDayOff ? (
                        <span style={{ color: C.textSub, fontSize: 12, fontStyle: "italic" }}>Выходной</span>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11, color: C.textMain }}>
                            {active.length} {active.length === 1 ? "запись" : active.length < 5 ? "записи" : "записей"}
                          </span>
                          <span style={{ fontSize: 11, color: C.textSub }}>{clients} кл.</span>
                          {booked > 0 && <span style={{ fontSize: 11, color: "#D4A84B" }}>● {booked} ожид.</span>}
                          {completed > 0 && <span style={{ fontSize: 11, color: "#4ADE80" }}>● {completed} выполн.</span>}
                          {revenue > 0 && <span style={{ fontSize: 11, color: C.accent, fontWeight: 600 }}>{revenue.toLocaleString("ru-RU")} ₸</span>}
                          <span style={{ fontSize: 10, color: roomPct > 70 ? "#F87171" : C.textSub }}>Каб. {roomPct}%</span>
                          <span style={{ fontSize: 10, color: therPct > 70 ? "#F87171" : C.textSub }}>Маст. {therPct}%</span>
                        </div>
                      )}

                      {/* Collapse/expand arrow */}
                      <div style={{ color: C.textSub }}>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </div>

                    {/* Day grid (shown by default, can collapse) */}
                    {isExpanded && !isDayOff && (() => {
                      const dayBookings = dayBkgs;
                      const _now = new Date();
                      const nowM = _now.getHours() * 60 + _now.getMinutes();
                      const nowLeft = (isT && nowM >= wStartM && nowM <= wEndM) ? (nowM - wStartM) / 30 * CELL_W : null;

                      const therapistUsage = slots.map(sStart => {
                        const sEnd = sStart + 30;
                        const sStartStr = minsToTime(sStart);
                        const sEndStr   = minsToTime(sEnd);
                        let used = 0;
                        for (const bk of dayBookings) {
                          if (!Array.isArray(bk.segments)) continue;
                          for (const seg of bk.segments) {
                            if (seg.startTime < sEndStr && seg.endTime > sStartStr) used += (seg.therapistCount || 0);
                          }
                        }
                        return { used, total: salon.therapistCount };
                      });

                      const getRowSegments = (row) => {
                        const out = [];
                        for (const bk of dayBookings) {
                          if (!Array.isArray(bk.segments)) continue;
                          for (const seg of bk.segments) {
                            const match = row.type === "sauna"
                              ? seg.resourceType === "sauna"
                              : (seg.resourceType === "room" && seg.roomId === row.id);
                            if (match) out.push({ ...seg, booking: bk });
                          }
                        }
                        return out;
                      };

                      return (
                        <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, overflow: "hidden", margin: "4px 16px 8px" }}>
                          <div style={{ display: "flex" }}>
                            {/* Fixed left column */}
                            <div style={{ width: COL_W, flexShrink: 0, borderRight: `1px solid ${C.border}`, backgroundColor: C.card }}>
                              <div style={{ height: 32, borderBottom: `1px solid ${C.border}` }} />
                              {rows.map((row, i) => (
                                <div key={row.id} style={{
                                  height: ROW_H, display: "flex", alignItems: "center", padding: "0 12px",
                                  borderBottom: i < rows.length - 1 ? `1px solid ${C.border}` : "none",
                                  color: C.textSub, fontSize: 12, fontWeight: 500,
                                }}>{row.label}</div>
                              ))}
                              <div style={{
                                borderTop: `1px solid ${C.border}`, height: 44,
                                display: "flex", alignItems: "center", padding: "0 12px",
                                color: C.textSub, fontSize: 11,
                              }}>Массажистки</div>
                            </div>

                            {/* Scrollable grid */}
                            <div style={{ overflowX: "auto", flex: 1 }}>
                              <div style={{ width: totalGridW, position: "relative", minWidth: "100%" }}>
                                {/* Time header */}
                                <div style={{ display: "flex", height: 32, borderBottom: `1px solid ${C.border}`, backgroundColor: C.card }}>
                                  {slots.map(s => (
                                    <div key={s} style={{
                                      width: CELL_W, flexShrink: 0, display: "flex", alignItems: "center",
                                      paddingLeft: 6, color: C.textSub, fontSize: 11,
                                      borderRight: `1px solid ${C.border}`,
                                    }}>{minsToTime(s)}</div>
                                  ))}
                                </div>

                                {/* Grid rows */}
                                {rows.map((row, rowIdx) => {
                                  const rowSegs = getRowSegments(row);
                                  return (
                                    <div key={row.id} style={{
                                      height: ROW_H, position: "relative",
                                      borderBottom: rowIdx < rows.length - 1 ? `1px solid ${C.border}` : "none",
                                      backgroundColor: C.gridBg,
                                    }}>
                                      {slots.map(s => (
                                        <div key={s} style={{
                                          position: "absolute",
                                          left: (s - wStartM) / 30 * CELL_W, top: 0,
                                          width: CELL_W, height: ROW_H,
                                          borderRight: `1px solid ${C.border}`,
                                          cursor: "pointer", transition: "background 100ms",
                                        }}
                                          onMouseEnter={e => e.currentTarget.style.backgroundColor = "#1D2A3A"}
                                          onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                                          onClick={() => setBookingModal({
                                            initialDate: ds,
                                            initialTime: minsToTime(s),
                                            initialRoomId: row.type === "room" ? row.id : null,
                                          })}
                                        />
                                      ))}
                                      {rowSegs.map((seg, si) => {
                                        const proc = procedures.find(p => p.id === seg.procedureId);
                                        const cat  = proc?.category || (row.type === "sauna" ? "sauna" : "massage");
                                        const color = SEG_COLORS[cat] || SEG_COLORS.massage;
                                        const isCombo = seg.booking.bookingType === "combo";
                                        const hasPeelingBadge = row.type === "sauna"
                                          && seg.booking.segments.some(s2 => s2.resourceType === "peeling");
                                        const lx = segLeft(seg.startTime);
                                        const wd = Math.max(segWidth(seg.startTime, seg.endTime) - 4, 20);
                                        return (
                                          <div key={si} style={{
                                            position: "absolute", left: lx + 2, top: 4,
                                            width: wd, height: ROW_H - 8,
                                            backgroundColor: color, borderRadius: 6,
                                            border: isCombo ? `1px dashed ${C.accent}55` : "none",
                                            overflow: "hidden", cursor: "pointer",
                                            transition: "filter 150ms, box-shadow 150ms",
                                            zIndex: 2, padding: "4px 6px",
                                          }}
                                            onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.15)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.4)"; }}
                                            onMouseLeave={e => { e.currentTarget.style.filter = ""; e.currentTarget.style.boxShadow = ""; }}
                                            onClick={(e) => { e.stopPropagation(); setSelectedBookingId(seg.booking.id); }}
                                          >
                                            <div style={{ fontSize: 11, fontWeight: 600, color: "#fff", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                                              {seg.booking.clientName}
                                            </div>
                                            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.75)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                              {seg.procedureName}
                                            </div>
                                            {hasPeelingBadge && (
                                              <div style={{
                                                position: "absolute", top: 4, right: 4,
                                                backgroundColor: SEG_COLORS.peeling,
                                                borderRadius: 3, padding: "1px 5px",
                                                fontSize: 9, color: "#fff", fontWeight: 600,
                                              }}>+ Пиллинг</div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })}

                                {/* Therapist indicator */}
                                <div style={{ display: "flex", height: 44, borderTop: `1px solid ${C.border}`, backgroundColor: C.card }}>
                                  {therapistUsage.map((u, i) => {
                                    const isFull = u.used >= u.total && u.total > 0;
                                    return (
                                      <div key={i} style={{
                                        width: CELL_W, flexShrink: 0, display: "flex", flexDirection: "column",
                                        alignItems: "center", justifyContent: "center", gap: 3,
                                        borderRight: `1px solid ${C.border}`,
                                      }}>
                                        <div style={{ display: "flex", gap: 1, flexWrap: "wrap", justifyContent: "center", maxWidth: CELL_W - 8 }}>
                                          {Array.from({ length: Math.min(u.total, 12) }).map((_, j) => (
                                            <div key={j} style={{
                                              width: 4, height: 4, borderRadius: 1,
                                              backgroundColor: j < u.used ? C.accent : C.border,
                                            }} />
                                          ))}
                                        </div>
                                        <span style={{ fontSize: 9, fontWeight: 600, color: isFull ? "#F87171" : C.textSub }}>
                                          {u.used}/{u.total}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Current time line */}
                                {nowLeft !== null && (
                                  <div style={{
                                    position: "absolute", left: nowLeft, top: 0, bottom: 0,
                                    width: 2, backgroundColor: "#EF4444", opacity: 0.7,
                                    zIndex: 20, pointerEvents: "none",
                                  }} />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          ));
        })()}
      </div>

      {/* Booking modal */}
      {bookingModal && (
        <BookingModal
          salon={salon}
          procedures={procedures}
          combos={combos || []}
          initialDate={bookingModal.initialDate || toDateStr(new Date())}
          initialTime={bookingModal.initialTime}
          initialRoomId={bookingModal.initialRoomId}
          onSave={handleBookingCreated}
          onClose={() => setBookingModal(null)}
        />
      )}

      {/* Booking details side panel (STEP-09) */}
      {selectedBooking && (
        <BookingDetailsPanel
          booking={selectedBooking}
          salon={salon}
          procedures={procedures}
          onStatusChange={handleStatusChange}
          onDelete={handleDeleteBooking}
          onClose={() => setSelectedBookingId(null)}
        />
      )}

      {/* Slide-in animation */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

// ─── Journal Screen (STEP-10) ──────────────────────────────────────────────

const PAGE_SIZE = 25;

function JournalScreen({ salons, onShowToast, currentUser }) {
  const [allBookings, setAllBookings] = useState([]);
  const [loadingJ, setLoadingJ] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [filterSalon, setFilterSalon] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Sort
  const [sortCol, setSortCol] = useState("date");
  const [sortDir, setSortDir] = useState("desc");

  // Pagination
  const [page, setPage] = useState(1);

  // Load all bookings from all salons / all months
  const loadAll = useCallback(async () => {
    setLoadingJ(true);
    const keys = await Storage.list("spa-crm:bookings:");
    const promises = keys.map(k => Storage.get(k));
    const arrays = await Promise.all(promises);
    const flat = arrays.flat().filter(Boolean);
    setAllBookings(flat);
    setLoadingJ(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Derive service name for a booking
  const serviceName = (b) => {
    if (b.bookingType === "combo") return "Комбо";
    return b.segments?.[0]?.procedureName || "—";
  };

  // Total duration from segments
  const totalDuration = (b) => {
    if (!b.segments || b.segments.length === 0) return 0;
    const starts = b.segments.map(s => timeToMins(s.startTime));
    const ends   = b.segments.map(s => timeToMins(s.endTime));
    return Math.max(...ends) - Math.min(...starts);
  };

  const salonName = (b) => salons.find(s => s.id === b.salonId)?.name || b.salonId;

  // Filter
  const filtered = allBookings.filter(b => {
    if (filterSalon !== "all" && b.salonId !== filterSalon) return false;
    if (filterStatus !== "all" && b.status !== filterStatus) return false;
    if (dateFrom && b.date < dateFrom) return false;
    if (dateTo && b.date > dateTo) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!b.clientName?.toLowerCase().includes(q) && !b.clientPhone?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let va, vb;
    switch (sortCol) {
      case "date":     va = a.date; vb = b.date; break;
      case "name":     va = a.clientName?.toLowerCase() || ""; vb = b.clientName?.toLowerCase() || ""; break;
      case "salon":    va = salonName(a); vb = salonName(b); break;
      case "service":  va = serviceName(a); vb = serviceName(b); break;
      case "duration": va = totalDuration(a); vb = totalDuration(b); break;
      case "price":    va = a.totalPrice || 0; vb = b.totalPrice || 0; break;
      case "status":   va = a.status; vb = b.status; break;
      default:         va = a.date; vb = b.date;
    }
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [search, filterSalon, filterStatus, dateFrom, dateTo, sortCol, sortDir]);

  // Inline status change
  const handleStatusChange = async (bookingId, salonId, bookingDate, newStatus) => {
    const ym = bookingDate.slice(0, 7);
    const key = KEYS.bookings(salonId, ym);
    const arr = await Storage.get(key) || [];
    const booking = arr.find(b => b.id === bookingId);
    const updated = arr.map(b => b.id === bookingId ? { ...b, status: newStatus } : b);
    await Storage.set(key, updated);
    setAllBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b));
    if (currentUser && booking) {
      await UserStorage.saveLog({
        id: makeId(), userId: currentUser.id, userName: currentUser.name,
        action: "edit", targetDate: booking.date, targetTime: booking.totalStartTime,
        clientName: booking.clientName,
        details: `Статус: ${booking.status} → ${newStatus}`,
        timestamp: new Date().toISOString(),
      });
    }
    if (onShowToast) onShowToast("Статус изменён");
  };

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  const sortArrow = (col) => sortCol === col ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  const columns = [
    { id: "date",     label: "Дата",         w: 100 },
    { id: "name",     label: "Имя",          w: null },
    { id: "phone",    label: "Телефон",      w: 140 },
    { id: "salon",    label: "Салон",         w: 100 },
    { id: "service",  label: "Услуга",       w: 140 },
    { id: "duration", label: "Длит.",        w: 70 },
    { id: "price",    label: "Цена",         w: 90 },
    { id: "status",   label: "Статус",       w: 150 },
  ];

  const sortable = new Set(["date","name","salon","service","duration","price","status"]);

  const formatDateRu = (d) => {
    if (!d) return "—";
    const [y, m, day] = d.split("-");
    return `${day}.${m}.${y}`;
  };

  const filterInputStyle = {
    ...inputStyle(), height: 34, fontSize: 12,
  };

  if (loadingJ) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 60, color: C.textSub }}>
        <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Filters row */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 200px", maxWidth: 300 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: C.textSub, pointerEvents: "none" }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по имени / телефону"
            style={{ ...filterInputStyle, paddingLeft: 32, width: "100%" }}
          />
        </div>

        {/* Salon filter */}
        <select value={filterSalon} onChange={e => setFilterSalon(e.target.value)}
          style={{ ...filterInputStyle, width: "auto", minWidth: 120, cursor: "pointer" }}>
          <option value="all" style={{ backgroundColor: C.card }}>Все салоны</option>
          {salons.map(s => (
            <option key={s.id} value={s.id} style={{ backgroundColor: C.card }}>{s.name}</option>
          ))}
        </select>

        {/* Status filter */}
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ ...filterInputStyle, width: "auto", minWidth: 140, cursor: "pointer" }}>
          <option value="all" style={{ backgroundColor: C.card }}>Все статусы</option>
          {Object.entries(STATUS_CFG).map(([val, cfg]) => (
            <option key={val} value={val} style={{ backgroundColor: C.card }}>{cfg.label}</option>
          ))}
        </select>

        {/* Date range */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ ...filterInputStyle, width: 140, colorScheme: "dark", cursor: "pointer" }} />
          <span style={{ color: C.textSub, fontSize: 12 }}>—</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ ...filterInputStyle, width: 140, colorScheme: "dark", cursor: "pointer" }} />
        </div>
      </div>

      {/* Table */}
      <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, overflow: "hidden" }}>
        {/* Header */}
        <div style={{
          display: "flex", backgroundColor: C.card, borderBottom: `1px solid ${C.border}`,
          padding: "0 12px", height: 36, alignItems: "center",
        }}>
          {columns.map(col => (
            <div key={col.id}
              onClick={sortable.has(col.id) ? () => toggleSort(col.id) : undefined}
              style={{
                width: col.w || undefined, flex: col.w ? `0 0 ${col.w}px` : 1,
                fontSize: 11, fontWeight: 600, color: C.textSub, textTransform: "uppercase",
                letterSpacing: "0.5px",
                cursor: sortable.has(col.id) ? "pointer" : "default",
                userSelect: "none",
              }}>
              {col.label}{sortArrow(col.id)}
            </div>
          ))}
        </div>

        {/* Rows */}
        {pageItems.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: C.textSub, fontSize: 13 }}>
            Нет записей
          </div>
        ) : pageItems.map((b, i) => {
          const bg = i % 2 === 0 ? C.card : C.gridBg;
          const sCfg = STATUS_CFG[b.status] || STATUS_CFG.booked;
          return (
            <div key={b.id} style={{
              display: "flex", padding: "0 12px", height: 42, alignItems: "center",
              backgroundColor: bg, borderBottom: `1px solid ${C.border}`,
              transition: "background 100ms",
            }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = "#1D2A3A"}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = bg}
            >
              <div style={{ flex: "0 0 100px", fontSize: 13, color: C.textMain }}>{formatDateRu(b.date)}</div>
              <div style={{ flex: 1, fontSize: 13, color: C.textMain, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{b.clientName}</div>
              <div style={{ flex: "0 0 140px", fontSize: 12, color: C.textSub }}>{b.clientPhone}</div>
              <div style={{ flex: "0 0 100px", fontSize: 12, color: C.textSub }}>{salonName(b)}</div>
              <div style={{ flex: "0 0 140px", fontSize: 12, color: C.textMain, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{serviceName(b)}</div>
              <div style={{ flex: "0 0 70px", fontSize: 12, color: C.textSub }}>{totalDuration(b)} мин</div>
              <div style={{ flex: "0 0 90px", fontSize: 13, color: C.accent, fontWeight: 600 }}>{(b.totalPrice || 0).toLocaleString("ru-RU")} ₸</div>
              <div style={{ flex: "0 0 150px" }}>
                <select value={b.status}
                  onChange={e => handleStatusChange(b.id, b.salonId, b.date, e.target.value)}
                  style={{
                    backgroundColor: sCfg.color + "22", border: `1px solid ${sCfg.color}55`,
                    borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 600,
                    color: sCfg.color, cursor: "pointer", outline: "none",
                  }}>
                  {Object.entries(STATUS_CFG).map(([val, cfg]) => (
                    <option key={val} value={val} style={{ backgroundColor: C.card, color: C.textMain }}>{cfg.label}</option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {sorted.length > PAGE_SIZE && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <span style={{ color: C.textSub, fontSize: 12, marginRight: 12 }}>
            Показано {Math.min(pageItems.length, PAGE_SIZE)} из {sorted.length}
          </span>
          <button disabled={safePage <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            style={{
              padding: "4px 10px", borderRadius: 4,
              border: `1px solid ${C.border}`, backgroundColor: "transparent",
              color: safePage <= 1 ? C.border : C.textSub, cursor: safePage <= 1 ? "default" : "pointer",
              fontSize: 12,
            }}>
            <ChevronLeft size={14} />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
            .reduce((acc, p, idx, arr) => {
              if (idx > 0 && p - arr[idx - 1] > 1) acc.push("...");
              acc.push(p);
              return acc;
            }, [])
            .map((p, i) =>
              p === "..." ? (
                <span key={`e${i}`} style={{ color: C.textSub, fontSize: 12 }}>…</span>
              ) : (
                <button key={p} onClick={() => setPage(p)} style={{
                  padding: "4px 10px", borderRadius: 4, fontSize: 12,
                  border: `1px solid ${p === safePage ? C.accent : C.border}`,
                  backgroundColor: p === safePage ? C.accent + "22" : "transparent",
                  color: p === safePage ? C.accent : C.textSub,
                  cursor: "pointer", fontWeight: p === safePage ? 600 : 400,
                }}>{p}</button>
              )
            )}
          <button disabled={safePage >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            style={{
              padding: "4px 10px", borderRadius: 4,
              border: `1px solid ${C.border}`, backgroundColor: "transparent",
              color: safePage >= totalPages ? C.border : C.textSub,
              cursor: safePage >= totalPages ? "default" : "pointer",
              fontSize: 12,
            }}>
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Dashboard Screen (STEP-11) ────────────────────────────────────────────

// Mini SVG chart components (no Recharts dependency)
function MiniBarChart({ data, barColor, width = 400, height = 180, label }) {
  if (!data.length) return <div style={{ color: C.textSub, fontSize: 12, padding: 20, textAlign: "center" }}>Нет данных за период</div>;
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const barW = Math.max(8, Math.min(32, (width - 40) / data.length - 4));
  const chartH = height - 30;
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
      {data.map((d, i) => {
        const x = 30 + i * ((width - 40) / data.length) + ((width - 40) / data.length - barW) / 2;
        const h = (d.value / maxVal) * (chartH - 10);
        return (
          <g key={i}>
            <rect x={x} y={chartH - h} width={barW} height={h} rx={3} fill={barColor} opacity={0.85}>
              <title>{d.label}: {d.value.toLocaleString("ru-RU")}{label ? ` ${label}` : ""}</title>
            </rect>
            <text x={x + barW / 2} y={height - 2} textAnchor="middle" fill={C.textSub} fontSize={9}>{d.label}</text>
          </g>
        );
      })}
      {/* Y axis line */}
      <line x1={28} y1={0} x2={28} y2={chartH} stroke={C.border} strokeWidth={1} />
    </svg>
  );
}

function MiniPieChart({ data, width = 200, height = 200 }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  if (!total) return <div style={{ color: C.textSub, fontSize: 12, padding: 20, textAlign: "center" }}>Нет данных</div>;
  const cx = width / 2, cy = height / 2, r = Math.min(cx, cy) - 20;
  let cumAngle = -Math.PI / 2;
  const nonZero = data.filter(d => d.value > 0);
  const slices = nonZero.map(d => {
    const angle = (d.value / total) * Math.PI * 2;
    const start = cumAngle;
    cumAngle += angle;
    // Single slice (full circle): SVG arc can't draw start==end, use two half-arcs
    if (nonZero.length === 1) {
      return { ...d, path: `M${cx},${cy - r} A${r},${r} 0 1,1 ${cx},${cy + r} A${r},${r} 0 1,1 ${cx},${cy - r} Z`, pct: 100 };
    }
    const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(start + angle), y2 = cy + r * Math.sin(start + angle);
    const large = angle > Math.PI ? 1 : 0;
    return { ...d, path: `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z`, pct: Math.round(d.value / total * 100) };
  });
  return (
    <svg width="100%" height={height + 30} viewBox={`0 0 ${width} ${height + 30}`} preserveAspectRatio="xMidYMid meet">
      {slices.map((s, i) => (
        <path key={i} d={s.path} fill={s.color} stroke={C.card} strokeWidth={2}>
          <title>{s.label}: {s.value} ({s.pct}%)</title>
        </path>
      ))}
      {/* Legend */}
      {slices.map((s, i) => (
        <g key={`l${i}`} transform={`translate(${i * (width / slices.length)}, ${height + 4})`}>
          <rect width={8} height={8} rx={2} fill={s.color} />
          <text x={12} y={8} fill={C.textSub} fontSize={9}>{s.label}</text>
        </g>
      ))}
    </svg>
  );
}

function MiniHBarChart({ data, barColor, width = 400, height = 160 }) {
  if (!data.length) return <div style={{ color: C.textSub, fontSize: 12, padding: 20, textAlign: "center" }}>Нет данных</div>;
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const rowH = Math.min(28, height / data.length);
  const labelW = 120;
  return (
    <svg width="100%" height={data.length * rowH + 4} viewBox={`0 0 ${width} ${data.length * rowH + 4}`} preserveAspectRatio="xMidYMid meet">
      {data.map((d, i) => {
        const barMax = width - labelW - 40;
        const w = (d.value / maxVal) * barMax;
        return (
          <g key={i}>
            <text x={labelW - 6} y={i * rowH + rowH / 2 + 4} textAnchor="end" fill={C.textSub} fontSize={10}>{d.label}</text>
            <rect x={labelW} y={i * rowH + 4} width={w} height={rowH - 8} rx={3} fill={barColor} opacity={0.85} />
            <text x={labelW + w + 6} y={i * rowH + rowH / 2 + 4} fill={C.textMain} fontSize={10}>{d.value}</text>
          </g>
        );
      })}
    </svg>
  );
}

function KpiRing({ pct, size = 40, color = C.accent }) {
  const r = (size - 6) / 2, c = size / 2, circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - Math.min(pct, 100) / 100);
  return (
    <svg width={size} height={size}>
      <circle cx={c} cy={c} r={r} fill="none" stroke={C.border} strokeWidth={3} />
      <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={3}
        strokeDasharray={circumference} strokeDashoffset={dashOffset}
        strokeLinecap="round" transform={`rotate(-90 ${c} ${c})`} />
    </svg>
  );
}

function DashboardScreen({ salons }) {
  const [allBookings, setAllBookings] = useState([]);
  const [loadingD, setLoadingD] = useState(true);
  const [dashSalon, setDashSalon] = useState("all");
  const [period, setPeriod] = useState("month");

  const loadAll = useCallback(async () => {
    setLoadingD(true);
    const keys = await Storage.list("spa-crm:bookings:");
    const arrays = await Promise.all(keys.map(k => Storage.get(k)));
    setAllBookings(arrays.flat().filter(Boolean));
    setLoadingD(false);
  }, []);
  useEffect(() => { loadAll(); }, [loadAll]);

  // Period date range
  const today = toDateStr(new Date());
  const dateRange = (() => {
    if (period === "today") return { from: today, to: today };
    if (period === "week") return { from: toDateStr(addDays(new Date(), -6)), to: toDateStr(addDays(new Date(), 1)) };
    // month — show entire current month (including future days)
    const d = new Date();
    const y = d.getFullYear(), m = d.getMonth() + 1;
    const from = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return { from, to };
  })();

  // Filter bookings
  const filtered = allBookings.filter(b => {
    if (dashSalon !== "all" && b.salonId !== dashSalon) return false;
    if (b.date < dateRange.from || b.date > dateRange.to) return false;
    return true;
  });

  // KPI helpers
  const computeKpi = (bookings, salonFilter) => {
    const bks = salonFilter ? bookings.filter(b => b.salonId === salonFilter) : bookings;
    const active = bks.filter(b => b.status !== "cancelled_refund" && b.status !== "cancelled_no_refund");
    const paid = bks.filter(b => b.status === "completed" || b.status === "no-show" || b.status === "cancelled_no_refund");
    const totalBookings = active.length;
    const totalClients = active.reduce((a, b) => a + (b.clientCount || 1), 0);
    const revenue = paid.reduce((a, b) => a + (b.totalPrice || 0), 0);
    const avgCheck = paid.length > 0 ? Math.round(revenue / paid.length) : 0;

    // Room & therapist utilization — compute per salon then aggregate (only active bookings)
    const targetSalons = salonFilter ? salons.filter(s => s.id === salonFilter) : salons;
    let roomBusyMins = 0, roomTotalMins = 0;
    let therBusyMins = 0, therTotalMins = 0;

    for (const sal of targetSalons) {
      const salBks = active.filter(b => b.salonId === sal.id);
      const daySet = new Set(salBks.map(b => b.date));
      const daysCount = daySet.size;
      if (daysCount === 0) continue; // no bookings for this salon — skip capacity
      const wMins = timeToMins(sal.workEnd) - timeToMins(sal.workStart);
      roomTotalMins += sal.rooms.length * wMins * daysCount;
      therTotalMins += ((sal.therapistCount || 1) + (sal.hasPeeling ? (sal.peelingMastersMax || 2) : 0)) * wMins * daysCount;

      for (const b of salBks) {
        for (const seg of (b.segments || [])) {
          const dur = timeToMins(seg.endTime) - timeToMins(seg.startTime);
          if (seg.resourceType === "room" && seg.roomId) roomBusyMins += dur;
          therBusyMins += (seg.therapistCount || 0) * dur;
        }
      }
    }

    const roomPct = roomTotalMins > 0 ? Math.round(roomBusyMins / roomTotalMins * 100) : 0;
    const therPct = therTotalMins > 0 ? Math.round(therBusyMins / therTotalMins * 100) : 0;

    const refundedBks = bks.filter(b => b.status === "cancelled_refund");
    const refunded = refundedBks.reduce((a, b) => a + (b.totalPrice || 0), 0);
    const refundedCount = refundedBks.reduce((a, b) => a + (b.clientCount || 1), 0);
    const keptBks = bks.filter(b => b.status === "cancelled_no_refund");
    const keptDeposit = keptBks.reduce((a, b) => a + (b.totalPrice || 0), 0);
    const keptCount = keptBks.reduce((a, b) => a + (b.clientCount || 1), 0);

    return { totalBookings, totalClients, revenue, avgCheck, roomPct, therPct, refunded, refundedCount, keptDeposit, keptCount };
  };

  const kpi = (() => {
    if (dashSalon !== "all" || salons.length < 2) return computeKpi(filtered);
    // "Оба" — average of two salons
    const perSalon = salons.map(s => computeKpi(filtered, s.id));
    const n = perSalon.length;
    return {
      totalBookings: Math.round(perSalon.reduce((a, k) => a + k.totalBookings, 0) / n),
      totalClients:  Math.round(perSalon.reduce((a, k) => a + k.totalClients, 0) / n),
      revenue:       Math.round(perSalon.reduce((a, k) => a + k.revenue, 0) / n),
      avgCheck:      Math.round(perSalon.reduce((a, k) => a + k.avgCheck, 0) / n),
      roomPct:       Math.round(perSalon.reduce((a, k) => a + k.roomPct, 0) / n),
      therPct:       Math.round(perSalon.reduce((a, k) => a + k.therPct, 0) / n),
      refunded:      Math.round(perSalon.reduce((a, k) => a + k.refunded, 0) / n),
      refundedCount: Math.round(perSalon.reduce((a, k) => a + k.refundedCount, 0) / n),
      keptDeposit:   Math.round(perSalon.reduce((a, k) => a + k.keptDeposit, 0) / n),
      keptCount:     Math.round(perSalon.reduce((a, k) => a + k.keptCount, 0) / n),
    };
  })();

  // Chart 1: Revenue by day
  const revenueByDay = (() => {
    const map = {};
    filtered.filter(b => b.status === "completed" || b.status === "no-show" || b.status === "cancelled_no_refund").forEach(b => {
      const key = b.date.slice(5); // MM-DD
      map[key] = (map[key] || 0) + (b.totalPrice || 0);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({ label: k.replace("-", "."), value: v }));
  })();

  // Chart 2: Procedure type distribution
  const typeDist = (() => {
    const counts = { massage: 0, sauna: 0, peeling: 0, combo: 0 };
    filtered.forEach(b => {
      if (b.bookingType === "combo") { counts.combo++; return; }
      const cat = b.segments?.[0]?.resourceType === "sauna" ? "sauna"
        : b.segments?.[0]?.resourceType === "peeling" ? "peeling" : "massage";
      counts[cat]++;
    });
    return [
      { label: "Массаж", value: counts.massage, color: "#2D6A4F" },
      { label: "Сауна", value: counts.sauna, color: "#B85C38" },
      { label: "Пиллинг", value: counts.peeling, color: "#7B68AE" },
      { label: "Комбо", value: counts.combo, color: "#D4A84B" },
    ];
  })();

  // Chart 3: Load by hour
  const loadByHour = (() => {
    const hourMap = {};
    const dayCounts = {};
    filtered.forEach(b => {
      if (!dayCounts[b.date]) dayCounts[b.date] = true;
      for (const seg of (b.segments || [])) {
        const sM = timeToMins(seg.startTime), eM = timeToMins(seg.endTime);
        for (let h = Math.floor(sM / 60); h < Math.ceil(eM / 60); h++) {
          const key = `${String(h).padStart(2, "0")}:00`;
          hourMap[key] = (hourMap[key] || 0) + (seg.therapistCount || 0);
        }
      }
    });
    const days = Math.max(Object.keys(dayCounts).length, 1);
    return Object.entries(hourMap).sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({ label: k, value: Math.round(v / days * 10) / 10 }));
  })();

  // Chart 4: Top 5 procedures
  const topProcs = (() => {
    const counts = {};
    filtered.forEach(b => {
      for (const seg of (b.segments || [])) {
        if (seg.procedureName) counts[seg.procedureName] = (counts[seg.procedureName] || 0) + 1;
      }
    });
    return Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 5)
      .map(([k, v]) => ({ label: k.length > 18 ? k.slice(0, 18) + "…" : k, value: v }));
  })();

  // Comparison table for "both" mode
  const comparison = dashSalon === "all" && salons.length >= 2
    ? salons.map(s => ({ name: s.name, ...computeKpi(filtered, s.id) }))
    : null;

  const pillBtn = (active) => ({
    padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 500,
    border: active ? "none" : `1px solid ${C.border}`,
    backgroundColor: active ? C.accent : "transparent",
    color: active ? C.bg : C.textSub,
    cursor: "pointer",
  });

  const cardStyle = {
    backgroundColor: C.card, borderRadius: 8, padding: 16,
    display: "flex", flexDirection: "column", gap: 4,
  };

  const chartBox = {
    backgroundColor: C.card, borderRadius: 8, padding: 16,
  };

  if (loadingD) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 60, color: C.textSub }}>
        <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Switchers */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {/* Salon pills */}
        {salons.map(s => (
          <button key={s.id} onClick={() => setDashSalon(s.id)}
            style={pillBtn(dashSalon === s.id)}>{s.name}</button>
        ))}
        <button onClick={() => setDashSalon("all")} style={pillBtn(dashSalon === "all")}>Оба</button>

        <div style={{ flex: 1 }} />

        {/* Period pills */}
        {[["today", "Сегодня"], ["week", "Неделя"], ["month", "Месяц"]].map(([v, l]) => (
          <button key={v} onClick={() => setPeriod(v)} style={pillBtn(period === v)}>{l}</button>
        ))}
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.textMain }}>{kpi.totalBookings}</div>
          <div style={{ fontSize: 11, color: C.textSub }}>Всего записей</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.textMain }}>{kpi.totalClients}</div>
          <div style={{ fontSize: 11, color: C.textSub }}>Всего клиентов</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.textMain }}>{kpi.revenue.toLocaleString("ru-RU")} ₸</div>
          <div style={{ fontSize: 11, color: C.textSub }}>Выручка</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.textMain }}>{kpi.avgCheck.toLocaleString("ru-RU")} ₸</div>
          <div style={{ fontSize: 11, color: C.textSub }}>Средний чек</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#F87171" }}>{kpi.refunded.toLocaleString("ru-RU")} ₸</div>
            <div style={{ fontSize: 13, color: C.textSub }}>{kpi.refundedCount} чел.</div>
          </div>
          <div style={{ fontSize: 11, color: C.textSub }}>Вернули за бронь</div>
        </div>
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#34D399" }}>{kpi.keptDeposit.toLocaleString("ru-RU")} ₸</div>
            <div style={{ fontSize: 13, color: C.textSub }}>{kpi.keptCount} чел.</div>
          </div>
          <div style={{ fontSize: 11, color: C.textSub }}>Не вернули за бронь</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
        <div style={{ ...cardStyle, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <KpiRing pct={kpi.roomPct} color="#2D6A4F" />
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: C.textMain }}>{kpi.roomPct}%</div>
            <div style={{ fontSize: 11, color: C.textSub }}>Загрузка кабинок</div>
          </div>
        </div>
        <div style={{ ...cardStyle, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <KpiRing pct={kpi.therPct} color={C.accent} />
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: C.textMain }}>{kpi.therPct}%</div>
            <div style={{ fontSize: 11, color: C.textSub }}>Загрузка мастеров</div>
          </div>
        </div>
      </div>

      {/* Charts 2×2 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={chartBox}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.textMain, marginBottom: 10 }}>Выручка по дням</div>
          <MiniBarChart data={revenueByDay} barColor={C.accent} label="₸" />
        </div>
        <div style={chartBox}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.textMain, marginBottom: 10 }}>Типы процедур</div>
          <MiniPieChart data={typeDist} />
        </div>
        <div style={chartBox}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.textMain, marginBottom: 10 }}>Загрузка по часам (ср. мастеров)</div>
          <MiniBarChart data={loadByHour} barColor="#2D6A4F" />
        </div>
        <div style={chartBox}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.textMain, marginBottom: 10 }}>Топ процедур</div>
          <MiniHBarChart data={topProcs} barColor={C.accent} />
        </div>
      </div>

      {/* Comparison table (both salons) */}
      {comparison && (
        <div style={{ ...chartBox }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.textMain, marginBottom: 12 }}>Сравнение салонов</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "6px 10px", color: C.textSub, fontSize: 11, textTransform: "uppercase", borderBottom: `1px solid ${C.border}` }}>Метрика</th>
                {comparison.map(s => (
                  <th key={s.name} style={{ textAlign: "right", padding: "6px 10px", color: C.textSub, fontSize: 11, textTransform: "uppercase", borderBottom: `1px solid ${C.border}` }}>{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Записей", key: "totalBookings", fmt: v => v },
                { label: "Выручка", key: "revenue", fmt: v => v.toLocaleString("ru-RU") + " ₸" },
                { label: "Ср. чек", key: "avgCheck", fmt: v => v.toLocaleString("ru-RU") + " ₸" },
                { label: "Загр. кабинок", key: "roomPct", fmt: v => v + "%" },
                { label: "Загр. мастеров", key: "therPct", fmt: v => v + "%" },
                { label: "Вернули за бронь", key: "refunded", fmt: (v, row) => v.toLocaleString("ru-RU") + " ₸ (" + (row.refundedCount || 0) + " чел.)" },
                { label: "Не вернули за бронь", key: "keptDeposit", fmt: (v, row) => v.toLocaleString("ru-RU") + " ₸ (" + (row.keptCount || 0) + " чел.)" },
              ].map(row => {
                const vals = comparison.map(s => s[row.key]);
                const best = Math.max(...vals);
                return (
                  <tr key={row.key}>
                    <td style={{ padding: "8px 10px", color: C.textSub, borderBottom: `1px solid ${C.border}` }}>{row.label}</td>
                    {comparison.map((_s, i) => (
                      <td key={i} style={{
                        textAlign: "right", padding: "8px 10px",
                        color: vals[i] === best && best > 0 ? C.accent : C.textMain,
                        fontWeight: vals[i] === best && best > 0 ? 600 : 400,
                        borderBottom: `1px solid ${C.border}`,
                      }}>{row.fmt(vals[i], comparison[i])}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Workers Screen (Admin only) ─────────────────────────────────────────────

function WorkersScreen({ onShowToast, currentUser }) {
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [newRole, setNewRole] = useState("worker");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userLogs, setUserLogs] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [editName, setEditName] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState("worker");
  const [showEditPwd, setShowEditPwd] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const users = await UserStorage.getUsers();
    setAllUsers(users);
    setLoading(false);
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleAdd = async () => {
    if (!name.trim() || !login.trim() || !password.trim()) {
      if (onShowToast) onShowToast("Заполните все поля");
      return;
    }
    const users = await UserStorage.getUsers();
    if (users.some(u => u.login === login.trim())) {
      if (onShowToast) onShowToast("Логин уже занят");
      return;
    }
    const result = await UserStorage.createUser(login.trim(), password, name.trim(), newRole);
    if (result.error) {
      if (onShowToast) onShowToast("Ошибка: " + result.error);
      return;
    }
    setName(""); setLogin(""); setPassword(""); setNewRole("worker");
    setShowAdd(false);
    await loadUsers();
    if (onShowToast) onShowToast("Аккаунт создан");
  };

  const handleDelete = async (id) => {
    if (currentUser && id === currentUser.id) {
      if (onShowToast) onShowToast("Нельзя удалить свой аккаунт");
      setConfirmDeleteId(null);
      return;
    }
    const users = await UserStorage.getUsers();
    const target = users.find(u => u.id === id);
    if (target && target.role === "admin") {
      const adminCount = users.filter(u => u.role === "admin").length;
      if (adminCount <= 1) {
        if (onShowToast) onShowToast("Нельзя удалить последнего администратора");
        setConfirmDeleteId(null);
        return;
      }
    }
    await UserStorage.deleteUser(id);
    setConfirmDeleteId(null);
    await loadUsers();
    if (onShowToast) onShowToast("Аккаунт удалён");
  };

  const startEdit = async (u) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditPassword("");
    setEditRole(u.role);
    setShowEditPwd(false);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) { if (onShowToast) onShowToast("Имя обязательно"); return; }
    const users = await UserStorage.getUsers();
    // Protect last admin from role change
    if (editingUser.role === "admin" && editRole !== "admin") {
      const adminCount = users.filter(u => u.role === "admin").length;
      if (adminCount <= 1) {
        if (onShowToast) onShowToast("Нельзя убрать роль у последнего администратора");
        return;
      }
    }
    await UserStorage.saveUser({ ...editingUser, name: editName.trim(), role: editRole });
    setEditingUser(null);
    await loadUsers();
    if (onShowToast) onShowToast("Аккаунт обновлён");
  };

  const openUserLogs = async (user) => {
    setSelectedUser(user);
    const logs = await UserStorage.getLogs();
    setUserLogs(logs.filter(l => l.userId === user.id).sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
  };

  // Detail view: user logs
  if (selectedUser) {
    return (
      <div>
        <button onClick={() => setSelectedUser(null)} style={{
          background: "none", border: "none", color: C.accent, cursor: "pointer",
          fontSize: 14, marginBottom: 16, display: "flex", alignItems: "center", gap: 6,
        }}>
          <ChevronLeft size={16} /> Назад к списку
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <h2 style={{ color: C.textMain, fontSize: 18, fontWeight: 600, margin: 0 }}>{selectedUser.name}</h2>
          <span style={{
            padding: "2px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            backgroundColor: selectedUser.role === "admin" ? `${C.accent}22` : "#34D39922",
            color: selectedUser.role === "admin" ? C.accent : "#34D399",
          }}>{selectedUser.role === "admin" ? "Админ" : "Работник"}</span>
        </div>
        <p style={{ color: C.textSub, fontSize: 13, marginBottom: 20 }}>Логин: {selectedUser.login} · Создан: {new Date(selectedUser.createdAt).toLocaleDateString("ru-RU")}</p>

        <h3 style={{ color: C.textMain, fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Журнал действий ({userLogs.length})</h3>
        {userLogs.length === 0 ? (
          <div style={{ color: C.textSub, fontSize: 13, padding: 20, textAlign: "center" }}>Нет действий</div>
        ) : (
          <div style={{ borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ backgroundColor: C.gridBg }}>
                  <th style={{ padding: "10px 12px", textAlign: "left", color: C.textSub, fontWeight: 500 }}>Дата/время</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", color: C.textSub, fontWeight: 500 }}>Действие</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", color: C.textSub, fontWeight: 500 }}>Клиент</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", color: C.textSub, fontWeight: 500 }}>Дата записи</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", color: C.textSub, fontWeight: 500 }}>Детали</th>
                </tr>
              </thead>
              <tbody>
                {userLogs.map(log => (
                  <tr key={log.id} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ padding: "10px 12px", color: C.textMain }}>{new Date(log.timestamp).toLocaleString("ru-RU")}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{
                        padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                        backgroundColor: log.action === "create" ? "#34D39922" : log.action === "delete" ? "#EF444422" : "#FBBF2422",
                        color: log.action === "create" ? "#34D399" : log.action === "delete" ? "#F87171" : "#FBBF24",
                      }}>
                        {log.action === "create" ? "Создание" : log.action === "delete" ? "Удаление" : "Изменение"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", color: C.textMain }}>{log.clientName || "—"}</td>
                    <td style={{ padding: "10px 12px", color: C.textSub }}>{log.targetDate || "—"} {log.targetTime || ""}</td>
                    <td style={{ padding: "10px 12px", color: C.textSub, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.details || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  const inputStyle = {
    width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 14,
    border: `1px solid ${C.border}`, backgroundColor: C.gridBg,
    color: C.textMain, outline: "none",
  };

  const roleToggle = (value, onChange) => (
    <div style={{ display: "flex", gap: 4, padding: 3, borderRadius: 8, backgroundColor: C.gridBg, border: `1px solid ${C.border}` }}>
      {[{ v: "worker", l: "Работник" }, { v: "admin", l: "Администратор" }].map(r => (
        <button key={r.v} type="button" onClick={() => onChange(r.v)} style={{
          flex: 1, padding: "6px 12px", borderRadius: 6, border: "none",
          fontSize: 12, fontWeight: value === r.v ? 700 : 400, cursor: "pointer",
          backgroundColor: value === r.v ? C.accent : "transparent",
          color: value === r.v ? C.bg : C.textSub,
        }}>{r.l}</button>
      ))}
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ color: C.textMain, fontSize: 18, fontWeight: 600, margin: 0 }}>Аккаунты</h2>
        <button onClick={() => setShowAdd(!showAdd)} style={{
          display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8,
          border: "none", backgroundColor: C.accent, color: C.bg,
          fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}>
          <UserPlus size={15} /> Добавить
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div style={{ padding: 20, borderRadius: 12, marginBottom: 20, backgroundColor: C.card, border: `1px solid ${C.border}` }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, color: C.textSub, marginBottom: 4 }}>Имя</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Имя Фамилия" style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, color: C.textSub, marginBottom: 4 }}>Логин</label>
              <input value={login} onChange={e => setLogin(e.target.value)} placeholder="worker1" style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, color: C.textSub, marginBottom: 4 }}>Пароль</label>
              <input value={password} onChange={e => setPassword(e.target.value)} placeholder="pass123" style={inputStyle} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 12, color: C.textSub, marginBottom: 4 }}>Роль</label>
            {roleToggle(newRole, setNewRole)}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleAdd} style={{
              padding: "8px 20px", borderRadius: 8, border: "none",
              backgroundColor: C.accent, color: C.bg, fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>Сохранить</button>
            <button onClick={() => { setShowAdd(false); setName(""); setLogin(""); setPassword(""); setNewRole("worker"); }} style={{
              padding: "8px 20px", borderRadius: 8, border: `1px solid ${C.border}`,
              backgroundColor: "transparent", color: C.textSub, fontSize: 13, cursor: "pointer",
            }}>Отмена</button>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingUser && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 300, backgroundColor: "rgba(0,0,0,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ width: 400, padding: 28, borderRadius: 12, backgroundColor: C.card, border: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: C.textMain }}>Редактировать аккаунт</h3>
              <button onClick={() => setEditingUser(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textSub }}><X size={18} /></button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: C.textSub, marginBottom: 4 }}>Логин (не меняется)</label>
              <input disabled value={editingUser.login} style={{ ...inputStyle, opacity: 0.5, cursor: "not-allowed" }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: C.textSub, marginBottom: 4 }}>Имя</label>
              <input value={editName} onChange={e => setEditName(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, color: C.textSub, marginBottom: 4 }}>Пароль</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showEditPwd ? "text" : "password"}
                  value={editPassword}
                  onChange={e => setEditPassword(e.target.value)}
                  style={{ ...inputStyle, paddingRight: 40 }}
                />
                <button type="button" onClick={() => setShowEditPwd(!showEditPwd)} style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", color: C.textSub, padding: 4,
                }}>
                  {showEditPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, color: C.textSub, marginBottom: 4 }}>Роль</label>
              {roleToggle(editRole, setEditRole)}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleSaveEdit} style={{
                flex: 1, padding: "10px 0", borderRadius: 8, border: "none",
                backgroundColor: C.accent, color: C.bg, fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>Сохранить</button>
              <button onClick={() => setEditingUser(null)} style={{
                flex: 1, padding: "10px 0", borderRadius: 8, border: `1px solid ${C.border}`,
                backgroundColor: "transparent", color: C.textSub, fontSize: 13, cursor: "pointer",
              }}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ textAlign: "center", color: C.textSub, padding: 40 }}>Загрузка…</div>
      ) : allUsers.length === 0 ? (
        <div style={{ textAlign: "center", color: C.textSub, padding: 40, fontSize: 13 }}>Нет аккаунтов</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {allUsers.map(w => {
            const isSelf = currentUser && w.id === currentUser.id;
            return (
              <div key={w.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 18px", borderRadius: 10,
                backgroundColor: C.card, border: `1px solid ${isSelf ? C.accent + "66" : C.border}`,
                cursor: "pointer",
              }} onClick={() => openUserLogs(w)}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: C.textMain, fontWeight: 600, fontSize: 14 }}>{w.name}</span>
                      <span style={{
                        padding: "1px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                        backgroundColor: w.role === "admin" ? `${C.accent}22` : "#34D39922",
                        color: w.role === "admin" ? C.accent : "#34D399",
                      }}>{w.role === "admin" ? "Админ" : "Работник"}</span>
                      {isSelf && <span style={{ fontSize: 11, color: C.textSub }}>(вы)</span>}
                    </div>
                    <div style={{ color: C.textSub, fontSize: 12 }}>@{w.login} · {new Date(w.createdAt).toLocaleDateString("ru-RU")}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button onClick={(e) => { e.stopPropagation(); startEdit(w); }} style={{
                    background: "none", border: "none", cursor: "pointer", color: C.textSub, padding: 4,
                  }} title="Редактировать">
                    <Settings size={14} />
                  </button>
                  {confirmDeleteId === w.id ? (
                    <>
                      <span style={{ color: C.textSub, fontSize: 12 }}>Удалить?</span>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(w.id); }} style={{
                        padding: "4px 12px", borderRadius: 6, border: "none",
                        backgroundColor: "#EF4444", color: "#fff", fontSize: 12, cursor: "pointer",
                      }}>Да</button>
                      <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }} style={{
                        padding: "4px 12px", borderRadius: 6, border: `1px solid ${C.border}`,
                        backgroundColor: "transparent", color: C.textSub, fontSize: 12, cursor: "pointer",
                      }}>Нет</button>
                    </>
                  ) : (
                    <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(w.id); }} style={{
                      background: "none", border: "none", cursor: "pointer", color: C.textSub, padding: 4,
                    }} title="Удалить">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Logs Screen (Admin only) ────────────────────────────────────────────────

function LogsScreen() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterUser, setFilterUser] = useState("all");
  const [filterAction, setFilterAction] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [workers, setWorkers] = useState([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [allLogs, allUsers] = await Promise.all([UserStorage.getLogs(), UserStorage.getUsers()]);
      setLogs(allLogs.sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
      setWorkers(allUsers.filter(u => u.role === "worker"));
      setLoading(false);
    })();
  }, []);

  const filtered = logs.filter(l => {
    if (filterUser !== "all" && l.userId !== filterUser) return false;
    if (filterAction !== "all" && l.action !== filterAction) return false;
    if (dateFrom && l.timestamp < dateFrom) return false;
    if (dateTo && l.timestamp.slice(0, 10) > dateTo) return false;
    return true;
  });

  const selectStyle = {
    padding: "8px 12px", borderRadius: 8, fontSize: 13,
    border: `1px solid ${C.border}`, backgroundColor: C.gridBg,
    color: C.textMain, outline: "none", cursor: "pointer",
  };

  return (
    <div>
      <h2 style={{ color: C.textMain, fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Логи действий</h2>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <select value={filterUser} onChange={e => setFilterUser(e.target.value)} style={selectStyle}>
          <option value="all" style={{ backgroundColor: C.card }}>Все работники</option>
          {workers.map(w => (
            <option key={w.id} value={w.id} style={{ backgroundColor: C.card }}>{w.name}</option>
          ))}
        </select>
        <select value={filterAction} onChange={e => setFilterAction(e.target.value)} style={selectStyle}>
          <option value="all" style={{ backgroundColor: C.card }}>Все действия</option>
          <option value="create" style={{ backgroundColor: C.card }}>Создание</option>
          <option value="edit" style={{ backgroundColor: C.card }}>Изменение</option>
          <option value="delete" style={{ backgroundColor: C.card }}>Удаление</option>
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          style={{ ...selectStyle, cursor: "text" }} />
        <span style={{ color: C.textSub }}>—</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          style={{ ...selectStyle, cursor: "text" }} />
        <span style={{ color: C.textSub, fontSize: 13 }}>Найдено: {filtered.length}</span>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", color: C.textSub, padding: 40 }}>Загрузка…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", color: C.textSub, padding: 40, fontSize: 13 }}>Нет записей в логах</div>
      ) : (
        <div style={{ borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: C.gridBg }}>
                <th style={{ padding: "10px 12px", textAlign: "left", color: C.textSub, fontWeight: 500 }}>Дата/время</th>
                <th style={{ padding: "10px 12px", textAlign: "left", color: C.textSub, fontWeight: 500 }}>Работник</th>
                <th style={{ padding: "10px 12px", textAlign: "left", color: C.textSub, fontWeight: 500 }}>Действие</th>
                <th style={{ padding: "10px 12px", textAlign: "left", color: C.textSub, fontWeight: 500 }}>Клиент</th>
                <th style={{ padding: "10px 12px", textAlign: "left", color: C.textSub, fontWeight: 500 }}>Дата записи</th>
                <th style={{ padding: "10px 12px", textAlign: "left", color: C.textSub, fontWeight: 500 }}>Детали</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map(log => (
                <tr key={log.id} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: "10px 12px", color: C.textMain, whiteSpace: "nowrap" }}>{new Date(log.timestamp).toLocaleString("ru-RU")}</td>
                  <td style={{ padding: "10px 12px", color: C.textMain }}>{log.userName}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                      backgroundColor: log.action === "create" ? "#34D39922" : log.action === "delete" ? "#EF444422" : "#FBBF2422",
                      color: log.action === "create" ? "#34D399" : log.action === "delete" ? "#F87171" : "#FBBF24",
                    }}>
                      {log.action === "create" ? "Создание" : log.action === "delete" ? "Удаление" : "Изменение"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", color: C.textMain }}>{log.clientName || "—"}</td>
                  <td style={{ padding: "10px 12px", color: C.textSub }}>{log.targetDate || "—"} {log.targetTime || ""}</td>
                  <td style={{ padding: "10px 12px", color: C.textSub, maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.details || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

function App() {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);
  const showToast = useCallback((msg) => setToastMsg(msg), []);

  // Global state
  const [salons, setSalons] = useState([]);
  const [activeSalonId, setActiveSalonId] = useState("salon-1");
  const [procedures, setProcedures] = useState([]);
  const [combos, setCombos] = useState([]);
  const [bookings, setBookings] = useState([]);

  const isAdmin = currentUser?.role === "admin";
  const defaultTab = isAdmin ? "schedule" : "schedule";
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Role-based tab guard
  const workerTabs = new Set(["schedule", "journal"]);
  const handleTabChange = useCallback((tab) => {
    if (currentUser?.role === "worker" && !workerTabs.has(tab)) {
      setActiveTab("schedule");
      return;
    }
    setActiveTab(tab);
  }, [currentUser]);

  // Load data for active salon
  const loadSalonData = useCallback(async (salonId) => {
    const ym = currentYearMonth();
    const [procs, cmbs, bkgs] = await Promise.all([
      Storage.get(KEYS.procedures(salonId)),
      Storage.get(KEYS.combos(salonId)),
      Storage.get(KEYS.bookings(salonId, ym)),
    ]);
    setProcedures(procs || []);
    setCombos(cmbs || []);
    setBookings(bkgs || []);
  }, []);

  // Initial load — check auth + init default admin
  useEffect(() => {
    (async () => {
      await UserStorage.initDefaultAdmin();
      const savedUser = await UserStorage.getCurrentUser();
      if (savedUser) {
        setCurrentUser(savedUser);
      }

      const savedSalons = await Storage.get(KEYS.salons);
      if (!savedSalons || savedSalons.length === 0) {
        setNeedsOnboarding(true);
      } else {
        setSalons(savedSalons);
        const firstId = savedSalons[0].id;
        setActiveSalonId(firstId);
        await loadSalonData(firstId);
      }

      setLoading(false);
    })();
  }, [loadSalonData]);

  const handleLogin = useCallback((user) => {
    setCurrentUser({ id: user.id, name: user.name, login: user.login, role: user.role });
    if (user.role === "worker") setActiveTab("schedule");
  }, []);

  const handleLogout = useCallback(async () => {
    await UserStorage.clearCurrentUser();
    setCurrentUser(null);
  }, []);

  const handleOnboardingComplete = useCallback(async (savedSalons) => {
    setSalons(savedSalons);
    const firstId = savedSalons[0].id;
    setActiveSalonId(firstId);
    await loadSalonData(firstId);
    setNeedsOnboarding(false);
    setActiveTab("schedule");
  }, [loadSalonData]);

  const handleSalonChange = useCallback(async (salonId) => {
    setActiveSalonId(salonId);
    await loadSalonData(salonId);
  }, [loadSalonData]);

  if (loading) return <LoadingScreen />;

  // Auth gate
  if (!currentUser) return <LoginScreen onLogin={handleLogin} />;

  if (needsOnboarding && isAdmin) return <OnboardingWizard onComplete={handleOnboardingComplete} />;
  if (needsOnboarding && !isAdmin) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", backgroundColor: C.bg, color: C.textSub, fontFamily: "system-ui, sans-serif", flexDirection: "column", gap: 16 }}>
      <Lock size={32} color={C.textSub} />
      <span style={{ fontSize: 14 }}>Система ещё не настроена. Обратитесь к администратору.</span>
      <button onClick={handleLogout} style={{ padding: "8px 20px", borderRadius: 8, border: "none", backgroundColor: C.accent, color: C.bg, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Выйти</button>
    </div>
  );

  // Build tabs based on role
  const visibleTabs = isAdmin ? [
    { id: "schedule",  label: "Расписание",    icon: Calendar },
    { id: "services",  label: "Услуги и цены", icon: BookOpen },
    { id: "dashboard", label: "Дашборд",       icon: LayoutDashboard },
    { id: "journal",   label: "Журнал",        icon: BookOpen },
    { id: "logs",      label: "Логи",          icon: ClipboardList },
    { id: "workers",   label: "Работники",     icon: Users },
    { id: "settings",  label: "Настройки",     icon: Settings },
  ] : [
    { id: "schedule",  label: "Расписание",    icon: Calendar },
    { id: "journal",   label: "Журнал",        icon: BookOpen },
  ];

  return (
    <div style={{
      backgroundColor: C.bg,
      minHeight: "100vh",
      minWidth: 1024,
      color: C.textMain,
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 13,
      lineHeight: 1.5,
    }}>
      {/* Header with user info */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 56, zIndex: 50,
        backgroundColor: C.header, borderBottom: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Gem size={22} color={C.accent} />
          <span style={{ color: C.textMain, fontWeight: 600, fontSize: 16, letterSpacing: "0.5px" }}>SPA CRM</span>
        </div>

        {/* Salon switcher */}
        <div style={{ display: "flex", gap: 8 }}>
          {salons.map((salon) => {
            const isActive = salon.id === activeSalonId;
            return (
              <button key={salon.id} onClick={() => handleSalonChange(salon.id)} style={{
                padding: isActive ? "8px 24px" : "6px 16px", borderRadius: 8,
                border: isActive ? `2px solid ${C.accent}` : `1px solid ${C.accent}55`,
                backgroundColor: isActive ? C.accent : "transparent",
                color: isActive ? C.bg : C.accent,
                fontWeight: isActive ? 700 : 500, fontSize: isActive ? 15 : 13,
                cursor: "pointer", transition: "all 150ms",
                boxShadow: isActive ? `0 0 12px ${C.accent}44` : "none",
              }}>{salon.name}</button>
            );
          })}
        </div>

        {/* User info + logout */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: C.textMain, fontSize: 13, fontWeight: 600 }}>{currentUser.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
              {isAdmin && <Shield size={10} color={C.accent} />}
              <span style={{ color: C.textSub, fontSize: 11 }}>{isAdmin ? "Админ" : "Работник"}</span>
            </div>
          </div>
          <button onClick={handleLogout} title="Выйти" style={{
            background: "none", border: `1px solid ${C.border}`, borderRadius: 8,
            padding: "6px 10px", cursor: "pointer", color: C.textSub,
            display: "flex", alignItems: "center", gap: 4,
          }}>
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* Tab bar — role-aware */}
      <nav style={{
        position: "fixed", top: 56, left: 0, right: 0, height: 44, zIndex: 49,
        backgroundColor: C.header, borderBottom: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", padding: "0 24px", gap: 0,
      }}>
        {visibleTabs.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button key={id} onClick={() => handleTabChange(id)} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "0 16px", height: "100%",
              background: "none", border: "none",
              borderBottom: isActive ? `2px solid ${C.accent}` : "2px solid transparent",
              color: isActive ? C.accent : C.textSub,
              fontSize: 14, fontWeight: isActive ? 600 : 400,
              cursor: "pointer", transition: "all 150ms", letterSpacing: "0.3px",
            }}>
              <Icon size={15} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Content area */}
      <main style={{
        marginTop: 100,
        padding: 24,
        maxWidth: 1400,
        margin: "100px auto 0",
        overflowY: "auto",
      }}>
        {activeTab === "settings" && isAdmin && (
          <SettingsScreen
            salons={salons}
            onSalonsChange={setSalons}
            onShowToast={showToast}
            onReset={() => setNeedsOnboarding(true)}
            onImportComplete={async (importedSalons) => {
              setSalons(importedSalons);
              const firstId = importedSalons[0].id;
              setActiveSalonId(firstId);
              await loadSalonData(firstId);
            }}
            currentUser={currentUser}
          />
        )}
        {activeTab === "services" && isAdmin && (
          <ServicesScreen
            procedures={procedures}
            onProceduresChange={setProcedures}
            combos={combos}
            onCombosChange={setCombos}
            activeSalonId={activeSalonId}
            salons={salons}
            onSalonsChange={setSalons}
            onShowToast={showToast}
          />
        )}
        {activeTab === "schedule" && (
          <ScheduleScreen
            activeSalonId={activeSalonId}
            salons={salons}
            procedures={procedures}
            combos={combos}
            onShowToast={showToast}
            currentUser={currentUser}
          />
        )}
        {activeTab === "journal" && (
          <JournalScreen
            salons={salons}
            onShowToast={showToast}
            currentUser={currentUser}
          />
        )}
        {activeTab === "dashboard" && isAdmin && (
          <DashboardScreen salons={salons} />
        )}
        {activeTab === "logs" && isAdmin && (
          <LogsScreen />
        )}
        {activeTab === "workers" && isAdmin && (
          <WorkersScreen onShowToast={showToast} currentUser={currentUser} />
        )}
      </main>

      {toastMsg && (
        <Toast message={toastMsg} onDone={() => setToastMsg(null)} />
      )}
    </div>
  );
}

// Entry point
export default App;
