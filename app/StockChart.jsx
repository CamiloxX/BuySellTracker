"use client";
import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";

const COLORS = [
  "#60a5fa", "#4ade80", "#facc15", "#f87171", "#a78bfa",
  "#fb923c", "#2dd4bf", "#f472b6", "#c084fc",
];

export default function StockChart({ history, products, selectedDen, myProducts }) {
  const [metric, setMetric] = useState("stock");
  const [range, setRange] = useState(90);

  const filteredProducts = useMemo(
    () =>
      selectedDen != null
        ? products.filter((p) => p.denomination_ngn === selectedDen)
        : products,
    [products, selectedDen],
  );

  const lineData = useMemo(() => {
    if (!history?.length) return [];
    const cutoff = Date.now() - range * 86400000;
    const allowed = new Set(filteredProducts.map((p) => p.id));
    const byTime = {};
    for (const row of history) {
      if (!allowed.has(row.product_id)) continue;
      const t = new Date(row.captured_at).getTime();
      if (t < cutoff) continue;
      const day = String(row.captured_at).slice(0, 10);
      if (!byTime[day]) byTime[day] = { date: day };
      byTime[day][row.product_id] = row[metric];
    }
    return Object.values(byTime).sort((a, b) => a.date.localeCompare(b.date));
  }, [history, metric, range, filteredProducts]);

  const barData = useMemo(() => {
    return (myProducts || [])
      .filter((p) => (selectedDen != null ? p.denomination_ngn === selectedDen : true))
      .map((p) => ({
        name: `${p.denomination_ngn} NGN`,
        denomination: p.denomination_ngn,
        stock: p.stock ?? 0,
        sold: p.sold ?? 0,
        price: p.price_usd ?? 0,
      }))
      .sort((a, b) => (a.denomination || 0) - (b.denomination || 0));
  }, [myProducts, selectedDen]);

  const enoughHistory = lineData.length >= 2;
  const [view, setView] = useState("auto"); // auto | line | bar

  const showLine = view === "line" || (view === "auto" && enoughHistory);

  if (!history?.length && !barData.length)
    return <div className="empty">Sin datos aún. Ejecuta el scraper.</div>;

  const barColor = (stock) =>
    stock === 0 ? "#f87171" : stock <= 5 ? "#facc15" : stock <= 20 ? "#60a5fa" : "#4ade80";

  return (
    <div>
      <div className="filters" style={{ marginBottom: 16, justifyContent: "space-between", width: "100%" }}>
        <div className="btn-group">
          <button className={`btn ${view === "auto" ? "active" : ""}`} onClick={() => setView("auto")}>Auto</button>
          <button className={`btn ${view === "bar" ? "active" : ""}`} onClick={() => setView("bar")}>Barras (actual)</button>
          <button className={`btn ${view === "line" ? "active" : ""}`} onClick={() => setView("line")}>Línea (histórico)</button>
        </div>
        {showLine && (
          <>
            <div className="btn-group">
              <button className={`btn ${metric === "stock" ? "active" : ""}`} onClick={() => setMetric("stock")}>Stock</button>
              <button className={`btn ${metric === "price_usd" ? "active" : ""}`} onClick={() => setMetric("price_usd")}>Precio</button>
            </div>
            <div className="btn-group">
              {[7, 30, 90].map((d) => (
                <button key={d} className={`btn ${range === d ? "active" : ""}`} onClick={() => setRange(d)}>{d}d</button>
              ))}
            </div>
          </>
        )}
      </div>

      {showLine ? (
        <div style={{ width: "100%", height: 380 }}>
          <ResponsiveContainer>
            <LineChart data={lineData} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid stroke="#1e222c" vertical={false} />
              <XAxis dataKey="date" stroke="#5a6070" tick={{ fontSize: 11 }} />
              <YAxis stroke="#5a6070" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "#12141a",
                  border: "1px solid #1e222c",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "#8b92a1" }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {filteredProducts.map((p, i) => (
                <Line
                  key={p.id}
                  type="monotone"
                  dataKey={p.id}
                  name={`${p.denomination_ngn ?? "?"} NGN`}
                  stroke={COLORS[i % COLORS.length]}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  strokeWidth={2}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          {!enoughHistory && (
            <div style={{ textAlign: "center", color: "var(--text-mute)", fontSize: 12, marginTop: 8 }}>
              Solo hay 1 snapshot — la línea aparecerá cuando corra el scraper nuevamente.
            </div>
          )}
        </div>
      ) : (
        <div style={{ width: "100%", height: 380 }}>
          <ResponsiveContainer>
            <BarChart data={barData} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid stroke="#1e222c" vertical={false} />
              <XAxis dataKey="name" stroke="#5a6070" tick={{ fontSize: 11 }} />
              <YAxis stroke="#5a6070" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "#12141a",
                  border: "1px solid #1e222c",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
              />
              <Bar dataKey="stock" name="Stock actual" radius={[6, 6, 0, 0]}>
                {barData.map((d, i) => (
                  <Cell key={i} fill={barColor(d.stock)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
