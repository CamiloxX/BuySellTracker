import { createClient } from "@libsql/client";

let _client;
export function db() {
  if (_client) return _client;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) throw new Error("TURSO_DATABASE_URL missing");
  _client = createClient({ url, authToken });
  return _client;
}

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  seller TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  denomination_ngn INTEGER,
  first_seen TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL,
  captured_at TEXT NOT NULL DEFAULT (datetime('now')),
  price_usd REAL,
  stock INTEGER,
  sold INTEGER,
  FOREIGN KEY(product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_snap_product_time ON snapshots(product_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS competitors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  captured_at TEXT NOT NULL DEFAULT (datetime('now')),
  seller TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  denomination_ngn INTEGER,
  price_usd REAL,
  stock INTEGER
);

CREATE INDEX IF NOT EXISTS idx_comp_time ON competitors(captured_at DESC);
`;

export async function initSchema() {
  const c = db();
  for (const stmt of SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) {
    await c.execute(stmt);
  }
}

export async function upsertProduct(p) {
  await db().execute({
    sql: `INSERT INTO products (id, seller, title, url, denomination_ngn)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title=excluded.title, url=excluded.url,
            denomination_ngn=excluded.denomination_ngn,
            last_seen=datetime('now')`,
    args: [p.id, p.seller, p.title, p.url, p.denomination_ngn ?? null],
  });
}

export async function insertSnapshot(s) {
  await db().execute({
    sql: `INSERT INTO snapshots (product_id, price_usd, stock, sold)
          VALUES (?, ?, ?, ?)`,
    args: [s.product_id, s.price_usd ?? null, s.stock ?? null, s.sold ?? null],
  });
}

export async function insertCompetitor(c) {
  await db().execute({
    sql: `INSERT INTO competitors (seller, title, url, denomination_ngn, price_usd, stock)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [c.seller, c.title, c.url, c.denomination_ngn ?? null, c.price_usd ?? null, c.stock ?? null],
  });
}

export async function lastSnapshotByProduct(productId) {
  const res = await db().execute({
    sql: `SELECT * FROM snapshots WHERE product_id = ? ORDER BY captured_at DESC LIMIT 1 OFFSET 1`,
    args: [productId],
  });
  return res.rows[0] ?? null;
}
