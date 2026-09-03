import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/components/toast";
import { THEME_INIT_SCRIPT } from "@/components/shell/theme-toggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "SSSVA Portal",
  description: "Temple finance, reports and function planning.",
  // Share links carry their own tags (see lib/share/link-preview.ts); these
  // are the fallback for any other URL someone pastes into a chat.
  openGraph: {
    siteName: "SSSVA Portal",
    type: "website",
    title: "SSSVA Portal",
    description: "Temple finance, reports and function planning."
  },
  // The portal is entirely behind a sign-in, so there is nothing for a
  // search engine to index and no reason to appear in results.
  robots: { index: false, follow: false }
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
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the stored theme before first paint. Without it a
            dark-mode user sees a white flash on every navigation, because
            the server has no way to know their preference. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
