import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "MSM Studio", template: "%s | MSM Studio" },
  description: "Marketing Strategy Review report automation for EKWA.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
