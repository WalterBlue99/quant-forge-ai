import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QuantForge AI Assistant",
  description: "Source-grounded C++ guidance for QuantForge.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
