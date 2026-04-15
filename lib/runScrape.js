import {
  scrapeSellerListing,
  scrapeProduct,
  scrapeCompetitors,
} from "./scraper.js";
import {
  initSchema,
  upsertProduct,
  insertSnapshot,
  insertCompetitor,
  lastSnapshotByProduct,
} from "./db.js";
import { sendTelegram, buildAlert } from "./telegram.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function runScrape({ seller, scanCompetitors = true } = {}) {
  const sellerSlug = seller || process.env.SELLER_SLUG || "DexAshkan";
  await initSchema();

  const listing = await scrapeSellerListing(sellerSlug);
  const alerts = [];
  const snapshot = [];

  for (const p of listing) {
    try {
      const detail = await scrapeProduct(p.url);
      await upsertProduct({
        id: p.id,
        seller: sellerSlug,
        title: p.title,
        url: p.url,
        denomination_ngn: p.denomination_ngn,
      });
      const prev = await lastSnapshotByProduct(p.id);
      const curr = {
        product_id: p.id,
        price_usd: p.price_usd ?? detail.price_usd,
        stock: detail.stock,
        sold: p.sold ?? detail.sold,
      };
      await insertSnapshot(curr);
      const alert = buildAlert(p, prev, curr);
      if (alert) alerts.push(alert);
      snapshot.push({ ...p, ...curr });
    } catch (e) {
      console.error("product failed", p.url, e.message);
    }
    await sleep(500);
  }

  let competitors = [];
  if (scanCompetitors) {
    try {
      competitors = await scrapeCompetitors({ ownSeller: sellerSlug });
      for (const c of competitors) await insertCompetitor(c);
    } catch (e) {
      console.error("competitor scan failed:", e.message);
    }
  }

  // Summary message — always send once per run so you know it's alive
  const summary =
    `📊 Reporte ${sellerSlug}\n` +
    snapshot
      .sort((a, b) => (a.denomination_ngn || 0) - (b.denomination_ngn || 0))
      .map(
        (s) =>
          `• ${s.denomination_ngn ?? "?"} NGN — $${s.price_usd ?? "?"} — stock: ${
            s.stock ?? "?"
          }`,
      )
      .join("\n") +
    `\n\nCompetidores escaneados: ${competitors.length}`;

  if (alerts.length) {
    for (const a of alerts) await sendTelegram(a);
  }
  await sendTelegram(summary);

  return { snapshot, competitors, alerts };
}
