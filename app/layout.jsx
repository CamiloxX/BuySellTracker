export const metadata = {
  title: "BuySell Tracker — DexAshkan iTunes Nigeria",
  description: "Stock & precios históricos de tarjetas iTunes Nigeria",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#0b0d10",
          color: "#e6e6e6",
        }}
      >
        {children}
      </body>
    </html>
  );
}
