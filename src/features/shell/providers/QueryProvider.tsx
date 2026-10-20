"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useEffect, useState, type ReactNode } from "react";
import { prefetchCatalogs } from "@/data/useServiceData";
import { createQueryClient } from "@/data/query-client";

export function QueryProvider({ children }: { children: ReactNode }) {
  // One client per browser session; created lazily so server renders never share it.
  const [client] = useState(createQueryClient);
  // Once per page load, after the first paint: wake the data services early.
  useEffect(() => prefetchCatalogs(client), [client]);
  return (
    <QueryClientProvider client={client}>
      {children}
      {/* Renders nothing in production builds. */}
      <ReactQueryDevtools buttonPosition="bottom-left" />
    </QueryClientProvider>
  );
}
