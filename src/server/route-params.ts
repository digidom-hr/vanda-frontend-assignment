import "server-only";
import { isServiceId, type ServiceId } from "@/services/registry";
import { RequestError } from "./http";

export interface ServiceRouteContext {
  params: Promise<{ service: string }>;
}

/** Resolves the `[service]` route segment, rejecting services that are not registered. */
export async function serviceParam(context: ServiceRouteContext): Promise<ServiceId> {
  const { service } = await context.params;
  if (!isServiceId(service)) throw new RequestError(404, "not_found", `Unknown service: ${service}`);
  return service;
}
