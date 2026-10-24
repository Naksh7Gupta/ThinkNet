import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ThinkNet",
  description: "GUI-driven platform for LLM design, multi-agent workflows, and robotics AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
