// lib/notify.js — Notificador multicanal para las alertas de recarga.
// Cada canal se envía solo si sus variables de entorno están configuradas.
// Ninguna falla detiene a las demás: se capturan y se reporta el resultado.

// Telegram (HTML). Reutiliza el bot ya configurado del proyecto.
async function sendTelegram(html) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return null;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: html,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) throw new Error(`Telegram ${res.status}: ${await res.text()}`);
  return "telegram";
}

// Email vía Resend.
async function sendEmail(subject, text, html, toOverride) {
  const key = process.env.RESEND_API_KEY;
  const to = toOverride || process.env.ALERT_EMAIL;
  if (!key || !to) return null;
  const from = process.env.ALERT_EMAIL_FROM || "Recarga Tracker <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, text, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return "email";
}

// WhatsApp vía CallMeBot (no oficial, ideal para uso personal).
async function sendCallMeBot(text) {
  const phone = process.env.CALLMEBOT_PHONE;
  const apikey = process.env.CALLMEBOT_APIKEY;
  if (!phone || !apikey) return null;
  const url =
    `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}` +
    `&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(apikey)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CallMeBot ${res.status}: ${await res.text()}`);
  return "whatsapp-callmebot";
}

// WhatsApp vía Twilio (oficial).
async function sendTwilio(text) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM; // ej. whatsapp:+14155238886
  const to = process.env.TWILIO_WHATSAPP_TO; // ej. whatsapp:+57300...
  if (!sid || !token || !from || !to) return null;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const body = new URLSearchParams({ From: from, To: to, Body: text });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
  return "whatsapp-twilio";
}

/**
 * Envía la alerta por todos los canales configurados.
 * @param {{subject:string, text:string, html:string}} msg
 * @param {{email?:string}} opts  email destino opcional (sobrescribe ALERT_EMAIL)
 * @returns {Promise<{sent:string[], errors:{channel:string,error:string}[]}>}
 */
export async function sendAlert(msg, opts = {}) {
  const tasks = [
    ["telegram", () => sendTelegram(msg.html)],
    ["email", () => sendEmail(msg.subject, msg.text, msg.html, opts.email)],
    ["whatsapp-callmebot", () => sendCallMeBot(msg.text)],
    ["whatsapp-twilio", () => sendTwilio(msg.text)],
  ];
  const sent = [];
  const errors = [];
  for (const [name, fn] of tasks) {
    try {
      const r = await fn();
      if (r) sent.push(r);
    } catch (e) {
      console.error(`notify:${name}`, e);
      errors.push({ channel: name, error: e.message });
    }
  }
  return { sent, errors };
}
