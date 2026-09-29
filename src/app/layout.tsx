import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Right Choice — Stock & Sales",
  description: "Continuous Stock, Sales & End-of-Day Management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
