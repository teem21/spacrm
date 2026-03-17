// Supabase Edge Function: Telegram CRM Bot
// Handles both webhook messages (/start, /stop, /report) and scheduled daily reports
// Deploy: supabase functions deploy telegram-bot
// Set secrets: supabase secrets set TELEGRAM_BOT_TOKEN=8667376995:AAGrBa2kcOtjS23Bo_eq48_dTEavrphdFgo

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Telegram API helper ──
async function tgSend(method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ── Escape MarkdownV2 ──
function esc(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

function fmtMoney(n: number): string {
  return n.toLocaleString("ru-RU");
}

// ── Build daily report ──
async function buildDailyReport(): Promise<string | null> {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const dateStr = `${yyyy}-${mm}-${dd}`;

  const { data: salons } = await supabase.from("salons").select("*");
  if (!salons || salons.length === 0) return null;

  const { data: bookings } = await supabase
    .from("bookings")
    .select("*")
    .eq("date", dateStr);

  const dayBookings = bookings || [];
  const lines: string[] = [];
  lines.push(`📊 *Отчёт за ${dd}\\.${mm}\\.${yyyy}*`);
  lines.push("");

  let grandTotal = 0, grandClients = 0, grandCompleted = 0;
  let grandCancelled = 0, grandNoShow = 0, grandRevenue = 0;

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
      const segs = b.segments || [];
      const name = segs[0]?.procedureName || "Другое";
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

    grandTotal += sb.length;
    grandClients += clients;
    grandCompleted += completed;
    grandCancelled += cancelRefund.length + cancelNoRefund.length;
    grandNoShow += noShow;
    grandRevenue += revenue;
  }

  if (salons.length > 1) {
    lines.push("━━━━━━━━━━━━━━━━━━━━");
    lines.push("📈 *Итого по всем салонам:*");
    lines.push(`├ Записей: ${grandTotal} \\(${grandClients} чел\\.\\)`);
    lines.push(`├ ✅ Завершено: ${grandCompleted}`);
    lines.push(`├ ❌ Отменено: ${grandCancelled}`);
    lines.push(`├ 🚫 Неявка: ${grandNoShow}`);
    lines.push(`└ 💵 Общая выручка: *${esc(fmtMoney(grandRevenue))} ₸*`);
  }

  return lines.join("\n");
}

// ── Send daily report to all subscribers ──
async function sendDailyReport() {
  const report = await buildDailyReport();
  if (!report) return { sent: 0, reason: "no data" };

  const { data: subs } = await supabase.from("telegram_subscribers").select("chat_id");
  if (!subs || subs.length === 0) return { sent: 0, reason: "no subscribers" };

  let sent = 0;
  for (const sub of subs) {
    try {
      await tgSend("sendMessage", {
        chat_id: sub.chat_id,
        text: report,
        parse_mode: "MarkdownV2",
      });
      sent++;
    } catch (e) {
      console.error(`Failed to send to ${sub.chat_id}:`, e);
    }
  }
  return { sent };
}

// ── Handle Telegram webhook update ──
async function handleWebhook(update: any) {
  const msg = update.message;
  if (!msg) return;

  const chatId = msg.chat.id;
  const text = (msg.text || "").trim();

  if (text === "/start") {
    await supabase.from("telegram_subscribers").upsert({ chat_id: chatId }, { onConflict: "chat_id" });
    await tgSend("sendMessage", {
      chat_id: chatId,
      text: "✅ Вы подписаны на ежедневные отчёты CRM\\!\n\nОтчёт приходит каждый день в 21:30\\.\n\nКоманды:\n/report — отчёт за сегодня\n/stop — отписаться",
      parse_mode: "MarkdownV2",
    });
    return;
  }

  if (text === "/report") {
    const report = await buildDailyReport();
    if (report) {
      await tgSend("sendMessage", { chat_id: chatId, text: report, parse_mode: "MarkdownV2" });
    } else {
      await tgSend("sendMessage", {
        chat_id: chatId,
        text: "Нет данных для отчёта\\. Салоны не настроены\\.",
        parse_mode: "MarkdownV2",
      });
    }
    return;
  }

  if (text === "/stop") {
    await supabase.from("telegram_subscribers").delete().eq("chat_id", chatId);
    await tgSend("sendMessage", {
      chat_id: chatId,
      text: "🔕 Вы отписаны\\. Отправьте /start чтобы подписаться снова\\.",
      parse_mode: "MarkdownV2",
    });
    return;
  }
}

// ── Main handler ──
Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);

    // Scheduled call (from pg_cron or manual trigger)
    if (url.searchParams.get("action") === "daily-report" || req.method === "GET") {
      const result = await sendDailyReport();
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Telegram webhook (POST from Telegram)
    if (req.method === "POST") {
      const body = await req.json();
      await handleWebhook(body);
      return new Response("ok");
    }

    return new Response("CRM Telegram Bot Edge Function", { status: 200 });
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
