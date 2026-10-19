import "server-only";
import { alphaAdapter } from "@/services/alpha/adapter";
import { bravoAdapter } from "@/services/bravo/adapter";
import { charlieAdapter } from "@/services/charlie/adapter";
import type { ServiceId } from "@/services/registry";
import type { ServiceAdapter } from "./adapter-kit";

/** Keyed by every registered service, so a service without an adapter fails to compile. */
export const ADAPTERS: Readonly<Record<ServiceId, ServiceAdapter>> = {
  alpha: alphaAdapter,
  bravo: bravoAdapter,
  charlie: charlieAdapter,
};
