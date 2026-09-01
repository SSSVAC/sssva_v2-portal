import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "SSSVA Portal",
  description: "Supabase-backed finance portal with Zoho Books synchronization"
};

// Without this, mobile browsers render at a virtual desktop-width viewport
// and zoom out to fit, so none of globals.css's max-width breakpoints ever
// actually trigger on a real phone.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
