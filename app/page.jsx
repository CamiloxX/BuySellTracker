import { db } from "../lib/db.js";
import Dashboard from "./Dashboard.jsx";

export const revalidate = 300;
export const dynamic = "force-dynamic";

async function loadData() {
  const c = db();
  const products = await c.execute(
    `SELECT * FROM products ORDER BY denomination_ngn`,
  );
  const latest = await c.execute(`
    SELECT s.* FROM snapshots s
    JOIN (
      SELECT product_id, MAX(captured_at) AS m
      FROM snapshots GROUP BY product_id
    ) last ON last.product_id = s.product_id AND last.m = s.captured_at
  `);
  const history = await c.execute(
    `SELECT product_id, captured_at, stock, price_usd FROM snapshots
     WHERE captured_at >= datetime('now','-90 days')
     ORDER BY captured_at ASC`,
  );
  const competitors = await c.execute(`
    SELECT c.* FROM competitors c
    JOIN (
      SELECT url, MAX(captured_at) AS m FROM competitors
      WHERE captured_at >= datetime('now','-14 days')
      GROUP BY url
    ) last ON last.url = c.url AND last.m = c.captured_at
  `);
  return {
    products: products.rows.map(r => ({...r})),
    latest: latest.rows.map(r => ({...r})),
    history: history.rows.map(r => ({...r})),
    competitors: competitors.rows.map(r => ({...r})),
  };
}

export default async function Page() {
  let data = { products: [], latest: [], history: [], competitors: [] };
  let error = null;
  try {
    data = await loadData();
  } catch (e) {
    error = e.message;
  }

  return <Dashboard data={data} error={error} />;
}
