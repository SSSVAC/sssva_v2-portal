import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SSSVA Portal",
  description: "Supabase-backed finance portal with Zoho Books synchronization"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
