import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { RouterProvider } from "react-aria-components";
import { vi } from "vitest";

/** Renders `ui` with a fresh query client (no retries) and a spy for React Aria link navigation. */
export function renderWithProviders(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const navigate = vi.fn();
  const result = render(
    <QueryClientProvider client={client}>
      <RouterProvider navigate={navigate}>{ui}</RouterProvider>
    </QueryClientProvider>,
  );
  return { ...result, navigate, client };
}

/** Replaces fetch with a handler keyed on the request URL. */
export function stubApi(handler: (url: URL) => Response | Promise<Response>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => handler(new URL(String(input), "http://app.test")));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
