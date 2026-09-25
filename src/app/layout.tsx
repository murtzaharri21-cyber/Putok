import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Putok by Azra — Home-made bread from Gulmit Gojal",
  description:
    "Home-made Putok by Azra in Chamangul, Gulmit Gojal. Made with white flour, water and salt, baked in a bukhari heater or oven for 50 to 60 minutes, and enjoyed with Hunza tea.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="grain bg-paper text-ink antialiased">{children}</body>
    </html>
  );
}
