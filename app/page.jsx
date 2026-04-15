import { db } from "../lib/db.js";
import StockChart from "./StockChart.jsx";

export const revalidate = 300;

async function loadData() {
  const c = db();
  const products = await c.execute(
    `SELECT * FROM products ORDER BY denomination_ngn NULLS LAST`,
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
     WHERE captured_at >= datetime('now','-60 days')
     ORDER BY captured_at ASC`,
  );
  const competitors = await c.execute(`
    SELECT * FROM competitors
    WHERE captured_at >= datetime('now','-7 days')
    ORDER BY denomination_ngn, price_usd
  `);
  return {
    products: products.rows,
    latest: latest.rows,
    history: history.rows,
    competitors: competitors.rows,
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

  const latestMap = Object.fromEntries(
    data.latest.map((r) => [r.product_id, r]),
  );

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 28, marginBottom: 4 }}>
        📈 DexAshkan — iTunes Nigeria
      </h1>
      <p style={{ color: "#888", marginTop: 0 }}>
        Stock y precios. Se actualiza cada 3 días vía Vercel Cron.
      </p>

      {error && (
        <div style={{ background: "#3a1010", padding: 12, borderRadius: 8 }}>
          DB no configurada aún: {error}
        </div>
      )}

      <section style={{ marginTop: 24 }}>
        <h2>Stock actual</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={th}>Denominación</th>
                <th style={th}>Título</th>
                <th style={th}>Precio</th>
                <th style={th}>Stock</th>
                <th style={th}>Vendidos</th>
                <th style={th}>Última captura</th>
              </tr>
            </thead>
            <tbody>
              {data.products.map((p) => {
                const s = latestMap[p.id] || {};
                const stockColor =
                  s.stock === 0
                    ? "#ff6b6b"
                    : s.stock > 10
                    ? "#6bff8e"
                    : "#ffd86b";
                return (
                  <tr key={p.id}>
                    <td style={td}>{p.denomination_ngn ?? "?"} NGN</td>
                    <td style={td}>
                      <a href={p.url} style={{ color: "#77b5ff" }}>
                        {p.title}
                      </a>
                    </td>
                    <td style={td}>${s.price_usd ?? "?"}</td>
                    <td style={{ ...td, color: stockColor, fontWeight: 600 }}>
                      {s.stock ?? "?"}
                    </td>
                    <td style={td}>{s.sold ?? "-"}</td>
                    <td style={td}>
                      {s.captured_at
                        ? new Date(s.captured_at).toLocaleString("es")
                        : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Histórico de stock (60 días)</h2>
        <StockChart history={data.history} products={data.products} />
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Competidores (últimos 7 días)</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={th}>Denominación</th>
                <th style={th}>Vendedor</th>
                <th style={th}>Título</th>
                <th style={th}>Precio</th>
                <th style={th}>Stock</th>
              </tr>
            </thead>
            <tbody>
              {data.competitors.map((c) => (
                <tr key={c.id}>
                  <td style={td}>{c.denomination_ngn ?? "?"} NGN</td>
                  <td style={td}>{c.seller}</td>
                  <td style={td}>
                    <a href={c.url} style={{ color: "#77b5ff" }}>
                      {c.title}
                    </a>
                  </td>
                  <td style={td}>${c.price_usd ?? "?"}</td>
                  <td style={td}>{c.stock ?? "?"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  background: "#13171c",
  borderRadius: 8,
  overflow: "hidden",
};
const th = {
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "1px solid #222",
  background: "#1a1f26",
  fontSize: 13,
  color: "#aaa",
};
const td = {
  padding: "10px 12px",
  borderBottom: "1px solid #1a1f26",
  fontSize: 14,
};
