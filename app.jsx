// SPA CRM — STEP-01 + STEP-02 + STEP-03: Foundation + Onboarding + Settings
// Single-file React JSX artifact
// Stack: React (hooks), Tailwind CSS, Lucide-react

const { useState, useEffect, useCallback, useRef, useMemo } = React;
const { Gem, Settings, Calendar, BookOpen, LayoutDashboard, Loader2, Plus, Trash2, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Check, X, Moon, Phone, Search, Users, LogOut, Shield, Eye, EyeOff, ClipboardList, UserPlus, Lock, Menu, ArrowUp, ArrowDown, Database, Download, Upload } = lucide;

// ─── Mobile Detection Hook ──────────────────────────────────────────────────
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [breakpoint]);
  return isMobile;
}

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
    const email = login + "@example.com";
    // Save current admin session before signUp (signUp creates a new session)
    const { data: { session: adminSession } } = await sb.auth.getSession();
    const { data, error } = await sb.auth.signUp({
      email, password,
      options: { data: { name, login, role } },
    });
    if (error) return { error: error.message };
    // Restore admin session
    if (adminSession) {
      await sb.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      });
    }
    const newId = data.user?.id;
    // Ensure profile exists (trigger may handle this, but just in case)
    if (newId) {
      await sb.from("profiles").upsert({ id: newId, name, login, role }, { onConflict: "id" });
    }
    return { user: { id: newId, name, login, role } };
  },

  async deleteUser(userId) {
    // Delete profile (auth.users entry remains but user can't access CRM without profile)
    const { error } = await sb.from("profiles").delete().eq("id", userId);
    if (error) console.error("deleteUser error:", error);
  },

  async updatePassword(userId, newPassword) {
    // Updates the currently logged-in user's password via Supabase Auth
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
      const { data, error } = await sb.auth.signUp({
        email: 'admin@example.com',
        password: 'admin123',
        options: { data: { name: 'Администратор', login: 'admin', role: 'admin' } },
      });
      if (error) console.error("initDefaultAdmin error:", error);
      // Sign out so user lands on login page
      await sb.auth.signOut();
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
 * @property {{id:string, name:string}[]} therapists
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
  bg:        "var(--bg-color)",
  card:      "var(--surface-container)",
  gridBg:    "var(--surface-container-low)",
  border:    "rgba(0,0,0,0.05)",
  textMain:  "var(--text-main)",
  textSub:   "var(--text-sub)",
  accent:    "var(--accent-color)",
  accentHov: "#fdc003ee",
  header:    "rgba(255, 255, 255, 0.7)",
  radius:    32,
};

// ─── UI Components ────────────────────────────────────────────────────────────

function Header({ salons, activeSalonId, onSalonChange }) {
  return (
    <header className="glass" style={{
      position: "fixed", top: 0, left: 0, right: 0, height: 72, zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 32px",
      borderBottom: "none",
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, backgroundColor: C.accent,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 8px 16px ${C.accent}44`
        }}>
          <Gem size={22} color="#1b1c15" />
        </div>
        <span style={{ 
          color: C.textMain, 
          fontWeight: 800, 
          fontSize: 18, 
          fontFamily: "'Poppins', sans-serif",
          letterSpacing: "-0.02em" 
        }}>
          SPA CRM
        </span>
      </div>

      {/* Salon switcher */}
      <div style={{ 
        display: "flex", gap: 8, padding: 6, borderRadius: 20,
        backgroundColor: "rgba(0,0,0,0.03)"
      }}>
        {salons.map((salon) => {
          const isActive = salon.id === activeSalonId;
          return (
            <button
              key={salon.id}
              onClick={() => onSalonChange(salon.id)}
              style={{
                padding: "8px 20px",
                borderRadius: 14,
                border: "none",
                backgroundColor: isActive ? "#fff" : "transparent",
                color: isActive ? C.textMain : C.textSub,
                fontWeight: isActive ? 700 : 500,
                fontSize: 14,
                cursor: "pointer",
                transition: "all 200ms",
                boxShadow: isActive ? "0 4px 12px rgba(0,0,0,0.05)" : "none",
              }}
            >
              {salon.name}
            </button>
          );
        })}
      </div>

      {/* Date */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.textSub }}>
        <Calendar size={16} />
        <span style={{ fontSize: 13, fontWeight: 500 }}>
          {formatDate()}
        </span>
      </div>
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
      position: "fixed", top: 72, left: 0, right: 0, height: 56, zIndex: 99,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "0 32px",
    }}>
      <div className="glass" style={{ 
        display: "flex", gap: 4, padding: 4, borderRadius: 28,
        boxShadow: "0 8px 32px rgba(0,0,0,0.03)"
      }}>
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "0 20px", height: 44,
                borderRadius: 22,
                background: isActive ? C.accent : "transparent",
                border: "none",
                color: isActive ? "#1b1c15" : C.textSub,
                fontSize: 14, fontWeight: isActive ? 700 : 500,
                cursor: "pointer",
                transition: "all 200ms",
              }}
            >
              <Icon size={18} />
              {label && <span>{label}</span>}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function LoadingScreen() {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "100vh", gap: 24,
      backgroundColor: "var(--bg-color)",
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 20, backgroundColor: C.accent,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: `0 12px 24px ${C.accent}44`,
        animation: "pulse 2s infinite"
      }}>
        <Gem size={32} color="#1b1c15" />
      </div>
      <span style={{ 
        fontSize: 14, fontWeight: 500, color: C.textSub, 
        fontFamily: "'Inter', sans-serif", letterSpacing: "0.05em" 
      }}>
        ЗАГРУЗКА...
      </span>
      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ─── Login Screen ────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }) {
  const isMobile = useIsMobile();
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
    flex: 1, padding: "12px 0", borderRadius: 12, border: "none",
    fontSize: 13, fontWeight: active ? 700 : 500, cursor: "pointer",
    backgroundColor: active ? "#fff" : "transparent",
    color: active ? C.textMain : C.textSub,
    transition: "all 200ms",
    boxShadow: active ? "0 4px 12px rgba(0,0,0,0.05)" : "none",
  });

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", backgroundColor: "var(--bg-color)",
      fontFamily: "'Inter', sans-serif",
    }}>
      <form onSubmit={handleSubmit} style={{
        width: isMobile ? "90%" : 420, maxWidth: 420, 
        padding: isMobile ? 32 : 48, 
        borderRadius: 32,
        backgroundColor: "var(--surface-container)", 
        border: "1px solid rgba(0,0,0,0.03)",
        boxShadow: "0 24px 64px rgba(0,0,0,0.05)",
        margin: isMobile ? "0 16px" : 0,
      }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, backgroundColor: C.accent,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px", boxShadow: `0 8px 16px ${C.accent}44`
          }}>
            <Gem size={28} color="#1b1c15" />
          </div>
          <h1 style={{ 
            margin: "0 0 8px", fontSize: 28, fontWeight: 800, 
            color: C.textMain, fontFamily: "'Poppins', sans-serif",
            letterSpacing: "-0.03em"
          }}>
            SPA CRM
          </h1>
          <p style={{ fontSize: 14, color: C.textSub, margin: 0, fontWeight: 500 }}>
            Добро пожаловать в систему
          </p>
        </div>

        {/* Role tab switcher */}
        <div style={{
          display: "flex", gap: 4, padding: 6, borderRadius: 18, marginBottom: 32,
          backgroundColor: "rgba(0,0,0,0.03)",
        }}>
          <button type="button" onClick={() => { setRoleTab("admin"); setError(""); }} style={tabStyle(roleTab === "admin")}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Shield size={16} /> Админ
            </span>
          </button>
          <button type="button" onClick={() => { setRoleTab("worker"); setError(""); }} style={tabStyle(roleTab === "worker")}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Users size={16} /> Работник
            </span>
          </button>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 13, color: C.textSub, marginBottom: 8, fontWeight: 600 }}>Логин</label>
          <input
            type="text" value={login} onChange={e => setLogin(e.target.value)}
            autoFocus placeholder={roleTab === "admin" ? "admin" : "worker1"}
            style={{
              width: "100%", padding: "14px 16px", borderRadius: 16, fontSize: 14,
              border: "1px solid rgba(0,0,0,0.05)", backgroundColor: "rgba(255,255,255,0.5)",
              color: C.textMain, outline: "none", transition: "all 200ms",
              boxShadow: "inset 0 2px 4px rgba(0,0,0,0.01)"
            }}
          />
        </div>

        <div style={{ marginBottom: 32 }}>
          <label style={{ display: "block", fontSize: 13, color: C.textSub, marginBottom: 8, fontWeight: 600 }}>Пароль</label>
          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••"
              style={{
                width: "100%", padding: "14px 44px 14px 16px", borderRadius: 16, fontSize: 14,
                border: "1px solid rgba(0,0,0,0.05)", backgroundColor: "rgba(255,255,255,0.5)",
                color: C.textMain, outline: "none", transition: "all 200ms",
                boxShadow: "inset 0 2px 4px rgba(0,0,0,0.01)"
              }}
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} style={{
              position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer", color: C.textSub, padding: 4,
            }}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {error && (
          <div style={{
            padding: "12px 16px", borderRadius: 16, marginBottom: 24,
            backgroundColor: "#FEE2E2", border: "1px solid #FCA5A5",
            color: "#B91C1C", fontSize: 13, fontWeight: 500
          }}>{error}</div>
        )}

        <button type="submit" disabled={loading} style={{
          width: "100%", padding: "14px 0", borderRadius: 16, border: "none",
          backgroundColor: C.accent, color: "#1b1c15", fontSize: 15, fontWeight: 700,
          cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1,
          boxShadow: `0 12px 24px ${C.accent}33`,
          transition: "all 200ms"
        }}>
          {loading ? "Вход…" : "Войти в систему"}
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
  therapists: Array.from({ length: 6 }, (_, i) => ({ id: `${id}-ther-${i + 1}`, name: `Массажистка ${i + 1}` })),
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
  height: 48,
  padding: "0 20px",
  borderRadius: 24,
  backgroundColor: focused ? "#fff" : "rgba(255,255,255,0.7)",
  border: `1px solid ${focused ? C.accent : "rgba(0,0,0,0.08)"}`,
  boxShadow: focused ? `0 8px 24px ${C.accent}22` : "none",
  color: C.textMain,
  fontSize: 14,
  fontWeight: 600,
  outline: "none",
  transition: "all 300ms cubic-bezier(0.4, 0, 0.2, 1)",
});

const labelStyle = { 
  display: "block", 
  color: C.textSub, 
  fontSize: 13, 
  marginBottom: 10, 
  fontWeight: 700,
  fontFamily: "'Inter', sans-serif",
  letterSpacing: "0.01em",
  textTransform: "uppercase",
  opacity: 0.8
};

function Toggle({ checked, onChange }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: 52, height: 28, borderRadius: 14, cursor: "pointer",
        backgroundColor: checked ? C.accent : "rgba(0,0,0,0.1)",
        position: "relative", transition: "all 300ms cubic-bezier(0.4, 0, 0.2, 1)",
        flexShrink: 0,
      }}
    >
      <div style={{
        position: "absolute", top: 4, left: checked ? 28 : 4,
        width: 20, height: 20, borderRadius: "50%",
        backgroundColor: "#fff",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        transition: "all 300ms cubic-bezier(0.4, 0, 0.2, 1)",
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
        style={{ ...inputStyle(focused), colorScheme: "light" }}
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

function TherapistsEditor({ therapists, onChange, salonId }) {
  const updateTher = (idx, patch) => {
    const next = therapists.map((t, i) => i === idx ? { ...t, ...patch } : t);
    onChange(next);
  };
  const addTher = () => {
    if (therapists.length >= 15) return;
    const n = therapists.length + 1;
    const sid = salonId || therapists[0]?.id.split("-ther-")[0] || "salon-1";
    onChange([...therapists, { id: `${sid}-ther-${n}-${Date.now()}`, name: `Массажистка ${n}` }]);
  };
  const removeTher = (idx) => {
    if (therapists.length <= 1) return;
    onChange(therapists.filter((_, i) => i !== idx));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {therapists.map((t, idx) => (
        <div key={t.id} style={{
          display: "flex", alignItems: "center", gap: 10,
          backgroundColor: C.bg, borderRadius: 8, padding: "10px 12px",
          border: `1px solid ${C.border}`,
        }}>
          <span style={{ color: C.textSub, fontSize: 13, minWidth: 24 }}>{idx + 1}</span>
          <div style={{ flex: 1 }}>
            <input
              type="text" value={t.name}
              onChange={e => updateTher(idx, { name: e.target.value })}
              style={{ ...inputStyle(), height: 32, fontSize: 13 }}
            />
          </div>
          {therapists.length > 1 && (
            <button
              onClick={() => removeTher(idx)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", padding: 4 }}
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      ))}
      {therapists.length < 15 && (
        <button
          onClick={addTher}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "8px", borderRadius: 8, border: `1px dashed ${C.border}`,
            background: "none", color: C.textSub, fontSize: 13, cursor: "pointer",
          }}
        >
          <Plus size={14} /> Добавить массажистку
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
      <div>
        <label style={labelStyle}>Массажистки</label>
        <TherapistsEditor
          therapists={config.therapists || []}
          onChange={therapists => onChange({ therapists })}
          salonId={config.id}
        />
      </div>
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
  const TOTAL_STEPS = 6;
  const [step, setStep] = useState(0);
  const [s1, setS1] = useState(makeInitialSalonConfig("salon-1"));
  const [s2, setS2] = useState(makeInitialSalonConfig("salon-2"));
  const [s3, setS3] = useState({ ...makeInitialSalonConfig("salon-3"), name: "Чунжа" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const patchS1 = (patch) => setS1(prev => ({ ...prev, ...patch }));
  const patchS2 = (patch) => setS2(prev => ({ ...prev, ...patch }));
  const patchS3 = (patch) => setS3(prev => ({ ...prev, ...patch }));

  const validate = () => {
    if (step === 0 && !s1.name.trim()) return "Введите название салона";
    if (step === 1 && (s1.rooms.length < 1 || s1.rooms.length > 6))
      return "Кол-во кабинок должно быть от 1 до 6";
    if (step === 1 && s1.rooms.some(r => !r.name.trim()))
      return "Укажите название каждой кабинки";
    if (step === 2 && (!s1.therapists || s1.therapists.length < 1 || s1.therapists.length > 15))
      return "Кол-во мастеров: от 1 до 15";
    if (step === 2 && s1.therapists && s1.therapists.some(t => !t.name.trim()))
      return "Укажите имя каждой массажистки";
    if (step === 4 && !s2.name.trim()) return "Введите название второго салона";
    if (step === 5 && !s3.name.trim()) return "Введите название третьего салона";
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
    const salons = [s1, s2, s3];
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
    "Настройка салона 3 — Чунжа",
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
      case 5:
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <TextInput
              label="Название третьего салона"
              value={s3.name}
              placeholder="Чунжа"
              onChange={v => patchS3({ name: v })}
            />
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
              <p style={{ margin: "0 0 10px", color: C.textSub, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Кабинки
              </p>
              <RoomsEditor rooms={s3.rooms} onChange={rooms => patchS3({ rooms })} />
            </div>
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
              <p style={{ margin: "0 0 10px", color: C.textSub, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Мастера и часы
              </p>
              <ScheduleFields config={s3} onChange={patchS3} />
            </div>
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
              <p style={{ margin: "0 0 10px", color: C.textSub, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Сауна и пиллинг
              </p>
              <SaunaFields config={s3} onChange={patchS3} />
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
        backgroundColor: "#fff", borderRadius: 32, padding: 32,
        boxShadow: "0 10px 40px rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.03)",
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
      backgroundColor: "#fff", border: `1px solid ${C.accent}44`,
      borderRadius: 20, padding: "12px 20px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
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
    <div className="glass" style={{
      borderRadius: 32, padding: 32,
      boxShadow: "0 10px 40px rgba(0,0,0,0.03)",
      display: "flex", flexDirection: "column", gap: 24,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 8, height: 24, borderRadius: 4, backgroundColor: C.accent }} />
        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.textMain, fontFamily: "'Poppins', sans-serif" }}>
          {salon.name || `Салон ${salon.id.replace("salon-", "")}`}
        </h3>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        {/* Название */}
        <Row label="Название">
          <InlineText value={salon.name} onChange={v => onChange({ name: v })} />
        </Row>

        {/* Кабинки */}
        <Row label="Управление кабинками">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.textSub }}>Количество:</span>
              <InlineNumber value={roomCount} min={1} max={6} onChange={handleRoomCountChange} />
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {salon.rooms.map((room, idx) => (
                <div key={room.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  backgroundColor: "rgba(0,0,0,0.02)", borderRadius: 16, padding: "12px 16px",
                  border: "1px solid rgba(0,0,0,0.03)",
                }}>
                  <InlineText
                    value={room.name}
                    onChange={v => updateRoom(idx, { name: v })}
                    style={{ flex: 1, fontSize: 13, height: 36, borderRadius: 12, padding: "0 12px" }}
                  />
                  <div style={{ display: "flex", gap: 4, backgroundColor: "rgba(0,0,0,0.03)", padding: 4, borderRadius: 12 }}>
                    {[1, 2].map(b => (
                      <button
                        key={b}
                        onClick={() => updateRoom(idx, { beds: b })}
                        style={{
                          padding: "6px 12px", borderRadius: 8, fontSize: 11,
                          border: "none",
                          backgroundColor: room.beds === b ? "#fff" : "transparent",
                          color: room.beds === b ? C.textMain : C.textSub,
                          fontWeight: room.beds === b ? 700 : 500,
                          cursor: "pointer",
                          transition: "all 200ms",
                          boxShadow: room.beds === b ? "0 2px 8px rgba(0,0,0,0.05)" : "none",
                        }}
                      >
                        {b} кр.
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Row>

        {/* Массажистки */}
        <Row label="Персонал">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
              {(salon.therapists || []).map((t, idx) => (
                <div key={t.id} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  backgroundColor: "rgba(0,0,0,0.02)", borderRadius: 16, padding: "8px 12px",
                  border: "1px solid rgba(0,0,0,0.03)",
                }}>
                  <InlineText
                    value={t.name}
                    onChange={v => {
                      const therapists = (salon.therapists || []).map((th, i) => i === idx ? { ...th, name: v } : th);
                      onChange({ therapists });
                    }}
                    style={{ flex: 1, fontSize: 13, height: 32, borderRadius: 10, padding: "0 10px" }}
                  />
                  {(salon.therapists || []).length > 1 && (
                    <button
                      onClick={() => onChange({ therapists: salon.therapists.filter((_, i) => i !== idx) })}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", padding: 4, display: "flex", alignItems: "center" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              {(salon.therapists || []).length < 15 && (
                <button
                  onClick={() => {
                    const n = (salon.therapists || []).length + 1;
                    onChange({ therapists: [...(salon.therapists || []), { id: `${salon.id}-ther-${n}-${Date.now()}`, name: `Массажистка ${n}` }] });
                  }}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    padding: "8px", borderRadius: 16, border: `1px dashed rgba(0,0,0,0.1)`,
                    background: "none", color: C.textSub, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    transition: "all 200ms",
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(0,0,0,0.1)"}
                >
                  <Plus size={14} /> Добавить специалиста
                </button>
              )}
            </div>
          </div>
        </Row>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {/* Сауна и Пиллинг */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Row label="Сауна (чел)">
              <InlineNumber value={salon.saunaCapacity || 4} min={1} max={20} onChange={v => onChange({ saunaCapacity: v })} />
            </Row>
            <Row label="Пиллинг (макс)">
              <InlineNumber value={salon.peelingMastersMax || 2} min={1} max={10} onChange={v => onChange({ peelingMastersMax: v })} />
            </Row>
          </div>

          {/* Время и Выходные */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Row label="Расписание">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <InlineSelect
                  value={salon.workStart}
                  options={TIME_OPTIONS}
                  onChange={v => onChange({ workStart: v })}
                />
                <span style={{ color: C.textSub, fontWeight: 700 }}>—</span>
                <InlineSelect
                  value={salon.workEnd}
                  options={TIME_OPTIONS.filter(o => o.value > salon.workStart)}
                  onChange={v => onChange({ workEnd: v })}
                />
              </div>
            </Row>
            <Row label="Выходной">
              <InlineSelect
                value={salon.dayOff}
                options={DAYS_OF_WEEK}
                onChange={v => onChange({ dayOff: v })}
              />
            </Row>
          </div>
        </div>

        {/* Буфер */}
        <Row label="Буфер между записями">
          <div style={{ width: 140 }}>
            <InlineSelect
              value={salon.bufferMinutes}
              options={BUFFER_OPTIONS}
              onChange={v => onChange({ bufferMinutes: Number(v) })}
            />
          </div>
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

  const innerInputStyle = {
    width: "100%", padding: "14px 20px", borderRadius: 20, fontSize: 14,
    border: "1px solid rgba(0,0,0,0.05)", backgroundColor: "rgba(255,255,255,0.6)",
    color: C.textMain, outline: "none", transition: "all 200ms", fontWeight: 600
  };

  const handleChange = async () => {
    if (!curPwd || !newPwd || !newPwd2) { onShowToast("Заполните все поля"); return; }
    if (newPwd !== newPwd2) { onShowToast("Пароли не совпадают"); return; }
    if (newPwd.length < 6) { onShowToast("Минимум 6 символов"); return; }
    setSaving(true);
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
    <div className="glass" style={{ borderRadius: 32, padding: 32, boxShadow: "0 10px 40px rgba(0,0,0,0.03)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Shield size={20} color={C.accent} />
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.textMain, fontFamily: "'Poppins', sans-serif" }}>
          Безопасность аккаунта
        </h3>
      </div>
      
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
        <div>
          <label style={labelStyle}>Текущий пароль</label>
          <input type="password" value={curPwd} onChange={e => setCurPwd(e.target.value)} style={innerInputStyle} placeholder="••••••••" />
        </div>
        <div>
          <label style={labelStyle}>Новый пароль</label>
          <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} style={innerInputStyle} placeholder="••••••••" />
        </div>
        <div>
          <label style={labelStyle}>Повтор пароля</label>
          <input type="password" value={newPwd2} onChange={e => setNewPwd2(e.target.value)} style={innerInputStyle} placeholder="••••••••" />
        </div>
      </div>

      <button onClick={handleChange} disabled={saving} style={{
        padding: "14px 32px", borderRadius: 24, border: "none",
        backgroundColor: C.accent, color: "#1b1c15", fontSize: 14, fontWeight: 700,
        cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1,
        boxShadow: `0 8px 24px ${C.accent}44`,
        transition: "all 200ms",
      }}>
        {saving ? "Сохранение…" : "Обновить пароль"}
      </button>
    </div>
  );
}

function SettingsScreen({ salons, onSalonsChange, onShowToast, onReset, onImportComplete, currentUser }) {
  const isMobile = useIsMobile();
  const isFirstRender = useRef(true);
  const fileInputRef = useRef(null);
  const [confirmModal, setConfirmModal] = useState(null); // { type, message, onConfirm }
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Debounced auto-save
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    const timer = setTimeout(async () => {
      // Validate before saving
      for (const s of salons) {
        if (!s.name.trim()) return;
        if (s.rooms.length < 1 || s.rooms.length > 6) return;
        if (!s.therapists || s.therapists.length < 1 || s.therapists.length > 15) return;
        if (s.bufferMinutes < 5 || s.bufferMinutes > 60) return;
        if (s.workStart >= s.workEnd) return;
      }
      await Storage.set(KEYS.salons, salons);
      onShowToast("Настройки сохранены");
    }, 1000);
    return () => clearTimeout(timer);
  }, [salons, onShowToast]);

  const updateSalon = (salonId, patch) => {
    onSalonsChange(salons.map(s => s.id === salonId ? { ...s, ...patch } : s));
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const exportObj = { version: "v4", exportDate: new Date().toISOString(), salons };
      const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `spa-crm-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      onShowToast("Экспорт завершен");
    } finally {
      setExporting(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.salons || !data.version) {
        onShowToast("Невалидный файл");
        return;
      }
      setConfirmModal({
        title: "Импорт данных",
        message: "Это действие заменит все текущие настройки. Продолжить?",
        confirmLabel: "Импортировать",
        onConfirm: async () => {
          setConfirmModal(null);
          await Storage.set(KEYS.salons, data.salons);
          onImportComplete(data.salons);
          onShowToast("Данные обновлены");
        },
        onCancel: () => setConfirmModal(null),
      });
    } catch {
      onShowToast("Ошибка чтения");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  return (
    <div style={{ padding: "40px 0", display: "flex", flexDirection: "column", gap: 32, maxWidth: 1000, margin: "0 auto" }}>
      <header style={{ marginBottom: 10 }}>
        <h2 style={{ 
          margin: "0 0 12px", fontSize: 32, fontWeight: 800, 
          color: C.textMain, fontFamily: "'Poppins', sans-serif",
          letterSpacing: "-0.03em"
        }}>
          Настройки системы
        </h2>
        <p style={{ color: C.textSub, fontSize: 16, fontWeight: 500 }}>
          Управление салонами, персоналом и безопасностью
        </p>
      </header>

      {/* Grid of salon settings */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 32 }}>
        {salons.map(salon => (
          <SalonSettingsCard
            key={salon.id}
            salon={salon}
            onChange={patch => updateSalon(salon.id, patch)}
          />
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(400px, 1fr))", gap: isMobile ? 16 : 32 }}>
        {/* Security */}
        {currentUser && (
          <PasswordChangeBlock currentUser={currentUser} onShowToast={onShowToast} />
        )}

        {/* Data Management */}
        <div className="glass" style={{ borderRadius: 32, padding: 32, boxShadow: "0 10px 40px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <Database size={20} color={C.accent} />
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.textMain, fontFamily: "'Poppins', sans-serif" }}>
              Управление данными
            </h3>
          </div>
          
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <button onClick={handleExport} disabled={exporting} style={{
              flex: 1, padding: "14px", borderRadius: 20, border: "none",
              backgroundColor: "rgba(0,0,0,0.03)", color: C.textMain,
              fontSize: 14, fontWeight: 700, cursor: "pointer",
              transition: "all 200ms", display: "flex", alignItems: "center", justifyContent: "center", gap: 8
            }} onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.06)"} onMouseLeave={e => e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.03)"}>
              <Download size={18} /> {exporting ? "Экспорт..." : "Экспорт данных"}
            </button>
            <button onClick={() => fileInputRef.current?.click()} disabled={importing} style={{
              flex: 1, padding: "14px", borderRadius: 20, border: "none",
              backgroundColor: "rgba(0,0,0,0.03)", color: C.textMain,
              fontSize: 14, fontWeight: 700, cursor: "pointer",
              transition: "all 200ms", display: "flex", alignItems: "center", justifyContent: "center", gap: 8
            }} onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.06)"} onMouseLeave={e => e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.03)"}>
              <Upload size={18} /> {importing ? "Импорт..." : "Импорт настроек"}
            </button>
            <input ref={fileInputRef} type="file" accept=".json" style={{ display: "none" }} onChange={handleFileChange} />
          </div>

          <div style={{ marginTop: 24, padding: 16, borderRadius: 20, backgroundColor: "#FEE2E255", border: "1px solid #FEE2E2" }}>
            <p style={{ margin: "0 0 12px", color: "#B91C1C", fontSize: 13, fontWeight: 600 }}>Опасная зона</p>
            <button onClick={() => {
              setConfirmModal({
                title: "Сброс данных",
                message: "Вы уверены? Это действие удалит все настройки и бронирования.",
                confirmLabel: "Удалить всё",
                confirmDanger: true,
                onConfirm: async () => {
                  setConfirmModal(null);
                  const allKeys = await Storage.list("spa-crm:");
                  for (const key of allKeys) await Storage.delete(key);
                  onShowToast("Все данные удалены");
                  onReset();
                },
                onCancel: () => setConfirmModal(null)
              });
            }} style={{
              width: "100%", padding: "12px", borderRadius: 16, border: "none",
              backgroundColor: "#EF4444", color: "#fff",
              fontSize: 13, fontWeight: 700, cursor: "pointer"
            }}>
              Сбросить всю систему
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal && (
        <div style={{
          position: "fixed", inset: 0, backgroundColor: "rgba(25,25,20,0.4)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
          padding: 20
        }} onClick={confirmModal.onCancel}>
          <div className="glass" style={{
            borderRadius: 32, padding: isMobile ? 24 : 40, width: 440, maxWidth: "calc(100% - 32px)",
            boxShadow: "0 20px 80px rgba(0,0,0,0.1)",
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 12px", fontSize: 24, fontWeight: 800, color: C.textMain, fontFamily: "'Poppins', sans-serif" }}>
              {confirmModal.title}
            </h3>
            <p style={{ margin: "0 0 32px", color: C.textSub, fontSize: 15, fontWeight: 500, lineHeight: 1.6 }}>
              {confirmModal.message}
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={confirmModal.onConfirm} style={{
                flex: 1, padding: "16px", borderRadius: 24, border: "none",
                backgroundColor: confirmModal.confirmDanger ? "#EF4444" : C.accent,
                color: confirmModal.confirmDanger ? "#fff" : "#1b1c15",
                fontSize: 14, fontWeight: 800, cursor: "pointer",
                boxShadow: `0 8px 24px ${confirmModal.confirmDanger ? "#EF4444" : C.accent}44`
              }}>
                {confirmModal.confirmLabel || "Продолжить"}
              </button>
              <button onClick={confirmModal.onCancel} style={{
                padding: "16px 24px", borderRadius: 24, border: "1px solid rgba(0,0,0,0.05)",
                backgroundColor: "#fff", color: C.textSub,
                fontSize: 14, fontWeight: 700, cursor: "pointer"
              }}>
                Отмена
              </button>
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
    <div className="glass" style={{ 
      display: "inline-flex", gap: 4, padding: 6, borderRadius: 24, marginBottom: 32,
      boxShadow: "0 4px 12px rgba(0,0,0,0.02)"
    }}>
      {tabs.map(t => {
        const isActive = t.id === active;
        return (
          <button key={t.id} onClick={() => onChange(t.id)} style={{
            padding: "10px 24px", borderRadius: 18, fontSize: 13,
            border: "none",
            backgroundColor: isActive ? C.accent : "transparent",
            color: isActive ? "#1b1c15" : C.textSub,
            cursor: "pointer", fontWeight: isActive ? 700 : 500,
            transition: "all 200ms",
          }}>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

const EMPTY_PROC = { name: "", category: "massage", duration: 60, therapistsRequired: 1, price: 5000 };

function ProcedureFormRow({ initial, onSave, onCancel, isMobile }) {
  const [form, setForm] = useState(initial || EMPTY_PROC);
  const [err, setErr] = useState("");
  const patch = (p) => setForm(f => ({ ...f, ...p }));

  const handleSave = () => {
    if (!form.name.trim())  { setErr("Введите название"); return; }
    if (form.duration <= 0) { setErr("Укажите длительность"); return; }
    setErr("");
    onSave(form);
  };

  if (isMobile) {
    const mInp = { ...inputStyle(), height: 44, borderRadius: 14, fontSize: 15 };
    return (
      <div className="glass" style={{
        backgroundColor: "rgba(253,192,3,0.06)", borderRadius: 20, padding: 20,
        display: "flex", flexDirection: "column", gap: 14,
        border: "1px solid rgba(253,192,3,0.15)"
      }}>
        <div>
          <label style={labelStyle}>Название</label>
          <input type="text" value={form.name} placeholder="Тайский массаж 1ч"
            onChange={e => patch({ name: e.target.value })} style={mInp} />
        </div>
        <div>
          <label style={labelStyle}>Категория</label>
          <select value={form.category} onChange={e => patch({ category: e.target.value })}
            style={{ ...mInp, cursor: "pointer" }}>
            {CATEGORY_OPTIONS.map(o => (
              <option key={o.value} value={o.value} style={{ backgroundColor: "#fff" }}>{o.label}</option>
            ))}
          </select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Длит. (мин)</label>
            <input type="number" value={form.duration} min={5} max={480}
              onChange={e => patch({ duration: parseInt(e.target.value, 10) || 0 })} style={mInp} />
          </div>
          <div>
            <label style={labelStyle}>Мастеров</label>
            <input type="number" value={form.therapistsRequired} min={0} max={4}
              onChange={e => patch({ therapistsRequired: parseInt(e.target.value, 10) || 0 })} style={mInp} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Цена (₸)</label>
          <input type="number" value={form.price} min={0}
            onChange={e => patch({ price: parseInt(e.target.value, 10) || 0 })} style={mInp} />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button onClick={handleSave} style={{
            flex: 1, padding: "14px 0", borderRadius: 14, border: "none",
            backgroundColor: C.accent, color: "#1b1c15",
            fontWeight: 700, fontSize: 14, cursor: "pointer",
            boxShadow: `0 4px 12px ${C.accent}44`
          }}>Сохранить</button>
          <button onClick={onCancel} style={{
            flex: 1, padding: "14px 0", borderRadius: 14,
            border: "1px solid rgba(0,0,0,0.05)", backgroundColor: "#fff",
            color: C.textSub, fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}>Отмена</button>
        </div>
        {err && <div style={{ color: "#EF4444", fontSize: 12, fontWeight: 600 }}>{err}</div>}
      </div>
    );
  }

  const inCell = { padding: "16px 8px", verticalAlign: "middle" };

  return (
    <>
      <tr className="glass" style={{ backgroundColor: "rgba(253, 192, 3, 0.05)" }}>
        <td style={{ ...inCell, paddingLeft: 24 }}>
          <label style={labelStyle}>Название</label>
          <input type="text" value={form.name} placeholder="Тайский массаж 1ч"
            onChange={e => patch({ name: e.target.value })}
            style={{ ...inputStyle(), height: 40, borderRadius: 12 }} />
        </td>
        <td style={inCell}>
          <label style={labelStyle}>Категория</label>
          <select value={form.category} onChange={e => patch({ category: e.target.value })}
            style={{ ...inputStyle(), height: 40, borderRadius: 12, cursor: "pointer" }}>
            {CATEGORY_OPTIONS.map(o => (
              <option key={o.value} value={o.value} style={{ backgroundColor: "#fff" }}>{o.label}</option>
            ))}
          </select>
        </td>
        <td style={inCell}>
          <label style={labelStyle}>Длит. (мин)</label>
          <input type="number" value={form.duration} min={5} max={480}
            onChange={e => patch({ duration: parseInt(e.target.value, 10) || 0 })}
            style={{ ...inputStyle(), height: 40, borderRadius: 12 }} />
        </td>
        <td style={inCell}>
          <label style={labelStyle}>Мастеров</label>
          <input type="number" value={form.therapistsRequired} min={0} max={4}
            onChange={e => patch({ therapistsRequired: parseInt(e.target.value, 10) || 0 })}
            style={{ ...inputStyle(), height: 40, borderRadius: 12 }} />
        </td>
        <td style={inCell}>
          <label style={labelStyle}>Цена (₸)</label>
          <input type="number" value={form.price} min={0}
            onChange={e => patch({ price: parseInt(e.target.value, 10) || 0 })}
            style={{ ...inputStyle(), height: 40, borderRadius: 12 }} />
        </td>
        <td style={{ ...inCell, paddingRight: 24, textAlign: "right" }}>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={handleSave} style={{
              padding: "10px 20px", borderRadius: 12, border: "none",
              backgroundColor: C.accent, color: "#1b1c15",
              fontWeight: 700, fontSize: 13, cursor: "pointer",
              boxShadow: `0 4px 12px ${C.accent}44`
            }}>Сохранить</button>
            <button onClick={onCancel} style={{
              padding: "10px 20px", borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.05)", backgroundColor: "#fff",
              color: C.textSub, fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>Отмена</button>
          </div>
        </td>
      </tr>
      {err && (
        <tr>
          <td colSpan={6} style={{ padding: "0 24px 16px", color: "#EF4444", fontSize: 12, fontWeight: 600 }}>{err}</td>
        </tr>
      )}
    </>
  );
}

function ProceduresTab({ procedures, activeSalonId, onProceduresChange, onShowToast }) {
  const [editing, setEditing] = useState(null);
  const isMobile = useIsMobile();

  const persist = async (updated) => {
    onProceduresChange(updated);
    await Storage.set(KEYS.procedures(activeSalonId), updated);
  };

  const handleAdd = async (form) => {
    await persist([...procedures, { id: makeId(), salonId: activeSalonId, ...form, isActive: true }]);
    setEditing(null);
    onShowToast("Процедура добавлена");
  };

  const handleEdit = async (id, form) => {
    await persist(procedures.map(p => p.id === id ? { ...p, ...form } : p));
    setEditing(null);
    onShowToast("Обновлено");
  };

  const handleToggle = (id) => {
    persist(procedures.map(p => p.id === id ? { ...p, isActive: !p.isActive } : p));
  };

  const thStyle = {
    padding: "16px 20px", textAlign: "left",
    color: C.textSub, fontSize: 11, fontWeight: 800,
    textTransform: "uppercase", letterSpacing: "0.1em",
    borderBottom: "1px solid rgba(0,0,0,0.05)",
    backgroundColor: "rgba(0,0,0,0.02)",
  };

  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <button
          onClick={() => setEditing(editing === "new" ? null : "new")}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "14px 24px", borderRadius: 20, width: "100%",
            border: "none", backgroundColor: C.accent,
            color: "#1b1c15", fontSize: 14, fontWeight: 700, cursor: "pointer",
            boxShadow: `0 8px 20px ${C.accent}44`
          }}
        >
          <Plus size={16} /> Добавить процедуру
        </button>

        {editing === "new" && (
          <ProcedureFormRow isMobile onSave={handleAdd} onCancel={() => setEditing(null)} />
        )}

        {procedures.map(proc => {
          if (editing === proc.id) {
            return (
              <ProcedureFormRow key={proc.id} isMobile
                initial={{ name: proc.name, category: proc.category, duration: proc.duration, therapistsRequired: proc.therapistsRequired, price: proc.price }}
                onSave={(form) => handleEdit(proc.id, form)}
                onCancel={() => setEditing(null)}
              />
            );
          }
          return (
            <div key={proc.id} onClick={() => setEditing(proc.id)} className="glass"
              style={{ borderRadius: 20, padding: 16, cursor: "pointer", opacity: proc.isActive ? 1 : 0.6, transition: "all 200ms" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 600, fontSize: 15, color: proc.isActive ? C.textMain : C.textSub }}>{proc.name}</span>
                <div onClick={e => { e.stopPropagation(); handleToggle(proc.id); }}>
                  <Toggle checked={proc.isActive} onChange={() => handleToggle(proc.id)} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
                <span style={{
                  padding: "4px 10px", borderRadius: 10,
                  backgroundColor: proc.category === "massage" ? "rgba(253,192,3,0.1)" : "rgba(0,0,0,0.05)",
                  fontSize: 12, fontWeight: 700
                }}>
                  {CATEGORY_ICONS[proc.category]} {CATEGORY_LABEL[proc.category]}
                </span>
                <span style={{ fontSize: 13, color: C.textSub }}>{proc.duration} мин</span>
                <span style={{ fontSize: 13, color: C.textSub }}>{proc.therapistsRequired} маст.</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.textMain, marginLeft: "auto" }}>
                  {proc.price.toLocaleString("ru-RU")} ₸
                </span>
              </div>
            </div>
          );
        })}

        {procedures.length === 0 && editing !== "new" && (
          <div style={{ padding: 64, textAlign: "center", color: C.textSub }}>
            <p style={{ margin: 0, fontSize: 40 }}>✨</p>
            <p style={{ margin: "16px 0 0", fontSize: 16, fontWeight: 600 }}>Нет процедур</p>
            <p style={{ margin: "4px 0 0", fontSize: 14 }}>Добавьте свою первую услугу</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => setEditing(editing === "new" ? null : "new")}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "12px 24px", borderRadius: 24,
            border: "none", backgroundColor: C.accent,
            color: "#1b1c15", fontSize: 13, fontWeight: 700, cursor: "pointer",
            boxShadow: `0 8px 20px ${C.accent}44`
          }}
        >
          <Plus size={16} /> Добавить процедуру
        </button>
      </div>

      <div className="glass" style={{ borderRadius: 24, overflow: "hidden", boxShadow: "0 10px 40px rgba(0,0,0,0.02)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, paddingLeft: 32 }}>Название</th>
              <th style={{ ...thStyle, width: 140 }}>Категория</th>
              <th style={{ ...thStyle, width: 110 }}>Длит.</th>
              <th style={{ ...thStyle, width: 100 }}>Мастеров</th>
              <th style={{ ...thStyle, width: 130 }}>Цена</th>
              <th style={{ ...thStyle, width: 100, textAlign: "center", paddingRight: 32 }}>Активна</th>
            </tr>
          </thead>
          <tbody>
            {editing === "new" && (
              <ProcedureFormRow onSave={handleAdd} onCancel={() => setEditing(null)} />
            )}
            {procedures.map((proc) => {
              const td = (center = false, right = false) => ({
                padding: "16px 20px",
                color: proc.isActive ? C.textMain : C.textSub,
                fontSize: 14, fontWeight: 500, verticalAlign: "middle",
                borderBottom: "1px solid rgba(0,0,0,0.03)",
                textAlign: center ? "center" : (right ? "right" : "left"),
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
                  style={{ cursor: "pointer", transition: "all 200ms", opacity: proc.isActive ? 1 : 0.6 }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.02)"}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  <td style={{ ...td(), paddingLeft: 32, fontWeight: 600 }}>{proc.name}</td>
                  <td style={td()}>
                    <span style={{
                      padding: "4px 10px", borderRadius: 10,
                      backgroundColor: proc.category === "massage" ? "rgba(253, 192, 3, 0.1)" : "rgba(0,0,0,0.05)",
                      fontSize: 12, fontWeight: 700
                    }}>
                      {CATEGORY_ICONS[proc.category]} {CATEGORY_LABEL[proc.category]}
                    </span>
                  </td>
                  <td style={td()}>{proc.duration} мин</td>
                  <td style={td(true)}>{proc.therapistsRequired}</td>
                  <td style={td()}>{proc.price.toLocaleString("ru-RU")} ₸</td>
                  <td style={{ ...td(true), paddingRight: 32 }} onClick={e => { e.stopPropagation(); handleToggle(proc.id); }}>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <Toggle checked={proc.isActive} onChange={() => handleToggle(proc.id)} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {procedures.length === 0 && editing !== "new" && (
          <div style={{ padding: 64, textAlign: "center", color: C.textSub }}>
            <p style={{ margin: 0, fontSize: 40 }}>✨</p>
            <p style={{ margin: "16px 0 0", fontSize: 16, fontWeight: 600 }}>Нет процедур</p>
            <p style={{ margin: "4px 0 0", fontSize: 14 }}>Добавьте свою первую услугу</p>
          </div>
        )}
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

function ComboModal({ initial, procedures, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || "");
  const [selected, setSelected] = useState(initial?.items || []);
  const [step, setStep] = useState(1); // 1: Name & Procs, 2: Price/Meta

  const totalPrice = selected.reduce((sum, item) => {
    const p = procedures.find(x => x.id === item.procedureId);
    return sum + (p ? p.price : 0);
  }, 0);

  const toggleProc = (proc) => {
    if (selected.find(s => s.procedureId === proc.id)) {
      setSelected(selected.filter(s => s.procedureId !== proc.id));
    } else {
      setSelected([...selected, { procedureId: proc.id, offsetMinutes: 0 }]);
    }
  };

  const updateOffset = (procId, off) => {
    setSelected(selected.map(s => s.procedureId === procId ? { ...s, offsetMinutes: off } : s));
  };

  const handleSave = () => {
    if (!name.trim()) return;
    if (selected.length < 2) return;
    onSave({ name, items: selected, price: totalPrice });
  };

  return (
    <div style={{
      position: "fixed", inset: 0, backgroundColor: "rgba(25,25,20,0.4)", backdropFilter: "blur(12px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20
    }} onClick={onCancel}>
      <div className="glass" style={{
        borderRadius: 32, width: 640, maxWidth: "100%", maxHeight: "90vh",
        display: "flex", flexDirection: "column", boxShadow: "0 20px 80px rgba(0,0,0,0.1)",
      }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{ padding: "32px 32px 24px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.textMain, fontFamily: "'Poppins', sans-serif" }}>
              {initial ? "Редактировать комбо" : "Новое комбо-предложение"}
            </h2>
            <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", color: C.textSub }}>
              <X size={24} />
            </button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ height: 4, flex: 1, borderRadius: 2, backgroundColor: step >= 1 ? C.accent : "rgba(0,0,0,0.05)" }} />
            <div style={{ height: 4, flex: 1, borderRadius: 2, backgroundColor: step >= 2 ? C.accent : "rgba(0,0,0,0.05)" }} />
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: 32, overflowY: "auto", flex: 1 }}>
          {step === 1 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div>
                <label style={labelStyle}>Название предложения</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="Например: Релакс для двоих" style={{ ...inputStyle(), borderRadius: 16, height: 48 }} />
              </div>
              
              <div>
                <label style={labelStyle}>Выберите услуги (мин. 2)</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {procedures.filter(p => p.isActive).map(p => {
                    const isSel = selected.find(s => s.procedureId === p.id);
                    return (
                      <button key={p.id} onClick={() => toggleProc(p)} style={{
                        padding: "16px", borderRadius: 16, border: isSel ? `2px solid ${C.accent}` : "1px solid rgba(0,0,0,0.05)",
                        backgroundColor: isSel ? "rgba(253, 192, 3, 0.05)" : "#fff",
                        textAlign: "left", cursor: "pointer", transition: "all 200ms",
                        display: "flex", alignItems: "center", gap: 12
                      }}>
                        <div style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: isSel ? C.accent : "rgba(0,0,0,0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {isSel && <Check size={14} color="#1b1c15" />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.textMain }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: C.textSub, fontWeight: 600 }}>{p.price.toLocaleString()} ₸</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div style={{ padding: 20, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.02)" }}>
                <h4 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: C.textSub }}>Настройка пауз</h4>
                {selected.map((item, idx) => {
                  const p = procedures.find(x => x.id === item.procedureId);
                  if (!p) return null;
                  return (
                    <div key={item.procedureId} style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: idx === selected.length - 1 ? 0 : 16 }}>
                      <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: C.textMain }}>{p.name}</div>
                      {idx > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 12, color: C.textSub, fontWeight: 600 }}>Пауза (мин):</span>
                          <input type="number" value={item.offsetMinutes} onChange={e => updateOffset(item.procedureId, parseInt(e.target.value, 10) || 0)}
                            style={{ ...inputStyle(), width: 70, height: 36, borderRadius: 8, padding: "0 8px", textAlign: "center" }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="glass" style={{ padding: 24, borderRadius: 24, backgroundColor: "rgba(253, 192, 3, 0.05)", border: `1px solid ${C.accent}33` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: C.textMain }}>Итоговая стоимость</span>
                  <span style={{ fontSize: 24, fontWeight: 900, color: C.accent }}>{totalPrice.toLocaleString()} ₸</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: 32, display: "flex", gap: 12, borderTop: "1px solid rgba(0,0,0,0.05)" }}>
          <button onClick={onCancel} style={{
            padding: "16px 24px", borderRadius: 24, border: "1px solid rgba(0,0,0,0.05)",
            backgroundColor: "#fff", color: C.textSub, fontSize: 14, fontWeight: 700, cursor: "pointer"
          }}>Отмена</button>
          
          <div style={{ flex: 1 }} />
          
          {step === 1 ? (
            <button onClick={() => setStep(2)} disabled={selected.length < 2 || !name.trim()} style={{
              padding: "16px 40px", borderRadius: 24, border: "none",
              backgroundColor: C.accent, color: "#1b1c15", fontSize: 14, fontWeight: 800,
              cursor: (selected.length < 2 || !name.trim()) ? "not-allowed" : "pointer",
              opacity: (selected.length < 2 || !name.trim()) ? 0.5 : 1,
              boxShadow: `0 8px 24px ${C.accent}44`
            }}>Далее</button>
          ) : (
            <>
              <button onClick={() => setStep(1)} style={{
                padding: "16px 24px", borderRadius: 24, border: "1px solid rgba(0,0,0,0.05)",
                backgroundColor: "#fff", color: C.textMain, fontSize: 14, fontWeight: 700, cursor: "pointer"
              }}>Назад</button>
              <button onClick={handleSave} style={{
                padding: "16px 40px", borderRadius: 24, border: "none",
                backgroundColor: C.accent, color: "#1b1c15", fontSize: 14, fontWeight: 800,
                cursor: "pointer", boxShadow: `0 8px 24px ${C.accent}44`
              }}>Сохранить комбо</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CombosTab({ combos, activeSalonId, onCombosChange, procedures, onShowToast }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCombo, setEditingCombo] = useState(null);
  const isMobile = useIsMobile();

  const persist = async (updated) => {
    onCombosChange(updated);
    await Storage.set(KEYS.combos(activeSalonId), updated);
  };

  const handleSave = async (form) => {
    if (editingCombo) {
      await persist(combos.map(c => c.id === editingCombo.id ? { ...editingCombo, ...form } : c));
      onShowToast("Обновлено");
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
    padding: "16px 20px", textAlign: "left",
    color: C.textSub, fontSize: 11, fontWeight: 800,
    textTransform: "uppercase", letterSpacing: "0.1em",
    borderBottom: "1px solid rgba(0,0,0,0.05)",
    backgroundColor: "rgba(0,0,0,0.02)",
  };

  const comboCard = (combo) => (
    <div key={combo.id}
      onClick={() => { setEditingCombo(combo); setModalOpen(true); }}
      className="glass"
      style={{ borderRadius: 20, padding: 16, cursor: "pointer", opacity: combo.isActive ? 1 : 0.6, transition: "all 200ms" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 600, fontSize: 15, color: combo.isActive ? C.textMain : C.textSub }}>{combo.name}</span>
        <div onClick={e => { e.stopPropagation(); handleToggle(combo.id); }}>
          <Toggle checked={combo.isActive} onChange={() => handleToggle(combo.id)} />
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
        {(combo.items || []).map((step, sidx) => {
          const p = procedures.find(x => x.id === step.procedureId);
          return (
            <React.Fragment key={step.procedureId}>
              <span style={{ padding: "4px 8px", borderRadius: 6, backgroundColor: "rgba(0,0,0,0.05)", fontSize: 11, fontWeight: 700 }}>
                {p ? p.name : "???"}
              </span>
              {sidx < combo.items.length - 1 && <span style={{ color: C.accent }}>→</span>}
            </React.Fragment>
          );
        })}
      </div>
      <div style={{ marginTop: 8, fontSize: 14, fontWeight: 700, color: C.textMain }}>
        {combo.price.toLocaleString("ru-RU")} ₸
      </div>
    </div>
  );

  const emptyState = combos.length === 0 && (
    <div style={{ padding: 64, textAlign: "center", color: C.textSub }}>
      <p style={{ margin: 0, fontSize: 40 }}>📦</p>
      <p style={{ margin: "16px 0 0", fontSize: 16, fontWeight: 600 }}>Нет комбо-пакетов</p>
      <p style={{ margin: "4px 0 0", fontSize: 14 }}>Создайте выгодное предложение</p>
    </div>
  );

  const modal = modalOpen && (
    <ComboModal
      initial={editingCombo}
      procedures={procedures}
      onSave={handleSave}
      onCancel={() => { setModalOpen(false); setEditingCombo(null); }}
    />
  );

  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <button onClick={() => { setEditingCombo(null); setModalOpen(true); }} style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "14px 24px", borderRadius: 20, width: "100%",
          border: "none", backgroundColor: C.accent,
          color: "#1b1c15", fontSize: 14, fontWeight: 700, cursor: "pointer",
          boxShadow: `0 8px 20px ${C.accent}44`
        }}>
          <Plus size={16} /> Создать комбо
        </button>
        {combos.map(comboCard)}
        {emptyState}
        {modal}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={() => { setEditingCombo(null); setModalOpen(true); }} style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "12px 24px", borderRadius: 24,
          border: "none", backgroundColor: C.accent,
          color: "#1b1c15", fontSize: 13, fontWeight: 700, cursor: "pointer",
          boxShadow: `0 8px 20px ${C.accent}44`
        }}>
          <Plus size={16} /> Создать комбо
        </button>
      </div>

      <div className="glass" style={{ borderRadius: 24, overflow: "hidden", boxShadow: "0 10px 40px rgba(0,0,0,0.02)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, paddingLeft: 32 }}>Название</th>
              <th style={thStyle}>Состав</th>
              <th style={{ ...thStyle, width: 150 }}>Цена</th>
              <th style={{ ...thStyle, width: 100, textAlign: "center", paddingRight: 32 }}>Активен</th>
            </tr>
          </thead>
          <tbody>
            {combos.map((combo) => {
              const td = (center = false) => ({
                padding: "16px 20px",
                color: combo.isActive ? C.textMain : C.textSub,
                fontSize: 14, fontWeight: 500, verticalAlign: "middle",
                borderBottom: "1px solid rgba(0,0,0,0.03)",
                textAlign: center ? "center" : "left",
              });
              return (
                <tr key={combo.id}
                  onClick={() => { setEditingCombo(combo); setModalOpen(true); }}
                  style={{ cursor: "pointer", transition: "all 200ms", opacity: combo.isActive ? 1 : 0.6 }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.02)"}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  <td style={{ ...td(), paddingLeft: 32, fontWeight: 600 }}>{combo.name}</td>
                  <td style={td()}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {(combo.items || []).map((step, sidx) => {
                        const p = procedures.find(x => x.id === step.procedureId);
                        return (
                          <React.Fragment key={step.procedureId}>
                            <span style={{ padding: "4px 8px", borderRadius: 6, backgroundColor: "rgba(0,0,0,0.05)", fontSize: 11, fontWeight: 700 }}>
                              {p ? p.name : "???"}
                            </span>
                            {sidx < combo.items.length - 1 && <span style={{ color: C.accent }}>→</span>}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </td>
                  <td style={td()}>{combo.price.toLocaleString("ru-RU")} ₸</td>
                  <td style={{ ...td(true), paddingRight: 32 }} onClick={e => { e.stopPropagation(); handleToggle(combo.id); }}>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <Toggle checked={combo.isActive} onChange={() => handleToggle(combo.id)} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {emptyState}
      </div>
      {modal}
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
    const ok = await Storage.set(KEYS.salons, updated);
    if (!ok) onShowToast("Ошибка сохранения настроек");
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
      const totalTherapists = (salon.therapists || []).length || salon.therapistCount || 1;
      if (existingLoad + newLoad > totalTherapists) {
        const free = Math.max(0, totalTherapists - existingLoad);
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

  // 8. Master (named therapist) conflict — prevent double-booking the same person
  const bookingMasters = booking.masterName ? booking.masterName.split(", ").filter(m => m) : [];
  if (bookingMasters.length > 0) {
    const activeOthers = others.filter(ob => ob.status !== "cancelled_refund" && ob.status !== "cancelled_no_refund");
    for (const ob of activeOthers) {
      if (!ob.masterName) continue;
      const obMasters = ob.masterName.split(", ").filter(m => m);
      const common = bookingMasters.filter(m => obMasters.includes(m));
      if (common.length === 0) continue;
      for (const seg of booking.segments) {
        if ((seg.therapistCount || 0) === 0) continue;
        for (const os of ob.segments) {
          if ((os.therapistCount || 0) === 0) continue;
          if (seg.startTime < os.endTime && seg.endTime > os.startTime) {
            for (const name of common) {
              errors.push({ field: "master", message: `${name} уже занят(а) с ${os.startTime} до ${os.endTime}` });
            }
            break;
          }
        }
        if (errors.some(e => e.field === "master")) break;
      }
      if (errors.some(e => e.field === "master")) break;
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── Booking Modal (STEP-07) ───────────────────────────────────────────────

function BookingModal({ salon, procedures, combos, initialDate, initialTime, initialRoomId, onSave, onClose }) {
  const isMobile = useIsMobile();
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
  const [masters, setMasters] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
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

  // Number of massage master slots (excluding peeling masters)
  const massageMasterCount = (() => {
    if (bookingType === "single") {
      if (!selectedProc || selectedProc.category === "sauna" || selectedProc.category === "peeling") return 0;
      return clientCount * (selectedProc.therapistsRequired || 0);
    }
    if (!selectedCombo) return 0;
    let max = 0;
    for (const step of selectedCombo.steps) {
      const proc = activeProcedures.find(p => p.id === step.procId);
      if (!proc || proc.category === "sauna" || proc.category === "peeling") continue;
      max = Math.max(max, clientCount * (proc.therapistsRequired || 1));
    }
    return max;
  })();

  // Resize masters array when count changes
  useEffect(() => {
    setMasters(prev => {
      if (prev.length === massageMasterCount) return prev;
      if (prev.length < massageMasterCount) return [...prev, ...Array(massageMasterCount - prev.length).fill("")];
      return prev.slice(0, massageMasterCount);
    });
  }, [massageMasterCount]);

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
      masterName: masters.filter(m => m).join(", "),
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
      masterName: masters.filter(m => m).join(", "),
      paymentMethod,
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
        width: "100%", maxWidth: isMobile ? "100%" : 520,
        backgroundColor: C.card, borderRadius: isMobile ? 16 : 12, padding: isMobile ? 16 : 28,
        maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
        margin: isMobile ? "0 8px" : 0,
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: isMobile ? 16 : 24 }}>
          <h3 style={{
            margin: 0,
            fontSize: isMobile ? 18 : 24,
            fontWeight: 800,
            color: C.textMain,
            fontFamily: "'Poppins', sans-serif",
            letterSpacing: "-0.02em"
          }}>Новая запись</h3>
          <button onClick={onClose} style={{ 
            background: "rgba(0,0,0,0.05)", border: "none", cursor: "pointer", color: C.textSub,
            width: 32, height: 32, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <X size={18} />
          </button>
        </div>
        {/* Salon indicator */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 20px", borderRadius: 20, marginBottom: 32,
          backgroundColor: `${C.accent}15`, border: `1px solid ${C.accent}33`,
        }}>
          <Gem size={18} color={C.accent} />
          <span style={{ color: "#927000", fontWeight: 700, fontSize: 15, fontFamily: "'Inter', sans-serif" }}>{salon.name}</span>
        </div>

        {/* Client info */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 12 : 16, marginBottom: 16 }}>
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

        {/* Master (therapist) selectors — one per required therapist */}
        {massageMasterCount > 0 && (
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>{massageMasterCount > 1 ? "Мастера" : "Мастер"}</label>
            {masters.map((m, idx) => (
              <div key={idx} style={{ marginBottom: idx < masters.length - 1 ? 8 : 0 }}>
                {massageMasterCount > 1 && (
                  <div style={{ fontSize: 11, color: C.textSub, marginBottom: 2 }}>Мастер {idx + 1}</div>
                )}
                <select value={m} onChange={e => {
                  const updated = [...masters];
                  updated[idx] = e.target.value;
                  setMasters(updated);
                }} style={{ ...inputStyle(), cursor: "pointer" }}>
                  <option value="" style={{ backgroundColor: C.card }}>— Не назначен —</option>
                  {(salon.therapists || []).filter(t => !masters.includes(t.name) || t.name === m).map(t => (
                    <option key={t.id} value={t.name} style={{ backgroundColor: C.card }}>{t.name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}

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
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 12 : 16, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Дата</label>
            <input type="date" value={date}
              onChange={e => { if (e.target.value) { setDate(e.target.value); setErr(""); } }}
              style={{ ...inputStyle(), colorScheme: "light", cursor: "pointer" }} />
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

        {/* Sauna / Therapist / Master validation warnings */}
        {(fieldErrors("sauna").length > 0 || fieldErrors("therapists").length > 0 || fieldErrors("master").length > 0) && (
          <div style={{
            padding: "8px 12px", borderRadius: 6, marginBottom: 16,
            backgroundColor: "#EF444422", border: "1px solid #EF4444",
          }}>
            {[...fieldErrors("sauna"), ...fieldErrors("therapists"), ...fieldErrors("master")].map((e, i) => (
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

        {/* Payment method */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Способ оплаты</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {PAYMENT_METHODS.map(pm => (
              <button key={pm.value} type="button" onClick={() => setPaymentMethod(pm.value)} style={{
                padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 500,
                border: paymentMethod === pm.value ? `1px solid ${C.accent}` : `1px solid ${C.border}`,
                backgroundColor: paymentMethod === pm.value ? `${C.accent}22` : "transparent",
                color: paymentMethod === pm.value ? C.accent : C.textSub,
                cursor: "pointer",
              }}>{pm.label}</button>
            ))}
          </div>
          {paymentMethod === "cert_dep" && (
            <div style={{ marginTop: 6, padding: "6px 10px", borderRadius: 6,
              backgroundColor: "#FBBF2422", border: "1px solid #FBBF2444", fontSize: 12, color: "#FBBF24" }}>
              СЕРТ / ДЕП — не учитывается в выручке
            </div>
          )}
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
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 32 }}>
          <button onClick={onClose} style={{
            padding: "12px 24px", borderRadius: 20,
            border: "none", backgroundColor: "rgba(0,0,0,0.05)",
            color: C.textSub, fontSize: 14, fontWeight: 600, cursor: "pointer",
            transition: "all 200ms"
          }}>Отмена</button>
          <button onClick={handleSave} disabled={saving || hasValidationErrors} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "12px 32px", borderRadius: 24,
            border: "none",
            backgroundColor: (saving || hasValidationErrors) ? "#E5E7EB" : C.accent,
            color: (saving || hasValidationErrors) ? "#9CA3AF" : "#1b1c15",
            fontSize: 14, fontWeight: 700,
            cursor: (saving || hasValidationErrors) ? "not-allowed" : "pointer",
            boxShadow: (saving || hasValidationErrors) ? "none" : `0 8px 24px ${C.accent}44`,
            transition: "all 200ms"
          }}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} 
            Создать запись
          </button>
        </div>
      </div>

      {/* Confirm dialog */}
      {showConfirm && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 400,
          backgroundColor: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(16px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div className="glass" style={{
            width: "100%", maxWidth: 400, backgroundColor: "rgba(255,255,255,0.8)", borderRadius: 32, padding: 32,
            boxShadow: "0 20px 50px rgba(0,0,0,0.2)", margin: "0 16px",
            border: "1px solid rgba(255,255,255,0.4)"
          }}>
            <h4 style={{ 
              margin: "0 0 20px", 
              fontSize: 20, 
              fontWeight: 800, 
              color: C.textMain,
              fontFamily: "'Poppins', sans-serif" 
            }}>
              Подтвердите запись
            </h4>
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "16px 20px", borderRadius: 20, marginBottom: 24,
              backgroundColor: `${C.accent}15`, border: `1px solid ${C.accent}33`,
            }}>
              <Gem size={22} color={C.accent} />
              <span style={{ color: "#927000", fontWeight: 700, fontSize: 17 }}>{salon.name}</span>
            </div>
            <div style={{ fontSize: 14, color: C.textMain, fontWeight: 600, marginBottom: 8 }}>
              {clientName.trim()}
            </div>
            <div style={{ fontSize: 13, color: C.textSub, marginBottom: 8, fontWeight: 500 }}>
              {date} в {startTime || segResult?.totalStartTime}
            </div>
            <div style={{ fontSize: 13, color: C.textSub, marginBottom: 24, fontWeight: 500 }}>
              {bookingType === "single" ? selectedProc?.name : selectedCombo?.name} • {totalPrice.toLocaleString("ru-RU")} ₸
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button onClick={() => setShowConfirm(false)} style={{
                padding: "10px 20px", borderRadius: 20,
                border: "none", backgroundColor: "rgba(0,0,0,0.05)",
                color: C.textSub, fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}>Отмена</button>
              <button onClick={handleConfirmedSave} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 24px", borderRadius: 20, border: "none",
                backgroundColor: C.accent, color: "#1b1c15",
                fontSize: 14, fontWeight: 700, cursor: "pointer",
                boxShadow: `0 8px 16px ${C.accent}44`
              }}>
                <Check size={16} />
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

const PAYMENT_METHODS = [
  { value: "cash",     label: "НАЛ" },
  { value: "card",     label: "БЕЗНАЛ" },
  { value: "qr",       label: "QR" },
  { value: "transfer", label: "ПЕРЕВОДЫ" },
  { value: "cert_dep", label: "СЕРТ / ДЕП" },
];
const PAYMENT_LABEL = Object.fromEntries(PAYMENT_METHODS.map(m => [m.value, m.label]));

const STATUS_CFG = {
  booked:              { label: "Забронировано",      color: "#D4A84B" },
  completed:           { label: "Завершено",          color: "#34D399" },
  "cancelled_refund":  { label: "Отменено (возврат)", color: "#F87171" },
  "cancelled_no_refund": { label: "Отменено (без возврата)", color: "#E85D5D" },
  "no-show":           { label: "Неявка",             color: "#FBBF24" },
};

const OVERDUE_CFG = { label: "Требуется изменить статус", color: "#F97316" };

function isBookingOverdue(b) {
  if (b.status !== "booked") return false;
  const now = new Date();
  const endDate = parseLocal(b.date);
  const [eh, em] = (b.totalEndTime || "23:59").split(":").map(Number);
  endDate.setHours(eh, em, 0, 0);
  return now > endDate;
}

function BookingDetailsPanel({ booking, salon, procedures, onStatusChange, onDelete, onClose }) {
  const isMobile = useIsMobile();
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
  const overdue = isBookingOverdue(booking);
  const statusCfg = overdue ? OVERDUE_CFG : (STATUS_CFG[booking.status] || STATUS_CFG.booked);

  // For single procedure — find room name
  const roomSeg = segments.find(s => s.resourceType === "room" && s.roomId);
  const roomName = roomSeg ? (salon.rooms.find(r => r.id === roomSeg.roomId)?.name || roomSeg.roomId) : null;

  const divider = <div style={{ height: 1, backgroundColor: C.border, margin: "16px 0" }} />;

  return (
    <div ref={panelRef} className="glass" style={{
      position: "fixed", top: 0, right: 0, bottom: 0,
      width: isMobile ? "100%" : 400, zIndex: 300,
      backgroundColor: "rgba(255, 255, 255, 0.8)",
      borderLeft: "1px solid rgba(255,255,255,0.4)",
      display: "flex", flexDirection: "column",
      boxShadow: "-20px 0 50px rgba(0,0,0,0.1)",
      animation: "slideInRight 300ms cubic-bezier(0.4, 0, 0.2, 1)",
      overflowY: "auto",
      borderRadius: isMobile ? 0 : "40px 0 0 40px",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "24px 16px 0" : "32px 32px 0" }}>
        <span style={{ 
          color: C.textSub, 
          fontSize: 12, 
          fontWeight: 800, 
          textTransform: "uppercase", 
          letterSpacing: "0.1em",
          fontFamily: "'Inter', sans-serif"
        }}>
          Детали записи
        </span>
        <button onClick={onClose} style={{ 
          background: "rgba(0,0,0,0.05)", border: "none", cursor: "pointer", color: C.textSub,
          width: 32, height: 32, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ padding: "32px", flex: 1 }}>
        {/* Client info */}
        <div style={{ fontSize: 24, fontWeight: 800, color: C.textMain, marginBottom: 8, fontFamily: "'Poppins', sans-serif", letterSpacing: "-0.02em" }}>
          {booking.clientName}
        </div>
        <a href={`tel:${booking.clientPhone}`} style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          color: C.textSub, fontSize: 15, textDecoration: "none",
          fontWeight: 500, backgroundColor: "rgba(0,0,0,0.03)", padding: "6px 12px", borderRadius: 12
        }}>
          <Phone size={14} />
          {booking.clientPhone}
        </a>
        {booking.masterName && (
          <div style={{ marginTop: 16, fontSize: 14, color: "#927000", fontWeight: 700, backgroundColor: `${C.accent}15`, padding: "8px 16px", borderRadius: 12, display: "inline-block", width: "100%" }}>
            Мастер: {booking.masterName}
          </div>
        )}

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

        {/* Price + Payment method */}
        <div style={{ fontSize: 18, fontWeight: 700, color: booking.paymentMethod === "cert_dep" ? C.textSub : C.accent, marginBottom: 4 }}>
          {booking.paymentMethod === "cert_dep"
            ? <><s>{(booking.totalPrice || 0).toLocaleString("ru-RU")} ₸</s> <span style={{ fontSize: 13, color: "#FBBF24" }}>СЕРТ / ДЕП</span></>
            : <>{(booking.totalPrice || 0).toLocaleString("ru-RU")} ₸</>}
        </div>
        <div style={{ fontSize: 12, color: C.textSub, marginBottom: 4 }}>
          Оплата: <span style={{ color: booking.paymentMethod === "cert_dep" ? "#FBBF24" : C.textMain, fontWeight: 500 }}>
            {PAYMENT_LABEL[booking.paymentMethod] || booking.paymentMethod || "НАЛ"}
          </span>
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
          <div style={{ padding: "32px", borderTop: `1px solid rgba(0,0,0,0.05)` }}>
            {isPast ? (
              <div style={{ color: C.textSub, fontSize: 13, textAlign: "center", fontWeight: 500 }}>
                Удаление невозможно — дата уже прошла
              </div>
            ) : confirmDelete ? (
              <div>
                <div style={{ color: C.textMain, fontSize: 14, marginBottom: 16, fontWeight: 600, textAlign: "center" }}>
                  Удалить запись {booking.clientName}?
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <button onClick={() => onDelete(booking.id)} style={{
                    flex: 1, padding: "12px 0", borderRadius: 20, border: "none",
                    backgroundColor: "#EF4444", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
                    boxShadow: "0 8px 16px rgba(239, 68, 68, 0.3)"
                  }}>Удалить</button>
                  <button onClick={() => setConfirmDelete(false)} style={{
                    flex: 1, padding: "12px 0", borderRadius: 20,
                    border: "none", backgroundColor: "rgba(0,0,0,0.05)",
                    color: C.textSub, fontSize: 14, fontWeight: 700, cursor: "pointer",
                  }}>Отмена</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                width: "100%", padding: "14px 0", borderRadius: 24,
                border: "none", backgroundColor: "rgba(239, 68, 68, 0.1)",
                color: "#EF4444", fontSize: 14, fontWeight: 700, cursor: "pointer",
                transition: "all 200ms"
              }}>
                <Trash2 size={16} /> Удалить запись
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
const addDays    = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const parseLocal = (s) => { const [y,m,d] = s.split("-").map(Number); return new Date(y, m-1, d); };

function ScheduleScreen({ activeSalonId, salons, procedures, combos, onShowToast, currentUser }) {
  const isMobile = useIsMobile();
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
    if (window.notifyTelegram) window.notifyTelegram("create", { ..._booking, salonName: salon?.name || "" });
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
    if (window.notifyTelegram && booking) window.notifyTelegram("status", { ...booking, salonName: salon?.name || "", oldStatus: booking.status, newStatus });
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
    if (window.notifyTelegram && target) window.notifyTelegram("delete", { ...target, salonName: salon?.name || "" });
    if (onShowToast) onShowToast("Запись удалена");
  };

  const selectedBooking = selectedBookingId ? monthBookings.find(b => b.id === selectedBookingId) : null;

  const cellW = isMobile ? 50 : CELL_W;
  const rowH  = isMobile ? 48 : ROW_H;
  const colW  = isMobile ? 70 : COL_W;

  const wStartM  = timeToMins(salon.workStart);
  const wEndM    = timeToMins(salon.workEnd);
  const slotCount = Math.max(0, (wEndM - wStartM) / 30);
  const slots    = Array.from({ length: slotCount }, (_, i) => wStartM + i * 30);
  const totalGridW = slotCount * cellW;

  const rows = [
    ...salon.rooms.map(r => ({ id: r.id, label: r.name, type: "room" })),
    ...(salon.hasSauna ? [{ id: "__sauna__", label: "Сауна", type: "sauna" }] : []),
  ];

  const segLeft  = (t) => (timeToMins(t) - wStartM) / 30 * cellW;
  const segWidth = (s, e) => (timeToMins(e) - timeToMins(s)) / 30 * cellW;

  const monthLabel = `${RU_MONTH_NOM[viewMonth.getMonth()]} ${viewMonth.getFullYear()}`;

  const pillStyle = (active) => ({
    padding: "8px 18px", borderRadius: 20, fontSize: 13, fontWeight: active ? 700 : 500,
    border: "none",
    backgroundColor: active ? C.accent : "rgba(0,0,0,0.03)",
    color: active ? "#1b1c15" : C.textSub,
    cursor: "pointer",
    transition: "all 200ms",
    boxShadow: active ? `0 8px 16px ${C.accent}33` : "none",
  });

  const btnStyle = (extra = {}) => ({
    display: "flex", alignItems: "center", justifyContent: "center",
    width: 38, height: 38, borderRadius: 19,
    border: "none", backgroundColor: "rgba(0,0,0,0.03)", color: C.textSub, cursor: "pointer",
    transition: "all 200ms",
    ...extra,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Top bar: month nav + view mode + new booking ── */}
      <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 10, flexWrap: "wrap" }}>
        <button onClick={() => setViewMonth(new Date(year, month - 1, 1))} style={btnStyle()}>
          <ChevronLeft size={15} />
        </button>
        <span style={{ color: C.textMain, fontSize: isMobile ? 13 : 15, fontWeight: 600, minWidth: isMobile ? 120 : 180, textAlign: "center", textTransform: "capitalize" }}>
          {monthLabel}
        </span>
        <button onClick={() => setViewMonth(new Date(year, month + 1, 1))} style={btnStyle()}>
          <ChevronRight size={15} />
        </button>

        {!isMobile && <div style={{ width: 1, height: 24, backgroundColor: C.border, margin: "0 4px" }} />}

        {/* View mode pills */}
        {[["month","Месяц"],["2weeks","2 нед"],["week","Нед"],["custom","Период"]].map(([val,lbl]) => (
          <button key={val} onClick={() => setViewMode(val)} style={pillStyle(viewMode === val)}>{lbl}</button>
        ))}

        {/* Custom date range */}
        {viewMode === "custom" && (
          <>
            <input type="date" value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              style={{ ...inputStyle(), width: isMobile ? 110 : 140, height: 30, fontSize: 11, colorScheme: "light" }}
            />
            <span style={{ color: C.textSub, fontSize: 12 }}>—</span>
            <input type="date" value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              style={{ ...inputStyle(), width: isMobile ? 110 : 140, height: 30, fontSize: 11, colorScheme: "light" }}
            />
          </>
        )}

        <div style={{ flex: 1 }} />

        <button
          onClick={() => setBookingModal({ initialTime: null, initialRoomId: null })}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: isMobile ? "8px 10px" : "8px 16px", borderRadius: 8,
            backgroundColor: C.accent, color: C.bg,
            fontWeight: 600, fontSize: 13, border: "none", cursor: "pointer",
          }}>
          <Plus size={14} /> {isMobile ? "" : "Новая запись"}
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
                padding: "32px 16px 16px", marginTop: week.num > 1 ? 40 : 0,
                display: "flex", alignItems: "baseline", gap: 16,
              }}>
                <span style={{ 
                  fontSize: isMobile ? 24 : 48, 
                  fontWeight: 900, 
                  color: C.accent, 
                  fontFamily: "'Poppins', sans-serif",
                  letterSpacing: "-0.03em" 
                }}>
                  Неделя {week.num}
                </span>
                <span style={{ 
                  fontSize: isMobile ? 14 : 24, 
                  color: C.textSub, 
                  fontWeight: 500,
                  fontFamily: "'Inter', sans-serif" 
                }}>
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
                const paid = dayBkgs.filter(b => (b.status === "completed" || b.status === "no-show" || b.status === "cancelled_no_refund") && b.paymentMethod !== "cert_dep");
                const overdueCount = dayBkgs.filter(b => isBookingOverdue(b)).length;
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



                return (
                  <div key={ds} style={{ borderBottom: `1px solid ${C.border}22` }}>
                    {/* Day header with date + KPI bar */}
                    <div
                      onClick={() => setExpandedDates(prev => ({ ...prev, [ds]: !prev[ds] }))}
                      style={{
                        display: "flex", alignItems: "center", gap: 20,
                        padding: "24px 32px", cursor: "pointer",
                        backgroundColor: isT ? "rgba(253, 192, 3, 0.08)" : "var(--surface-container)",
                        borderRadius: 32, margin: "12px 0",
                        transition: "all 300ms",
                        border: isT ? `2px solid ${C.accent}44` : "1px solid rgba(0,0,0,0.02)",
                        boxShadow: isT ? `0 8px 32px ${C.accent}22` : "0 8px 32px rgba(0,0,0,0.02)",
                      }}
                    >
                      {/* Date block */}
                      <div style={{ minWidth: 64, textAlign: "center" }}>
                        <div style={{ 
                          fontSize: 28, 
                          fontWeight: 800, 
                          color: isDayOff ? C.textSub : (isT ? C.accent : C.textMain),
                          fontFamily: "'Poppins', sans-serif",
                          lineHeight: 1
                        }}>
                          {day.getDate()}
                        </div>
                        <div style={{ 
                          fontSize: 12, 
                          color: isDayOff ? "#F8717199" : C.textSub, 
                          textTransform: "uppercase",
                          fontWeight: 600,
                          marginTop: 4,
                          letterSpacing: "0.05em"
                        }}>
                          {RU_WEEKDAY_SHORT[day.getDay()]}
                        </div>
                      </div>

                      {/* KPI mini-bar */}
                      {isDayOff ? (
                        <span style={{ color: C.textSub, fontSize: 14, fontWeight: 500, fontStyle: "italic", flex: 1 }}>Выходной день</span>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 24, flex: 1, flexWrap: "wrap" }}>
                          <span style={{ fontSize: isMobile ? 12 : 14, color: C.textMain, fontWeight: 700 }}>
                            {active.length} зап.
                          </span>
                          {!isMobile && <span style={{ fontSize: 14, color: C.textSub, fontWeight: 500 }}>{clients} клиентов</span>}
                          {overdueCount > 0 && (
                            <div style={{ display: "flex", alignItems: "center", gap: 4, backgroundColor: "#F9731622", padding: "4px 10px", borderRadius: 12 }}>
                              <span style={{ fontSize: 12, color: "#F97316", fontWeight: 700 }}>{overdueCount} просрочено</span>
                            </div>
                          )}
                          {revenue > 0 && (
                            <div style={{ display: "flex", alignItems: "center", gap: 4, backgroundColor: `${C.accent}22`, padding: "4px 10px", borderRadius: 12 }}>
                              <span style={{ fontSize: 12, color: "#927000", fontWeight: 700 }}>{revenue.toLocaleString("ru-RU")} ₸</span>
                            </div>
                          )}
                          {!isMobile && <span style={{ fontSize: 12, color: roomPct > 80 ? "#F87171" : C.textSub, fontWeight: 600 }}>Загрузка: {roomPct}%</span>}
                        </div>
                      )}

                      {/* Collapse/expand arrow */}
                      <div style={{ color: C.textSub, backgroundColor: "rgba(0,0,0,0.03)", width: 32, height: 32, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>

                    {/* Day grid (shown by default, can collapse) */}
                    {isExpanded && !isDayOff && (() => {
                      const dayBookings = dayBkgs;
                      const _now = new Date();
                      const nowM = _now.getHours() * 60 + _now.getMinutes();
                      const nowLeft = (isT && nowM >= wStartM && nowM <= wEndM) ? (nowM - wStartM) / 30 * cellW : null;

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
                        return { used, total: (salon.therapists || []).length || salon.therapistCount || 1 };
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
                        <div style={{ 
                          borderRadius: 32, 
                          backgroundColor: "rgba(255,255,255,0.4)",
                          backdropFilter: "blur(10px)",
                          border: `1px solid rgba(0,0,0,0.03)`, 
                          overflow: "hidden", 
                          margin: isMobile ? "4px 0 16px" : "4px 0 16px",
                          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.02)"
                        }}>
                          <div style={{ display: "flex" }}>
                            {/* Fixed left column */}
                            <div style={{ width: colW, flexShrink: 0, borderRight: `1px solid rgba(0,0,0,0.05)`, backgroundColor: "transparent" }}>
                              <div style={{ height: 40, borderBottom: `1px solid rgba(0,0,0,0.05)` }} />
                              {rows.map((row, i) => (
                                <div key={row.id} style={{
                                  height: rowH, display: "flex", alignItems: "center", padding: isMobile ? "0 8px" : "0 16px",
                                  borderBottom: i < rows.length - 1 ? `1px solid rgba(0,0,0,0.05)` : "none",
                                  color: C.textSub, fontSize: 12, fontWeight: 600,
                                  fontFamily: "'Inter', sans-serif"
                                }}>{row.label}</div>
                              ))}
                              <div style={{
                                borderTop: `1px solid rgba(0,0,0,0.05)`, height: 44,
                                display: "flex", alignItems: "center", padding: "0 16px",
                                color: C.textSub, fontSize: 11, fontWeight: 600,
                              }}>Мастера</div>
                            </div>

                            {/* Scrollable grid */}
                            <div style={{ overflowX: "auto", flex: 1, WebkitOverflowScrolling: "touch" }}>
                              <div style={{ width: totalGridW, position: "relative", minWidth: "100%" }}>
                                {/* Time header */}
                                <div style={{ display: "flex", height: 40, borderBottom: `1px solid rgba(0,0,0,0.05)`, backgroundColor: "transparent" }}>
                                  {slots.map(s => (
                                    <div key={s} style={{
                                      width: cellW, flexShrink: 0, display: "flex", alignItems: "center",
                                      paddingLeft: isMobile ? 4 : 10, color: C.textSub, fontSize: isMobile ? 10 : 12,
                                      fontWeight: 600,
                                      borderRight: `1px solid rgba(0,0,0,0.05)`,
                                    }}>{minsToTime(s)}</div>
                                  ))}
                                </div>

                                {/* Grid rows */}
                                {rows.map((row, rowIdx) => {
                                  const rowSegs = getRowSegments(row);
                                  return (
                                    <div key={row.id} style={{
                                      height: rowH, position: "relative",
                                      borderBottom: rowIdx < rows.length - 1 ? `1px solid rgba(0,0,0,0.05)` : "none",
                                      backgroundColor: "transparent",
                                    }}>
                                      {slots.map(s => (
                                        <div key={s} style={{
                                          position: "absolute",
                                          left: (s - wStartM) / 30 * cellW, top: 0,
                                          width: cellW, height: rowH,
                                          borderRight: `1px solid rgba(0,0,0,0.05)`,
                                          cursor: "pointer", transition: "all 200ms",
                                        }}
                                          onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.02)"}
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
                                        const status = seg.booking.status;
                                        const isCompleted = status === "completed";
                                        const isOverdue = isBookingOverdue(seg.booking);
                                        
                                        const lx = segLeft(seg.startTime);
                                        const wd = Math.max(segWidth(seg.startTime, seg.endTime) - 6, 24);
                                        return (
                                          <div key={si} className="glass" style={{
                                            position: "absolute", left: lx + 3, top: 6,
                                            width: wd, height: rowH - 12,
                                            backgroundColor: isCompleted ? "#c5dfd4dd" : (isOverdue ? "#f97316dd" : `${color}dd`), 
                                            borderRadius: 12,
                                            border: isCombo ? `1px dashed rgba(255,255,255,0.4)` : "1px solid rgba(255,255,255,0.2)",
                                            overflow: "hidden", cursor: "pointer",
                                            transition: "all 300ms cubic-bezier(0.4, 0, 0.2, 1)",
                                            zIndex: 2, padding: "6px 10px",
                                            display: "flex", flexDirection: "column", justifyContent: "center",
                                            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                                          }}
                                            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 16px rgba(0,0,0,0.15)"; }}
                                            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"; }}
                                            onClick={(e) => { e.stopPropagation(); setSelectedBookingId(seg.booking.id); }}
                                          >
                                            <div style={{ fontSize: 12, fontWeight: 800, color: isCompleted ? "#2D6A4F" : "#fff", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", lineHeight: 1.2 }}>
                                              {seg.booking.clientName}
                                            </div>
                                            <div style={{ fontSize: 10, fontWeight: 500, color: isCompleted ? "#2D6A4Fcc" : "rgba(255,255,255,0.85)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                                              {seg.procedureName}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })}

                                {/* Therapist indicator */}
                                <div style={{ display: "flex", height: 44, borderTop: `1px solid rgba(0,0,0,0.05)`, backgroundColor: "transparent" }}>
                                  {therapistUsage.map((u, i) => {
                                    const isFull = u.used >= u.total && u.total > 0;
                                    return (
                                      <div key={i} style={{
                                        width: cellW, flexShrink: 0, display: "flex", flexDirection: "column",
                                        alignItems: "center", justifyContent: "center", gap: 3,
                                        borderRight: `1px solid rgba(0,0,0,0.05)`,
                                      }}>
                                        <div style={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center", maxWidth: cellW - 8 }}>
                                          {Array.from({ length: Math.min(u.total, 8) }).map((_, j) => (
                                            <div key={j} style={{
                                              width: 5, height: 5, borderRadius: 2,
                                              backgroundColor: j < u.used ? C.accent : "rgba(0,0,0,0.1)",
                                            }} />
                                          ))}
                                        </div>
                                        <span style={{ fontSize: 9, fontWeight: 800, color: isFull ? "#F87171" : C.textSub, fontFamily: "'Poppins', sans-serif" }}>
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

function JournalScreen({ salons, onShowToast }) {
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

  const loadAll = useCallback(async () => {
    setLoadingJ(true);
    const keys = await Storage.list("spa-crm:bookings:");
    const promises = keys.map(k => Storage.get(k));
    const arrays = await Promise.all(promises);
    setAllBookings(arrays.flat().filter(Boolean));
    setLoadingJ(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const serviceName = (b) => b.bookingType === "combo" ? "Комбо" : (b.segments?.[0]?.procedureName || "—");
  const totalDuration = (b) => {
    if (!b.segments?.length) return 0;
    const ends = b.segments.map(s => timeToMins(s.endTime));
    const starts = b.segments.map(s => timeToMins(s.startTime));
    return Math.max(...ends) - Math.min(...starts);
  };
  const salonName = (b) => salons.find(s => s.id === b.salonId)?.name || "—";

  const filtered = allBookings.filter(b => {
    if (filterSalon !== "all" && b.salonId !== filterSalon) return false;
    if (filterStatus !== "all" && b.status !== filterStatus) return false;
    if (dateFrom && b.date < dateFrom) return false;
    if (dateTo && b.date > dateTo) return false;
    if (search) {
      const q = search.toLowerCase();
      return b.clientName?.toLowerCase().includes(q) || b.clientPhone?.includes(q);
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let va, vb;
    switch (sortCol) {
      case "date": va = a.date + (a.totalStartTime || ""); vb = b.date + (b.totalStartTime || ""); break;
      case "name": va = a.clientName || ""; vb = b.clientName || ""; break;
      case "master": va = a.masterName || ""; vb = b.masterName || ""; break;
      case "price": va = a.totalPrice || 0; vb = b.totalPrice || 0; break;
      case "status": va = a.status; vb = b.status; break;
      default: va = a.date; vb = b.date;
    }
    return sortDir === "asc" ? (va < vb ? -1 : 1) : (va < vb ? 1 : -1);
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, filterSalon, filterStatus, dateFrom, dateTo]);

  const handleStatusChange = async (bId, sId, bDate, newS) => {
    const ym = bDate.slice(0, 7);
    const key = KEYS.bookings(sId, ym);
    const arr = await Storage.get(key) || [];
    const booking = arr.find(b => b.id === bId);
    if (!booking) return;
    const updated = arr.map(b => b.id === bId ? { ...b, status: newS } : b);
    await Storage.set(key, updated);
    setAllBookings(prev => prev.map(b => b.id === bId ? { ...b, status: newS } : b));
    onShowToast("Статус обновлен");
    
    if (window.notifyTelegram) {
      const sObj = salons.find(s => s.id === sId);
      window.notifyTelegram("status", { ...booking, salonName: sObj?.name || "", oldStatus: booking.status, newStatus: newS });
    }
  };

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  const formatDateRu = (d) => {
    if (!d) return "—";
    const [y, m, day] = d.split("-");
    return `${day}.${m}.${y}`;
  };

  if (loadingJ) return (
    <div style={{ display: "flex", justifyContent: "center", padding: 100 }}>
      <Loader2 size={32} color={C.accent} style={{ animation: "spin 1s linear infinite" }} />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {/* Filters Card */}
      <div className="glass" style={{ borderRadius: 32, padding: 32, boxShadow: "0 10px 40px rgba(0,0,0,0.03)" }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 240px", maxWidth: 400 }}>
            <Search size={18} style={{ position: "absolute", left: 16, top: 15, color: C.textSub }} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Поиск клиента или телефона..."
              style={{ ...inputStyle(), paddingLeft: 48, borderRadius: 16, height: 48 }}
            />
          </div>

          <select value={filterSalon} onChange={e => setFilterSalon(e.target.value)}
            style={{ ...inputStyle(), width: "auto", minWidth: 160, borderRadius: 16, height: 48, cursor: "pointer" }}>
            <option value="all">Все салоны</option>
            {salons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ ...inputStyle(), width: "auto", minWidth: 180, borderRadius: 16, height: 48, cursor: "pointer" }}>
            <option value="all">Все статусы</option>
            {Object.entries(STATUS_CFG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
          </select>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              style={{ ...inputStyle(), width: 150, borderRadius: 16, height: 48, colorScheme: "light" }} />
            <span style={{ color: C.textSub, fontWeight: 700 }}>—</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              style={{ ...inputStyle(), width: 150, borderRadius: 16, height: 48, colorScheme: "light" }} />
          </div>
        </div>
      </div>

      {/* Main Journal Table */}
      <div className="glass" style={{ borderRadius: 32, overflow: "hidden", boxShadow: "0 20px 80px rgba(0,0,0,0.05)" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1000 }}>
            <thead>
              <tr style={{ backgroundColor: "rgba(0,0,0,0.02)" }}>
                {["date", "name", "master", "service", "duration", "price", "status"].map(col => {
                  const labels = { date: "Дата", name: "Клиент", master: "Мастер", service: "Услуга", duration: "Длит.", price: "Цена", status: "Статус" };
                  const isSorted = sortCol === col;
                  return (
                    <th key={col} onClick={() => toggleSort(col)} style={{
                      padding: "24px 20px", textAlign: "left", fontSize: 11, fontWeight: 800,
                      color: C.textSub, textTransform: "uppercase", letterSpacing: "0.1em",
                      cursor: "pointer", borderBottom: "1px solid rgba(0,0,0,0.05)",
                      whiteSpace: "nowrap"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {labels[col]}
                        {isSorted && (sortDir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((b, bIdx) => {
                const bOverdue = isBookingOverdue(b);
                const sCfg = bOverdue ? OVERDUE_CFG : (STATUS_CFG[b.status] || STATUS_CFG.booked);
                return (
                  <tr key={b.id} style={{
                    borderBottom: "1px solid rgba(0,0,0,0.03)", 
                    transition: "all 200ms",
                    backgroundColor: bIdx % 2 === 0 ? "transparent" : "rgba(0,0,0,0.01)"
                  }} onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.02)"} onMouseLeave={e => e.currentTarget.style.backgroundColor = bIdx % 2 === 0 ? "transparent" : "rgba(0,0,0,0.01)"}>
                    <td style={{ padding: "16px 20px" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.textMain }}>{formatDateRu(b.date)}</div>
                      <div style={{ fontSize: 11, color: C.textSub, fontWeight: 600 }}>{b.totalStartTime}</div>
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.textMain }}>{b.clientName}</div>
                      <div style={{ fontSize: 12, color: C.textSub, fontWeight: 600 }}>{b.clientPhone}</div>
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>{b.masterName || "—"}</div>
                      <div style={{ fontSize: 11, color: C.textSub, fontWeight: 600 }}>{salonName(b)}</div>
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      <span style={{ padding: "4px 10px", borderRadius: 8, backgroundColor: "rgba(0,0,0,0.05)", fontSize: 12, fontWeight: 600, color: C.textMain }}>
                        {serviceName(b)}
                      </span>
                    </td>
                    <td style={{ padding: "16px 20px", fontSize: 13, fontWeight: 600, color: C.textSub }}>
                      {totalDuration(b)} м
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      <div style={{ fontSize: 14, fontWeight: 900, color: C.textMain }}>{b.totalPrice.toLocaleString()} ₸</div>
                      <div style={{ fontSize: 10, color: C.textSub, fontWeight: 800 }}>{PAYMENT_LABEL[b.paymentMethod] || "НАЛ"}</div>
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      <select value={b.status}
                        onChange={e => handleStatusChange(b.id, b.salonId, b.date, e.target.value)}
                        style={{
                          backgroundColor: sCfg.color + "15", border: "none",
                          borderRadius: 12, padding: "8px 12px", fontSize: 12, fontWeight: 800,
                          color: sCfg.color, cursor: "pointer", outline: "none",
                        }}>
                        {Object.entries(STATUS_CFG).map(([val, cfg]) => (
                          <option key={val} value={val}>{cfg.label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {pageItems.length === 0 && (
          <div style={{ padding: 80, textAlign: "center", color: C.textSub }}>
            <span style={{ fontSize: 40 }}>📔</span>
            <p style={{ margin: "16px 0 0", fontSize: 18, fontWeight: 700 }}>Журнал пуст</p>
            <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 500 }}>Записей по вашим фильтрам не найдено</p>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div style={{ padding: 24, display: "flex", justifyContent: "center", gap: 8, backgroundColor: "rgba(0,0,0,0.01)", borderTop: "1px solid rgba(0,0,0,0.03)" }}>
            <button disabled={safePage === 1} onClick={() => setPage(p => p - 1)} style={{
              width: 40, height: 40, borderRadius: 12, border: "1px solid rgba(0,0,0,0.05)",
              backgroundColor: "#fff", color: C.textSub, display: "flex", alignItems: "center", justifyContent: "center", cursor: safePage === 1 ? "default" : "pointer", opacity: safePage === 1 ? 0.5 : 1
            }}>
              <ChevronLeft size={20} />
            </button>
            <div style={{ display: "flex", alignItems: "center", px: 16, fontSize: 14, fontWeight: 800, color: C.textMain }}>
              {safePage} / {totalPages}
            </div>
            <button disabled={safePage === totalPages} onClick={() => setPage(p => p + 1)} style={{
              width: 40, height: 40, borderRadius: 12, border: "1px solid rgba(0,0,0,0.05)",
              backgroundColor: "#fff", color: C.textSub, display: "flex", alignItems: "center", justifyContent: "center", cursor: safePage === totalPages ? "default" : "pointer", opacity: safePage === totalPages ? 0.5 : 1
            }}>
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Dashboard Screen (STEP-11) ────────────────────────────────────────────

// Mini SVG chart components (no Recharts dependency)
// Mini SVG chart components (no Recharts dependency)
function MiniBarChart({ data, barColor, width = 400, height = 180, label }) {
  if (!data.length) return <div style={{ color: C.textSub, fontSize: 13, padding: 40, textAlign: "center", fontWeight: 600 }}>Нет данных</div>;
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const chartH = height - 40;
  const gap = 12;
  const barW = (width - 60 - (data.length - 1) * gap) / data.length;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
      {data.map((d, i) => {
        const h = (d.value / maxVal) * (chartH - 20);
        const x = 30 + i * (barW + gap);
        return (
          <g key={i}>
            <rect x={x} y={chartH - h} width={barW} height={h} rx={barW / 2} fill={barColor} opacity={0.6}>
              <title>{d.label}: {d.value.toLocaleString("ru-RU")}{label ? ` ${label}` : ""}</title>
            </rect>
            <text x={x + barW / 2} y={height - 5} textAnchor="middle" fill={C.textSub} fontSize={11} fontWeight={700} style={{ fontFamily: "'Inter', sans-serif" }}>{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function PremiumAreaChart({ data, width = 600, height = 240, color = C.accent }) {
  if (!data || !data.length) return <div style={{ color: C.textSub, fontSize: 13, padding: 40, textAlign: "center", fontWeight: 600 }}>Нет данных</div>;
  
  const padding = { top: 20, right: 20, bottom: 40, left: 40 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const points = data.map((d, i) => ({
    x: padding.left + (i / (data.length - 1 || 1)) * chartW,
    y: padding.top + chartH - (d.value / maxVal) * chartH,
    value: d.value,
    label: d.label
  }));

  const linePath = points.length > 0 
    ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ")
    : "";
    
  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length-1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`
    : "";

  return (
    <div style={{ width: "100%", overflow: "hidden" }}>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        
        {/* Grid lines (horizontal) */}
        {[0, 0.25, 0.5, 0.75, 1].map(v => (
          <line key={v} x1={padding.left} y1={padding.top + chartH * v} x2={padding.left + chartW} y2={padding.top + chartH * v} 
                stroke="rgba(0,0,0,0.03)" strokeWidth="1" />
        ))}

        {/* Area */}
        <path d={areaPath} fill="url(#areaGradient)" />
        
        {/* Line */}
        <path d={linePath} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        
        {/* Points & Labels */}
        {points.map((p, i) => {
          const showLabel = data.length <= 10 || i % Math.ceil(data.length / 7) === 0 || i === data.length - 1;
          return (
            <g key={i}>
              {showLabel && (
                <text x={p.x} y={height - 10} textAnchor="middle" fill={C.textSub} fontSize={10} fontWeight={700}>
                  {p.label}
                </text>
              )}
              <circle cx={p.x} cy={p.y} r="4" fill="#fff" stroke={color} strokeWidth="2">
                <title>{p.label}: {p.value.toLocaleString()} ₸</title>
              </circle>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function MiniPieChart({ data, width = 240, height = 240 }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  if (!total) return <div style={{ color: C.textSub, fontSize: 13, padding: 40, textAlign: "center", fontWeight: 600 }}>Нет данных</div>;
  const cx = width / 2, cy = height / 2, r = Math.min(cx, cy) - 30;
  let cumAngle = -Math.PI / 2;
  const nonZero = data.filter(d => d.value > 0);
  const slices = nonZero.map(d => {
    const angle = (d.value / total) * Math.PI * 2;
    const start = cumAngle;
    cumAngle += angle;
    if (nonZero.length === 1) return { ...d, path: `M${cx},${cy - r} A${r},${r} 0 1,1 ${cx},${cy + r} A${r},${r} 0 1,1 ${cx},${cy - r} Z`, pct: 100 };
    const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(start + angle), y2 = cy + r * Math.sin(start + angle);
    const large = angle > Math.PI ? 1 : 0;
    return { ...d, path: `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z`, pct: Math.round(d.value / total * 100) };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32 }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="#fff" strokeWidth={6} style={{ transition: "all 300ms", cursor: "pointer" }}>
            <title>{s.label}: {s.value} ({s.pct}%)</title>
          </path>
        ))}
      </svg>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center" }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: s.color }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: C.textMain }}>{s.label} <span style={{ color: C.textSub }}>{s.pct}%</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniHBarChart({ data, barColor, width = 400 }) {
  if (!data.length) return <div style={{ color: C.textSub, fontSize: 13, padding: 40, textAlign: "center", fontWeight: 600 }}>Нет данных</div>;
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const rowH = 44;
  const labelW = 120;
  return (
    <svg width="100%" height={data.length * rowH + 10} viewBox={`0 0 ${width} ${data.length * rowH + 10}`} preserveAspectRatio="xMidYMid meet">
      {data.map((d, i) => {
        const barMax = width - labelW - 80;
        const w = (d.value / maxVal) * barMax;
        return (
          <g key={i}>
            <text x={0} y={i * rowH + rowH / 2 + 5} textAnchor="start" fill={C.textSub} fontSize={12} fontWeight={700} style={{ fontFamily: "'Inter', sans-serif" }}>{d.label}</text>
            <rect x={labelW} y={i * rowH + 10} width={w} height={rowH - 20} rx={(rowH - 20) / 2} fill={barColor} opacity={0.6} />
            <text x={labelW + w + 12} y={i * rowH + rowH / 2 + 5} fill={C.textMain} fontSize={14} fontWeight={800} style={{ fontFamily: "'Poppins', sans-serif" }}>{d.value}</text>
          </g>
        );
      })}
    </svg>
  );
}

function KpiRing({ pct, size = 40, color = C.accent }) {
  const strokeWidth = size / 8;
  const r = (size - strokeWidth) / 2, c = size / 2, circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - Math.min(pct, 100) / 100);
  return (
    <svg width={size} height={size}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(0,0,0,0.03)" strokeWidth={strokeWidth} />
      <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={dashOffset}
        strokeLinecap="round" transform={`rotate(-90 ${c} ${c})`} style={{ transition: "stroke-dashoffset 1s ease-out" }} />
    </svg>
  );
}

function DashboardScreen({ salons }) {
  const isMobile = useIsMobile();
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
    const d = new Date();
    const y = d.getFullYear(), m = d.getMonth() + 1;
    const from = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return { from, to };
  })();

  const filtered = allBookings.filter(b => {
    if (dashSalon !== "all" && b.salonId !== dashSalon) return false;
    return b.date >= dateRange.from && b.date <= dateRange.to;
  });

  const computeKpi = (bookings, salonFilter) => {
    const bks = salonFilter ? bookings.filter(b => b.salonId === salonFilter) : bookings;
    const active = bks.filter(b => b.status !== "cancelled_refund" && b.status !== "cancelled_no_refund");
    const paid = bks.filter(b => (b.status === "completed" || b.status === "no-show" || b.status === "cancelled_no_refund") && b.paymentMethod !== "cert_dep");
    const certDep = bks.filter(b => b.paymentMethod === "cert_dep" && b.status !== "cancelled_refund" && b.status !== "cancelled_no_refund");
    
    const totalBookings = active.length;
    const totalClients = active.reduce((a, b) => a + (b.clientCount || 1), 0);
    const revenue = paid.reduce((a, b) => a + (b.totalPrice || 0), 0);
    const avgCheck = paid.length > 0 ? Math.round(revenue / paid.length) : 0;

    const targetSalons = salonFilter ? salons.filter(s => s.id === salonFilter) : salons;
    let roomBusyMins = 0, roomTotalMins = 0;
    let therBusyMins = 0, therTotalMins = 0;

    for (const sal of targetSalons) {
      const salBks = active.filter(b => b.salonId === sal.id);
      const daysCount = new Set(salBks.map(b => b.date)).size;
      if (daysCount === 0) continue;
      const wMins = timeToMins(sal.workEnd) - timeToMins(sal.workStart);
      roomTotalMins += sal.rooms.length * wMins * daysCount;
      therTotalMins += (((sal.therapists || []).length || sal.therapistCount || 1) + (sal.hasPeeling ? (sal.peelingMastersMax || 2) : 0)) * wMins * daysCount;
      salBks.forEach(b => {
        (b.segments || []).forEach(seg => {
          const dur = timeToMins(seg.endTime) - timeToMins(seg.startTime);
          if (seg.resourceType === "room" && seg.roomId) roomBusyMins += dur;
          therBusyMins += (seg.therapistCount || 0) * dur;
        });
      });
    }

    const pmBreakdown = {};
    for (const pm of PAYMENT_METHODS) pmBreakdown[pm.value] = 0;
    active.forEach(b => { pmBreakdown[b.paymentMethod || "cash"]++; });

    return {
      totalBookings, totalClients, revenue, avgCheck, 
      roomPct: roomTotalMins > 0 ? Math.round(roomBusyMins / roomTotalMins * 100) : 0,
      therPct: therTotalMins > 0 ? Math.round(therBusyMins / therTotalMins * 100) : 0,
      refunded: bks.filter(b => b.status === "cancelled_refund").reduce((a, b) => a + (b.totalPrice || 0), 0),
      refundedCount: bks.filter(b => b.status === "cancelled_refund").reduce((a, b) => a + (b.clientCount || 1), 0),
      keptDeposit: bks.filter(b => b.status === "cancelled_no_refund").reduce((a, b) => a + (b.totalPrice || 0), 0),
      keptCount: bks.filter(b => b.status === "cancelled_no_refund").reduce((a, b) => a + (b.clientCount || 1), 0),
      certDepCount: certDep.length,
      certDepOriginalPrice: certDep.reduce((a, b) => a + (b.totalPrice || 0), 0),
      pmBreakdown,
      overdueBookings: active.filter(b => isBookingOverdue(b)).length
    };
  };

  const kpi = dashSalon !== "all" || salons.length < 2 ? computeKpi(filtered) : (() => {
    const perSalon = salons.map(s => computeKpi(filtered, s.id));
    const n = perSalon.length;
    const mergedPM = {};
    for (const pm of PAYMENT_METHODS) mergedPM[pm.value] = perSalon.reduce((a, k) => a + (k.pmBreakdown[pm.value] || 0), 0);
    return {
      totalBookings: Math.round(perSalon.reduce((a, k) => a + k.totalBookings, 0)),
      totalClients: Math.round(perSalon.reduce((a, k) => a + k.totalClients, 0)),
      revenue: Math.round(perSalon.reduce((a, k) => a + k.revenue, 0)),
      avgCheck: Math.round(perSalon.reduce((a, k) => a + (k.revenue > 0 ? k.avgCheck : 0), 0) / perSalon.filter(k => k.revenue > 0).length || 0),
      roomPct: Math.round(perSalon.reduce((a, k) => a + k.roomPct, 0) / n),
      therPct: Math.round(perSalon.reduce((a, k) => a + k.therPct, 0) / n),
      refunded: perSalon.reduce((a, k) => a + k.refunded, 0),
      refundedCount: perSalon.reduce((a, k) => a + k.refundedCount, 0),
      keptDeposit: perSalon.reduce((a, k) => a + k.keptDeposit, 0),
      keptCount: perSalon.reduce((a, k) => a + k.keptCount, 0),
      overdueBookings: perSalon.reduce((a, k) => a + k.overdueBookings, 0),
      certDepCount: perSalon.reduce((a, k) => a + k.certDepCount, 0),
      certDepOriginalPrice: perSalon.reduce((a, k) => a + k.certDepOriginalPrice, 0),
      pmBreakdown: mergedPM,
    };
  })();

  const revenueByDay = (() => {
    const map = {};
    const start = parseLocal(dateRange.from);
    const end = parseLocal(dateRange.to);
    
    // Fill all days in range with 0
    let curr = new Date(start);
    while (curr <= end) {
      const k = toDateStr(curr);
      map[k] = 0;
      curr.setDate(curr.getDate() + 1);
    }

    filtered.filter(b => (b.status === "completed" || b.status === "no-show" || b.status === "cancelled_no_refund") && b.paymentMethod !== "cert_dep").forEach(b => {
      if (map[b.date] !== undefined) {
        map[b.date] += (b.totalPrice || 0);
      }
    });

    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => {
      const parts = date.split("-");
      return { label: `${parts[2]}.${parts[1]}`, value };
    });
  })();

  const typeDist = (() => {
    const counts = { massage: 0, sauna: 0, peeling: 0, combo: 0 };
    filtered.forEach(b => {
      if (b.bookingType === "combo") counts.combo++;
      else {
        const cat = b.segments?.[0]?.resourceType || "massage";
        counts[cat]++;
      }
    });
    return [
      { label: "Массаж", value: counts.massage, color: "#785900" },
      { label: "Сауна", value: counts.sauna, color: "#d4c5ab" },
      { label: "Пилинг", value: counts.peeling, color: "#222" },
      { label: "Комбо", value: counts.combo, color: C.accent },
    ];
  })();

  const loadByHour = (() => {
    const hourMap = {};
    const dCount = new Set(filtered.map(b => b.date)).size || 1;
    filtered.forEach(b => {
      (b.segments || []).forEach(seg => {
        const s = Math.floor(timeToMins(seg.startTime) / 60), e = Math.ceil(timeToMins(seg.endTime) / 60);
        for (let h = s; h < e; h++) {
          const k = `${String(h).padStart(2, "0")}:00`;
          hourMap[k] = (hourMap[k] || 0) + (seg.therapistCount || 0);
        }
      });
    });
    return Object.entries(hourMap).sort(([a], [b]) => a.localeCompare(b)).map(([label, value]) => ({ label, value: Math.round(value / dCount * 10) / 10 }));
  })();

  const topProcs = (() => {
    const counts = {};
    filtered.forEach(b => (b.segments || []).forEach(s => { if (s.procedureName) counts[s.procedureName] = (counts[s.procedureName] || 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, value]) => ({ label: label.length > 20 ? label.slice(0, 20) + "..." : label, value }));
  })();

  const comparison = dashSalon === "all" && salons.length >= 2 ? salons.map(s => ({ name: s.name, ...computeKpi(filtered, s.id) })) : null;

  const pillStyle = (active) => ({
    padding: "12px 24px", borderRadius: 24, fontSize: 13, fontWeight: 800, border: "none",
    backgroundColor: active ? C.accent : "rgba(0,0,0,0.04)",
    color: active ? "#1b1c15" : C.textSub,
    cursor: "pointer", transition: "all 300ms",
    boxShadow: active ? `0 10px 20px ${C.accent}44` : "none",
  });

  const bentoCard = {
    backgroundColor: "#fff", borderRadius: 32, padding: 32,
    boxShadow: "0 10px 40px rgba(0,0,0,0.03)",
    display: "flex", flexDirection: "column", gap: 8,
    border: "1px solid rgba(0,0,0,0.02)"
  };

  if (loadingD) return (
    <div style={{ display: "flex", justifyContent: "center", padding: 100 }}>
      <Loader2 size={32} color={C.accent} style={{ animation: "spin 1s linear infinite" }} />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {/* Switchers */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20 }}>
        <div style={{ display: "flex", gap: 8, padding: 6, borderRadius: 32, backgroundColor: "rgba(0,0,0,0.03)" }}>
          {salons.map(s => <button key={s.id} onClick={() => setDashSalon(s.id)} style={pillStyle(dashSalon === s.id)}>{s.name}</button>)}
          <button onClick={() => setDashSalon("all")} style={pillStyle(dashSalon === "all")}>Все салоны</button>
        </div>
        <div style={{ display: "flex", gap: 8, padding: 6, borderRadius: 32, backgroundColor: "rgba(0,0,0,0.03)" }}>
          {[["today", "Сегодня"], ["week", "Неделя"], ["month", "Месяц"]].map(([v, l]) => (
            <button key={v} onClick={() => setPeriod(v)} style={pillStyle(period === v)}>{l}</button>
          ))}
        </div>
      </div>

      {/* Main KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 24 }}>
        {[
          { label: "Всего записей", val: kpi.totalBookings, icon: "📋" },
          { label: "Клиентов", val: kpi.totalClients, icon: "👥" },
          { label: "Выручка", val: `${kpi.revenue.toLocaleString()} ₸`, icon: "💰", accent: true },
          { label: "Средний чек", val: `${kpi.avgCheck.toLocaleString()} ₸`, icon: "📈" }
        ].map((item, i) => (
          <div key={i} style={{ ...bentoCard, borderBottom: item.accent ? `4px solid ${C.accent}` : bentoCard.border }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>{item.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: C.textMain, letterSpacing: "-0.03em" }}>{item.val}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.textSub, textTransform: "uppercase", letterSpacing: "0.05em" }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* Utilizations */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 24 }}>
        <div style={{ ...bentoCard, flexDirection: "row", alignItems: "center", gap: 24 }}>
          <KpiRing pct={kpi.roomPct} size={80} color="#785900" />
          <div>
            <div style={{ fontSize: 32, fontWeight: 900, color: C.textMain }}>{kpi.roomPct}%</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.textSub }}>Загрузка кабинок</div>
          </div>
        </div>
        <div style={{ ...bentoCard, flexDirection: "row", alignItems: "center", gap: 24 }}>
          <KpiRing pct={kpi.therPct} size={80} color={C.accent} />
          <div>
            <div style={{ fontSize: 32, fontWeight: 900, color: C.textMain }}>{kpi.therPct}%</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.textSub }}>Загрузка мастеров</div>
          </div>
        </div>
      </div>

      {/* Alert Overdue */}
      {kpi.overdueBookings > 0 && (
        <div style={{ ...bentoCard, backgroundColor: "#fff9f0", border: "1px solid #ffe8cc" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 24 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#862e00" }}>{kpi.overdueBookings} записей требуют внимания</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#b45309" }}>Прошедшее время, но статус не изменен. Обновите журнал.</div>
            </div>
          </div>
        </div>
      )}

      {/* Secondary KPIs Grid */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 24 }}>
        <div style={bentoCard}>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#e03131" }}>{kpi.refunded.toLocaleString()} ₸</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textSub }}>Возвраты ({kpi.refundedCount})</div>
        </div>
        <div style={bentoCard}>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#2f9e44" }}>{kpi.keptDeposit.toLocaleString()} ₸</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textSub }}>Удержанные депозиты ({kpi.keptCount})</div>
        </div>
        <div style={bentoCard}>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#f08c00" }}>{kpi.certDepCount} шт.</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textSub }}>Серт/Деп ({kpi.certDepOriginalPrice.toLocaleString()} ₸)</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 32 }}>
        <div style={{ ...bentoCard, gridColumn: isMobile ? "span 1" : "span 2" }}>
          <h3 style={{ margin: "0 0 24px 0", fontSize: 16, fontWeight: 800 }}>Выручка по дням (₸)</h3>
          <PremiumAreaChart data={revenueByDay} color={C.accent} />
        </div>
        <div style={bentoCard}>
          <h3 style={{ margin: "0 0 24px 0", fontSize: 16, fontWeight: 800 }}>Распределение услуг</h3>
          <MiniPieChart data={typeDist} />
        </div>
        <div style={bentoCard}>
          <h3 style={{ margin: "0 0 24px 0", fontSize: 16, fontWeight: 800 }}>Почасовая нагрузка</h3>
          <MiniBarChart data={loadByHour} barColor="#222" />
        </div>
        <div style={bentoCard}>
          <h3 style={{ margin: "0 0 24px 0", fontSize: 16, fontWeight: 800 }}>Популярные услуги</h3>
          <MiniHBarChart data={topProcs} barColor={C.accent} />
        </div>
      </div>

      {/* Comparison Table */}
      {comparison && (
        <div style={{ ...bentoCard, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "32px 32px 16px" }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Сравнение салонов</h3>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "rgba(0,0,0,0.02)" }}>
                  <th style={{ padding: "16px 32px", textAlign: "left", fontSize: 11, color: C.textSub, textTransform: "uppercase", letterSpacing: "0.1em" }}>Показатель</th>
                  {comparison.map(s => <th key={s.name} style={{ padding: "16px 32px", textAlign: "right", fontSize: 11, color: C.textSub, textTransform: "uppercase" }}>{s.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {[
                  { l: "Выручка", k: "revenue", f: v => `${v.toLocaleString()} ₸` },
                  { l: "Записей", k: "totalBookings", f: v => v },
                  { l: "Средний чек", k: "avgCheck", f: v => `${v.toLocaleString()} ₸` },
                  { l: "Загрузка мастеров", k: "therPct", f: v => `${v}%` },
                  { l: "Загрузка кабинок", k: "roomPct", f: v => `${v}%` },
                ].map((row, idx) => (
                  <tr key={row.k} style={{ borderBottom: "1px solid rgba(0,0,0,0.03)", backgroundColor: idx % 2 === 0 ? "transparent" : "rgba(0,0,0,0.01)" }}>
                    <td style={{ padding: "16px 32px", fontSize: 14, fontWeight: 700, color: C.textSub }}>{row.l}</td>
                    {comparison.map(s => (
                      <td key={s.name} style={{ padding: "16px 32px", textAlign: "right", fontSize: 15, fontWeight: 800, color: C.textMain }}>{row.f(s[row.k])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Workers Screen (Admin only) ─────────────────────────────────────────────

function WorkersScreen({ onShowToast, currentUser }) {
  const isMobile = useIsMobile();
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Form states
  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [newRole, setNewRole] = useState("worker");

  // Edit states
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("worker");
  const [editPassword, setEditPassword] = useState("");
  const [showEditPwd, setShowEditPwd] = useState(false);

  // Detail view
  const [selectedUser, setSelectedUser] = useState(null);
  const [userLogs, setUserLogs] = useState([]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const users = await UserStorage.getUsers();
    setAllUsers(users.sort((a, b) => a.name.localeCompare(b.name)));
    setLoading(false);
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleAdd = async () => {
    if (!name.trim() || !login.trim() || !password.trim()) {
      if (onShowToast) onShowToast("Заполните все поля");
      return;
    }
    const result = await UserStorage.createUser(login.trim(), password.trim(), name.trim(), newRole);
    if (result.error) {
      if (onShowToast) onShowToast(result.error === "User already registered" ? "Логин уже занят" : result.error);
      return;
    }
    setShowAdd(false); setName(""); setLogin(""); setPassword(""); setNewRole("worker");
    await loadUsers();
    if (onShowToast) onShowToast("Аккаунт создан");
  };

  const handleDelete = async (id) => {
    const users = await UserStorage.getUsers();
    if (users.find(u => u.id === id)?.role === "admin") {
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

  const startEdit = (user) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditRole(user.role);
    setEditPassword(user.password || "");
    setShowEditPwd(false);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) return;
    const users = await UserStorage.getUsers();
    if (editingUser.role === "admin" && editRole !== "admin") {
      const adminCount = users.filter(u => u.role === "admin").length;
      if (adminCount <= 1) {
        if (onShowToast) onShowToast("Нельзя убрать роль у последнего администратора");
        return;
      }
    }
    await UserStorage.saveUser({ ...editingUser, name: editName.trim(), role: editRole, password: editPassword });
    setEditingUser(null);
    await loadUsers();
    if (onShowToast) onShowToast("Аккаунт обновлён");
  };

  const openUserLogs = async (user) => {
    setSelectedUser(user);
    const logs = await UserStorage.getLogs();
    setUserLogs(logs.filter(l => l.userId === user.id).sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
  };

  const inputStyle = {
    width: "100%", padding: "14px 20px", borderRadius: 20, fontSize: 13, fontWeight: 600,
    border: "none", backgroundColor: "rgba(0,0,0,0.03)", color: C.textMain, outline: "none",
  };

  const roleToggle = (value, onChange) => (
    <div style={{ display: "flex", gap: 6, padding: 6, borderRadius: 32, backgroundColor: "rgba(0,0,0,0.03)" }}>
      {[{ v: "worker", l: "Работник" }, { v: "admin", l: "Админ" }].map(r => (
        <button key={r.v} type="button" onClick={() => onChange(r.v)} style={{
          flex: 1, padding: "10px 20px", borderRadius: 24, border: "none",
          fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 300ms",
          backgroundColor: value === r.v ? C.accent : "transparent",
          color: value === r.v ? "#1b1c15" : C.textSub,
        }}>{r.l}</button>
      ))}
    </div>
  );

  const bentoCard = {
    backgroundColor: "#fff", borderRadius: 32, padding: 32,
    boxShadow: "0 10px 40px rgba(0,0,0,0.03)",
    display: "flex", flexDirection: "column", gap: 8,
    border: "1px solid rgba(0,0,0,0.02)"
  };

  if (selectedUser) {
    const logActionBadge = (action) => ({
      padding: "4px 12px", borderRadius: 12, fontSize: 11, fontWeight: 800, textTransform: "uppercase",
      backgroundColor: action === "create" ? "#34D39915" : action === "delete" ? "#EF444415" : "#FBBF2415",
      color: action === "create" ? "#059669" : action === "delete" ? "#DC2626" : "#A67C00",
    });
    return (
      <div style={{ animation: "fadeIn 400ms ease-out" }}>
        <button onClick={() => setSelectedUser(null)} style={{
          background: "none", border: "none", color: C.accent, cursor: "pointer",
          fontSize: 14, fontWeight: 800, marginBottom: 24, display: "flex", alignItems: "center", gap: 8,
        }}>
          <ChevronLeft size={18} /> Назад к списку
        </button>
        <div style={{ ...bentoCard, marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", gap: 16, flexDirection: isMobile ? "column" : "row" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>👤</div>
              <div>
                <h2 style={{ color: C.textMain, fontSize: isMobile ? 20 : 24, fontWeight: 900, margin: 0 }}>{selectedUser.name}</h2>
                <div style={{ color: C.textSub, fontSize: 12, fontWeight: 600 }}>@{selectedUser.login} · {new Date(selectedUser.createdAt).toLocaleDateString("ru-RU")}</div>
              </div>
            </div>
            <span style={{
              marginLeft: isMobile ? 0 : "auto", padding: "6px 16px", borderRadius: 20, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em",
              backgroundColor: selectedUser.role === "admin" ? "#222" : "#d4c5ab",
              color: selectedUser.role === "admin" ? "#fff" : "#1b1c15",
            }}>{selectedUser.role === "admin" ? "Админ" : "Работник"}</span>
          </div>
        </div>

        <h3 style={{ color: C.textMain, fontSize: 18, fontWeight: 800, marginBottom: 20 }}>Логи действий ({userLogs.length})</h3>
        {userLogs.length === 0 ? (
          <div style={bentoCard}>Нет действий</div>
        ) : isMobile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {userLogs.map(log => (
              <div key={log.id} style={{ ...bentoCard, padding: 16, gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={logActionBadge(log.action)}>
                    {log.action === "create" ? "Создание" : log.action === "delete" ? "Удаление" : "Изменение"}
                  </span>
                  <span style={{ fontSize: 12, color: C.textSub, fontWeight: 600 }}>{new Date(log.timestamp).toLocaleString("ru-RU")}</span>
                </div>
                <div style={{ fontSize: 13, color: C.textSub, fontWeight: 500, marginTop: 4 }}>{log.details || "—"}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ ...bentoCard, padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "rgba(0,0,0,0.02)" }}>
                    <th style={{ padding: "16px 32px", textAlign: "left", fontSize: 11, color: C.textSub, textTransform: "uppercase" }}>Дата</th>
                    <th style={{ padding: "16px 32px", textAlign: "left", fontSize: 11, color: C.textSub, textTransform: "uppercase" }}>Действие</th>
                    <th style={{ padding: "16px 32px", textAlign: "left", fontSize: 11, color: C.textSub, textTransform: "uppercase" }}>Детали</th>
                  </tr>
                </thead>
                <tbody>
                  {userLogs.map(log => (
                    <tr key={log.id} style={{ borderBottom: "1px solid rgba(0,0,0,0.03)" }}>
                      <td style={{ padding: "16px 32px", fontSize: 14, fontWeight: 600 }}>{new Date(log.timestamp).toLocaleString("ru-RU")}</td>
                      <td style={{ padding: "16px 32px" }}>
                        <span style={logActionBadge(log.action)}>
                          {log.action === "create" ? "Создание" : log.action === "delete" ? "Удаление" : "Изменение"}
                        </span>
                      </td>
                      <td style={{ padding: "16px 32px", fontSize: 13, color: C.textSub, fontWeight: 500 }}>{log.details || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ animation: "fadeIn 400ms ease-out" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: isMobile ? 20 : 32, gap: 12 }}>
        <h2 style={{ color: C.textMain, fontSize: isMobile ? 22 : 28, fontWeight: 900, margin: 0 }}>Персонал</h2>
        <button onClick={() => setShowAdd(!showAdd)} style={{
          display: "flex", alignItems: "center", gap: isMobile ? 6 : 10,
          padding: isMobile ? "10px 16px" : "14px 28px", borderRadius: 32,
          border: "none", backgroundColor: C.accent, color: "#1b1c15",
          fontSize: isMobile ? 13 : 14, fontWeight: 800, cursor: "pointer", transition: "all 300ms",
          boxShadow: `0 10px 20px ${C.accent}44`, flexShrink: 0,
        }}>
          <UserPlus size={isMobile ? 16 : 18} /> Добавить
        </button>
      </div>

      {showAdd && (
        <div style={{ ...bentoCard, marginBottom: 32, gap: 24, backgroundColor: "rgba(255,255,255,0.8)", backdropFilter: "blur(20px)" }}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 20 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: C.textSub, marginBottom: 8, textTransform: "uppercase" }}>Имя</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Имя Фамилия" style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: C.textSub, marginBottom: 8, textTransform: "uppercase" }}>Логин</label>
              <input value={login} onChange={e => setLogin(e.target.value)} placeholder="worker1" style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: C.textSub, marginBottom: 8, textTransform: "uppercase" }}>Пароль</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Пароль" style={inputStyle} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 12, color: C.textSub, marginBottom: 4 }}>Роль</label>
            {roleToggle(newRole, setNewRole)}
          </div>
          <div style={{ display: "flex", gap: 10, flexDirection: isMobile ? "column" : "row" }}>
            <button onClick={handleAdd} style={{
              padding: "12px 24px", borderRadius: 20, border: "none",
              backgroundColor: C.accent, color: "#1b1c15", fontSize: 14, fontWeight: 700, cursor: "pointer",
              boxShadow: `0 8px 16px ${C.accent}33`,
            }}>Сохранить</button>
            <button onClick={() => { setShowAdd(false); setName(""); setLogin(""); setPassword(""); setNewRole("worker"); }} style={{
              padding: "12px 24px", borderRadius: 20, border: "none",
              backgroundColor: "rgba(0,0,0,0.05)", color: C.textSub, fontSize: 14, fontWeight: 600, cursor: "pointer",
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
          <div className="glass" style={{
            width: "100%", maxWidth: 420, padding: isMobile ? 24 : 32, borderRadius: 32,
            backgroundColor: "rgba(255,255,255,0.85)", border: "1px solid rgba(0,0,0,0.03)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.08)", margin: "0 16px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.textMain }}>Редактировать аккаунт</h3>
              <button onClick={() => setEditingUser(null)} style={{
                background: "rgba(0,0,0,0.05)", border: "none", cursor: "pointer", color: C.textSub,
                width: 32, height: 32, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center",
              }}><X size={18} /></button>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.textSub, marginBottom: 6, textTransform: "uppercase" }}>Логин (не меняется)</label>
              <input disabled value={editingUser.login} style={{ ...inputStyle, opacity: 0.5, cursor: "not-allowed" }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.textSub, marginBottom: 6, textTransform: "uppercase" }}>Имя</label>
              <input value={editName} onChange={e => setEditName(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.textSub, marginBottom: 6, textTransform: "uppercase" }}>Пароль</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showEditPwd ? "text" : "password"}
                  value={editPassword}
                  onChange={e => setEditPassword(e.target.value)}
                  style={{ ...inputStyle, paddingRight: 40 }}
                />
                <button type="button" onClick={() => setShowEditPwd(!showEditPwd)} style={{
                  position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", color: C.textSub, padding: 4,
                }}>
                  {showEditPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.textSub, marginBottom: 6, textTransform: "uppercase" }}>Роль</label>
              {roleToggle(editRole, setEditRole)}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleSaveEdit} style={{
                flex: 1, padding: "12px 0", borderRadius: 20, border: "none",
                backgroundColor: C.accent, color: "#1b1c15", fontSize: 14, fontWeight: 700, cursor: "pointer",
                boxShadow: `0 8px 16px ${C.accent}33`,
              }}>Сохранить</button>
              <button onClick={() => setEditingUser(null)} style={{
                flex: 1, padding: "12px 0", borderRadius: 20, border: "none",
                backgroundColor: "rgba(0,0,0,0.05)", color: C.textSub, fontSize: 14, fontWeight: 600, cursor: "pointer",
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
                display: "flex", alignItems: isMobile ? "flex-start" : "center",
                flexDirection: isMobile ? "column" : "row",
                justifyContent: "space-between",
                padding: isMobile ? "12px 14px" : "14px 18px", borderRadius: 20,
                backgroundColor: "#fff", border: `1px solid ${isSelf ? C.accent + "66" : "rgba(0,0,0,0.03)"}`,
                cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
                gap: isMobile ? 10 : 0,
              }} onClick={() => openUserLogs(w)}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ color: C.textMain, fontWeight: 600, fontSize: isMobile ? 13 : 14 }}>{w.name}</span>
                      <span style={{
                        padding: "1px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                        backgroundColor: w.role === "admin" ? `${C.accent}22` : "#34D39922",
                        color: w.role === "admin" ? C.accent : "#34D399",
                      }}>{w.role === "admin" ? "Админ" : "Работник"}</span>
                      {isSelf && <span style={{ fontSize: 11, color: C.textSub }}>(вы)</span>}
                    </div>
                    <div style={{ color: C.textSub, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>@{w.login} · {new Date(w.createdAt).toLocaleDateString("ru-RU")}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, alignSelf: isMobile ? "flex-end" : "center" }}>
                  <button onClick={(e) => { e.stopPropagation(); startEdit(w); }} style={{
                    background: "rgba(0,0,0,0.04)", border: "none", cursor: "pointer", color: C.textSub,
                    padding: 6, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                  }} title="Редактировать">
                    <Settings size={14} />
                  </button>
                  {confirmDeleteId === w.id ? (
                    <>
                      <span style={{ color: C.textSub, fontSize: 12 }}>Удалить?</span>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(w.id); }} style={{
                        padding: "4px 12px", borderRadius: 8, border: "none",
                        backgroundColor: "#EF4444", color: "#fff", fontSize: 12, cursor: "pointer",
                      }}>Да</button>
                      <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }} style={{
                        padding: "4px 12px", borderRadius: 8, border: "none",
                        backgroundColor: "rgba(0,0,0,0.05)", color: C.textSub, fontSize: 12, cursor: "pointer",
                      }}>Нет</button>
                    </>
                  ) : (
                    <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(w.id); }} style={{
                      background: "rgba(0,0,0,0.04)", border: "none", cursor: "pointer", color: C.textSub,
                      padding: 6, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
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
    padding: "14px 24px", borderRadius: 32, fontSize: 13, fontWeight: 800,
    border: "none", backgroundColor: "rgba(0,0,0,0.04)",
    color: "#1b1c15", outline: "none", cursor: "pointer",
  };

  const bentoCard = {
    backgroundColor: "#fff", borderRadius: 32, padding: 32,
    boxShadow: "0 10px 40px rgba(0,0,0,0.03)",
    display: "flex", flexDirection: "column", gap: 8,
    border: "1px solid rgba(0,0,0,0.02)"
  };

  return (
    <div style={{ animation: "fadeIn 400ms ease-out" }}>
      <h2 style={{ color: C.textMain, fontSize: 28, fontWeight: 900, marginBottom: 32 }}>Логи действий</h2>

      {/* Filters */}
      <div style={{ 
        display: "flex", gap: 12, marginBottom: 32, flexWrap: "wrap", alignItems: "center",
        padding: "12px", borderRadius: 40, backgroundColor: "rgba(0,0,0,0.03)"
      }}>
        <select value={filterUser} onChange={e => setFilterUser(e.target.value)} style={selectStyle}>
          <option value="all">Все работники</option>
          {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <select value={filterAction} onChange={e => setFilterAction(e.target.value)} style={selectStyle}>
          <option value="all">Все действия</option>
          <option value="create">Создание</option>
          <option value="edit">Изменение</option>
          <option value="delete">Удаление</option>
        </select>
        <div style={{ display: "flex", alignItems: "center", gap: 12, backgroundColor: "rgba(0,0,0,0.03)", padding: "10px 24px", borderRadius: 32 }}>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ background: "none", border: "none", fontSize: 13, fontWeight: 800, color: "#1b1c15", outline: "none" }} />
          <span style={{ color: C.textSub, fontWeight: 800 }}>—</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ background: "none", border: "none", fontSize: 13, fontWeight: 800, color: "#1b1c15", outline: "none" }} />
        </div>
        <div style={{ marginLeft: "auto", paddingRight: 24, fontSize: 13, fontWeight: 800, color: C.textSub }}>Найдено: {filtered.length}</div>
      </div>

      {loading ? (
        <div style={{ padding: 100, textAlign: "center" }}><Loader2 size={32} color={C.accent} style={{ animation: "spin 1s linear infinite" }} /></div>
      ) : (
        <div style={{ ...bentoCard, padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "rgba(0,0,0,0.02)" }}>
                  <th style={{ padding: "20px 32px", textAlign: "left", fontSize: 11, color: C.textSub, textTransform: "uppercase" }}>Время</th>
                  <th style={{ padding: "20px 32px", textAlign: "left", fontSize: 11, color: C.textSub, textTransform: "uppercase" }}>Работник</th>
                  <th style={{ padding: "20px 32px", textAlign: "left", fontSize: 11, color: C.textSub, textTransform: "uppercase" }}>Действие</th>
                  <th style={{ padding: "20px 32px", textAlign: "left", fontSize: 11, color: C.textSub, textTransform: "uppercase" }}>Детали</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(log => (
                  <tr key={log.id} style={{ borderBottom: "1px solid rgba(0,0,0,0.03)" }}>
                    <td style={{ padding: "20px 32px", fontSize: 14, fontWeight: 600 }}>{new Date(log.timestamp).toLocaleString("ru-RU")}</td>
                    <td style={{ padding: "20px 32px", fontSize: 14, fontWeight: 800, color: C.textMain }}>{log.userName}</td>
                    <td style={{ padding: "20px 32px" }}>
                      <span style={{
                        padding: "4px 12px", borderRadius: 12, fontSize: 11, fontWeight: 800, textTransform: "uppercase",
                        backgroundColor: log.action === "create" ? "#34D39915" : log.action === "delete" ? "#EF444415" : "#D4A84B15",
                        color: log.action === "create" ? "#059669" : log.action === "delete" ? "#DC2626" : "#A67C00",
                      }}>{log.action === "create" ? "Создание" : log.action === "delete" ? "Удаление" : "Изменение"}</span>
                    </td>
                    <td style={{ padding: "20px 32px", fontSize: 13, color: C.textSub, fontWeight: 500, maxWidth: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={log.details}>{log.details || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

function App() {
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
  const [, setBookings] = useState([]);

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

      let savedSalons = await Storage.get(KEYS.salons);
      // Migrate: generate therapists array from therapistCount if missing
      if (savedSalons && savedSalons.length > 0) {
        let migrated = false;
        savedSalons = savedSalons.map(s => {
          if (!s.therapists || s.therapists.length === 0) {
            const count = s.therapistCount || 6;
            migrated = true;
            return { ...s, therapists: Array.from({ length: count }, (_, i) => ({ id: `${s.id}-ther-${i + 1}`, name: `Массажистка ${i + 1}` })) };
          }
          return s;
        });
        if (migrated) await Storage.set(KEYS.salons, savedSalons);
      }
      // Migrate: add salon-3 "Чунжа" if only 2 salons exist
      if (savedSalons && savedSalons.length === 2 && !savedSalons.find(s => s.id === "salon-3")) {
        const s3 = { ...makeInitialSalonConfig("salon-3"), name: "Чунжа" };
        savedSalons = [...savedSalons, s3];
        const ok = await Storage.set(KEYS.salons, savedSalons);
        if (ok) {
          await Storage.set(KEYS.procedures("salon-3"), makeDefaultProcedures("salon-3"));
          await Storage.set(KEYS.combos("salon-3"), []);
        }
      }
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

  const handleLogin = useCallback(async (user) => {
    setCurrentUser({ id: user.id, name: user.name, login: user.login, role: user.role });
    if (user.role === "worker") setActiveTab("schedule");
    // Re-check salons after login (initial load may have been unauthenticated)
    let savedSalons = await Storage.get(KEYS.salons);
    if (savedSalons && savedSalons.length > 0) {
      savedSalons = savedSalons.map(s => {
        if (!s.therapists || s.therapists.length === 0) {
          const count = s.therapistCount || 6;
          return { ...s, therapists: Array.from({ length: count }, (_, i) => ({ id: `${s.id}-ther-${i + 1}`, name: `Массажистка ${i + 1}` })) };
        }
        return s;
      });
      // Migrate: add salon-3 "Чунжа" if only 2 salons exist
      if (savedSalons.length === 2 && !savedSalons.find(s => s.id === "salon-3")) {
        const s3 = { ...makeInitialSalonConfig("salon-3"), name: "Чунжа" };
        savedSalons = [...savedSalons, s3];
        const ok = await Storage.set(KEYS.salons, savedSalons);
        if (ok) {
          await Storage.set(KEYS.procedures("salon-3"), makeDefaultProcedures("salon-3"));
          await Storage.set(KEYS.combos("salon-3"), []);
        }
      }
      setSalons(savedSalons);
      const firstId = savedSalons[0].id;
      setActiveSalonId(firstId);
      await loadSalonData(firstId);
      setNeedsOnboarding(false);
    } else {
      setNeedsOnboarding(true);
    }
  }, [loadSalonData]);

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
      color: C.textMain,
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: 13,
      lineHeight: 1.5,
      overflowX: "hidden",
    }}>
      {/* Header with user info */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 56, zIndex: 50,
        backgroundColor: isMobile ? "#FFFFFF" : C.header,
        backdropFilter: isMobile ? "none" : "blur(16px)",
        WebkitBackdropFilter: isMobile ? "none" : "blur(16px)",
        borderBottom: `1px solid ${C.border}`,
        boxShadow: isMobile ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: isMobile ? "0 12px" : "0 24px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isMobile && (
            <button onClick={() => setMobileMenuOpen(v => !v)} style={{
              background: "none", border: "none", cursor: "pointer", color: C.textSub, padding: 4,
              display: "flex", alignItems: "center",
            }}>
              <Menu size={22} />
            </button>
          )}
          <Gem size={isMobile ? 18 : 22} color={C.accent} />
          {!isMobile && <span style={{ color: C.textMain, fontWeight: 600, fontSize: 16, letterSpacing: "0.5px" }}>SPA CRM</span>}
        </div>

        {/* Salon switcher */}
        <div style={{ display: "flex", gap: isMobile ? 4 : 8 }}>
          {salons.map((salon) => {
            const isActive = salon.id === activeSalonId;
            return (
              <button key={salon.id} onClick={() => handleSalonChange(salon.id)} style={{
                padding: isMobile ? (isActive ? "6px 12px" : "4px 10px") : (isActive ? "8px 24px" : "6px 16px"), borderRadius: 8,
                border: isActive ? `2px solid ${C.accent}` : `1px solid ${C.accent}55`,
                backgroundColor: isActive ? C.accent : "transparent",
                color: isActive ? C.bg : C.accent,
                fontWeight: isActive ? 700 : 500, fontSize: isMobile ? 11 : (isActive ? 15 : 13),
                cursor: "pointer", transition: "all 150ms",
                boxShadow: isActive ? `0 0 12px ${C.accent}44` : "none",
              }}>{salon.name}</button>
            );
          })}
        </div>

        {/* User info + logout */}
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 12 }}>
          {!isMobile && (
            <div style={{ textAlign: "right" }}>
              <div style={{ color: C.textMain, fontSize: 13, fontWeight: 600 }}>{currentUser.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                {isAdmin && <Shield size={10} color={C.accent} />}
                <span style={{ color: C.textSub, fontSize: 11 }}>{isAdmin ? "Админ" : "Работник"}</span>
              </div>
            </div>
          )}
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
      {isMobile ? (
        <>
          {/* Mobile bottom nav */}
          <nav style={{
            position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 49,
            backgroundColor: C.header, borderTop: `1px solid ${C.border}`,
            display: "flex", alignItems: "center", justifyContent: "space-around",
            height: "calc(56px + env(safe-area-inset-bottom, 0px))",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}>
            {visibleTabs.map(({ id, label, icon: Icon }) => {
              const isActive = activeTab === id;
              return (
                <button key={id} onClick={() => { handleTabChange(id); setMobileMenuOpen(false); }} style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                  padding: "4px 0", flex: 1,
                  background: "none", border: "none",
                  color: isActive ? C.accent : C.textSub,
                  fontSize: 9, fontWeight: isActive ? 600 : 400,
                  cursor: "pointer", transition: "all 150ms",
                }}>
                  <Icon size={18} />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>
          {/* Mobile slide-out menu overlay */}
          {mobileMenuOpen && (
            <div style={{ position: "fixed", inset: 0, zIndex: 200, backgroundColor: "rgba(0,0,0,0.5)" }}
              onClick={() => setMobileMenuOpen(false)}>
              <div style={{
                position: "absolute", top: 0, left: 0, bottom: 0, width: 260,
                backgroundColor: C.card, borderRight: `1px solid ${C.border}`,
                padding: "72px 16px 24px", display: "flex", flexDirection: "column", gap: 8,
              }} onClick={e => e.stopPropagation()}>
                <div style={{ color: C.textMain, fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{currentUser.name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 16 }}>
                  {isAdmin && <Shield size={12} color={C.accent} />}
                  <span style={{ color: C.textSub, fontSize: 12 }}>{isAdmin ? "Админ" : "Работник"}</span>
                </div>
                {visibleTabs.map(({ id, label, icon: Icon }) => {
                  const isActive = activeTab === id;
                  return (
                    <button key={id} onClick={() => { handleTabChange(id); setMobileMenuOpen(false); }} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px", borderRadius: 8,
                      background: isActive ? `${C.accent}22` : "none", border: "none",
                      color: isActive ? C.accent : C.textSub,
                      fontSize: 14, fontWeight: isActive ? 600 : 400,
                      cursor: "pointer", textAlign: "left", width: "100%",
                    }}>
                      <Icon size={18} />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
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
      )}

      {/* Content area */}
      <main style={{
        maxWidth: 1400,
        margin: isMobile ? "64px 0 0" : "100px auto 0",
        padding: isMobile ? "12px 12px calc(72px + env(safe-area-inset-bottom, 0px))" : 24,
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

// Entry point — expose globally for index.html
window.App = App;
