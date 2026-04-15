import axios from "axios";
import * as cheerio from "cheerio";

const BASE = "https://www.buysellvouchers.com";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const http = axios.create({
  baseURL: BASE,
  timeout: 25000,
  headers: { "User-Agent": UA, "Accept-Language": "es,en;q=0.8" },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function parseDenomination(title) {
  const m = title.match(/(\d{2,6})\s*ngn/i);
  return m ? parseInt(m[1], 10) : null;
}

function parsePrice(text) {
  if (!text) return null;
  const m = text.replace(/,/g, "").match(/\$?\s*([0-9]+(?:\.[0-9]+)?)/);
  return m ? parseFloat(m[1]) : null;
}

function productIdFromUrl(url) {
  const m = url.match(/\/view\/[^/]+\/([^/]+)\/?$/);
  return m ? m[1] : url;
}

function absUrl(href) {
  return href.startsWith("http") ? href : BASE + href;
}

/**
 * Parse the listing cards in any page (seller or category).
 * Returns [{id, url, title, price_usd, sold, seller}].
 */
function parseCards(html) {
  const $ = cheerio.load(html);
  const cards = [];
  $("a[href*='/products/view/']").each((_, a) => {
    const $a = $(a);
    const href = $a.attr("href");
    if (!href) return;
    const h3 = $a.find("h3").first().text().trim();
    if (!h3) return; // skip non-card anchors
    const url = absUrl(href);
    const id = productIdFromUrl(url);
    if (cards.find((c) => c.id === id)) return;

    const priceNode = $a
      .find("p.font-bold, p[class*='font-bold']")
      .filter((_, el) => /\$\s*\d/.test($(el).text()))
      .first()
      .text();
    const soldNode = $a
      .find("span")
      .filter((_, el) => /vendid/i.test($(el).text()))
      .first()
      .text();
    const soldMatch = soldNode.match(/([0-9,]+)/);

    // Seller link sits as a sibling of the <a> card
    const sellerLink = $a
      .closest("div")
      .find("a[href*='/seller/info/']")
      .attr("href");
    const sellerMatch = sellerLink?.match(/\/seller\/info\/([^/]+)/);

    cards.push({
      id,
      url,
      title: h3,
      price_usd: parsePrice(priceNode),
      sold: soldMatch ? parseInt(soldMatch[1].replace(/,/g, ""), 10) : null,
      seller: sellerMatch ? sellerMatch[1] : null,
    });
  });
  return cards;
}

/**
 * Seller listing — returns only Nigerian iTunes cards.
 */
export async function scrapeSellerListing(slug) {
  const { data } = await http.get(`/es/seller/info/${slug}/`);
  return parseCards(data)
    .filter((p) => /nigeria|ngn/i.test(p.title))
    .map((p) => ({
      ...p,
      seller: slug,
      denomination_ngn: parseDenomination(p.title),
    }));
}

/**
 * Product detail — authoritative stock count ("<N> disponible").
 */
export async function scrapeProduct(url) {
  const { data } = await http.get(url);
  const $ = cheerio.load(data);

  const title = $("h1").first().text().trim() || null;

  // Stock: main product card has "Disponible: N" (authoritative).
  // Sidebar products use "<N> disponible" — we ignore those.
  let stock = null;
  const mainStock = data.match(/Disponible:\s*<\/?[^>]*>?\s*(\d+)/i)
    || data.match(/>Disponible:\s*(\d+)</i)
    || data.match(/Disponible:\s*(\d+)/);
  if (mainStock) stock = parseInt(mainStock[1], 10);
  // Fallback: qty input max attribute
  if (stock == null) {
    const m = data.match(/<input[^>]+type="text"[^>]+max="(\d+)"/i);
    if (m) stock = parseInt(m[1], 10);
  }
  // Sold: from "Tiempos vendidos: N" next to the stock label.
  const soldMain = data.match(/Tiempos\s+vendidos:\s*(\d+)/i);
  // Price: first "$X.XX" near the top / product summary
  let price_usd = null;
  $("p, span, div").each((_, el) => {
    if (price_usd) return;
    const t = $(el).text().trim();
    if (/^\$\s*\d+(?:\.\d+)?$/.test(t)) price_usd = parsePrice(t);
  });

  const sold = soldMain ? parseInt(soldMain[1], 10) : null;

  // Price: "N.NN USD" next to "Precio total:" on main card, else first "$X.XX"
  const priceMain = data.match(/Precio\s+total:\s*<\/span>\s*<span[^>]*>\s*([0-9.]+)\s*USD/i)
    || data.match(/([0-9]+\.[0-9]+)\s*USD/);
  if (priceMain) {
    const v = parseFloat(priceMain[1]);
    if (!isNaN(v)) var priceOverride = v;
  }

  // Seller: first /seller/info/ link
  const sellerHref = $("a[href*='/seller/info/']").first().attr("href") || "";
  const sellerMatch = sellerHref.match(/\/seller\/info\/([^/]+)/);
  const seller = sellerMatch ? sellerMatch[1] : null;

  return { title, stock, price_usd: priceOverride ?? price_usd, sold, seller };
}

/**
 * Scan Apple gift-card category pages for Nigerian products from any seller.
 */
export async function scrapeCompetitors({ maxPages = 15, ownSeller } = {}) {
  const found = new Map();

  for (let page = 1; page <= maxPages; page++) {
    const path =
      page === 1
        ? "/es/products/list/gift-cards-apple/"
        : `/es/products/list/gift-cards-apple/?page=${page}`;
    let html;
    try {
      ({ data: html } = await http.get(path));
    } catch {
      break;
    }
    const cards = parseCards(html).filter((c) => /nigeria|ngn/i.test(c.title));
    let newHits = 0;
    for (const c of cards) {
      if (found.has(c.id)) continue;
      if (ownSeller && c.seller === ownSeller) continue;
      found.set(c.id, {
        ...c,
        denomination_ngn: parseDenomination(c.title),
      });
      newHits++;
    }
    if (newHits === 0 && page > 3) break;
    await sleep(600);
  }

  // Enrich with stock (listing doesn't expose stock)
  const out = [];
  for (const c of found.values()) {
    try {
      const d = await scrapeProduct(c.url);
      out.push({
        seller: c.seller || d.seller || "unknown",
        title: c.title,
        url: c.url,
        denomination_ngn: c.denomination_ngn,
        price_usd: c.price_usd ?? d.price_usd,
        stock: d.stock,
      });
    } catch {}
    await sleep(400);
  }
  return out;
}
