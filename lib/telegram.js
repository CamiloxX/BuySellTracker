export async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn("Telegram not configured, skipping message");
    return;
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) console.error("Telegram error:", await res.text());
}

/**
 * Compare previous and current snapshot for a product and return an alert message (or null).
 */
export function buildAlert(product, prev, curr) {
  const prevStock = prev?.stock ?? null;
  const currStock = curr.stock ?? null;
  const name = `${product.title}`;
  const link = product.url;

  // No alerts on first run (no history to compare)
  if (prev == null) return null;

  // Out of stock
  if (currStock === 0 && prevStock !== 0) {
    return `🔴 <b>AGOTADO</b>\n${name}\n<a href="${link}">Ver producto</a>`;
  }
  // Restock from zero
  if (prevStock === 0 && currStock > 0) {
    return `🟢 <b>REABASTECIDO</b> (+${currStock})\n${name}\nPrecio: $${curr.price_usd}\n<a href="${link}">Comprar</a>`;
  }
  // Significant increase (>=10 units) = refill
  if (prevStock != null && currStock != null && currStock - prevStock >= 10) {
    return `📦 <b>Stock aumentó</b> ${prevStock} → ${currStock}\n${name}\nPrecio: $${curr.price_usd}\n<a href="${link}">Ver</a>`;
  }
  // Low stock warning
  if (currStock != null && currStock > 0 && currStock <= 3 && prevStock > 3) {
    return `⚠️ <b>Stock bajo</b> (${currStock} u.)\n${name}\n<a href="${link}">Ver</a>`;
  }
  return null;
}
