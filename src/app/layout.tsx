import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "PUTOK — the round bread of Hunza",
  description:
    "Putok is the round oven bread of Hunza: white flour, water, salt, fire. Baked before sunrise in Karimabad and delivered to your door with the morning tea.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="grain bg-paper text-ink antialiased">{children}</body>
    </html>
  );
}
