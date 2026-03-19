const https = require("https");
const fs = require("fs");
const path = require("path");

// ─── Load .env ──────────────────────────────────────────────────────────────
const ENV_FILE = path.join(__dirname, ".env");
if (fs.existsSync(ENV_FILE)) {
  fs.readFileSync(ENV_FILE, "utf-8").split("\n").forEach(line => {
    const eq = line.indexOf("=");
    if (eq > 0) {
      const key = line.slice(0, eq).trim();
      const val = line.slice(eq + 1).trim();
      if (key && val) process.env[key] = val;
    }
  });
}

// ─── Config ─────────────────────────────────────────────────────────────────
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SEND_HOUR = 21;
const SEND_MINUTE = 30;

if (!BOT_TOKEN) { console.error("ERROR: Missing TELEGRAM_BOT_TOKEN in .env"); process.exit(1); }
if (!SUPABASE_URL) { console.error("ERROR: Missing SUPABASE_URL in .env"); process.exit(1); }
if (!SUPABASE_KEY) { console.error("ERROR: Missing SUPABASE_SERVICE_ROLE_KEY in .env"); process.exit(1); }

const STATUS_LABEL = {
  booked: "Ожидает",
  completed: "Завершено",
  cancelled_refund: "Отменено (возврат)",
  cancelled_no_refund: "Отменено (без возврата)",
  "no-show": "Неявка",
};

// ─── Telegram API ───────────────────────────────────────────────────────────
function tgApi(method, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: "api.telegram.org",
      path: `/bot${BOT_TOKEN}/${method}`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
    }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => { try { resolve(JSON.parse(raw)); } catch { resolve(raw); } });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

// ─── Supabase REST API ──────────────────────────────────────────────────────
function supabaseGet(tablePath) {
  return new Promise((resolve, reject) => {
    const fullUrl = `${SUPABASE_URL}/rest/v1/${tablePath}`;
    const parsed = new URL(fullUrl);
    const req = https.request({
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
    }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => { try { resolve(JSON.parse(raw)); } catch { resolve(null); } });
    });
    req.on("error", reject);
    req.end();
  });
}

function supabasePost(table, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const parsed = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
    const req = https.request({
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname,
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
        ...headers,
      },
    }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => { try { resolve(JSON.parse(raw)); } catch { resolve(raw); } });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function supabaseDelete(tablePath) {
  return new Promise((resolve, reject) => {
    const fullUrl = `${SUPABASE_URL}/rest/v1/${tablePath}`;
    const parsed = new URL(fullUrl);
    const req = https.request({
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: "DELETE",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => resolve(raw));
    });
    req.on("error", reject);
    req.end();
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function escMd(text) {
  return String(text || "").replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

function fmtMoney(n) {
  return n.toLocaleString("ru-RU");
}

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ─── Build daily report ─────────────────────────────────────────────────────
async function buildDailyReport() {
  const dateStr = todayStr();
  const [yyyy, mm, dd] = dateStr.split("-");

  const salons = await supabaseGet("salons?select=*") || [];
  if (!Array.isArray(salons) || salons.length === 0) return null;

  const bookings = await supabaseGet(`bookings?select=*&date=eq.${dateStr}`) || [];

  const lines = [];
  lines.push(`📊 *Отчёт за ${dd}\\.${mm}\\.${yyyy}*`);
  lines.push("");

  let gTotal = 0, gClients = 0, gCompleted = 0;
  let gCancelled = 0, gNoShow = 0, gRevenue = 0;

  for (const salon of salons) {
    const sb = bookings.filter((b) => b.salon_id === salon.id);

    if (sb.length === 0) {
      lines.push(`🏠 *${escMd(salon.name)}*: нет записей`);
      lines.push("");
      continue;
    }

    const clients = sb.reduce((s, b) => s + (b.client_count || 1), 0);
    const booked = sb.filter((b) => b.status === "booked").length;
    const completed = sb.filter((b) => b.status === "completed").length;
    const cancelRefund = sb.filter((b) => b.status === "cancelled_refund");
    const cancelNoRefund = sb.filter((b) => b.status === "cancelled_no_refund");
    const noShow = sb.filter((b) => b.status === "no-show").length;

    const paid = sb.filter(
      (b) => b.status === "completed" || b.status === "no-show" || b.status === "cancelled_no_refund"
    );
    const revenue = paid.reduce((s, b) => s + (b.total_price || 0), 0);
    const refunded = cancelRefund.reduce((s, b) => s + (b.total_price || 0), 0);
    const keptDeposit = cancelNoRefund.reduce((s, b) => s + (b.total_price || 0), 0);

    lines.push(`🏠 *${escMd(salon.name)}*`);
    lines.push(`├ Записей: ${sb.length} \\(${clients} чел\\.\\)`);
    lines.push(`├ ✅ Завершено: ${completed}`);
    lines.push(`├ 📋 Ожидают: ${booked}`);
    lines.push(`├ ❌ Отмена \\(возврат\\): ${cancelRefund.length} — ${escMd(fmtMoney(refunded))} ₸`);
    lines.push(`├ 💰 Отмена \\(без возврата\\): ${cancelNoRefund.length} — ${escMd(fmtMoney(keptDeposit))} ₸`);
    lines.push(`├ 🚫 Неявка: ${noShow}`);
    lines.push(`└ 💵 Выручка: *${escMd(fmtMoney(revenue))} ₸*`);
    lines.push("");

    // Top procedures
    const procCounts = {};
    sb.forEach((b) => {
      const name = (b.segments || [])[0]?.procedureName || "Другое";
      procCounts[name] = (procCounts[name] || 0) + 1;
    });
    const topProcs = Object.entries(procCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
    if (topProcs.length > 0) {
      lines.push("📋 *Популярные услуги:*");
      topProcs.forEach(([name, count], i) => {
        lines.push(`  ${i + 1}\\. ${escMd(name)} — ${count}`);
      });
      lines.push("");
    }

    // Peak hour
    const hourMap = {};
    sb.forEach((b) => {
      const h = b.total_start_time?.slice(0, 2) || "??";
      hourMap[h] = (hourMap[h] || 0) + 1;
    });
    const busyHours = Object.entries(hourMap).sort(([, a], [, b]) => b - a);
    if (busyHours.length > 0) {
      lines.push(`⏰ Пиковый час: ${busyHours[0][0]}:00 \\(${busyHours[0][1]} записей\\)`);
      lines.push("");
    }

    gTotal += sb.length;
    gClients += clients;
    gCompleted += completed;
    gCancelled += cancelRefund.length + cancelNoRefund.length;
    gNoShow += noShow;
    gRevenue += revenue;
  }

  if (salons.length > 1) {
    lines.push("━━━━━━━━━━━━━━━━━━━━");
    lines.push("📈 *Итого по всем салонам:*");
    lines.push(`├ Записей: ${gTotal} \\(${gClients} чел\\.\\)`);
    lines.push(`├ ✅ Завершено: ${gCompleted}`);
    lines.push(`├ ❌ Отменено: ${gCancelled}`);
    lines.push(`├ 🚫 Неявка: ${gNoShow}`);
    lines.push(`└ 💵 Общая выручка: *${escMd(fmtMoney(gRevenue))} ₸*`);
  }

  return lines.join("\n");
}

// ─── Build schedule for a date ──────────────────────────────────────────────
async function buildSchedule(dateStr) {
  const [yyyy, mm, dd] = dateStr.split("-");

  const salons = await supabaseGet("salons?select=*") || [];
  if (!Array.isArray(salons) || salons.length === 0) return null;

  const bookings = await supabaseGet(
    `bookings?select=*&date=eq.${dateStr}&status=not.in.(cancelled_refund,cancelled_no_refund)&order=total_start_time.asc`
  ) || [];

  const lines = [];
  lines.push(`📅 *Расписание на ${dd}\\.${mm}\\.${yyyy}*`);
  lines.push("");

  let totalCount = 0;
  let totalRevenue = 0;

  for (const salon of salons) {
    const sb = Array.isArray(bookings) ? bookings.filter((b) => b.salon_id === salon.id) : [];
    lines.push(`🏠 *${escMd(salon.name)}*`);

    if (sb.length === 0) {
      lines.push("  _Нет записей_");
      lines.push("");
      continue;
    }

    for (const b of sb) {
      const proc = (b.segments || [])[0]?.procedureName || "—";
      const master = b.master_name || "—";
      const status = b.status !== "booked" ? ` \\[${escMd(STATUS_LABEL[b.status] || b.status)}\\]` : "";
      lines.push(
        `  ${escMd(b.total_start_time)}–${escMd(b.total_end_time)} │ ${escMd(b.client_name)} │ ${escMd(proc)} │ ${escMd(master)} │ ${escMd(fmtMoney(b.total_price || 0))} ₸${status}`
      );
    }
    lines.push("");

    totalCount += sb.length;
    totalRevenue += sb.reduce((s, b) => s + (b.total_price || 0), 0);
  }

  lines.push(`📊 Итого: ${totalCount} записей, ${escMd(fmtMoney(totalRevenue))} ₸`);
  return lines.join("\n");
}

// ─── Subscribers (Supabase) ─────────────────────────────────────────────────
async function getSubscribers() {
  const data = await supabaseGet("telegram_subscribers?select=chat_id");
  return Array.isArray(data) ? data.map((r) => r.chat_id) : [];
}

async function addSubscriber(chatId) {
  await supabasePost("telegram_subscribers", { chat_id: chatId });
}

async function removeSubscriber(chatId) {
  await supabaseDelete(`telegram_subscribers?chat_id=eq.${chatId}`);
}

// ─── Polling ────────────────────────────────────────────────────────────────
let lastUpdateId = 0;

async function pollUpdates() {
  try {
    const result = await tgApi("getUpdates", { offset: lastUpdateId + 1, timeout: 5 });
    if (result.ok && result.result) {
      for (const update of result.result) {
        lastUpdateId = update.update_id;
        const msg = update.message;
        if (!msg) continue;

        const chatId = msg.chat.id;
        const text = (msg.text || "").trim();

        if (text === "/start") {
          await addSubscriber(chatId);
          console.log(`Subscriber added: ${chatId}`);
          await tgApi("sendMessage", {
            chat_id: chatId,
            parse_mode: "MarkdownV2",
            text: [
              "✅ Вы подписаны на уведомления CRM\\!",
              "",
              "*Команды:*",
              "/today — расписание на сегодня",
              "/tomorrow — расписание на завтра",
              "/report — отчёт за сегодня",
              "/stop — отписаться",
            ].join("\n"),
          });
        }

        if (text === "/stop") {
          await removeSubscriber(chatId);
          console.log(`Subscriber removed: ${chatId}`);
          await tgApi("sendMessage", {
            chat_id: chatId,
            text: "🔕 Вы отписаны\\. Отправьте /start чтобы подписаться снова\\.",
            parse_mode: "MarkdownV2",
          });
        }

        if (text === "/report") {
          const report = await buildDailyReport();
          await tgApi("sendMessage", {
            chat_id: chatId,
            text: report || "Нет данных для отчёта\\.",
            parse_mode: "MarkdownV2",
          });
        }

        if (text === "/today") {
          const schedule = await buildSchedule(todayStr());
          await tgApi("sendMessage", {
            chat_id: chatId,
            text: schedule || "Нет данных\\.",
            parse_mode: "MarkdownV2",
          });
        }

        if (text === "/tomorrow") {
          const schedule = await buildSchedule(tomorrowStr());
          await tgApi("sendMessage", {
            chat_id: chatId,
            text: schedule || "Нет данных\\.",
            parse_mode: "MarkdownV2",
          });
        }
      }
    }
  } catch (err) {
    console.error("Poll error:", err.message);
  }
}

// ─── Scheduled daily send ───────────────────────────────────────────────────
let lastSentDate = "";

function checkSchedule() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const dateStr = now.toISOString().slice(0, 10);

  if (h === SEND_HOUR && m === SEND_MINUTE && lastSentDate !== dateStr) {
    lastSentDate = dateStr;
    sendDailyReport();
  }
}

async function sendDailyReport() {
  const report = await buildDailyReport();
  if (!report) { console.log("No report data — skipping"); return; }

  const chatIds = await getSubscribers();
  if (chatIds.length === 0) { console.log("No subscribers — skipping"); return; }

  console.log(`Sending daily report to ${chatIds.length} subscriber(s)...`);
  for (const chatId of chatIds) {
    try {
      await tgApi("sendMessage", { chat_id: chatId, text: report, parse_mode: "MarkdownV2" });
      console.log(`  → sent to ${chatId}`);
    } catch (err) {
      console.error(`  → failed for ${chatId}:`, err.message);
    }
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────
console.log("🤖 CRM Telegram Bot started (Supabase mode)");
console.log(`   Daily report at ${SEND_HOUR}:${String(SEND_MINUTE).padStart(2, "0")}`);
console.log("   Commands: /start, /stop, /report, /today, /tomorrow\n");

setInterval(pollUpdates, 2000);
setInterval(checkSchedule, 30000);
pollUpdates();
