import "./globals.css";

export const metadata = {
  title: "BuySell Tracker — iTunes Nigeria",
  description: "Stock & precios históricos de tarjetas iTunes Nigeria",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
