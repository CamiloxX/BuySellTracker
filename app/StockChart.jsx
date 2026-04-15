"use client";
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
  "#77b5ff",
  "#6bff8e",
  "#ffd86b",
  "#ff7ab6",
  "#b57aff",
  "#ff9a6b",
  "#6bfff0",
  "#ff6b6b",
  "#c6ff6b",
];

export default function StockChart({ history, products }) {
  if (!history?.length)
    return <p style={{ color: "#666" }}>Sin datos aún — espera la 1ª corrida.</p>;

  // Group by captured_at (rounded to day)
  const byTime = {};
  for (const row of history) {
    const day = String(row.captured_at).slice(0, 10);
    if (!byTime[day]) byTime[day] = { date: day };
    byTime[day][row.product_id] = row.stock;
  }
  const rows = Object.values(byTime).sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  return (
    <div style={{ width: "100%", height: 380 }}>
      <ResponsiveContainer>
        <LineChart data={rows}>
          <CartesianGrid stroke="#222" />
          <XAxis dataKey="date" stroke="#888" />
          <YAxis stroke="#888" />
          <Tooltip contentStyle={{ background: "#13171c", border: "1px solid #333" }} />
          <Legend />
          {products.map((p, i) => (
            <Line
              key={p.id}
              type="monotone"
              dataKey={p.id}
              name={`${p.denomination_ngn ?? "?"} NGN`}
              stroke={COLORS[i % COLORS.length]}
              dot={false}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
