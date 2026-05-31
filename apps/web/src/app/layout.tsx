import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "applywise | Your job search copilot",
  description: "Find better-fit roles and create stronger applications with an AI-powered job search workspace.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

