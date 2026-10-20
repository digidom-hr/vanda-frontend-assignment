import type { Metadata, Viewport } from "next";
import { Jost } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";
import { AriaRouterProvider } from "@/components/providers/AriaRouterProvider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { AppShell } from "@/components/shell/AppShell";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "@/styles/globals.css";

// Vanda's typeface: one variable family covers every weight the app uses.
const jost = Jost({
  subsets: ["latin"],
  variable: "--font-jost",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Vanda Timeseries",
    template: "%s – Vanda Timeseries",
  },
  description: "Search, chart and transform timeseries across data services.",
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1824" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    // The init script may set data-theme before React hydrates.
    <html lang="en" className={jost.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <NuqsAdapter>
          <QueryProvider>
            <AriaRouterProvider>
              <AppShell>{children}</AppShell>
            </AriaRouterProvider>
          </QueryProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
