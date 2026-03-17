const https = require("https");
const fs = require("fs");
const path = require("path");

// ─── Config ──────────────────────────────────────────────────────────────────
const BOT_TOKEN = "8667376995:AAGrBa2kcOtjS23Bo_eq48_dTEavrphdFgo";
const DATA_DIR = path.join(__dirname, "data");
const CHAT_IDS_FILE = path.join(DATA_DIR, "_bot_chat_ids.json");
const SEND_HOUR = 21;
const SEND_MINUTE = 30;

// ─── Helpers ─────────────────────────────────────────────────────────────────
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
      res.on("end", () => {
        try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function loadChatIds() {
  if (fs.existsSync(CHAT_IDS_FILE)) {
    try { return JSON.parse(fs.readFileSync(CHAT_IDS_FILE, "utf-8")); }
    catch { return []; }
  }
  return [];
}

function saveChatIds(ids) {
  fs.writeFileSync(CHAT_IDS_FILE, JSON.stringify(ids), "utf-8");
}

function readStorageKey(key) {
  const file = path.join(DATA_DIR, encodeURIComponent(key) + ".json");
  if (fs.existsSync(file)) {
    try { return JSON.parse(fs.readFileSync(file, "utf-8")); } catch { return null; }
  }
  return null;
}

function listStorageKeys(prefix) {
  if (!fs.existsSync(DATA_DIR)) return [];
  return fs.readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => decodeURIComponent(f.replace(/\.json$/, "")))
    .filter((k) => k.startsWith(prefix));
}

// ─── Build daily report ──────────────────────────────────────────────────────
function buildDailyReport() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const dateStr = `${yyyy}-${mm}-${dd}`;
  const ym = `${yyyy}-${mm}`;

  // Load salons
  const salons = readStorageKey("spa-crm:salons") || [];
  if (salons.length === 0) return null;

  const lines = [];
  lines.push(`📊 *Отчёт за ${dd}.${mm}.${yyyy}*`);
  lines.push("");

  let grandTotal = 0;
  let grandBookings = 0;
  let grandClients = 0;
  let grandCompleted = 0;
  let grandCancelled = 0;
  let grandNoShow = 0;
  let grandRevenue = 0;
  let grandRefunded = 0;

  for (const salon of salons) {
    const bookingKey = `spa-crm:bookings:${salon.id}:${ym}`;
    const allMonth = readStorageKey(bookingKey) || [];
    const dayBookings = allMonth.filter((b) => b.date === dateStr);

    if (dayBookings.length === 0) {
      lines.push(`🏠 *${escMd(salon.name)}*: нет записей`);
      lines.push("");
      continue;
    }

    const total = dayBookings.length;
    const clients = dayBookings.reduce((s, b) => s + (b.clientCount || 1), 0);
    const booked = dayBookings.filter((b) => b.status === "booked").length;
    const completed = dayBookings.filter((b) => b.status === "completed").length;
    const cancelledRefund = dayBookings.filter((b) => b.status === "cancelled_refund");
    const cancelledNoRefund = dayBookings.filter((b) => b.status === "cancelled_no_refund");
    const noShow = dayBookings.filter((b) => b.status === "no-show").length;

    const paid = dayBookings.filter(
      (b) => b.status === "completed" || b.status === "no-show" || b.status === "cancelled_no_refund"
    );
    const revenue = paid.reduce((s, b) => s + (b.totalPrice || 0), 0);
    const refunded = cancelledRefund.reduce((s, b) => s + (b.totalPrice || 0), 0);
    const keptDeposit = cancelledNoRefund.reduce((s, b) => s + (b.totalPrice || 0), 0);

    lines.push(`🏠 *${escMd(salon.name)}*`);
    lines.push(`├ Записей: ${total} (${clients} чел\\.)`);
    lines.push(`├ ✅ Завершено: ${completed}`);
    lines.push(`├ 📋 Ожидают: ${booked}`);
    lines.push(`├ ❌ Отмена \\(возврат\\): ${cancelledRefund.length} — ${formatMoney(refunded)} ₸`);
    lines.push(`├ 💰 Отмена \\(без возврата\\): ${cancelledNoRefund.length} — ${formatMoney(keptDeposit)} ₸`);
    lines.push(`├ 🚫 Неявка: ${noShow}`);
    lines.push(`└ 💵 Выручка: *${formatMoney(revenue)} ₸*`);
    lines.push("");

    // Top procedures
    const procCounts = {};
    dayBookings.forEach((b) => {
      const name = b.segments?.[0]?.procedureName || "Другое";
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

    // Time slots breakdown
    const hourMap = {};
    dayBookings.forEach((b) => {
      const h = b.totalStartTime?.slice(0, 2) || "??";
      hourMap[h] = (hourMap[h] || 0) + 1;
    });
    const busyHours = Object.entries(hourMap).sort(([, a], [, b]) => b - a);
    if (busyHours.length > 0) {
      const peakHour = busyHours[0];
      lines.push(`⏰ Пиковый час: ${peakHour[0]}:00 \\(${peakHour[1]} записей\\)`);
      lines.push("");
    }

    grandTotal += total;
    grandClients += clients;
    grandCompleted += completed;
    grandCancelled += cancelledRefund.length + cancelledNoRefund.length;
    grandNoShow += noShow;
    grandRevenue += revenue;
    grandRefunded += refunded;
  }

  // Grand total if multiple salons
  if (salons.length > 1) {
    lines.push("━━━━━━━━━━━━━━━━━━━━");
    lines.push(`📈 *Итого по всем салонам:*`);
    lines.push(`├ Записей: ${grandTotal} (${grandClients} чел\\.)`);
    lines.push(`├ ✅ Завершено: ${grandCompleted}`);
    lines.push(`├ ❌ Отменено: ${grandCancelled}`);
    lines.push(`├ 🚫 Неявка: ${grandNoShow}`);
    lines.push(`└ 💵 Общая выручка: *${formatMoney(grandRevenue)} ₸*`);
  }

  return lines.join("\n");
}

function escMd(text) {
  // Escape MarkdownV2 special characters
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

function formatMoney(n) {
  return n.toLocaleString("ru-RU").replace(/\s/g, " ");
}

// ─── Polling for /start command ──────────────────────────────────────────────
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
        const text = msg.text || "";

        if (text === "/start") {
          const ids = loadChatIds();
          if (!ids.includes(chatId)) {
            ids.push(chatId);
            saveChatIds(ids);
            console.log(`New chat registered: ${chatId}`);
          }
          await tgApi("sendMessage", {
            chat_id: chatId,
            text: "✅ Вы подписаны на ежедневные отчёты CRM\\!\n\nОтчёт будет приходить каждый день в 21:30\\.\n\nКоманды:\n/report — получить отчёт за сегодня\n/stop — отписаться",
            parse_mode: "MarkdownV2",
          });
        }

        if (text === "/report") {
          const report = buildDailyReport();
          if (report) {
            await tgApi("sendMessage", { chat_id: chatId, text: report, parse_mode: "MarkdownV2" });
          } else {
            await tgApi("sendMessage", { chat_id: chatId, text: "Нет данных для отчёта\\. Салоны не настроены\\.", parse_mode: "MarkdownV2" });
          }
        }

        if (text === "/stop") {
          const ids = loadChatIds().filter((id) => id !== chatId);
          saveChatIds(ids);
          await tgApi("sendMessage", {
            chat_id: chatId,
            text: "🔕 Вы отписаны от отчётов\\. Отправьте /start чтобы подписаться снова\\.",
            parse_mode: "MarkdownV2",
          });
        }
      }
    }
  } catch (err) {
    console.error("Poll error:", err.message);
  }
}

// ─── Scheduled daily send at 21:30 ──────────────────────────────────────────
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
  const report = buildDailyReport();
  if (!report) {
    console.log("No report data — skipping");
    return;
  }

  const chatIds = loadChatIds();
  if (chatIds.length === 0) {
    console.log("No subscribers — skipping");
    return;
  }

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

// ─── Main ────────────────────────────────────────────────────────────────────
console.log("🤖 CRM Telegram Bot started");
console.log(`   Daily report scheduled at ${SEND_HOUR}:${String(SEND_MINUTE).padStart(2, "0")}`);
console.log("   Send /start to the bot to subscribe\n");

// Poll for messages every 2 seconds
setInterval(pollUpdates, 2000);

// Check schedule every 30 seconds
setInterval(checkSchedule, 30000);

// Initial poll
pollUpdates();
