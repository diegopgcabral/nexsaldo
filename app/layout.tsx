import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "NexSaldo",
  description: "Seu copiloto financeiro pessoal.",
  icons: {
    icon: "/brand/nexsaldo-mark.png",
    apple: "/brand/nexsaldo-mark.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
