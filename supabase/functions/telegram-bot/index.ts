// Supabase Edge Function: Telegram CRM Bot
// Handles webhook messages, scheduled reports, and real-time notifications from CRM
// Deploy: supabase functions deploy telegram-bot
// Set secrets: supabase secrets set TELEGRAM_BOT_TOKEN=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
// Set webhook: curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<project>.supabase.co/functions/v1/telegram-bot"

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const STATUS_LABEL: Record<string, string> = {
  booked: "Ожидает",
  completed: "Завершено",
  cancelled_refund: "Отменено (возврат)",
  cancelled_no_refund: "Отменено (без возврата)",
  "no-show": "Неявка",
};

// ── Telegram API ──
async function tg(method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ── MarkdownV2 escape ──
function esc(text: string): string {
  return String(text || "").replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

function fmtMoney(n: number): string {
  return n.toLocaleString("ru-RU");
}

function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

// ── Build daily report ──
async function buildDailyReport(): Promise<string | null> {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const [yyyy, mm, dd] = dateStr.split("-");

  const { data: salons } = await supabase.from("salons").select("*");
  if (!salons || salons.length === 0) return null;

  const { data: bookings } = await supabase
    .from("bookings").select("*").eq("date", dateStr);
  const dayBookings = bookings || [];

  const lines: string[] = [];
  lines.push(`📊 *Отчёт за ${dd}\\.${mm}\\.${yyyy}*`);
  lines.push("");

  let gTotal = 0, gClients = 0, gCompleted = 0;
  let gCancelled = 0, gNoShow = 0, gRevenue = 0;

  for (const salon of salons) {
    const sb = dayBookings.filter((b: any) => b.salon_id === salon.id);

    if (sb.length === 0) {
      lines.push(`🏠 *${esc(salon.name)}*: нет записей`);
      lines.push("");
      continue;
    }

    const clients = sb.reduce((s: number, b: any) => s + (b.client_count || 1), 0);
    const booked = sb.filter((b: any) => b.status === "booked").length;
    const completed = sb.filter((b: any) => b.status === "completed").length;
    const cancelRefund = sb.filter((b: any) => b.status === "cancelled_refund");
    const cancelNoRefund = sb.filter((b: any) => b.status === "cancelled_no_refund");
    const noShow = sb.filter((b: any) => b.status === "no-show").length;

    const paid = sb.filter(
      (b: any) => b.status === "completed" || b.status === "no-show" || b.status === "cancelled_no_refund"
    );
    const revenue = paid.reduce((s: number, b: any) => s + (b.total_price || 0), 0);
    const refunded = cancelRefund.reduce((s: number, b: any) => s + (b.total_price || 0), 0);
    const keptDeposit = cancelNoRefund.reduce((s: number, b: any) => s + (b.total_price || 0), 0);

    lines.push(`🏠 *${esc(salon.name)}*`);
    lines.push(`├ Записей: ${sb.length} \\(${clients} чел\\.\\)`);
    lines.push(`├ ✅ Завершено: ${completed}`);
    lines.push(`├ 📋 Ожидают: ${booked}`);
    lines.push(`├ ❌ Отмена \\(возврат\\): ${cancelRefund.length} — ${esc(fmtMoney(refunded))} ₸`);
    lines.push(`├ 💰 Отмена \\(без возврата\\): ${cancelNoRefund.length} — ${esc(fmtMoney(keptDeposit))} ₸`);
    lines.push(`├ 🚫 Неявка: ${noShow}`);
    lines.push(`└ 💵 Выручка: *${esc(fmtMoney(revenue))} ₸*`);
    lines.push("");

    // Top procedures
    const procCounts: Record<string, number> = {};
    sb.forEach((b: any) => {
      const name = (b.segments || [])[0]?.procedureName || "Другое";
      procCounts[name] = (procCounts[name] || 0) + 1;
    });
    const topProcs = Object.entries(procCounts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5);
    if (topProcs.length > 0) {
      lines.push("📋 *Популярные услуги:*");
      topProcs.forEach(([name, count], i) => {
        lines.push(`  ${i + 1}\\. ${esc(name)} — ${count}`);
      });
      lines.push("");
    }

    // Peak hour
    const hourMap: Record<string, number> = {};
    sb.forEach((b: any) => {
      const h = b.total_start_time?.slice(0, 2) || "??";
      hourMap[h] = (hourMap[h] || 0) + 1;
    });
    const busyHours = Object.entries(hourMap).sort(([, a], [, b]) => (b as number) - (a as number));
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
    lines.push(`└ 💵 Общая выручка: *${esc(fmtMoney(gRevenue))} ₸*`);
  }

  return lines.join("\n");
}

// ── Build schedule for a date ──
async function buildSchedule(dateStr: string): Promise<string | null> {
  const [yyyy, mm, dd] = dateStr.split("-");

  const { data: salons } = await supabase.from("salons").select("*");
  if (!salons || salons.length === 0) return null;

  const { data: bookings } = await supabase
    .from("bookings").select("*").eq("date", dateStr)
    .not("status", "in", "(cancelled_refund,cancelled_no_refund)");

  const dayBookings = (bookings || []).sort((a: any, b: any) =>
    (a.total_start_time || "").localeCompare(b.total_start_time || "")
  );

  const lines: string[] = [];
  lines.push(`📅 *Расписание на ${dd}\\.${mm}\\.${yyyy}*`);
  lines.push("");

  let totalCount = 0;
  let totalRevenue = 0;

  for (const salon of salons) {
    const sb = dayBookings.filter((b: any) => b.salon_id === salon.id);
    lines.push(`🏠 *${esc(salon.name)}*`);

    if (sb.length === 0) {
      lines.push("  _Нет записей_");
      lines.push("");
      continue;
    }

    for (const b of sb) {
      const proc = (b.segments || [])[0]?.procedureName || "—";
      const master = b.master_name || "—";
      const status = b.status !== "booked" ? ` \\[${esc(STATUS_LABEL[b.status] || b.status)}\\]` : "";
      lines.push(
        `  ${esc(b.total_start_time)}–${esc(b.total_end_time)} │ ${esc(b.client_name)} │ ${esc(proc)} │ ${esc(master)} │ ${esc(fmtMoney(b.total_price || 0))} ₸${status}`
      );
    }
    lines.push("");

    totalCount += sb.length;
    totalRevenue += sb.reduce((s: number, b: any) => s + (b.total_price || 0), 0);
  }

  lines.push(`📊 Итого: ${totalCount} записей, ${esc(fmtMoney(totalRevenue))} ₸`);
  return lines.join("\n");
}

// ── Format notification messages ──
function formatNewBooking(data: any): string {
  const lines: string[] = [];
  lines.push("📅 *Новая запись*");
  lines.push("");
  if (data.salonName) lines.push(`🏠 ${esc(data.salonName)}`);
  lines.push(`👤 ${esc(data.clientName || "—")}${data.clientPhone ? " │ " + esc(data.clientPhone) : ""}`);
  lines.push(`🕐 ${esc(data.totalStartTime || "")}–${esc(data.totalEndTime || "")} │ ${esc(fmtDate(data.date || ""))}`);
  const proc = data.segments?.[0]?.procedureName || data.procedureName || "—";
  lines.push(`💆 ${esc(proc)}`);
  if (data.masterName) lines.push(`👩 Мастер: ${esc(data.masterName)}`);
  lines.push(`💰 ${esc(fmtMoney(data.totalPrice || 0))} ₸`);
  return lines.join("\n");
}

function formatStatusChange(data: any): string {
  const lines: string[] = [];
  lines.push("🔄 *Статус изменён*");
  lines.push("");
  if (data.salonName) lines.push(`🏠 ${esc(data.salonName)}`);
  lines.push(`👤 ${esc(data.clientName || "—")}`);
  lines.push(`🕐 ${esc(data.totalStartTime || "")} │ ${esc(fmtDate(data.date || ""))}`);
  const oldLabel = STATUS_LABEL[data.oldStatus] || data.oldStatus || "—";
  const newLabel = STATUS_LABEL[data.newStatus] || data.newStatus || "—";
  lines.push(`📋 ${esc(oldLabel)} → ${esc(newLabel)}`);
  return lines.join("\n");
}

function formatDeleteBooking(data: any): string {
  const lines: string[] = [];
  lines.push("🗑 *Запись удалена*");
  lines.push("");
  if (data.salonName) lines.push(`🏠 ${esc(data.salonName)}`);
  lines.push(`👤 ${esc(data.clientName || "—")}`);
  lines.push(`🕐 ${esc(data.totalStartTime || "")} │ ${esc(fmtDate(data.date || ""))}`);
  const proc = data.segments?.[0]?.procedureName || "—";
  lines.push(`💆 ${esc(proc)}`);
  return lines.join("\n");
}

// ── Send to all subscribers ──
async function broadcast(text: string): Promise<{ sent: number }> {
  const { data: subs } = await supabase.from("telegram_subscribers").select("chat_id");
  if (!subs || subs.length === 0) return { sent: 0 };

  let sent = 0;
  for (const sub of subs) {
    try {
      await tg("sendMessage", { chat_id: sub.chat_id, text, parse_mode: "MarkdownV2" });
      sent++;
    } catch (e) {
      console.error(`Failed to send to ${sub.chat_id}:`, e);
    }
  }
  return { sent };
}

// ── Handle notification from CRM app ──
async function handleNotification(payload: any) {
  const { event, data } = payload;
  let text = "";
  if (event === "create") text = formatNewBooking(data);
  else if (event === "status") text = formatStatusChange(data);
  else if (event === "delete") text = formatDeleteBooking(data);
  if (!text) return { sent: 0, reason: "unknown event" };
  return broadcast(text);
}

// ── Handle Telegram webhook ──
async function handleWebhook(update: any) {
  const msg = update.message;
  if (!msg) return;

  const chatId = msg.chat.id;
  const text = (msg.text || "").trim();

  if (text === "/start") {
    await supabase.from("telegram_subscribers").upsert({ chat_id: chatId }, { onConflict: "chat_id" });
    await tg("sendMessage", {
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
    return;
  }

  if (text === "/stop") {
    await supabase.from("telegram_subscribers").delete().eq("chat_id", chatId);
    await tg("sendMessage", {
      chat_id: chatId,
      text: "🔕 Вы отписаны\\. Отправьте /start чтобы подписаться снова\\.",
      parse_mode: "MarkdownV2",
    });
    return;
  }

  if (text === "/report") {
    const report = await buildDailyReport();
    await tg("sendMessage", {
      chat_id: chatId,
      text: report || "Нет данных для отчёта\\.",
      parse_mode: "MarkdownV2",
    });
    return;
  }

  if (text === "/today") {
    const today = new Date().toISOString().slice(0, 10);
    const schedule = await buildSchedule(today);
    await tg("sendMessage", {
      chat_id: chatId,
      text: schedule || "Нет данных\\.",
      parse_mode: "MarkdownV2",
    });
    return;
  }

  if (text === "/tomorrow") {
    const tmr = new Date();
    tmr.setDate(tmr.getDate() + 1);
    const schedule = await buildSchedule(tmr.toISOString().slice(0, 10));
    await tg("sendMessage", {
      chat_id: chatId,
      text: schedule || "Нет данных\\.",
      parse_mode: "MarkdownV2",
    });
    return;
  }
}

// ── Main handler ──
Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    // Scheduled daily report (GET or ?action=daily-report)
    if (url.searchParams.get("action") === "daily-report" || (req.method === "GET" && !url.searchParams.has("action"))) {
      const result = await broadcast(await buildDailyReport() || "Нет данных\\.");
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      const body = await req.json();

      // CRM notification (has "action" field)
      if (body.action === "notify") {
        const result = await handleNotification(body);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Telegram webhook (has "update_id" field)
      if (body.update_id !== undefined) {
        await handleWebhook(body);
        return new Response("ok", { headers: corsHeaders });
      }

      return new Response(JSON.stringify({ error: "unknown payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response("CRM Telegram Bot", { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
