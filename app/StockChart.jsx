"use client";
import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const COLORS = [
  "#60a5fa", "#4ade80", "#facc15", "#f87171", "#a78bfa",
  "#fb923c", "#2dd4bf", "#f472b6", "#c084fc",
];

export default function StockChart({ history, products }) {
  const [metric, setMetric] = useState("stock"); // stock | price_usd
  const [range, setRange] = useState(90);

  const data = useMemo(() => {
    if (!history?.length) return [];
    const cutoff = Date.now() - range * 86400000;
    const byTime = {};
    for (const row of history) {
      const t = new Date(row.captured_at).getTime();
      if (t < cutoff) continue;
      const day = String(row.captured_at).slice(0, 10);
      if (!byTime[day]) byTime[day] = { date: day };
      byTime[day][row.product_id] = row[metric];
    }
    return Object.values(byTime).sort((a, b) => a.date.localeCompare(b.date));
  }, [history, metric, range]);

  if (!history?.length)
    return <div className="empty">Sin datos aún. Necesita ≥2 corridas del scraper.</div>;

  return (
    <div>
      <div className="filters" style={{ marginBottom: 16 }}>
        <div className="btn-group">
          <button className={`btn ${metric === "stock" ? "active" : ""}`} onClick={() => setMetric("stock")}>Stock</button>
          <button className={`btn ${metric === "price_usd" ? "active" : ""}`} onClick={() => setMetric("price_usd")}>Precio</button>
        </div>
        <div className="btn-group">
          {[7, 30, 90].map((d) => (
            <button key={d} className={`btn ${range === d ? "active" : ""}`} onClick={() => setRange(d)}>
              {d}d
            </button>
          ))}
        </div>
      </div>
      <div style={{ width: "100%", height: 360 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
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
            {products.map((p, i) => (
              <Line
                key={p.id}
                type="monotone"
                dataKey={p.id}
                name={`${p.denomination_ngn ?? "?"} NGN`}
                stroke={COLORS[i % COLORS.length]}
                dot={false}
                strokeWidth={2}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
