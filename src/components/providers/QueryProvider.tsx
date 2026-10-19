"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, type ReactNode } from "react";
import { createQueryClient } from "@/lib/query-client";

export function QueryProvider({ children }: { children: ReactNode }) {
  // One client per browser session; created lazily so server renders never share it.
  const [client] = useState(createQueryClient);
  return (
    <QueryClientProvider client={client}>
      {children}
      {/* Renders nothing in production builds. */}
      <ReactQueryDevtools buttonPosition="bottom-left" />
    </QueryClientProvider>
  );
}
