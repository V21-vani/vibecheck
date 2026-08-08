import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VibeCheck — Autonomous Sandboxed QA",
  description: "The zero-config reality check for vibe-coded repos.",
};

// Deliberately using the system font stack (configured in tailwind.config.ts)
// instead of next/font/google — keeps builds fully offline/network-independent,
// fitting for a QA tool that already promises zero external calls.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
