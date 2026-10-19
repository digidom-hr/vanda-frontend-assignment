import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: {
    default: "Timeseries Dashboard",
    template: "%s · Timeseries Dashboard",
  },
  description: "Analytics dashboard for large collections of timeseries.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
