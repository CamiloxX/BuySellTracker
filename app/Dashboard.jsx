"use client";
import { useMemo, useState } from "react";
import StockChart from "./StockChart.jsx";

const fmt = {
  usd: (n) => (n == null ? "—" : `$${Number(n).toFixed(2)}`),
  int: (n) => (n == null ? "—" : Number(n).toLocaleString("es")),
  date: (s) =>
    s ? new Date(s).toLocaleString("es", { dateStyle: "short", timeStyle: "short" }) : "—",
};

const stockPill = (stock) => {
  if (stock == null) return <span className="pill pill-muted">—</span>;
  if (stock === 0) return <span className="pill pill-red">Agotado</span>;
  if (stock <= 3) return <span className="pill pill-yellow">{stock} u.</span>;
  if (stock <= 10) return <span className="pill pill-blue">{stock} u.</span>;
  return <span className="pill pill-green">{stock} u.</span>;
};

function useSortable(rows, defaultKey, defaultDir = "asc") {
  const [key, setKey] = useState(defaultKey);
  const [dir, setDir] = useState(defaultDir);
  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[key], bv = b[key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number") return dir === "asc" ? av - bv : bv - av;
      return dir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return copy;
  }, [rows, key, dir]);
  const toggle = (k) => {
    if (k === key) setDir(dir === "asc" ? "desc" : "asc");
    else { setKey(k); setDir("asc"); }
  };
  const headerClass = (k) => (k === key ? `sort-${dir}` : "");
  return { sorted, toggle, headerClass };
}

export default function Dashboard({ data, error }) {
  const { products, latest, history, competitors } = data;

  const latestMap = useMemo(
    () => Object.fromEntries(latest.map((r) => [r.product_id, r])),
    [latest],
  );

  const myProducts = useMemo(
    () =>
      products.map((p) => {
        const s = latestMap[p.id] || {};
        return {
          ...p,
          price_usd: s.price_usd ?? null,
          stock: s.stock ?? null,
          sold: s.sold ?? null,
          captured_at: s.captured_at ?? null,
          price_per_ngn:
            s.price_usd && p.denomination_ngn
              ? (s.price_usd / p.denomination_ngn) * 1000
              : null,
        };
      }),
    [products, latestMap],
  );

  const bestPriceMap = useMemo(() => {
    const all = [
      ...myProducts.filter((p) => p.price_usd).map((p) => ({ den: p.denomination_ngn, price: p.price_usd })),
      ...competitors.filter((c) => c.price_usd).map((c) => ({ den: c.denomination_ngn, price: c.price_usd })),
    ];
    const map = {};
    for (const r of all) {
      if (!r.den) continue;
      if (!map[r.den] || r.price < map[r.den]) map[r.den] = r.price;
    }
    return map;
  }, [myProducts, competitors]);

  // ===== Selected denomination (global filter) =====
  const [selectedDen, setSelectedDen] = useState(null); // null = all

  const denominationCards = useMemo(() => {
    // One entry per distinct DexAshkan denomination
    const byDen = {};
    for (const p of myProducts) {
      if (!p.denomination_ngn) continue;
      byDen[p.denomination_ngn] = {
        denomination: p.denomination_ngn,
        stock: p.stock ?? 0,
        price: p.price_usd,
        sold: p.sold ?? 0,
        bestPrice: bestPriceMap[p.denomination_ngn],
        isBest: bestPriceMap[p.denomination_ngn] === p.price_usd,
        competitorCount: competitors.filter(
          (c) => c.denomination_ngn === p.denomination_ngn,
        ).length,
      };
    }
    return Object.values(byDen).sort((a, b) => a.denomination - b.denomination);
  }, [myProducts, competitors, bestPriceMap]);

  // ===== Stats =====
  const stats = useMemo(() => {
    const totalUnits = myProducts.reduce((a, p) => a + (p.stock || 0), 0);
    const totalSold = myProducts.reduce((a, p) => a + (p.sold || 0), 0);
    const avgPrice = myProducts.length
      ? myProducts.reduce((a, p) => a + (p.price_usd || 0), 0) / myProducts.length
      : 0;
    const lowStock = myProducts.filter((p) => p.stock > 0 && p.stock <= 5).length;
    const outOfStock = myProducts.filter((p) => p.stock === 0).length;
    const inStock = myProducts.filter((p) => p.stock > 0).length;
    const lastUpdate = myProducts.map((p) => p.captured_at).filter(Boolean).sort().pop();
    const bestDeals = myProducts.filter(
      (p) => p.price_usd && bestPriceMap[p.denomination_ngn] === p.price_usd,
    ).length;
    return { total: myProducts.length, inStock, totalUnits, totalSold, avgPrice, lowStock, outOfStock, lastUpdate, bestDeals };
  }, [myProducts, bestPriceMap]);

  // ===== My products filters =====
  const [myStockFilter, setMyStockFilter] = useState("all");
  const myFiltered = useMemo(() => {
    return myProducts.filter((p) => {
      if (selectedDen != null && p.denomination_ngn !== selectedDen) return false;
      if (myStockFilter === "in") return p.stock > 0;
      if (myStockFilter === "low") return p.stock > 0 && p.stock <= 5;
      if (myStockFilter === "out") return p.stock === 0;
      return true;
    });
  }, [myProducts, myStockFilter, selectedDen]);
  const mySort = useSortable(myFiltered, "denomination_ngn", "asc");

  // ===== Competitors =====
  const [compQuery, setCompQuery] = useState("");
  const [compInStockOnly, setCompInStockOnly] = useState(false);

  const competitorRows = useMemo(() => {
    const rows = competitors.map((c) => ({ ...c, mine: false }));
    const mineRows = myProducts
      .filter((p) => p.price_usd != null)
      .map((p) => ({
        id: `mine-${p.id}`,
        seller: p.seller,
        title: p.title,
        url: p.url,
        denomination_ngn: p.denomination_ngn,
        price_usd: p.price_usd,
        stock: p.stock,
        mine: true,
      }));
    return [...mineRows, ...rows];
  }, [competitors, myProducts]);

  const compFiltered = useMemo(() => {
    return competitorRows.filter((c) => {
      if (selectedDen != null && c.denomination_ngn !== selectedDen) return false;
      if (compInStockOnly && !(c.stock > 0)) return false;
      if (compQuery) {
        const q = compQuery.toLowerCase();
        if (!`${c.seller} ${c.title}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [competitorRows, compInStockOnly, compQuery, selectedDen]);

  const compSort = useSortable(compFiltered, "price_usd", "asc");

  return (
    <div className="container">
      <div className="header">
        <div>
          <h1 className="title">📈 iTunes Nigeria Tracker</h1>
          <p className="subtitle">
            Monitoreo de stock y precios · vendedor principal:{" "}
            <strong style={{ color: "var(--text)" }}>DexAshkan</strong>
          </p>
        </div>
        <div className="badge">
          <span className="badge-dot" />
          Última actualización: {fmt.date(stats.lastUpdate)}
        </div>
      </div>

      {error && <div className="error-banner">⚠️ {error}</div>}

      <div className="stats">
        <div className="stat-card">
          <div className="stat-label">Productos</div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-sub">{stats.inStock} en stock</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Stock total</div>
          <div className="stat-value accent mono">{fmt.int(stats.totalUnits)}</div>
          <div className="stat-sub">unidades disponibles</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Vendidos histórico</div>
          <div className="stat-value green mono">{fmt.int(stats.totalSold)}</div>
          <div className="stat-sub">total acumulado</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Precio promedio</div>
          <div className="stat-value mono">{fmt.usd(stats.avgPrice)}</div>
          <div className="stat-sub">{stats.bestDeals} con mejor precio del mercado</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Alertas</div>
          <div className="stat-value yellow mono">{stats.lowStock}</div>
          <div className="stat-sub">
            stock bajo ·{" "}
            <span style={{ color: "var(--red)" }}>{stats.outOfStock} agotados</span>
          </div>
        </div>
      </div>

      {/* ===== Denomination selector ===== */}
      <div className="section">
        <div className="section-head">
          <h2 className="section-title">💳 Denominaciones</h2>
          <div className="filters">
            <button
              className={`btn ${selectedDen == null ? "active" : ""}`}
              onClick={() => setSelectedDen(null)}
            >
              Ver todas
            </button>
          </div>
        </div>
        <div className="den-grid">
          {denominationCards.map((d) => {
            const active = selectedDen === d.denomination;
            const stockClass =
              d.stock === 0 ? "red" : d.stock <= 5 ? "yellow" : d.stock <= 20 ? "blue" : "green";
            return (
              <button
                key={d.denomination}
                className={`den-card ${active ? "active" : ""}`}
                onClick={() =>
                  setSelectedDen(active ? null : d.denomination)
                }
              >
                <div className="den-top">
                  <span className="den-amount mono">{fmt.int(d.denomination)}</span>
                  <span className="den-unit">NGN</span>
                </div>
                <div className={`den-stock ${stockClass}`}>
                  <strong className="mono">{fmt.int(d.stock)}</strong>
                  <span>unidades</span>
                </div>
                <div className="den-foot">
                  <span className="mono">{fmt.usd(d.price)}</span>
                  {d.isBest && <span className="pill pill-green">Mejor</span>}
                  {!d.isBest && d.bestPrice && (
                    <span className="price-diff">
                      +${(d.price - d.bestPrice).toFixed(2)}
                    </span>
                  )}
                </div>
                <div className="den-meta">
                  <span>🏪 {d.competitorCount} competidores</span>
                  <span>📦 {fmt.int(d.sold)} vendidos</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== DexAshkan table ===== */}
      <div className="section">
        <div className="section-head">
          <h2 className="section-title">
            🎯 Stock DexAshkan
            {selectedDen && (
              <span className="pill pill-blue" style={{ marginLeft: 8 }}>
                Filtrado: {fmt.int(selectedDen)} NGN
              </span>
            )}
          </h2>
          <div className="filters">
            <div className="btn-group">
              {[
                ["all", "Todos"],
                ["in", "En stock"],
                ["low", "Bajo ≤5"],
                ["out", "Agotados"],
              ].map(([k, label]) => (
                <button
                  key={k}
                  className={`btn ${myStockFilter === k ? "active" : ""}`}
                  onClick={() => setMyStockFilter(k)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {mySort.sorted.length === 0 ? (
          <div className="empty">Sin productos con estos filtros.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th onClick={() => mySort.toggle("denomination_ngn")} className={mySort.headerClass("denomination_ngn")}>Denominación</th>
                  <th>Producto</th>
                  <th onClick={() => mySort.toggle("price_usd")} className={mySort.headerClass("price_usd")}>Precio</th>
                  <th onClick={() => mySort.toggle("price_per_ngn")} className={mySort.headerClass("price_per_ngn")}>$/1k NGN</th>
                  <th onClick={() => mySort.toggle("stock")} className={mySort.headerClass("stock")}>Stock</th>
                  <th onClick={() => mySort.toggle("sold")} className={mySort.headerClass("sold")}>Vendidos</th>
                  <th>Actualizado</th>
                </tr>
              </thead>
              <tbody>
                {mySort.sorted.map((p) => {
                  const best = bestPriceMap[p.denomination_ngn];
                  const isBest = best && p.price_usd === best;
                  return (
                    <tr key={p.id}>
                      <td className="mono"><strong>{fmt.int(p.denomination_ngn)}</strong> <span style={{color:"var(--text-mute)"}}>NGN</span></td>
                      <td><a className="link" href={p.url} target="_blank" rel="noreferrer">{p.title}</a></td>
                      <td className="mono">
                        <span className={isBest ? "best-price" : ""}>{fmt.usd(p.price_usd)}</span>
                        {isBest && <span className="pill pill-green" style={{marginLeft:6}}>Mejor</span>}
                      </td>
                      <td className="mono" style={{ color: "var(--text-dim)" }}>
                        {p.price_per_ngn ? `$${p.price_per_ngn.toFixed(3)}` : "—"}
                      </td>
                      <td>{stockPill(p.stock)}</td>
                      <td className="mono">{fmt.int(p.sold)}</td>
                      <td style={{ color: "var(--text-mute)", fontSize: 12 }}>{fmt.date(p.captured_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===== Chart ===== */}
      <div className="section">
        <div className="section-head">
          <h2 className="section-title">
            📊 Histórico
            {selectedDen && (
              <span className="pill pill-blue" style={{ marginLeft: 8 }}>
                {fmt.int(selectedDen)} NGN
              </span>
            )}
          </h2>
        </div>
        <StockChart
          history={history}
          products={products}
          selectedDen={selectedDen}
          myProducts={myProducts}
        />
      </div>

      {/* ===== Competitors ===== */}
      <div className="section">
        <div className="section-head">
          <h2 className="section-title">
            🏆 Comparador de precios
            {selectedDen && (
              <span className="pill pill-blue" style={{ marginLeft: 8 }}>
                {fmt.int(selectedDen)} NGN
              </span>
            )}
          </h2>
          <div className="filters">
            <input
              className="input"
              placeholder="Buscar vendedor o título..."
              value={compQuery}
              onChange={(e) => setCompQuery(e.target.value)}
              style={{ minWidth: 200 }}
            />
            <button
              className={`btn ${compInStockOnly ? "active" : ""}`}
              onClick={() => setCompInStockOnly((v) => !v)}
            >
              Solo con stock
            </button>
          </div>
        </div>

        {compSort.sorted.length === 0 ? (
          <div className="empty">Sin resultados con los filtros actuales.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th onClick={() => compSort.toggle("denomination_ngn")} className={compSort.headerClass("denomination_ngn")}>Denominación</th>
                  <th onClick={() => compSort.toggle("seller")} className={compSort.headerClass("seller")}>Vendedor</th>
                  <th>Producto</th>
                  <th onClick={() => compSort.toggle("price_usd")} className={compSort.headerClass("price_usd")}>Precio</th>
                  <th>Δ vs mejor</th>
                  <th onClick={() => compSort.toggle("stock")} className={compSort.headerClass("stock")}>Stock</th>
                </tr>
              </thead>
              <tbody>
                {compSort.sorted.map((c) => {
                  const best = bestPriceMap[c.denomination_ngn];
                  const diff = best && c.price_usd ? c.price_usd - best : null;
                  const isBest = diff === 0;
                  return (
                    <tr key={c.id}>
                      <td className="mono"><strong>{fmt.int(c.denomination_ngn)}</strong> <span style={{color:"var(--text-mute)"}}>NGN</span></td>
                      <td>
                        <strong style={{ color: c.mine ? "var(--accent)" : "var(--text)" }}>{c.seller}</strong>
                        {c.mine && <span className="pill pill-blue" style={{marginLeft:6}}>DexAshkan</span>}
                      </td>
                      <td><a className="link" href={c.url} target="_blank" rel="noreferrer">{c.title}</a></td>
                      <td className="mono">
                        <span className={isBest ? "best-price" : ""}>{fmt.usd(c.price_usd)}</span>
                        {isBest && <span className="pill pill-green" style={{marginLeft:6}}>Mejor</span>}
                      </td>
                      <td className="mono price-diff">
                        {diff == null ? "—" : diff === 0 ? "—" : `+$${diff.toFixed(2)}`}
                      </td>
                      <td>{stockPill(c.stock)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ textAlign: "center", marginTop: 32, color: "var(--text-mute)", fontSize: 12 }}>
        Datos desde buysellvouchers.com · Actualización automática cada 3 días vía Vercel Cron
      </div>
    </div>
  );
}
