import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { PostHogProvider } from "@/components/providers/posthog";
import "./globals.css";

// Get app URL for metadata, checking multiple sources
function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export const metadata: Metadata = {
  metadataBase: new URL(getAppUrl()),
  title: {
    default: "flow",
    template: "%s | flow",
  },
  description: "flow - Built with Hatch",
  keywords: ["flow", "web app"],
  authors: [{ name: "flow" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "flow",
    title: "flow",
    description: "flow - Built with Hatch",
  },
  twitter: {
    card: "summary_large_image",
    title: "flow",
    description: "flow - Built with Hatch",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <PostHogProvider>{children}</PostHogProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
